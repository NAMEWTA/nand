import { RuntimeStartup } from '../../../core/pty/runtime-startup';
import type { ContextMaterial } from '../../../core/agent-launch/session-api';
import { agentSessions } from '../../workflows/agent-sessions';
import { pickContextMaterial } from '../../../view/terminal/context-material-picker';
import { TerminalWindowNavigation } from './window-navigation';
import type { CommandAvailability } from '../../../platform/desktop/terminal/command-availability';
import { probeLauncher } from '../../../platform/desktop/terminal/launcher-status';
import { TerminalViewPlaceholder } from './view-placeholder';
import { shell } from 'electron';
import { orderRecentSessions } from '../../../core/pty/recent-sessions';
import { RecentSessionModal } from '../../../view/terminal/recent-session-modal';
import type { View, WorkspaceLeaf } from 'obsidian';
import { FileSystemAdapter, Modal, Notice, Platform, Plugin, normalizePath, setIcon, setTooltip } from 'obsidian';
import { getAgent } from '../../../core/agent-launch/catalog';
import { normalizeAgentSettings } from '../../../core/agent-launch/defaults';
import type { VaultSession, VaultSessionAgent } from '../../../core/ai-vault/types';
import {
	AI_LAUNCHER_CATALOG,
	getAiLauncherEntry,
	getInstallCommandForPlatform,
	getUpgradeCommandForPlatform,
	partitionLaunchers,
	type AiLauncherCatalogEntry,
	type AiLauncherStatus,
} from '../../../core/pty/ai-launcher-catalog';
import {

	readinessToBadge,
	type AiLauncherStatusSnapshot,
} from '../../../core/pty/ai-launcher-status';
import {
	DEFAULT_PRESET_SCRIPTS,
	DEFAULT_TERMINAL_SETTINGS,
	type PresetScript,
	type PresetWorkflowAction,
	type TerminalSettings,
} from '../../../core/pty/settings';
import type { AgentContextBridge } from '../../../platform/desktop/agent-context/agent-context-bridge';
import { isProcessAlive, removeStaleNandIdeLockfiles } from '../../../platform/desktop/agent-context/claude-ide-locks';
import { sessionAge } from '../../../platform/desktop/ai-vault/scope';
import { resolvePluginDirectory } from '../../../platform/desktop/filesystem-paths';
import { getHomeDir } from '../../../platform/desktop/platform';
import { debugLog, errorLog } from '../../../platform/desktop/logger';
import {
	clearCommandVersionCache,
} from '../../../platform/desktop/terminal/command-version-probe';
import {
	clearLatestVersionCache,
} from '../../../platform/desktop/terminal/latest-version-registry';
import type { PtySession } from '../../../platform/desktop/terminal/pty-session';
import type { TerminalService } from '../../../platform/desktop/terminal/terminal-service';
import { refreshLeafTitle } from '../../../platform/obsidian/workspace-title';
import type { LocalizedCommand } from '../../../platform/obsidian/localized-command';
import type { ServerManager } from '../../../platform/terminal-server/server-manager';
import { onLanguageChanged, t as sharedT } from '../../../shared/i18n/index';
import { i18n, t } from '../../../shared/i18n/terminal-accessor';
import { TERMINAL_RIBBON_ICON_ID } from '../../../view/terminal/icons';
import { LauncherInstallModal } from '../../../view/terminal/launcher-install-modal';
import { renderPresetScriptIcon } from '../../../view/terminal/preset-script-icons';
import { PresetScriptModal } from '../../../view/terminal/preset-script-modal';
import type { TerminalInstance } from '../../../view/terminal/runtime/terminal-instance';
import { TerminalRenderers } from '../../../view/terminal/runtime/terminal-renderers';
import { FeatureVisibilityManager } from '../../../view/terminal/settings/feature-visibility-manager';
import { avoidOccupiedTerminalLeaf, getLeafForTerminalRoute } from '../../../view/terminal/terminal-leaf-routing';
import { TERMINAL_VIEW_TYPE, TerminalView } from '../../../view/terminal/terminal-view';
import { TerminalAutomationRuntime } from '../../workflows/agent-runtime';
import {
	isAgentId,
	launchRegisteredAgent,
	refreshRegisteredUsage,
	registerOrca,
	resumeRegisteredSession,
} from '../agents/register';
import { mountNandStatusBarEntry } from './status-bar-entry';

export interface TerminalAgentBridge {
	getBrowserEnvironment?(): Promise<Record<string, string>>;
	readAbsoluteReference(): string | null;
	openAutomations?(): Promise<void>;
	openNotifications?(): void;
}

interface TerminalAgentStore {
	readTerminalAgent(): unknown;
	writeTerminalAgent(data: unknown): Promise<void>;
}

/**
 * Main class for the Obsidian Terminal plugin
 */
export class TerminalAgentController {
	pickContextMaterial(): Promise<ContextMaterial | null> { return pickContextMaterial(this.app); }
	async attachContext(id: string, materials: readonly ContextMaterial[], signal?: AbortSignal): Promise<void> {
		await (await agentSessions(this)).attach(id, materials, signal);
	}
	private automationRuntime?: TerminalAutomationRuntime;
	private startup = new RuntimeStartup();
	getAutomationRuntime(): TerminalAutomationRuntime {
		return this.automationRuntime ?? (this.automationRuntime = new TerminalAutomationRuntime(this));
	}
	private readonly terminalRenderers = new TerminalRenderers();
	private recentSessionIds: string[] = [];
	recordActiveSession(id: string): void {
		const live = new Set(this._terminalService?.getAllTerminals().map((session) => session.id));
		this.recentSessionIds = this.recentSessionIds.filter((key) => key !== id && live.has(key));
		this.recentSessionIds.push(id);
	}
	showSessionSwitcher(view: TerminalView): void {
		const sessions = this._terminalService?.getAllTerminals() ?? [];
		const ordered = orderRecentSessions(sessions, this.recentSessionIds, view.getTerminalInstance()?.id);
		new RecentSessionModal(this.app, ordered, (session) => {
			void view.selectPtySession(session).catch((error: unknown) => new Notice(String(error)));
		}).open();
	}
	getTerminalRenderer(session: PtySession): Promise<TerminalInstance> {
		return this.terminalRenderers.get(session);
	}
	async openAutomationTerminal(id: string): Promise<void> {
		const terminal = (await this.getTerminalService()).getTerminal(id);
		if (!terminal) throw new Error(sharedT('automation.sessionMissing'));
		const existing = this.app.workspace
			.getLeavesOfType(TERMINAL_VIEW_TYPE)
			.find((leaf) => leaf.view instanceof TerminalView && leaf.view.getTerminalInstance()?.id === id);
		if (existing) {
			await this.app.workspace.revealLeaf(existing);
			return;
		}
		const leaf = this.app.workspace.getLeaf('tab');
		this.navigation.restoreOnOpen(leaf, await this.getTerminalRenderer(terminal));
		await leaf.setViewState({ type: TERMINAL_VIEW_TYPE, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	constructor(
		private readonly host: Plugin,
		private readonly bridge: TerminalAgentBridge,
	) {}

	get app(): Plugin['app'] {
		return this.host.app;
	}

	get manifest(): Plugin['manifest'] {
		return this.host.manifest;
	}

	registerView(type: string, leafCreator: (leaf: import('obsidian').WorkspaceLeaf) => import('obsidian').View): void {
		this.host.registerView(type, leafCreator);
	}

	registerEvent<T extends import('obsidian').EventRef>(eventRef: T): T {
		this.host.registerEvent(eventRef);
		return eventRef;
	}

	addCommand(command: LocalizedCommand): import('obsidian').Command {
		return this.host.addCommand(command);
	}

	addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => unknown): HTMLElement {
		return this.host.addRibbonIcon(icon, title, callback);
	}

	addStatusBarItem(): HTMLElement {
		return this.host.addStatusBarItem();
	}

	registerInterval(id: number): number {
		return this.host.registerInterval(id);
	}

	readAbsoluteReference(): string | null {
		return this.bridge.readAbsoluteReference();
	}

	loadData(): Promise<unknown> {
		return Promise.resolve((this.host as Plugin & TerminalAgentStore).readTerminalAgent());
	}

	saveData(data: unknown): Promise<void> {
		return (this.host as Plugin & TerminalAgentStore).writeTerminalAgent(data);
	}

	settings!: TerminalSettings;
	featureVisibilityManager!: FeatureVisibilityManager;

	// Lazily initialized services
	private _serverManager: ServerManager | null = null;
	private _terminalService: TerminalService | null = null;
	private _agentContextBridge: AgentContextBridge | null = null;
	private _active = true;

	// Status bar elements
	private _statusBarItem: HTMLElement | null = null;
	private usageCleanup: (() => void) | null = null;
	private languageCleanup: (() => void) | null = null;
	private _presetScriptsMenuEl: HTMLElement | null = null;
	private _presetScriptsMenuCleanup: (() => void) | null = null;
	private _presetMenuAnchor: DOMRect | null = null;
	private _vaultSessionLoad = 0;
	private _vaultSessionAbort: AbortController | null = null;

	/**
	 * Snapshot of the most recent availability probe result, keyed by the
	 * detect command (e.g. `claude`, `codex`). The status bar menu reads it
	 * synchronously so the "hide unavailable launchers" setting can act on a
	 * known state. The map is refreshed by {@link refreshAiLauncherAvailability}.
	 */

	/**
	 * Combined snapshot per launcher (presetId → snapshot). The snapshot
	 * carries the local version, the upstream "latest" version (when the
	 * user opted in via `checkAiLauncherUpdates`), and the derived readiness
	 * including the new `update-available` state. This is the single source
	 * of truth that both the menu and the install modal consume.
	 */
	private _aiLauncherSnapshots: Map<string, AiLauncherStatusSnapshot> = new Map();
	/**
	 * Listeners notified when a launcher snapshot is updated. The settings
	 * page subscribes so its rows stay in sync when offline mode toggles
	 * or the user opts in to update checks while the page is open.
	 */
	private _aiLauncherSnapshotListeners: Set<(presetId: string, snapshot: AiLauncherStatusSnapshot) => void> =
		new Set();

	// Registered preset script commands
	private registeredPresetScriptCommandIds: Set<string> = new Set();

	/**
	 * Get the server manager (lazy initialization)
	 */
	getServerManager(): Promise<ServerManager> { return this.startup.run('server', () => this.createServerManager()); }
	private async createServerManager(): Promise<ServerManager> {
		if (!this._serverManager) {
			debugLog('[TerminalAgentController] Initializing ServerManager...');

			const { ServerManager } = await import('../../../platform/terminal-server/server-manager');

			const pluginDir = this.getPluginDir();
			const version = this.manifest.version;
			const binaryDownloadConfig = {
				source: this.settings.serverConnection?.binaryDownloadSource ?? 'github-release',
			};
			const offlineMode = this.settings.serverConnection?.offlineMode ?? false;

			this._serverManager = new ServerManager(
				pluginDir,
				version,
				binaryDownloadConfig,
				this.settings.enableDebugLog,
				offlineMode,
				this.manifest.id,
			);

			debugLog('[TerminalAgentController] ServerManager initialized');
		}
		return this._serverManager;
	}

	/**
	 * Get the terminal service (lazy initialization)
	 */
	getTerminalService(): Promise<TerminalService> { return this.startup.run('service', () => this.createTerminalService()); }
	private async createTerminalService(): Promise<TerminalService> {
		await this.initializeAgentContextBridge();

		if (!this._terminalService) {
			debugLog('[TerminalAgentController] Initializing TerminalService...');

			const { TerminalService } = await import('../../../platform/desktop/terminal/terminal-service');

			const serverManager = await this.getServerManager();
			this._terminalService = new TerminalService(
				this.app,
				this.settings,
				serverManager,
				async (session) => ({
					...this._agentContextBridge?.getTerminalEnv(),
					// Resolve at launch time: a restarted bridge has a new endpoint and token.
					...(session?.agentId ? await this.bridge.getBrowserEnvironment?.() : {}),
				}),
				() => this.saveSettings(),
			);

			debugLog('[TerminalAgentController] TerminalService initialized');
		}
		return this._terminalService;
	}

	/**
	 * Called when the plugin loads
	 */
	async onload() {
		// Initialize the i18n service
		i18n.initialize();

		debugLog(t('plugin.loadingMessage'));

		// Load settings
		await this.loadSettings();

		// Set debug mode
		const { setDebugMode } = await import('../../../platform/desktop/logger');
		setDebugMode(this.settings.enableDebugLog);

		// Initialize the feature visibility manager
		this.featureVisibilityManager = new FeatureVisibilityManager(this);

		// Register feature visibility configuration
		this.registerFeatureVisibility();

		// The plugin shell registers the view type so a closed module still has a leaf.

		// Register all commands
		this.registerCommands();
		this.usageCleanup = registerOrca(this);
		this.languageCleanup = onLanguageChanged(() => this.updateStatusBar());

		try {
			this.sweepStaleClaudeIdeLocks();
		} catch (error) {
			errorLog('[TerminalAgentController] Failed to remove stale Claude IDE lockfiles:', error);
		}
		void this.initializeAgentContextBridge().catch((error) => {
			errorLog('[TerminalAgentController] Failed to initialize agent context bridge:', error);
		});

		// Delay UI initialization until the layout is ready whenever possible
		this.app.workspace.onLayoutReady(() => {
			this.initStatusBar();
			if (this.settings.visibility.showInNewTab) {
				this.registerNewTabTerminalAction();
			}
			// Warm up the AI launcher availability snapshot so the first menu
			// open already shows accurate Ready / Not installed badges.
			void this.refreshAiLauncherAvailability().catch((error) => {
				errorLog('[TerminalAgentController] Failed to refresh AI launcher availability:', error);
			});
		});

		// Add the settings tab

		debugLog(t('plugin.loadedMessage'));
	}

	/**
	 * Called when the plugin unloads
	 */
	onunload(): void {
		this._active = false;
		this.languageCleanup?.();
		this.languageCleanup = null;
		this.usageCleanup?.();
		this.usageCleanup = null;
		void this.handleUnload();
	}

	private async handleUnload(): Promise<void> {
		await this.startup.shutdown();
		this.automationRuntime?.dispose();
		debugLog(t('plugin.unloadingMessage'));

		// Stop any in-flight launcher upgrade watchdogs so their poll
		// timers do not outlive the plugin lifecycle.
		for (const presetId of this._upgradeWatchdogTimers.keys()) {
			this.stopUpgradeWatchdog(presetId);
		}

		// Clean up the feature visibility manager
		if (this.featureVisibilityManager) {
			this.featureVisibilityManager.cleanup();
		}

		this.closePresetScriptsMenu();

		// Clean up the terminal service (this automatically cleans up all terminal instances)
		if (this._terminalService) {
			try {
				debugLog('[TerminalAgentController] Shutting down TerminalService...');
				await this._terminalService.shutdown();
				debugLog('[TerminalAgentController] TerminalService stopped');
			} catch (error) {
				errorLog('[TerminalAgentController] Failed to shutdown TerminalService:', error);
			}
		}

		// Stop the server
		if (this._serverManager) {
			try {
				debugLog('[TerminalAgentController] Shutting down ServerManager...');
				await this._serverManager.shutdown();
				debugLog('[TerminalAgentController] ServerManager stopped');
			} catch (error) {
				errorLog('[TerminalAgentController] Failed to stop ServerManager:', error);
			}
		}

		if (this._agentContextBridge) {
			try {
				debugLog('[TerminalAgentController] Shutting down agent context bridge...');
				this._agentContextBridge.stop();
				debugLog('[TerminalAgentController] Agent context bridge stopped');
			} catch (error) {
				errorLog('[TerminalAgentController] Failed to stop agent context bridge:', error);
			}
		}

		debugLog(t('plugin.unloadedMessage'));
	}

	/** Drop lock files left by the removed Claude Code IDE bridge. Never creates the directory. */
	private sweepStaleClaudeIdeLocks(): void {
		if (!Platform.isDesktopApp) return;
		const fs = window.require('fs') as typeof import('fs');
		const path = window.require('path') as typeof import('path');
		removeStaleNandIdeLockfiles(path.join(getHomeDir(), '.claude', 'ide'), {
			readdirSync: (dir) => fs.readdirSync(dir, 'utf8'),
			readFileSync: (file, encoding) => fs.readFileSync(file, encoding),
			unlinkSync: (file) => fs.unlinkSync(file),
			join: (dir, name) => path.join(dir, name),
		}, isProcessAlive);
	}

	private async initializeAgentContextBridge(): Promise<void> {
		if (!this._agentContextBridge) {
			const { AgentContextBridge } = await import('../../../platform/desktop/agent-context/agent-context-bridge');
			this._agentContextBridge = new AgentContextBridge(this.app, this.getPluginDir());
		}

		this._agentContextBridge.start();
	}

	isActive(): boolean {
		return this._active;
	}

	refreshUsage(): void {
		refreshRegisteredUsage(this);
	}

	openHome(): void {
		const owner = this.host as Plugin & { openHome?: () => void };
		owner.openHome?.();
	}

	createLeafView(leaf: WorkspaceLeaf): TerminalView {
		return new TerminalViewPlaceholder(leaf, this);
	}

	noteLocalVersion(presetId: string, version: string | null): void {
		if (!version) return;
		const current = this._aiLauncherSnapshots.get(presetId);
		if (!current) return;
		this.setAiLauncherSnapshot(presetId, {
			...current,
			local: version,
			readiness: current.readiness === 'not-installed' ? 'ready' : current.readiness,
		});
	}

	activate(): void {
		this.startup.open();
		this._active = true;
		this.updateStatusBar();
		refreshRegisteredUsage(this);
	}

	async deactivate(): Promise<void> {
		await this.startup.shutdown();
		this._active = false;
		this._statusBarItem?.toggleClass('is-hidden', true);
		refreshRegisteredUsage(this);
		this.closePresetScriptsMenu();
		if (this._terminalService) {
			try {
				await this._terminalService.shutdown();
			} catch (error) {
				errorLog('[TerminalAgentController] Failed to shutdown TerminalService:', error);
			}
			this._terminalService = null;
		}
		if (this._serverManager) {
			try {
				await this._serverManager.shutdown();
			} catch (error) {
				errorLog('[TerminalAgentController] Failed to stop ServerManager:', error);
			}
			this._serverManager = null;
		}
	}

	/**
	 * Load settings
	 */
	async loadSettings() {
		const loaded = (await this.loadData()) as Partial<TerminalSettings> | null;
		const normalizedPresetScripts = this.normalizePresetScripts(loaded?.presetScripts);
		this.settings = {
			...DEFAULT_TERMINAL_SETTINGS,
			...loaded,
			// Ensure the visibility config exists
			visibility: {
				...DEFAULT_TERMINAL_SETTINGS.visibility,
				...loaded?.visibility,
			},
			// Ensure the serverConnection config exists
			serverConnection: this.normalizeServerConnectionSettings(loaded?.serverConnection),
			// Ensure the presetScripts config exists
			presetScripts: normalizedPresetScripts,
			agentSettings: normalizeAgentSettings(loaded?.agentSettings),
		};
		if (loaded?.preferredRendererMigratedToWebgl !== true) {
			this.settings.preferredRenderer = 'webgl';
			this.settings.preferredRendererMigratedToWebgl = true;
			await this.saveData(this.settings);
		}
	}

	/**
	 * Save settings
	 */
	async saveSettings() {
		this.settings.presetScripts = this.normalizePresetScripts(this.settings.presetScripts);
		this.settings.serverConnection = this.normalizeServerConnectionSettings(this.settings.serverConnection);
		await this.saveData(this.settings);

		// Update debug mode
		const { setDebugMode } = await import('../../../platform/desktop/logger');
		setDebugMode(this.settings.enableDebugLog);

		// Update the ServerManager configuration
		if (this._serverManager) {
			this._serverManager.updateDebugMode(this.settings.enableDebugLog);
			this._serverManager.updateOfflineMode(this.settings.serverConnection.offlineMode);
			this._serverManager.updateBinaryDownloadConfig({
				source: this.settings.serverConnection.binaryDownloadSource,
			});
		}

		// Update terminal service settings
		if (this._terminalService) {
			this._terminalService.updateSettings(this.settings);
		}

		// Register newly added preset script commands
		this.registerPresetScriptCommands();
	}

	private normalizePresetScripts(value: unknown): PresetScript[] {
		const scripts = Array.isArray(value)
			? value.map((script: PresetScript) => this.normalizePresetScript(script))
			: [];
		const existingIds = new Set(scripts.map((script) => script.id));

		// Seed missing built-in workflows. This happens on first install or if a
		// user has deleted a built-in workflow — it's a one-time recovery, not a
		// continuous "reset to defaults". Once seeded, the user's saved version
		// is the source of truth.
		for (const builtInScript of DEFAULT_PRESET_SCRIPTS) {
			if (existingIds.has(builtInScript.id)) {
				continue;
			}

			scripts.push(this.clonePresetScript(builtInScript));
			existingIds.add(builtInScript.id);
		}

		return scripts;
	}

	private clonePresetScript(script: PresetScript): PresetScript {
		return {
			...script,
			actions: script.actions.map((action) => ({ ...action })),
		};
	}

	private normalizeServerConnectionSettings(
		serverConnection: Partial<TerminalSettings['serverConnection']> | null | undefined,
	): TerminalSettings['serverConnection'] {
		return {
			...DEFAULT_TERMINAL_SETTINGS.serverConnection,
			...serverConnection,
			binaryDownloadSource: 'github-release',
			offlineMode: Boolean(serverConnection?.offlineMode),
		};
	}

	/**
	 * Register feature visibility configuration
	 */
	private registerFeatureVisibility(): void {
		this.featureVisibilityManager.registerFeature({
			id: 'terminal',
			getVisibility: () => this.settings.visibility,
			ribbon: {
				icon: TERMINAL_RIBBON_ICON_ID,
				tooltip: t('ribbon.terminalTooltip'),
				callback: () => {
					void this.activateTerminalView();
				},
			},
			onVisibilityChange: () => {
				// Update the terminal button in new tabs when terminal visibility settings change
				this.injectTerminalButtonToEmptyViews();
				// Update the status bar display
				this.updateStatusBar();
			},
		});
	}

	/**
	 * Update feature visibility
	 * Called after settings change
	 */
	updateFeatureVisibility(): void {
		this.featureVisibilityManager.updateAllVisibility();
	}

	/**
	 * Initialize the status bar
	 */
	private initStatusBar(): void {
		this._statusBarItem = this.addStatusBarItem();
		this._statusBarItem.addClass('terminal-status-bar');
		this._statusBarItem.addClass('is-clickable');

		const { iconEl } = mountNandStatusBarEntry(this._statusBarItem, activeDocument);
		setIcon(iconEl, TERMINAL_RIBBON_ICON_ID);

		// Add click handler
		this._statusBarItem.addEventListener('click', (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			this.togglePresetScriptsMenu(event);
		});

		// Context menu: preset scripts
		this._statusBarItem.addEventListener('contextmenu', (event: MouseEvent) => {
			event.preventDefault();
			this.togglePresetScriptsMenu(event);
		});

		// Show or hide based on settings
		this.updateStatusBar();
	}

	/**
	 * Update the status bar visibility
	 */
	private updateStatusBar(): void {
		if (!this._statusBarItem) return;
		const tooltip = t('ribbon.terminalTooltip');
		this._statusBarItem.setAttr('aria-label', tooltip);
		setTooltip(this._statusBarItem, tooltip);

		const shouldShow = this._active && this.settings.visibility.enabled && this.settings.visibility.showInStatusBar;

		this._statusBarItem.toggleClass('is-hidden', !shouldShow);
	}

	async openFreshTerminal(): Promise<void> {
		const view = this.getActiveTerminalView();
		if (view) {
			const initializing = view.isInitializing();
			if (initializing) await view.waitForTerminalInstance();
			if (!initializing || (await this.getTerminalService()).hasPendingSession()) await view.newSession();
			await this.app.workspace.revealLeaf(view.leaf);
			return;
		}
		await this.activateTerminalView(this.getLeafForNewTerminal());
	}
	launchAgent(id: import('../../../core/agent-launch/types').AgentId): Promise<void> {
		return launchRegisteredAgent(this, id);
	}
	resumeSession(session: import('../../../core/ai-vault/types').VaultSession): Promise<void> {
		return resumeRegisteredSession(this, session);
	}
	openAutomationCenter(): Promise<void> {
		return this.bridge.openAutomations?.() ?? Promise.resolve();
	}
	openNotificationCenter(): void {
		this.bridge.openNotifications?.();
	}

	async insertIntoActiveTerminal(text: string): Promise<boolean> {
		let terminalView = this.getActiveTerminalView();
		if (!terminalView) {
			const leaf = this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE)[0];
			await leaf?.loadIfDeferred();
			if (leaf && this.isTerminalView(leaf.view)) terminalView = leaf.view;
		}
		const terminal = await terminalView?.waitForTerminalInstance();
		if (!terminalView || !terminal) {
			new Notice(t('workbench.sessionMissing'));
			return false;
		}
		terminal.write(text);
		this.focusTerminalView(terminalView, terminal);
		return true;
	}

	openSettings(): void {
		const setting = (
			this.app as unknown as {
				setting: { open: () => void; openTabById: (id: string) => void };
			}
		).setting;
		setting.open();
		setting.openTabById(this.manifest.id);
	}

	/**
	 * Activate the terminal view
	 */
	async activateTerminalView(targetLeaf?: WorkspaceLeaf): Promise<void> {
		const { workspace } = this.app;

		if (!targetLeaf) {
			const existing = workspace.getLeavesOfType(TERMINAL_VIEW_TYPE)[0];
			if (existing) {
				await existing.loadIfDeferred();
				await workspace.revealLeaf(existing);
				return;
			}
		}
		const leaf = targetLeaf ?? workspace.getLeaf('tab');

		// If locking new instances is enabled, pin the tab
		if (this.settings.lockNewInstance) {
			leaf.setPinned(true);
		}

		await leaf.setViewState({
			type: TERMINAL_VIEW_TYPE,
			active: this.settings.focusNewInstance,
		});

		// If focusing new instances is enabled, switch to the new tab
		if (this.settings.focusNewInstance) {
			workspace.setActiveLeaf(leaf, { focus: true });
		}
	}

	toggleAlwaysOnTopTerminal(view?: TerminalView | null): Promise<void> { return this.navigation.toggleAlwaysOnTopTerminal(view); }
	getAlwaysOnTopTerminalLabel(view?: TerminalView | null): string { return this.navigation.getAlwaysOnTopTerminalLabel(view); }
	isAlwaysOnTopTerminal(view?: TerminalView | null): boolean { return this.navigation.isAlwaysOnTopTerminal(view); }
	handleTerminalViewClosed(view: TerminalView): void { this.navigation.handleTerminalViewClosed(view); }
	consumePendingRestoredTerminal(leaf: WorkspaceLeaf): TerminalInstance | null { return this.navigation.consumePendingRestoredTerminal(leaf); }
	private _navigation?: TerminalWindowNavigation;
	private get navigation(): TerminalWindowNavigation { return this._navigation ??= new TerminalWindowNavigation(this.app, () => this.getActiveTerminalView(), view => this.isTerminalView(view)); }

	private registerCommands(): void {
		this.addCommand({
			id: 'terminal-quick-switch',
			nameKey: 'terminalAgent.commands.terminalQuickSwitch',
			name: t('commands.terminalQuickSwitch'),
			checkCallback: (checking: boolean) => {
				const view = this.getActiveTerminalView();
				if (!view || !this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) return false;
				if (!checking) this.showSessionSwitcher(view);
				return true;
			},
		});
		// Open terminal
		this.addCommand({
			id: 'open-terminal',
			nameKey: 'terminalAgent.commands.openTerminal',
			name: t('commands.openTerminal'),
			checkCallback: (checking: boolean) => {
				// Check visibility settings
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				if (!checking) {
					void this.activateTerminalView();
				}
				return true;
			},
		});

		this.addCommand({
			id: 'terminal-toggle-always-on-top',
			nameKey: 'terminalAgent.commands.terminalToggleAlwaysOnTop',
			name: t('commands.terminalToggleAlwaysOnTop'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}

				const terminalView = this.getActiveTerminalView();
				if (!terminalView && !this.navigation.trackedLeaf) {
					return false;
				}

				if (!checking) {
					void this.toggleAlwaysOnTopTerminal(terminalView);
				}
				return true;
			},
		});

		// Clear screen
		this.addCommand({
			id: 'terminal-clear',
			nameKey: 'terminalAgent.commands.terminalClear',
			name: t('commands.terminalClear'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				const terminalView = this.getActiveTerminalView();
				const terminal = terminalView?.getTerminalInstance();
				if (terminal) {
					if (!checking) {
						terminal.getXterm().clear();
					}
					return true;
				}
				return false;
			},
		});

		// Copy
		this.addCommand({
			id: 'terminal-copy',
			nameKey: 'terminalAgent.commands.terminalCopy',
			name: t('commands.terminalCopy'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				const terminalView = this.getActiveTerminalView();
				const terminal = terminalView?.getTerminalInstance();
				if (terminal && terminal.getXterm().hasSelection()) {
					if (!checking) {
						const selection = terminal.getXterm().getSelection();
						void navigator.clipboard.writeText(selection).catch((error) => {
							errorLog('[TerminalAgentController] Copy failed:', error);
						});
					}
					return true;
				}
				return false;
			},
		});

		// Paste
		this.addCommand({
			id: 'terminal-paste',
			nameKey: 'terminalAgent.commands.terminalPaste',
			name: t('commands.terminalPaste'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				const terminalView = this.getActiveTerminalView();
				const terminal = terminalView?.getTerminalInstance();
				if (terminal) {
					if (!checking) {
						void terminal.pasteFromClipboard().catch((error) => {
							errorLog('[TerminalAgentController] Paste failed:', error);
						});
					}
					return true;
				}
				return false;
			},
		});

		// Increase font size
		this.addCommand({
			id: 'terminal-font-increase',
			nameKey: 'terminalAgent.commands.terminalFontIncrease',
			name: t('commands.terminalFontIncrease'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				const terminalView = this.getActiveTerminalView();
				const terminal = terminalView?.getTerminalInstance();
				if (terminal) {
					if (!checking) {
						terminal.increaseFontSize();
					}
					return true;
				}
				return false;
			},
		});

		// Decrease font size
		this.addCommand({
			id: 'terminal-font-decrease',
			nameKey: 'terminalAgent.commands.terminalFontDecrease',
			name: t('commands.terminalFontDecrease'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				const terminalView = this.getActiveTerminalView();
				const terminal = terminalView?.getTerminalInstance();
				if (terminal) {
					if (!checking) {
						terminal.decreaseFontSize();
					}
					return true;
				}
				return false;
			},
		});

		// Reset font size
		this.addCommand({
			id: 'terminal-font-reset',
			nameKey: 'terminalAgent.commands.terminalFontReset',
			name: t('commands.terminalFontReset'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				const terminalView = this.getActiveTerminalView();
				const terminal = terminalView?.getTerminalInstance();
				if (terminal) {
					if (!checking) {
						terminal.resetFontSize();
					}
					return true;
				}
				return false;
			},
		});

		// Split horizontally
		this.addCommand({
			id: 'terminal-split-horizontal',
			nameKey: 'terminalAgent.commands.terminalSplitHorizontal',
			name: t('commands.terminalSplitHorizontal'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				const terminalView = this.getActiveTerminalView();
				if (terminalView) {
					if (!checking) {
						void terminalView.splitTerminal('horizontal');
					}
					return true;
				}
				return false;
			},
		});

		// Split vertically
		this.addCommand({
			id: 'terminal-split-vertical',
			nameKey: 'terminalAgent.commands.terminalSplitVertical',
			name: t('commands.terminalSplitVertical'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				const terminalView = this.getActiveTerminalView();
				if (terminalView) {
					if (!checking) {
						void terminalView.splitTerminal('vertical');
					}
					return true;
				}
				return false;
			},
		});

		// Clear buffer
		this.addCommand({
			id: 'terminal-clear-buffer',
			nameKey: 'terminalAgent.commands.terminalClearBuffer',
			name: t('commands.terminalClearBuffer'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}
				const terminalView = this.getActiveTerminalView();
				const terminal = terminalView?.getTerminalInstance();
				if (terminal) {
					if (!checking) {
						terminal.clearBuffer();
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'terminal-send-selection',
			nameKey: 'terminalAgent.commands.terminalSendSelection',
			name: t('commands.terminalSendSelection'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}

				if (!checking) {
					this.sendEditorSelectionToTerminal();
				}

				return true;
			},
		});

		this.addCommand({
			id: 'terminal-send-current-note',
			nameKey: 'terminalAgent.commands.terminalSendCurrentNote',
			name: t('commands.terminalSendCurrentNote'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}

				if (!checking) {
					this.sendCurrentNoteToTerminal();
				}

				return true;
			},
		});

		this.addCommand({
			id: 'terminal-send-current-path',
			nameKey: 'terminalAgent.commands.terminalSendCurrentPath',
			name: t('commands.terminalSendCurrentPath'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}

				if (!checking) {
					this.sendCurrentPathToTerminal();
				}

				return true;
			},
		});

		this.addCommand({
			id: 'terminal-prompt-previous',
			nameKey: 'terminalAgent.commands.terminalPromptPrevious',
			name: t('commands.terminalPromptPrevious'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}

				if (!checking) {
					this.navigateTerminalPrompt('previous');
				}

				return true;
			},
		});

		this.addCommand({
			id: 'terminal-prompt-next',
			nameKey: 'terminalAgent.commands.terminalPromptNext',
			name: t('commands.terminalPromptNext'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}

				if (!checking) {
					this.navigateTerminalPrompt('next');
				}

				return true;
			},
		});

		this.addCommand({
			id: 'terminal-prompt-last-failed',
			nameKey: 'terminalAgent.commands.terminalPromptLastFailed',
			name: t('commands.terminalPromptLastFailed'),
			checkCallback: (checking: boolean) => {
				if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
					return false;
				}

				if (!checking) {
					this.navigateToLastFailedTerminalCommand();
				}

				return true;
			},
		});

		// Register preset script commands
		this.registerPresetScriptCommands();
	}

	private registerPresetScriptCommands(): void {
		const scripts = this.settings.presetScripts ?? [];
		scripts.forEach((script) => {
			const commandId = this.getPresetScriptCommandId(script.id);
			if (this.registeredPresetScriptCommandIds.has(commandId)) return;

			this.registeredPresetScriptCommandIds.add(commandId);

			this.addCommand({
				id: commandId,
				name: `${t('commands.presetScriptPrefix')}${script.name || t('settingsDetails.terminal.presetScriptsUnnamed')}`,
				nameResolver: () =>
					`${t('commands.presetScriptPrefix')}${this.getPresetScriptById(script.id)?.name || t('settingsDetails.terminal.presetScriptsUnnamed')}`,
				checkCallback: (checking: boolean) => {
					if (!this.featureVisibilityManager.isVisibleAt('terminal', 'showInCommandPalette')) {
						return false;
					}
					const currentScript = this.getPresetScriptById(script.id);
					if (!currentScript) return false;
					if (!(currentScript.showInStatusBar ?? true)) {
						return false;
					}
					if (!checking) {
						this.runAiAwarePresetScript(currentScript);
					}
					return true;
				},
			});
		});
	}

	/**
	 * Run a preset script, but route through the install modal when the entry
	 * is a catalog-backed AI launcher whose CLI is not installed. The status
	 * bar menu and the command palette share this path so behaviour stays
	 * consistent across surfaces.
	 */
	private runAiAwarePresetScript(script: PresetScript): void {
		const entry = getAiLauncherEntry(script.id);
		if (entry && entry.detectCommand) {
			const cached = this._aiLauncherSnapshots.get(entry.presetId);
			if (cached?.readiness === 'not-installed') {
				this.openLauncherInstallModal(script, entry, cached);
				return;
			}
			if (cached?.readiness === 'update-available') {
				const local = cached.local ?? '?';
				const latest = cached.latest ?? '?';
				new Notice(
					t('notices.presetScript.launcherUpdateAvailable', {
						name: script.name || entry.presetId,
						local,
						latest,
					}),
					5000,
				);
			}
		}
		this.runPresetScript(script).catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(t('notices.presetScript.runFailed', { message }));
		});
	}

	/**
	 * Get the currently active terminal view
	 */
	private getActiveTerminalView(): TerminalView | null {
		const activeView = this.app.workspace.getActiveViewOfType(TerminalView);

		// Prefer the currently active terminal view
		if (activeView) {
			return activeView;
		}

		// Otherwise return the first terminal view
		const leaves = this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);
		const view = leaves.map((item) => item.view).find((item) => this.isTerminalView(item));
		return view ?? null;
	}

	private getActiveTerminalInstance(): TerminalInstance | null {
		return this.getActiveTerminalView()?.getTerminalInstance() ?? null;
	}

	private focusTerminalView(terminalView: TerminalView, terminal: TerminalInstance): void {
		this.app.workspace.setActiveLeaf(terminalView.leaf, { focus: true });
		terminal.focus();
	}

	private getActiveEditorContext(): {
		editor: { getSelection: () => string; getValue: () => string } | null;
		filePath: string | null;
	} {
		const activeEditor = (
			this.app.workspace as typeof this.app.workspace & {
				activeEditor?: {
					editor?: { getSelection: () => string; getValue: () => string };
					file?: { path: string };
				};
			}
		).activeEditor;

		return {
			editor: activeEditor?.editor ?? null,
			filePath: activeEditor?.file?.path ?? this.app.workspace.getActiveFile()?.path ?? null,
		};
	}

	private sendEditorSelectionToTerminal(): void {
		const terminalView = this.getActiveTerminalView();
		const terminal = terminalView?.getTerminalInstance();
		if (!terminalView || !terminal) {
			new Notice(t('notices.presetScript.terminalUnavailable'));
			return;
		}

		const { editor } = this.getActiveEditorContext();
		const selection = editor?.getSelection()?.trim() ?? '';
		if (!selection) {
			new Notice(t('notices.terminal.selectionRequired'));
			return;
		}

		terminal.pasteText(selection);
		this.focusTerminalView(terminalView, terminal);
	}

	private sendCurrentNoteToTerminal(): void {
		const terminalView = this.getActiveTerminalView();
		const terminal = terminalView?.getTerminalInstance();
		if (!terminalView || !terminal) {
			new Notice(t('notices.presetScript.terminalUnavailable'));
			return;
		}

		const { editor } = this.getActiveEditorContext();
		const noteText = editor?.getValue() ?? '';
		if (!noteText.trim()) {
			new Notice(t('notices.terminal.noteRequired'));
			return;
		}

		terminal.pasteText(noteText);
		this.focusTerminalView(terminalView, terminal);
	}

	private sendCurrentPathToTerminal(): void {
		const terminalView = this.getActiveTerminalView();
		const terminal = terminalView?.getTerminalInstance();
		if (!terminalView || !terminal) {
			new Notice(t('notices.presetScript.terminalUnavailable'));
			return;
		}

		const { filePath } = this.getActiveEditorContext();
		if (!filePath) {
			new Notice(t('notices.terminal.filePathRequired'));
			return;
		}

		terminal.sendText(normalizePath(filePath));
		this.focusTerminalView(terminalView, terminal);
	}

	private navigateTerminalPrompt(direction: 'previous' | 'next'): void {
		const terminal = this.getActiveTerminalInstance();
		if (!terminal) {
			new Notice(t('notices.presetScript.terminalUnavailable'));
			return;
		}

		if (!terminal.navigatePrompt(direction)) {
			new Notice(t('notices.terminal.promptNavigationUnavailable'));
		}
	}

	private navigateToLastFailedTerminalCommand(): void {
		const terminal = this.getActiveTerminalInstance();
		if (!terminal) {
			new Notice(t('notices.presetScript.terminalUnavailable'));
			return;
		}

		if (!terminal.navigateToLastFailedCommand()) {
			new Notice(t('notices.terminal.failedCommandUnavailable'));
		}
	}

	private isTerminalView(view: View | null | undefined): view is TerminalView {
		return view instanceof TerminalView;
	}

	/**
	 * Register the "Open terminal" action in new tabs
	 * Inject a custom button into empty tabs by listening to the layout-change event
	 */
	private registerNewTabTerminalAction(): void {
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.injectTerminalButtonToEmptyViews();
			}),
		);

		// Initial injection
		this.injectTerminalButtonToEmptyViews();
	}

	/**
	 * Inject the "Open terminal" button into all empty tabs
	 * Inject or remove the button based on the showInNewTab setting
	 */
	private injectTerminalButtonToEmptyViews(): void {
		const shouldShow = this.settings.visibility.enabled && this.settings.visibility.showInNewTab;

		// Find all empty views
		const emptyViews = activeDocument.querySelectorAll('.workspace-leaf-content[data-type="empty"] .view-content');

		emptyViews.forEach((emptyView) => {
			const existingButton = emptyView.querySelector('.terminal-plugin-terminal-action');

			if (!shouldShow) {
				// If it should not be shown, remove the existing button
				if (existingButton) {
					existingButton.remove();
				}
				return;
			}

			// Check whether it has already been injected
			if (existingButton) {
				return;
			}

			// Find the actions container
			const actionsContainer = emptyView.querySelector('.empty-state-action-list');
			if (!actionsContainer) {
				return;
			}

			// Create the "Open terminal" button
			const terminalAction = activeDocument.createElement('div');
			terminalAction.className = 'empty-state-action terminal-plugin-terminal-action';
			terminalAction.textContent = t('commands.openTerminal');
			terminalAction.addEventListener('click', () => {
				const leaf = this.findLeafByEmptyView(emptyView);
				void this.activateTerminalView(leaf ?? undefined);
			});

			// Add it to the actions list
			actionsContainer.appendChild(terminalAction);
		});
	}

	/**
	 * Get the leaf to use for a new terminal
	 */
	private getLeafForNewTerminal(): WorkspaceLeaf {
		const routed = getLeafForTerminalRoute(this.app.workspace, this.settings, {
			terminalViewType: TERMINAL_VIEW_TYPE,
			excludedLeaf: this.navigation.trackedLeaf,
		});
		return avoidOccupiedTerminalLeaf(this.app.workspace, routed, (candidate) =>
			this.isTerminalView(candidate.view),
		);
	}

	private getPresetScriptById(scriptId: string): PresetScript | null {
		const scripts = this.settings.presetScripts ?? [];
		return scripts.find((script) => script.id === scriptId) ?? null;
	}

	private findLeafByEmptyView(emptyView: Element): WorkspaceLeaf | null {
		const leaves = this.app.workspace.getLeavesOfType('empty');
		for (const leaf of leaves) {
			const view = leaf.view;
			if (this.hasContentEl(view) && view.contentEl === emptyView) {
				return leaf;
			}
		}
		return null;
	}

	private hasContentEl(view: unknown): view is { contentEl: Element } {
		return typeof view === 'object' && view !== null && 'contentEl' in view;
	}

	private getPresetScriptCommandId(scriptId: string): string {
		return `preset-script-${scriptId}`;
	}

	private createPresetScriptId(): string {
		const random = Math.random().toString(36).slice(2, 8);
		return `preset-${Date.now()}-${random}`;
	}

	private createWorkflowActionId(): string {
		const random = Math.random().toString(36).slice(2, 8);
		return `action-${Date.now()}-${random}`;
	}

	private normalizePresetScript(script: PresetScript): PresetScript {
		const sourceActions = Array.isArray(script.actions) ? script.actions : [];
		const actions = sourceActions
			.map((action) => this.normalizeWorkflowAction(action))
			.filter((action) => action.value.length > 0);

		const normalized: PresetScript = {
			id: (script.id || '').trim(),
			sourceTemplateId:
				typeof script.sourceTemplateId === 'string' && script.sourceTemplateId.trim().length > 0
					? script.sourceTemplateId.trim()
					: undefined,
			name: (script.name || '').trim(),
			icon: (script.icon || '').trim(),
			actions,
			terminalTitle: (script.terminalTitle || '').trim(),
			showInStatusBar: script.showInStatusBar !== false,
			autoOpenTerminal: script.autoOpenTerminal !== false,
			runInNewTerminal: script.runInNewTerminal === true,
		};

		return normalized;
	}

	private normalizeWorkflowAction(action: PresetWorkflowAction): PresetWorkflowAction {
		const rawType = (action?.type || '').trim();
		const type = rawType === 'obsidian-command' || rawType === 'open-external' ? rawType : 'terminal-command';
		const value = (action?.value || '').trim();
		const id = (action?.id || '').trim() || this.createWorkflowActionId();
		const enabled = action?.enabled !== false;
		const note = typeof action?.note === 'string' ? action.note.trim() : '';
		return { id, type, value, enabled, note };
	}

	private openPresetScriptCreateModal(): void {
		const scripts = this.settings.presetScripts ?? [];
		let newId = this.createPresetScriptId();
		while (scripts.some((script) => script.id === newId)) {
			newId = this.createPresetScriptId();
		}
		const newScript: PresetScript = {
			id: newId,
			name: '',
			icon: '',
			actions: [
				{
					id: this.createWorkflowActionId(),
					type: 'terminal-command',
					value: '',
					enabled: true,
					note: '',
				},
			],
			terminalTitle: '',
			showInStatusBar: true,
			autoOpenTerminal: true,
			runInNewTerminal: false,
		};
		const modal = new PresetScriptModal(
			this.app,
			newScript,
			(updatedScript: PresetScript) => {
				scripts.push(updatedScript);
				this.settings.presetScripts = scripts;
				void this.saveSettings();
			},
			true,
		);
		modal.open();
	}

	private openPresetScriptEditModal(script: PresetScript): void {
		const clone = this.clonePresetScript(script);
		const modal = new PresetScriptModal(
			this.app,
			clone,
			(updatedScript: PresetScript) => {
				const scripts = this.settings.presetScripts ?? [];
				const index = scripts.findIndex((item) => item.id === updatedScript.id);
				if (index >= 0) {
					scripts[index] = updatedScript;
				}
				this.settings.presetScripts = scripts;
				void this.saveSettings();
			},
			false,
		);
		modal.open();
	}

	private buildPresetScriptTooltip(script: PresetScript): string {
		const name = script.name?.trim() || t('settingsDetails.terminal.presetScriptsUnnamed');
		const actions = Array.isArray(script.actions) ? script.actions : [];
		const enabledActions = actions.filter((action) => action.enabled !== false);

		if (enabledActions.length === 0) {
			return name;
		}

		const lines = enabledActions.map((action) => {
			const prefix =
				action.type === 'obsidian-command' ? 'Obsidian' : action.type === 'open-external' ? 'URL' : 'Terminal';
			const value = (action.value ?? '').trim();
			return value ? `${prefix}: ${value}` : prefix;
		});

		return `${name}\n${lines.join('\n')}`;
	}

	private confirmAndDeletePresetScript(scriptId: string, scriptName: string): void {
		const modal = new Modal(this.app);
		modal.titleEl.setText(t('common.confirm'));
		modal.contentEl.createEl('p', {
			text: t('settingsDetails.terminal.presetScriptsDeleteConfirm', { name: scriptName }),
		});
		const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
		const cancelBtn = buttonContainer.createEl('button', { cls: 'mod-cancel', text: t('common.cancel') });
		cancelBtn.addEventListener('click', () => modal.close());
		const confirmBtn = buttonContainer.createEl('button', { cls: 'mod-cta', text: t('common.confirm') });
		confirmBtn.addEventListener('click', () => {
			modal.close();
			this.settings.presetScripts = (this.settings.presetScripts ?? []).filter((s) => s.id !== scriptId);
			void this.saveSettings();
		});
		modal.open();
	}

	private togglePresetScriptsMenu(event: MouseEvent): void {
		if (this._presetScriptsMenuEl) {
			this.closePresetScriptsMenu();
			return;
		}
		// Kick off a background availability refresh — the menu still renders
		// immediately using the most recent snapshot; the badges update in place
		// once new probe results arrive.
		void this.refreshAiLauncherAvailability();
		const anchorRect = this._statusBarItem?.getBoundingClientRect();
		if (anchorRect) {
			this.showPresetScriptsMenuAtRect(anchorRect);
		} else {
			this.showPresetScriptsMenuAtPoint(event.clientX, event.clientY);
		}
	}

	private showPresetScriptsMenuAtPoint(x: number, y: number): void {
		this.openPresetScriptsMenu(new DOMRect(x, y, 0, 0));
	}

	private showPresetScriptsMenuAtRect(rect: DOMRect): void {
		this.openPresetScriptsMenu(rect);
	}

	private openPresetScriptsMenu(anchor: DOMRect): void {
		const menu = this.buildPresetScriptsMenu();
		if (!menu) return;
		menu.addClass('is-measuring');
		this.mountPresetScriptsMenu(menu);
		this._presetMenuAnchor = anchor;
		this.refreshVaultSessionSection();
		this.placePresetScriptsMenu(menu, anchor);
		menu.removeClass('is-measuring');
	}

	private placePresetScriptsMenu(menu: HTMLElement, anchor: DOMRect): void {
		const menuRect = menu.getBoundingClientRect();
		let top = anchor.top - menuRect.height - 8;
		if (top < 8) top = anchor.bottom + 8;
		let left = anchor.left;
		if (left + menuRect.width > window.innerWidth - 8) {
			left = window.innerWidth - menuRect.width - 8;
		}
		if (left < 8) left = 8;
		if (top + menuRect.height > window.innerHeight - 8) {
			top = Math.max(8, window.innerHeight - menuRect.height - 8);
		}
		menu.setCssStyles({ top: `${top}px`, left: `${left}px` });
	}

	private repositionPresetScriptsMenu(): void {
		const menu = this._presetScriptsMenuEl;
		const anchor = this._presetMenuAnchor;
		if (!menu || !anchor) return;
		this.placePresetScriptsMenu(menu, anchor);
	}

	private mountPresetScriptsMenu(menu: HTMLElement): void {
		this.closePresetScriptsMenu();
		activeDocument.body.appendChild(menu);
		this._presetScriptsMenuEl = menu;

		const onOutsideClick = (event: MouseEvent) => {
			if (!menu.contains(event.target as Node)) {
				this.closePresetScriptsMenu();
			}
		};
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				this.closePresetScriptsMenu();
			}
		};
		activeDocument.addEventListener('mousedown', onOutsideClick, true);
		activeDocument.addEventListener('keydown', onKeydown, true);
		this._presetScriptsMenuCleanup = () => {
			activeDocument.removeEventListener('mousedown', onOutsideClick, true);
			activeDocument.removeEventListener('keydown', onKeydown, true);
		};
	}

	private buildPresetScriptsMenu(): HTMLElement | null {
		const scripts = this.settings.presetScripts ?? [];
		const visibleScripts = scripts.filter((script) => script.showInStatusBar ?? true);
		const hideUnavailable = this.settings.hideUnavailableAiLaunchers === true;
		const menu = activeDocument.createElement('div');
		menu.className = 'preset-scripts-menu';
		menu.setAttribute('role', 'menu');

		const listEl = activeDocument.createElement('div');
		listEl.className = 'preset-scripts-menu-list';
		listEl.setAttribute('role', 'none');

		// Partition the visible scripts into the AI launcher catalog buckets
		// and the leftover "regular" workflows. The catalog buckets render
		// grouped sections with readiness badges, while regular workflows
		// keep their original drag-and-drop reorderable behavior.
		const partition = partitionLaunchers(visibleScripts);

		// Apply the user's "hide unavailable launchers" preference. We never
		// hide a launcher whose status is still 'unknown' — the menu shows it
		// as "Checking…" so the user still sees something during the very
		// first probe.
		const filterAvailable = (script: PresetScript): boolean => {
			if (!hideUnavailable) return true;
			const snapshot = this._aiLauncherSnapshots.get(script.id);
			// We never hide a launcher whose status is still 'unknown' — the
			// menu shows it as "Checking…" so the user still sees something.
			return snapshot?.readiness !== 'not-installed';
		};

		const codingAgentScripts = partition.codingAgent.filter(filterAvailable);
		const regularScripts = partition.regular;

		if (codingAgentScripts.length > 0) {
			this.appendPresetMenuSection(listEl, t('settingsDetails.terminal.aiLauncherCategoryCodingAgent'));
			for (const script of codingAgentScripts) {
				const entry = getAiLauncherEntry(script.id);
				if (!entry) continue;
				listEl.appendChild(this.createAiLauncherMenuItem(script, entry));
			}
		}

		this.appendPresetMenuSection(listEl, t('sessions.heading'));
		const sessionHost = activeDocument.createElement('div');
		sessionHost.className = 'preset-scripts-menu-sessions';
		listEl.appendChild(sessionHost);

		if (regularScripts.length > 0) {
			this.appendPresetMenuSection(listEl, t('menu.workflows'));
			this.appendRegularPresetMenuItems(listEl, regularScripts);
		}

		menu.appendChild(listEl);

		const footerEl = activeDocument.createElement('div');
		footerEl.className = 'preset-scripts-menu-footer';

		const addItem = activeDocument.createElement('div');
		addItem.className = 'preset-scripts-menu-item preset-scripts-menu-add';
		addItem.setAttribute('role', 'menuitem');
		addItem.textContent = `+ ${t('settingsDetails.terminal.presetScriptsAddMenu')}`;
		addItem.addEventListener('click', () => {
			this.closePresetScriptsMenu();
			this.openPresetScriptCreateModal();
		});
		footerEl.appendChild(addItem);
		menu.appendChild(footerEl);

		return menu;
	}

	/**
	 * Public hook used by the settings renderer when the user flips the
	 * "Check for AI launcher updates" toggle. Re-runs the snapshot pipeline
	 * so badges in the status bar menu reflect the new policy on the very
	 * next open without waiting for the user to click again.
	 *
	 * Pass `force: true` to drop the in-memory caches first. The toggle
	 * itself does not need this, but turning offline mode OFF does — any
	 * registry lookup we did while offline returned an error and got
	 * cached for 12 hours, so without a force-clear the badges would
	 * still show "no latest version known" until the TTL elapses.
	 */
	async refreshAiLauncherStatusFromSettings(options: { force?: boolean } = {}): Promise<void> {
		try {
			if (options.force) {
				clearLatestVersionCache();
				for (const entry of AI_LAUNCHER_CATALOG) {
					if (entry.detectCommand) {
						clearCommandVersionCache(entry.detectCommand);
					}
				}
			}
			await this.refreshAiLauncherAvailability();
		} catch (error) {
			errorLog('[TerminalAgentController] Failed to refresh AI launcher status:', error);
		}
	}

	/**
	 * Read the most recent cached snapshot for an AI launcher preset. Returns
	 * undefined when the preset is unknown or no probe has resolved yet.
	 * Exposed so the settings page can render the same readiness + version
	 * info that the status bar menu uses, without re-running its own probes.
	 */
	getAiLauncherSnapshot(presetId: string): AiLauncherStatusSnapshot | undefined {
		return this._aiLauncherSnapshots.get(presetId);
	}

	/**
	 * Subscribe to launcher snapshot updates. The listener fires every
	 * time {@link setAiLauncherSnapshot} writes a new snapshot — i.e.
	 * whenever any probe (PATH, version, registry) settles. Used by the
	 * settings page to keep its rows fresh when the user toggles offline
	 * mode or opts in to update checks while the page is open.
	 *
	 * Returns an unsubscribe function. Callers MUST call it when their
	 * DOM is torn down so we do not leak listeners across re-renders.
	 */
	onAiLauncherSnapshotsChanged(listener: (presetId: string, snapshot: AiLauncherStatusSnapshot) => void): () => void {
		this._aiLauncherSnapshotListeners.add(listener);
		return () => {
			this._aiLauncherSnapshotListeners.delete(listener);
		};
	}

	/**
	 * Single write site for {@link _aiLauncherSnapshots}. Updates the map
	 * and fans the new value out to every registered listener so any open
	 * surface (settings page rows, in-flight menu render) can re-paint
	 * without polling.
	 */
	private setAiLauncherSnapshot(presetId: string, snapshot: AiLauncherStatusSnapshot): void {
		this._aiLauncherSnapshots.set(presetId, snapshot);
		for (const listener of this._aiLauncherSnapshotListeners) {
			try {
				listener(presetId, snapshot);
			} catch (error) {
				errorLog('[TerminalAgentController] AI launcher snapshot listener threw:', error);
			}
		}
	}

	/**
	 * Re-run the probe pipeline for a single launcher and return the fresh
	 * snapshot. Public wrapper around {@link refreshSingleLauncherSnapshot}
	 * so the settings page can refresh one row in place after the cached
	 * snapshot is shown.
	 */
	async refreshAiLauncherSnapshot(entry: AiLauncherCatalogEntry): Promise<AiLauncherStatusSnapshot | null> {
		return this.refreshSingleLauncherSnapshot(entry);
	}

	/**
	 * Open the launcher install/upgrade modal for the given preset. Public
	 * entry point for the settings page so rows there can offer the same
	 * "Update now" affordance the status bar menu does.
	 *
	 * Returns false when the preset is not a catalogued AI launcher (or
	 * has no detect command) — callers should fall through to whatever
	 * default action makes sense for a regular workflow row.
	 */
	openAiLauncherUpgradeModalForPreset(script: PresetScript): boolean {
		const entry = getAiLauncherEntry(script.id);
		if (!entry || !entry.detectCommand) return false;
		const snapshot = this._aiLauncherSnapshots.get(entry.presetId) ?? null;
		this.openLauncherInstallModal(script, entry, snapshot);
		return true;
	}

	/**
	 * Refresh the AI launcher status snapshot in the background. The menu reads
	 * {@link _aiLauncherSnapshots} synchronously when rendering; this method
	 * keeps it warm so the very first menu open already has a meaningful
	 * answer for most launchers.
	 *
	 * Pipeline per launcher:
	 *   1. PATH probe (`where` / `which`) — always runs, zero network.
	 *   2. Local `--version` probe — always runs, zero network. Falls back to
	 *      well-known directories when PATH is sparse.
	 *   3. Remote latest-version lookup — only runs when the user enabled
	 *      `checkAiLauncherUpdates`. Off by default so the README's "no
	 *      extra outbound traffic" promise holds out of the box.
	 */
	private async refreshAiLauncherAvailability(): Promise<void> {
		await Promise.all(AI_LAUNCHER_CATALOG.map(entry => this.refreshSingleLauncherSnapshot(entry)));
	}

	/**
	 * Render a section header inside the preset scripts menu. Used to label
	 * the "Coding agent" bucket.
	 */
	private appendPresetMenuSection(listEl: HTMLElement, title: string): void {
		const header = activeDocument.createElement('div');
		header.className = 'preset-scripts-menu-section-header';
		header.setAttribute('role', 'presentation');
		const titleEl = activeDocument.createElement('div');
		titleEl.className = 'preset-scripts-menu-section-title';
		titleEl.textContent = title;
		header.appendChild(titleEl);
		listEl.appendChild(header);
	}

	private refreshVaultSessionSection(): void {
		const menu = this._presetScriptsMenuEl;
		const host = menu?.querySelector<HTMLElement>('.preset-scripts-menu-sessions');
		if (!menu || !host) return;
		this._vaultSessionAbort?.abort();
		const abort = (this._vaultSessionAbort = new AbortController());
		this.renderVaultSessionLoading(host);
		const token = this._vaultSessionLoad;
		void (async () => {
			const service = await this.getTerminalService();
			const history = service.history(() => this.settings.agentSettings, this.manifest.dir ?? '');
			await history.scan(abort.signal);
			const page = await history.query('', 0, abort.signal, 'active');
			return page.rows.slice(0, 20).map((session): VaultSession => ({
				...session,
				agentId: session.agentId as VaultSessionAgent,
				title: history.meta(session.key).title || session.title,
				env: JSON.parse(session.accountKey) as Record<string, string>,
			}));
		})()
			.then((sessions) => {
				if (token !== this._vaultSessionLoad || this._presetScriptsMenuEl !== menu) return;
				this.renderVaultSessionRows(host, sessions);
				this.repositionPresetScriptsMenu();
			})
			.catch((error) => {
				if (abort.signal.aborted) return;
				errorLog('[TerminalAgentController] Failed to read vault sessions:', error);
				if (token !== this._vaultSessionLoad || this._presetScriptsMenuEl !== menu) return;
				this.renderVaultSessionRows(host, []);
				this.repositionPresetScriptsMenu();
			});
	}

	private renderVaultSessionLoading(host: HTMLElement): void {
		host.replaceChildren();
		const row = activeDocument.createElement('div');
		row.className = 'preset-scripts-menu-item is-disabled';
		row.textContent = t('sessions.loading');
		host.appendChild(row);
	}

	private renderVaultSessionRows(host: HTMLElement, sessions: readonly VaultSession[]): void {
		host.replaceChildren();
		if (sessions.length === 0) {
			const row = activeDocument.createElement('div');
			row.className = 'preset-scripts-menu-item is-disabled';
			row.textContent = t('sessions.empty');
			host.appendChild(row);
			return;
		}
		for (const session of sessions) {
			host.appendChild(this.createVaultSessionMenuItem(session));
		}
	}

	private createVaultSessionMenuItem(session: VaultSession): HTMLElement {
		const item = activeDocument.createElement('div');
		item.className = 'preset-scripts-menu-item preset-scripts-menu-session';
		item.setAttribute('role', 'menuitem');

		const iconEl = activeDocument.createElement('div');
		iconEl.className = 'preset-scripts-menu-icon';
		renderPresetScriptIcon(iconEl, getAgent(session.agentId).icon || 'terminal');
		item.appendChild(iconEl);

		const labelEl = activeDocument.createElement('div');
		labelEl.className = 'preset-scripts-menu-label';
		labelEl.textContent = session.title;
		item.appendChild(labelEl);

		const meta = activeDocument.createElement('span');
		meta.className = 'preset-scripts-menu-session-meta';
		meta.textContent = this.formatSessionAge(session.modifiedAtMs);
		item.appendChild(meta);

		const agentTitle = getAgent(session.agentId).title;
		setTooltip(item, `${agentTitle}\n${session.cwd}`, {
			placement: 'top',
			classes: ['preset-script-tooltip'],
		});

		item.addEventListener('click', () => {
			this.closePresetScriptsMenu();
			void resumeRegisteredSession(this, session).catch((error) => {
				const message = error instanceof Error ? error.message : String(error);
				new Notice(t('sessions.resumeFailed', { message }));
			});
		});
		return item;
	}

	private formatSessionAge(modifiedAtMs: number): string {
		const age = sessionAge(modifiedAtMs, Date.now());
		if (age.kind === 'now') return t('sessions.justNow');
		if (age.kind === 'minutes') return t('sessions.minutesAgo', { count: age.count });
		if (age.kind === 'hours') return t('sessions.hoursAgo', { count: age.count });
		return t('sessions.daysAgo', { count: age.count });
	}

	/**
	 * Build a menu row for a real catalog-backed AI launcher. The row shows a
	 * readiness badge ("Ready" / "Not installed") and routes the click to either
	 * the regular preset runner or the install-guidance modal.
	 */
	private createAiLauncherMenuItem(script: PresetScript, entry: AiLauncherCatalogEntry): HTMLElement {
		const item = activeDocument.createElement('div');
		item.className = 'preset-scripts-menu-item preset-scripts-menu-launcher';
		item.setAttribute('role', 'menuitem');
		item.dataset.scriptId = script.id;
		item.dataset.launcherCategory = entry.category;

		const iconEl = activeDocument.createElement('div');
		iconEl.className = 'preset-scripts-menu-icon';
		renderPresetScriptIcon(iconEl, script.icon || 'terminal');
		item.appendChild(iconEl);

		const labelEl = activeDocument.createElement('div');
		labelEl.className = 'preset-scripts-menu-label';
		labelEl.textContent = script.name || t('settingsDetails.terminal.presetScriptsUnnamed');
		item.appendChild(labelEl);

		// Pull the cached snapshot when available so re-opens don't flash
		// through "Checking…" on every click.
		const cachedSnapshot = this._aiLauncherSnapshots.get(entry.presetId);
		const initialBadgeStatus: AiLauncherStatus = cachedSnapshot
			? readinessToBadge(cachedSnapshot.readiness)
			: entry.detectCommand
				? 'checking'
				: 'ready';
		const badge = this.createLauncherStatusBadge(initialBadgeStatus, true);
		item.appendChild(badge);
		if (cachedSnapshot) {
			item.dataset.availability = cachedSnapshot.readiness;
		}

		// Version info stays in the tooltip only for this surface — the menu
		// row is already crowded with icon + label + status badge, so the
		// inline label lives on the settings page where there is more room.

		setTooltip(item, this.launcherMenuTooltip(script, cachedSnapshot, initialBadgeStatus), {
			placement: 'top',
			classes: ['preset-script-tooltip'],
		});

		// Mutable holder so the click handler always sees the freshest
		// snapshot, even after the async refresh below settles.
		let snapshot = cachedSnapshot ?? null;

		// Inline "Update" affordance shown only when an upgrade is available
		// for this launcher AND the catalog defines an upgrade command for
		// the current platform. Clicking it routes through the install
		// modal so the user can review the exact command before running it.
		const updateBtn = activeDocument.createElement('button');
		updateBtn.className = 'preset-scripts-menu-action-btn preset-scripts-menu-action-update';
		updateBtn.setAttribute('aria-label', t('settingsDetails.terminal.aiLauncherUpdateAriaLabel'));
		setIcon(updateBtn, 'download');
		updateBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.closePresetScriptsMenu();
			const current = snapshot;
			this.openLauncherInstallModal(script, entry, current);
		});

		const refreshUpdateBtnVisibility = (next: AiLauncherStatusSnapshot | null): void => {
			const showUpdate =
				next?.readiness === 'update-available' &&
				getUpgradeCommandForPlatform(
					entry,
					Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux',
				) !== null;
			updateBtn.classList.toggle('is-hidden', !showUpdate);
		};
		refreshUpdateBtnVisibility(cachedSnapshot ?? null);
		item.appendChild(updateBtn);

		// Refresh in the background so the badge & click route stay accurate
		// when the user re-opens the menu after an install or upgrade. We do
		// not block menu render on this — the cached snapshot is good enough.
		if (entry.detectCommand) {
			void this.refreshSingleLauncherSnapshot(entry).then((next) => {
				if (!next) return;
				snapshot = next;
				this.applyLauncherBadgeStatus(badge, readinessToBadge(next.readiness));
				item.dataset.availability = next.readiness;
				refreshUpdateBtnVisibility(next);
				setTooltip(item, this.launcherMenuTooltip(script, next, readinessToBadge(next.readiness)), {
					placement: 'top',
					classes: ['preset-script-tooltip'],
				});
			});
		}

		item.addEventListener('click', () => {
			this.closePresetScriptsMenu();

			const current = snapshot;
			if (current?.readiness === 'not-installed') {
				this.openLauncherInstallModal(script, entry, current);
				return;
			}
			if (current?.readiness === 'update-available') {
				// The CLI is functional, so we still let the launcher run, but
				// surface the upgrade path through a non-blocking notice. Users
				// can disable this via the `checkAiLauncherUpdates` setting if
				// they find it noisy.
				const local = current.local ?? '?';
				const latest = current.latest ?? '?';
				new Notice(
					t('notices.presetScript.launcherUpdateAvailable', {
						name: script.name || entry.presetId,
						local,
						latest,
					}),
					5000,
				);
			}

			this.runPresetScript(script).catch((error) => {
				const message = error instanceof Error ? error.message : String(error);
				new Notice(t('notices.presetScript.runFailed', { message }));
			});
		});

		return item;
	}

	/**
	 * Run all probes for one launcher (PATH + version + optional registry)
	 * and update the cached snapshot in place. Returns the new snapshot so
	 * callers can re-render without re-querying the Map.
	 */
	private async refreshSingleLauncherSnapshot(entry: AiLauncherCatalogEntry): Promise<AiLauncherStatusSnapshot | null> {
		const snapshot = await probeLauncher(entry, this.settings.checkAiLauncherUpdates === true && this.settings.serverConnection?.offlineMode !== true);
		if (snapshot && this.isActive()) this.setAiLauncherSnapshot(entry.presetId, snapshot);
		return snapshot;
	}

	private launcherMenuTooltip(
		script: PresetScript,
		snapshot: AiLauncherStatusSnapshot | null | undefined,
		status: AiLauncherStatus,
	): string {
		return `${this.launcherStatusLabel(status)}\n${this.buildLauncherTooltip(script, snapshot)}`;
	}

	private buildLauncherTooltip(script: PresetScript, snapshot: AiLauncherStatusSnapshot | null | undefined): string {
		const base = this.buildPresetScriptTooltip(script);
		if (!snapshot || (!snapshot.local && !snapshot.latest)) {
			return base;
		}
		const lines: string[] = [];
		if (snapshot.local)
			lines.push(t('settingsDetails.terminal.aiLauncherTooltipInstalled', { version: snapshot.local }));
		if (snapshot.latest)
			lines.push(t('settingsDetails.terminal.aiLauncherTooltipLatest', { version: snapshot.latest }));
		if (snapshot.resolvedFrom)
			lines.push(t('settingsDetails.terminal.aiLauncherTooltipResolvedFrom', { path: snapshot.resolvedFrom }));
		return `${base}\n${lines.join('\n')}`;
	}

	/**
	 * Render the readiness badge for the NAND AI menu row. The badge starts
	 * from the cached resolver state and refreshes asynchronously.
	 */
	private createLauncherStatusBadge(status: AiLauncherStatus, dot = false): HTMLElement {
		const badge = activeDocument.createElement('span');
		badge.className = dot ? 'preset-scripts-menu-status-badge is-dot' : 'preset-scripts-menu-status-badge';
		this.applyLauncherBadgeStatus(badge, status);
		return badge;
	}

	private launcherStatusLabel(status: AiLauncherStatus): string {
		switch (status) {
			case 'ready':
				return t('settingsDetails.terminal.aiLauncherStatusReady');
			case 'not-installed':
				return t('settingsDetails.terminal.aiLauncherStatusNotInstalled');
			case 'update-available':
				return t('settingsDetails.terminal.aiLauncherStatusUpdateAvailable');
			case 'checking':
			default:
				return t('settingsDetails.terminal.aiLauncherStatusChecking');
		}
	}

	private applyLauncherBadgeStatus(badge: HTMLElement, status: AiLauncherStatus): void {
		badge.dataset.status = status;
		badge.classList.remove('is-ready', 'is-not-installed', 'is-update-available', 'is-checking');
		const label = this.launcherStatusLabel(status);
		switch (status) {
			case 'ready':
				badge.classList.add('is-ready');
				break;
			case 'not-installed':
				badge.classList.add('is-not-installed');
				break;
			case 'update-available':
				badge.classList.add('is-update-available');
				break;
			case 'checking':
			default:
				badge.classList.add('is-checking');
				break;
		}
		if (badge.classList.contains('is-dot')) {
			badge.textContent = '';
			badge.setAttribute('aria-label', label);
			return;
		}
		badge.textContent = label;
	}

	private openLauncherInstallModal(
		script: PresetScript,
		entry: AiLauncherCatalogEntry,
		snapshot: AiLauncherStatusSnapshot | CommandAvailability | null,
	): void {
		const isSnapshot = (
			value: AiLauncherStatusSnapshot | CommandAvailability | null,
		): value is AiLauncherStatusSnapshot => {
			return !!value && typeof value === 'object' && 'readiness' in value;
		};

		const localVersion = isSnapshot(snapshot) ? snapshot.local : null;
		const latestVersion = isSnapshot(snapshot) ? snapshot.latest : null;
		const updateAvailable = isSnapshot(snapshot) && snapshot.readiness === 'update-available';
		const upgradeCommand = updateAvailable
			? getUpgradeCommandForPlatform(entry, Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux')
			: null;
		const installCommand = getInstallCommandForPlatform(
			entry,
			Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux',
		);

		const modal = new LauncherInstallModal(this.app, {
			name: script.name || t('settingsDetails.terminal.presetScriptsUnnamed'),
			command: entry.detectCommand ?? '',
			docsUrl: entry.installDocsUrl,
			installCommand,
			upgradeCommand,
			localVersion,
			latestVersion,
			updateAvailable,
			onRunAnyway: () => {
				this.runPresetScript(script).catch((error) => {
					const message = error instanceof Error ? error.message : String(error);
					new Notice(t('notices.presetScript.runFailed', { message }));
				});
			},
			// Wire up "Install now" only when we have an install command for
			// the current platform AND the launcher is actually missing. We
			// skip this hook in the update-available case so the modal's
			// primary CTA stays focused on the upgrade.
			onRunInstall:
				!updateAvailable && installCommand
					? () => {
							void this.runLauncherCommand(script, entry, installCommand, 'install');
						}
					: undefined,
			onRunUpgrade: upgradeCommand
				? () => {
						void this.runLauncherCommand(script, entry, upgradeCommand, 'upgrade');
					}
				: undefined,
		});
		modal.open();
	}

	/**
	 * Run a catalog-supplied install or upgrade command in a fresh NAND
	 * terminal. The user clicked "Install now" or "Update now" from the
	 * install modal, so we already have explicit consent to execute —
	 * NAND types the command into a new terminal session and presses
	 * Enter, exactly as if the user had typed it themselves.
	 *
	 * Because the command runs in a user-visible PTY we cannot wait on
	 * its exit code, so we kick off a short watchdog poll: re-probe the
	 * local version every few seconds and broadcast the new snapshot the
	 * moment the readiness changes. That way the settings page row, the
	 * status-bar menu badge, and the "Update now" / "Install now" button
	 * all flip back to "Ready" without the user having to reopen
	 * anything.
	 */
	private async runLauncherCommand(
		script: PresetScript,
		entry: AiLauncherCatalogEntry,
		command: string,
		intent: 'install' | 'upgrade',
	): Promise<void> {
		try {
			await this.activateTerminalView(this.getLeafForNewTerminal());
			const terminalView = this.getActiveTerminalView();
			if (!terminalView) {
				new Notice(t('notices.presetScript.terminalUnavailable'));
				return;
			}

			const terminal = await terminalView.waitForTerminalInstance();
			const title =
				intent === 'install'
					? t('settingsDetails.terminal.aiLauncherTitleInstall', { name: script.name || entry.presetId })
					: t('settingsDetails.terminal.aiLauncherTitleUpdate', { name: script.name || entry.presetId });
			terminal.setTitle(title);
			this.updateLeafHeader(terminalView.leaf);

			// Capture the version we'd consider "stale" — anything different
			// from this signals the upgrade landed. Always null for install.
			const before = intent === 'upgrade' ? (this._aiLauncherSnapshots.get(entry.presetId)?.local ?? null) : null;

			const normalized = this.normalizePresetScriptCommand(command);
			terminal.write(normalized);
			this.focusTerminalView(terminalView, terminal);

			// Watchdog: poll the local probe (cheap — just spawns
			// `<cmd> --version`) until the readiness flips or we hit the cap.
			this.startUpgradeWatchdog(entry, before, intent);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(t('notices.presetScript.runFailed', { message }));
		}
	}

	/**
	 * Poll the local version probe after an upgrade command has been
	 * dispatched into a NAND terminal. Stops on:
	 *
	 *   - the snapshot leaves `update-available` (success — local caught
	 *     up with latest, or the user was already on latest before
	 *     clicking Update);
	 *   - {@link UPGRADE_WATCHDOG_TIMEOUT_MS} elapses (give-up — upgrade
	 *     never finished, network dropped, user cancelled the install);
	 *   - the user dispatches another upgrade for the same launcher (the
	 *     new watchdog supersedes this one).
	 *
	 * Cadence: a single 5-second tick. Frequent enough that a successful
	 * upgrade flips the UI within a few seconds of finishing, but cheap
	 * enough that a stuck/cancelled upgrade only spawns ~24 probes
	 * before the timeout cuts it off.
	 */
	private _upgradeWatchdogTimers: Map<string, number> = new Map();

	private startUpgradeWatchdog(
		entry: AiLauncherCatalogEntry,
		versionBeforeUpgrade: string | null,
		intent: 'install' | 'upgrade' = 'upgrade',
	): void {
		if (!entry.detectCommand) return;
		const command = entry.detectCommand;

		// If a previous watchdog is already running for this launcher,
		// cancel it. The most recent click wins.
		this.stopUpgradeWatchdog(entry.presetId);

		const POLL_INTERVAL_MS = 5_000;
		const TIMEOUT_MS = 2 * 60 * 1000;
		const startedAt = Date.now();

		const scheduleNextTick = (): void => {
			// Stopped? Some other code path tore us down — bail.
			if (!this._upgradeWatchdogTimers.has(entry.presetId)) return;

			if (Date.now() - startedAt >= TIMEOUT_MS) {
				this.stopUpgradeWatchdog(entry.presetId);
				return;
			}
			const timer = window.setTimeout(tick, POLL_INTERVAL_MS);
			this._upgradeWatchdogTimers.set(entry.presetId, timer);
		};

		const tick = (): void => {
			// Always drop the local probe + registry caches so the resolver
			// re-queries instead of returning the pre-upgrade values.
			clearCommandVersionCache(command);
			clearLatestVersionCache();

			void this.refreshSingleLauncherSnapshot(entry)
				.then((snapshot) => {
					if (!snapshot) {
						// Probe failed — treat as a transient and retry on schedule.
						scheduleNextTick();
						return;
					}
					// Success criteria: the launcher is no longer flagged as
					// update-available. This covers both "upgrade landed" and "the
					// user was already on the latest version when they clicked
					// Update" (e.g. they wanted to test the flow). For the latter
					// we still log a friendly notice so the click feels acknowledged.
					if (snapshot.readiness !== 'update-available') {
						this.stopUpgradeWatchdog(entry.presetId);
						if (intent === 'install') {
							if (snapshot.local) {
								new Notice(
									t('notices.presetScript.launcherInstalled', {
										name: entry.presetId,
										version: snapshot.local,
									}),
								);
							}
						} else if (snapshot.local && snapshot.local !== versionBeforeUpgrade) {
							new Notice(
								t('notices.presetScript.launcherUpdated', {
									name: entry.presetId,
									version: snapshot.local,
								}),
							);
						} else if (snapshot.local) {
							new Notice(
								t('notices.presetScript.launcherOnLatest', {
									name: entry.presetId,
									version: snapshot.local,
								}),
							);
						}
						return;
					}
					scheduleNextTick();
				})
				.catch(() => {
					scheduleNextTick();
				});
		};

		// Seed the map so concurrent calls see we're running, then run an
		// immediate tick — the badge flips to "Checking…" right away.
		this._upgradeWatchdogTimers.set(entry.presetId, 0);
		tick();
	}

	private stopUpgradeWatchdog(presetId: string): void {
		const timer = this._upgradeWatchdogTimers.get(presetId);
		if (timer === undefined) return;
		if (timer !== 0) {
			window.clearTimeout(timer);
		}
		this._upgradeWatchdogTimers.delete(presetId);
	}

	/**
	 * Render the legacy reorderable workflow rows. These are workflows that
	 * are NOT part of the AI launcher catalog (e.g. user-defined entries).
	 * The behavior is unchanged from before the catalog refactor.
	 */
	private appendRegularPresetMenuItems(listEl: HTMLElement, scripts: PresetScript[]): void {
		let draggedItem: HTMLElement | null = null;
		let draggedScriptId: string | null = null;

		scripts.forEach((script) => {
			const item = activeDocument.createElement('div');
			item.className = 'preset-scripts-menu-item';
			item.setAttribute('role', 'menuitem');
			item.setAttribute('draggable', 'true');
			item.dataset.scriptId = script.id;

			const dragHandle = activeDocument.createElement('div');
			dragHandle.className = 'preset-scripts-menu-drag-handle';
			setIcon(dragHandle, 'grip-vertical');
			item.appendChild(dragHandle);

			const iconEl = activeDocument.createElement('div');
			iconEl.className = 'preset-scripts-menu-icon';
			renderPresetScriptIcon(iconEl, script.icon || 'terminal');
			item.appendChild(iconEl);

			const labelEl = activeDocument.createElement('div');
			labelEl.className = 'preset-scripts-menu-label';
			labelEl.textContent = script.name || t('settingsDetails.terminal.presetScriptsUnnamed');
			item.appendChild(labelEl);

			setTooltip(item, this.buildPresetScriptTooltip(script), {
				placement: 'top',
				classes: ['preset-script-tooltip'],
			});

			const actionsEl = activeDocument.createElement('div');
			actionsEl.className = 'preset-scripts-menu-actions';

			const editBtn = activeDocument.createElement('button');
			editBtn.className = 'preset-scripts-menu-action-btn';
			editBtn.setAttribute('aria-label', t('modals.presetScript.titleEdit'));
			setIcon(editBtn, 'pencil');
			editBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.closePresetScriptsMenu();
				this.openPresetScriptEditModal(script);
			});
			actionsEl.appendChild(editBtn);

			const isBuiltIn = DEFAULT_PRESET_SCRIPTS.some((d) => d.id === script.id);
			if (!isBuiltIn) {
				const deleteBtn = activeDocument.createElement('button');
				deleteBtn.className = 'preset-scripts-menu-action-btn preset-scripts-menu-action-delete';
				deleteBtn.setAttribute('aria-label', t('common.delete'));
				setIcon(deleteBtn, 'trash');
				deleteBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.closePresetScriptsMenu();
					const scriptName = script.name?.trim() || t('settingsDetails.terminal.presetScriptsUnnamed');
					this.confirmAndDeletePresetScript(script.id, scriptName);
				});
				actionsEl.appendChild(deleteBtn);
			}
			item.appendChild(actionsEl);

			item.addEventListener('dragstart', (e) => {
				draggedItem = item;
				draggedScriptId = script.id;
				item.addClass('is-dragging');
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text/plain', script.id);
				}
			});

			item.addEventListener('dragend', () => {
				if (draggedItem) {
					draggedItem.removeClass('is-dragging');
				}
				draggedItem = null;
				draggedScriptId = null;
				listEl.querySelectorAll('.preset-scripts-menu-item').forEach((el) => {
					(el as HTMLElement).removeClass('drag-over-above');
					(el as HTMLElement).removeClass('drag-over-below');
				});
			});

			item.addEventListener('dragover', (e) => {
				e.preventDefault();
				if (!draggedItem || draggedScriptId === script.id) return;
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = 'move';
				}
				const rect = item.getBoundingClientRect();
				const midY = rect.top + rect.height / 2;
				listEl.querySelectorAll('.preset-scripts-menu-item').forEach((el) => {
					(el as HTMLElement).removeClass('drag-over-above');
					(el as HTMLElement).removeClass('drag-over-below');
				});
				if (e.clientY < midY) {
					item.addClass('drag-over-above');
				} else {
					item.addClass('drag-over-below');
				}
			});

			item.addEventListener('dragleave', () => {
				item.removeClass('drag-over-above');
				item.removeClass('drag-over-below');
			});

			item.addEventListener('drop', (e) => {
				e.preventDefault();
				item.removeClass('drag-over-above');
				item.removeClass('drag-over-below');
				if (!draggedScriptId || draggedScriptId === script.id) return;

				const rect = item.getBoundingClientRect();
				const midY = rect.top + rect.height / 2;
				const insertBefore = e.clientY < midY;

				this.reorderPresetScript(draggedScriptId, script.id, insertBefore);
			});

			item.addEventListener('click', () => {
				this.closePresetScriptsMenu();
				this.runPresetScript(script).catch((error) => {
					const message = error instanceof Error ? error.message : String(error);
					new Notice(t('notices.presetScript.runFailed', { message }));
				});
			});

			listEl.appendChild(item);
		});
	}

	private reorderPresetScript(draggedId: string, targetId: string, insertBefore: boolean): void {
		const scripts = [...(this.settings.presetScripts ?? [])];
		const draggedIndex = scripts.findIndex((s) => s.id === draggedId);
		if (draggedIndex < 0) return;

		const dragged = scripts.splice(draggedIndex, 1)[0];
		if (!dragged) return;
		let targetIndex = scripts.findIndex((s) => s.id === targetId);
		if (targetIndex < 0) {
			scripts.push(dragged);
		} else {
			if (!insertBefore) {
				targetIndex += 1;
			}
			scripts.splice(targetIndex, 0, dragged);
		}

		this.settings.presetScripts = scripts;
		void this.saveSettings();
		// Rebuild the menu to reflect new order
		this.closePresetScriptsMenu();
		const anchorRect = this._statusBarItem?.getBoundingClientRect();
		if (anchorRect) {
			this.showPresetScriptsMenuAtRect(anchorRect);
		}
	}

	private closePresetScriptsMenu(): void {
		this._vaultSessionAbort?.abort();
		this._vaultSessionAbort = null;
		this._vaultSessionLoad += 1;
		this._presetMenuAnchor = null;
		if (this._presetScriptsMenuCleanup) {
			this._presetScriptsMenuCleanup();
			this._presetScriptsMenuCleanup = null;
		}
		if (this._presetScriptsMenuEl) {
			this._presetScriptsMenuEl.remove();
			this._presetScriptsMenuEl = null;
		}
	}

	async runPresetScript(script: PresetScript): Promise<void> {
		if (!script) {
			new Notice(t('notices.presetScript.notFound'));
			return;
		}

		const normalizedScript = this.normalizePresetScript(script);
		if (isAgentId(normalizedScript.id)) {
			await launchRegisteredAgent(this, normalizedScript.id);
			return;
		}
		const actions = normalizedScript.actions.filter((action) => action.enabled !== false);
		if (actions.length === 0) {
			new Notice(t('notices.presetScript.emptyCommand'));
			return;
		}

		this.runWorkflowNonTerminalActions(actions);

		const terminalCommand = this.buildWorkflowTerminalCommand(actions);
		if (!terminalCommand) {
			return;
		}

		let terminalView = this.getActiveTerminalView();
		if (normalizedScript.runInNewTerminal) {
			await this.activateTerminalView(this.getLeafForNewTerminal());
			terminalView = this.getActiveTerminalView();
		} else if (normalizedScript.autoOpenTerminal && !terminalView) {
			await this.activateTerminalView();
			terminalView = this.getActiveTerminalView();
		}

		if (!terminalView) {
			new Notice(t('notices.presetScript.terminalUnavailable'));
			return;
		}

		const terminal = await terminalView.waitForTerminalInstance();
		const title = (normalizedScript.terminalTitle || '').trim();
		if (title) {
			terminal.setTitle(title);
			this.updateLeafHeader(terminalView.leaf);
		}
		const normalizedCommand = this.normalizePresetScriptCommand(terminalCommand);
		terminal.write(normalizedCommand);
		this.focusTerminalView(terminalView, terminal);
	}

	private buildWorkflowTerminalCommand(actions: PresetWorkflowAction[]): string {
		return actions
			.filter((action) => action.type === 'terminal-command')
			.map((action) => action.value.trim())
			.filter((value) => value.length > 0)
			.join('\n');
	}

	private runWorkflowNonTerminalActions(actions: PresetWorkflowAction[]): void {
		const nonTerminalActions = actions.filter((action) => action.type !== 'terminal-command');
		for (const action of nonTerminalActions) {
			if (action.type === 'obsidian-command') {
				this.runObsidianCommandAction(action.value);
				continue;
			}
			if (action.type === 'open-external') {
				void this.runOpenExternalAction(action.value);
			}
		}
	}

	private runObsidianCommandAction(commandId: string): void {
		const normalizedCommandId = commandId.trim();
		if (!normalizedCommandId) {
			throw new Error('Workflow action "obsidian-command" requires command ID');
		}
		const openTerminalCommandId = `${this.manifest.id}:open-terminal`;
		if (normalizedCommandId === openTerminalCommandId || normalizedCommandId === 'open-terminal') {
			void this.activateTerminalView();
			return;
		}

		if (this.isNANDTerminalContextCommand(normalizedCommandId) && !this.getActiveTerminalView()) {
			void this.activateTerminalView();
		}

		const appWithCommands = this.app as typeof this.app & {
			commands?: {
				executeCommandById: (id: string) => boolean;
			};
		};
		if (!appWithCommands.commands) {
			throw new Error('Obsidian command manager is unavailable');
		}
		const executed = appWithCommands.commands.executeCommandById(normalizedCommandId);
		if (!executed) {
			throw new Error(`Obsidian command cannot execute in current context: ${normalizedCommandId}`);
		}
	}

	private isNANDTerminalContextCommand(commandId: string): boolean {
		const prefix = `${this.manifest.id}:terminal-`;
		return commandId.startsWith(prefix);
	}

	private async runOpenExternalAction(url: string): Promise<void> {
		const targetUrl = url.trim();
		if (!targetUrl) {
			throw new Error('Workflow action "open-external" requires a URL');
		}
		await shell.openExternal(targetUrl);
	}

	private normalizePresetScriptCommand(command: string): string {
		const normalized = command.replace(/\r?\n/g, '\r').trimEnd();
		return normalized.endsWith('\r') ? normalized : `${normalized}\r`;
	}

	private updateLeafHeader(leaf: WorkspaceLeaf): void {
		refreshLeafTitle(this.app, leaf);
	}

	/**
	 * Get the absolute path to the plugin directory
	 *
	 * @returns The absolute path to the plugin directory
	 */
	getPluginDir(): string {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error('FileSystemAdapter is not available');
		}
		return resolvePluginDirectory(
			adapter.getBasePath(),
			this.app.vault.configDir,
			this.manifest.dir,
			this.manifest.id,
			window.require('path') as typeof import('path'),
		);
	}
}
