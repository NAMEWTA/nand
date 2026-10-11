import { Menu, Notice, Platform, type App } from 'obsidian';
import { SessionMaterialService } from './session-material';
import type { ModuleContext } from '../../../app/contracts/module';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { collectReferences } from '../../../host/obsidian/references';
import { t } from '../../../shared/i18n/index';
import type { SettingsHandle } from '../../../shared/settings/store';
import { AGENT_CATALOG, getAgent } from '../core/launch/catalog';
import type { AgentId } from '../core/launch/types';
import { AgentUsageSource } from '../core/launch/usage-source';
import type { VaultSession, VaultSessionAgent } from '../core/history/types';
import { activate, activeTab, canSplit, openTab, removeSession, sessionsOf, split, tabOf, type SplitDirection } from '../core/terminal/layout';
import { splitArgs } from '../core/launch/flags';
import type { LaunchPreset, ShellChoice, TerminalSettings } from '../core/terminal/settings';
import { absolutePluginDir } from '../platform/desktop/agents/accounts';
import { readUsageSnapshots } from '../platform/desktop/agents/usage';
import { AutomationHooks } from '../platform/desktop/hooks/automation-hooks';
import { BinaryError, ensureHelper } from '../platform/desktop/pty/binary';
import { availableShells, resolveShell, sessionDirectory, type ShellOption } from '../platform/desktop/pty/shells';
import type { NativeSessionSummary } from '../platform/desktop/server/agent-data-client';
import { NativeHistory } from '../platform/history/service';
import { TerminalAutomationRuntime } from './agent-runtime';
import { AGENT_RUN_CONTEXTS } from '../api';
import { PromptRunner } from './prompt-runner';
import { launchAgent, resumeAgent, type LaunchHost, type LaunchRequest } from './launch/launcher';
import type { TerminalSession } from './terminal/session';
import { hookActivity, TerminalSessions } from './terminal/sessions';

/** Usage polling interval with backoff after failures (capped at 15 minutes). */
export function usageDelay(refreshSec: number, failures: number): number {
	return Math.min(15 * 60_000, Math.max(15, refreshSec) * 1000 * 2 ** Math.min(failures, 6));
}

/** Text in a CSS color property as `#rrggbb`, or '' when it cannot be resolved. */
function cssColor(element: HTMLElement, property: string): string {
	const value = element.win.getComputedStyle(element).getPropertyValue(property);
	const match = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value);
	if (!match) return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : '';
	return '#' + match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('');
}

export type Placement = { split: { from: string; direction: SplitDirection } } | { tab: true };

/** Dialogs the controller shows; supplied by the module (the UI code loads on first use). */
export interface ControllerDialogs {
	confirm(app: App, message: string): Promise<boolean>;
	switchSession(controller: AgentController): void;
}

/**
 * The agent module's runtime: terminal sessions and their tab layout, launching shells, agents and
 * presets, native history, usage, automation and the commands. One instance per module activation.
 */
export class AgentController {
	readonly sessions: TerminalSessions;
	readonly usage: AgentUsageSource;
	readonly runtime: TerminalAutomationRuntime;
	readonly prompts: PromptRunner;
	readonly materials: SessionMaterialService;
	private historyService?: NativeHistory;
	/** First page of this vault's native history, for the side panel and preview lookups. */
	private historyRows: NativeSessionSummary[] = [];
	private historyLoad?: Promise<void>;
	historyState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	historyError = '';
	private readonly hooks: AutomationHooks;
	private readonly listeners = new Set<() => void>();
	private shellOptions?: ShellOption[];
	private colors = { foreground: '#d4d4d4', background: '#1e1e1e', cursor: '#d4d4d4' };
	private colorsReadAt = 0;
	private installing?: Promise<string>;

	constructor(private readonly context: ModuleContext, readonly settings: SettingsHandle<TerminalSettings>, private readonly dialogs: ControllerDialogs) {
		const app = context.app;
		const win = app.workspace.containerEl.win;
		this.hooks = new AutomationHooks(win);
		this.sessions = new TerminalSessions({
			app,
			version: context.manifest.version,
			platform: Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux',
			pluginDir: () => this.pluginDir(),
			settings: () => this.settings.get(),
			colors: () => this.themeColors(),
			binary: () => this.binary(),
			agentHooks: (agentId, env, activity) =>
				this.hooks.prepare(agentId, env, (event) => {
					const next = hookActivity(event.event);
					if (next) activity(next, event.data);
				}),
		});
		context.lifetime.register(this.sessions.subscribe(() => this.changed()));
		this.usage = new AgentUsageSource({
			read: () => readUsageSnapshots(this.usageAgents(), { settings: this.settings.get().agents, pluginDir: this.pluginDir() }),
			active: () => true,
			delay: (failures) => usageDelay(this.settings.get().agents.usageRefreshSec, failures),
			now: () => Date.now(),
			schedule: (callback, delay) => win.setTimeout(callback, delay),
			cancel: (timer) => win.clearTimeout(timer),
		});
		this.usage.setPinned(this.usagePinned());
		context.lifetime.register(this.usage.subscribe(() => this.changed()));
		context.lifetime.register(this.settings.subscribe(() => {
			this.usage.setPinned(this.usagePinned());
			this.usage.invalidate();
			for (const session of this.sessions.list()) session.setScrollback(this.settings.get().scrollback);
			this.changed();
		}));
		this.runtime = new TerminalAutomationRuntime({
			app,
			pluginDir: context.manifest.dir ?? '',
			agentSettings: () => this.settings.get().agents,
			history: () => this.history(),
			create: (request) => this.sessions.create(request),
			remove: (id) => this.sessions.remove(id),
			open: async (id) => {
				this.show(id);
				await this.open({ feature: 'terminal', section: 'running', resourceId: id });
			},
			shell: (kind) => resolveShell(kind === 'powershell' ? (Platform.isWin ? 'powershell' : 'pwsh') : 'bash', this.settings.get()),
		});
		this.prompts = new PromptRunner(this.runtime, () => this.vaultPath() ?? '', async () => (await context.contributions.collect(AGENT_RUN_CONTEXTS)).map(item => item.value), win);
		this.materials = new SessionMaterialService(this);
	}

	get app(): App {
		return this.context.app;
	}

	private changed(): void {
		for (const listener of [...this.listeners]) listener();
		this.context.shell.refresh();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	vaultPath(): string | undefined {
		const adapter = this.app.vault.adapter as { getBasePath?: () => string };
		return typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : undefined;
	}

	pluginDir(): string {
		return absolutePluginDir(this.vaultPath() ?? '', this.context.manifest.dir ?? '');
	}

	history(): NativeHistory {
		if (!this.historyService) {
			this.historyService = new NativeHistory(this.app, this.sessions, () => this.settings.get().agents, this.context.manifest.dir ?? '');
			this.context.lifetime.register(this.historyService.subscribe(() => this.changed()));
		}
		return this.historyService;
	}

	/** Cached first page of history (loads it the first time). Never starts a session. */
	recentHistory(): readonly NativeSessionSummary[] {
		if (this.historyState === 'idle') void this.refreshHistory(false);
		return this.historyRows;
	}

	findHistory(key: string): NativeSessionSummary | undefined {
		return this.historyRows.find((row) => row.key === key);
	}

	/** Re-read native history (`scan` re-enumerates the CLI folders first). */
	refreshHistory(scan = true): Promise<void> {
		if (this.historyLoad) return this.historyLoad;
		this.historyState = 'loading';
		this.changed();
		this.historyLoad = (async () => {
			try {
				const history = this.history();
				if (scan || !history.hasScanned) await history.scan();
				const page = await history.query('', 0, undefined, 'all');
				this.historyRows = page.rows;
				this.historyState = 'ready';
				this.historyError = '';
			} catch (error) {
				this.historyState = 'error';
				this.historyError = error instanceof Error ? error.message : String(error);
			} finally {
				this.historyLoad = undefined;
				this.changed();
			}
		})();
		return this.historyLoad;
	}

	/** Agents turned on in settings, in catalog order. */
	enabledAgents(): Array<{ id: AgentId; title: string }> {
		const agents = this.settings.get().agents.agents;
		return AGENT_CATALOG.filter((agent) => agents[agent.id]?.enabled).map((agent) => ({ id: agent.id, title: agent.title }));
	}

	usageAgents(): AgentId[] {
		const { agents } = this.settings.get().agents;
		return AGENT_CATALOG.filter((agent) => agent.usage !== 'none' && agents[agent.id]?.enabled !== false && agents[agent.id]?.showUsage !== false).map((agent) => agent.id);
	}

	usagePinned(): boolean {
		return this.settings.get().agents.showUsageInStatusBar && this.usageAgents().length > 0;
	}

	shells(): ShellOption[] {
		this.shellOptions ??= availableShells();
		return this.shellOptions;
	}

	/** Theme colors for color queries, read from the workspace at most once a second. */
	private themeColors() {
		const settings = this.settings.get();
		const now = Date.now();
		if (now - this.colorsReadAt > 1000) {
			this.colorsReadAt = now;
			const body = this.app.workspace.containerEl.doc.body;
			this.colors = {
				foreground: cssColor(body, 'color') || this.colors.foreground,
				background: cssColor(this.app.workspace.containerEl, 'background-color') || cssColor(body, 'background-color') || this.colors.background,
				cursor: cssColor(body, 'caret-color') || cssColor(body, 'color') || this.colors.cursor,
			};
		}
		return {
			foreground: settings.useObsidianTheme ? this.colors.foreground : settings.foreground || this.colors.foreground,
			background: settings.useObsidianTheme ? this.colors.background : settings.background || this.colors.background,
			cursor: this.colors.cursor,
		};
	}

	/** Locate, download or verify the native helper, with notices for slow steps and failures. */
	private binary(): Promise<string> {
		this.installing ??= (async () => {
			let notice: Notice | undefined;
			try {
				return await ensureHelper({
					pluginDir: this.pluginDir(),
					version: this.context.manifest.version,
					offline: this.settings.get().offline,
					progress: (state) => {
						notice?.hide();
						notice = new Notice(t(state === 'downloading' ? 'agent.helper.downloading' : 'agent.helper.verifying'), 0);
					},
				});
			} catch (error) {
				const message = error instanceof BinaryError
					? t(error.code === 'http' && error.detail?.status === 404 ? 'agent.helper.unpublished' : `agent.helper.${error.code}`, {
						status: error.detail?.status ?? 0, version: this.context.manifest.version,
					}) : error instanceof Error ? error.message : String(error);
				if (error instanceof BinaryError) console.warn('[NAND terminal helper]', error.code, error.detail);
				new Notice(t('agent.helper.failed', { message }), 10_000);
				throw error;
			} finally {
				notice?.hide();
			}
		})().finally(() => {
			this.installing = undefined;
		});
		return this.installing;
	}

	/** Install or verify the helper and start it; resolves to its version. */
	async checkHelper(): Promise<string> {
		return (await this.sessions.ensureHelper()).version;
	}

	/** Show the agent page (in the main window's workbench by default). */
	async open(target: WorkbenchTarget = { feature: 'terminal', section: 'running' }): Promise<void> {
		await this.context.shell.open(target, this.app.workspace.getMostRecentLeaf()?.view.containerEl.win);
	}

	/** Put a session on screen: its tab becomes active (a new tab when it has none). */
	show(id: string): void {
		const session = this.sessions.get(id);
		if (!session) return;
		const state = this.sessions.tabs;
		this.sessions.setTabs(tabOf(state, id) ? activate(state, id) : openTab(state, `tab-${crypto.randomUUID()}`, id));
		this.sessions.focus(id);
	}

	private place(session: TerminalSession, placement: Placement): void {
		let state = this.sessions.tabs;
		if ('split' in placement && canSplit(state, placement.split.from)) state = split(state, placement.split.from, placement.split.direction, session.id);
		else state = openTab(state, `tab-${crypto.randomUUID()}`, session.id);
		this.sessions.setTabs(state);
		this.sessions.focus(session.id);
	}

	/** Start a session from a launch request and show it. */
	async start(request: LaunchRequest & { kind?: 'shell' | 'agent' | 'preset'; input?: string }, placement: Placement = { tab: true }): Promise<TerminalSession> {
		const session = await this.sessions.create({
			kind: request.kind ?? (request.agentId ? 'agent' : 'shell'),
			title: request.title,
			file: request.file,
			args: request.args,
			cwd: request.cwd,
			env: request.env,
			agentId: request.agentId,
			hooks: !!request.agentId,
		});
		this.place(session, placement);
		await this.open({ feature: 'terminal', section: 'running', resourceId: session.id });
		if (request.input) void this.typeWhenReady(session, request.input);
		return session;
	}

	/** Paste text and press Enter once the shell has drawn its prompt (or after 5 seconds). */
	private async typeWhenReady(session: TerminalSession, text: string): Promise<void> {
		const win = this.app.workspace.containerEl.win;
		const deadline = Date.now() + 5000;
		while (session.running && Date.now() < deadline && !session.inputReady() && session.prompts().lines.length === 0) {
			await new Promise((resolve) => win.setTimeout(resolve, 100));
		}
		if (!session.running) return;
		session.paste(text);
		session.input('\r');
	}

	private launchHost(placement: Placement): LaunchHost {
		return {
			app: this.app,
			getVaultPath: () => this.vaultPath(),
			getPluginDataDir: () => this.pluginDir(),
			getAgentSettings: () => this.settings.get().agents,
			saveAgentSettings: (agents) => this.settings.update((draft) => { draft.agents = agents; }),
			start: async (request) => { await this.start(request, placement); },
		};
	}

	async newShell(choice?: ShellChoice, placement: Placement = { tab: true }): Promise<TerminalSession | undefined> {
		const settings = this.settings.get();
		const shell = resolveShell(choice ?? settings.shell, settings);
		return this.start({ kind: 'shell', file: shell.file, args: shell.args, cwd: sessionDirectory(this.vaultPath(), settings.startInVault), env: {}, title: shell.title }, placement);
	}

	async newAgent(agentId: AgentId, placement: Placement = { tab: true }): Promise<void> {
		await launchAgent(this.launchHost(placement), agentId);
	}

	async newPreset(preset: LaunchPreset, placement: Placement = { tab: true }): Promise<TerminalSession | undefined> {
		const settings = this.settings.get();
		const shell = preset.program.trim() ? { file: preset.program.trim(), args: splitArgs(preset.args), title: preset.name } : resolveShell(preset.shell, { customShellPath: settings.customShellPath, shellArgs: preset.args || settings.shellArgs });
		return this.start({ kind: 'preset', file: shell.file, args: shell.args, cwd: sessionDirectory(this.vaultPath(), true, preset.cwd), env: {}, title: preset.name, input: preset.input }, placement);
	}

	/** Resume a conversation from native history in its CLI. */
	async resume(row: NativeSessionSummary): Promise<void> {
		let env: Record<string, string> = {};
		try {
			const parsed: unknown = JSON.parse(row.accountKey || '{}');
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) env = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
		} catch {
			env = {};
		}
		const session: VaultSession = {
			agentId: row.agentId as VaultSessionAgent,
			title: this.history().meta(row.key).title || row.title,
			cwd: row.cwd,
			sessionId: row.sessionId,
			transcriptPath: row.transcriptPath || undefined,
			modifiedAtMs: row.modifiedAtMs,
			env,
		};
		await resumeAgent(this.launchHost({ tab: true }), session);
	}

	/** Split a pane with a new session of the default shell. */
	async splitSession(id: string, direction: SplitDirection): Promise<void> {
		if (!canSplit(this.sessions.tabs, id)) {
			new Notice(t('agent.splitLimit'));
			return;
		}
		await this.newShell(undefined, { split: { from: id, direction } });
	}

	/** End a session (after confirmation when it is running) and remove its pane. */
	async closeSession(id: string, confirmRunning = true): Promise<void> {
		const session = this.sessions.get(id);
		if (!session) return;
		if (session.running && confirmRunning && !(await this.confirm(t('agent.endConfirm', { title: session.title })))) return;
		this.sessions.setTabs(removeSession(this.sessions.tabs, id));
		this.sessions.remove(id);
	}

	async closeTab(tabId: string): Promise<void> {
		const tab = this.sessions.tabs.tabs.find((item) => item.id === tabId);
		if (!tab) return;
		const ids = sessionsOf(tab.root);
		const running = ids.filter((id) => this.sessions.get(id)?.running).length;
		if (running && !(await this.confirm(t('agent.closeTabConfirm', { count: running })))) return;
		for (const id of ids) {
			this.sessions.setTabs(removeSession(this.sessions.tabs, id));
			this.sessions.remove(id);
		}
	}

	private confirm(message: string): Promise<boolean> {
		return this.dialogs.confirm(this.app, message);
	}

	/** The session that commands send text to: the focused pane of the active tab, else the latest running one. */
	target(): TerminalSession | undefined {
		const tab = activeTab(this.sessions.tabs);
		const focused = tab ? this.sessions.get(tab.focused) : undefined;
		return focused?.running ? focused : this.sessions.focused;
	}

	/** Paste into one session and do not press Enter. */
	pasteInto(id: string, text: string): boolean {
		const session = this.sessions.get(id);
		if (!session) return false;
		session.paste(text);
		this.show(id);
		return true;
	}

	/** Paste text into the target session (no Enter). */
	send(text: string): boolean {
		const session = this.target();
		if (!session) {
			new Notice(t('agent.noTerminal'));
			return false;
		}
		session.paste(text);
		this.show(session.id);
		return true;
	}

	/** "New session" menu: shells, enabled agents and presets. */
	newSessionMenu(): Menu {
		const menu = new Menu();
		for (const shell of this.shells()) menu.addItem((item) => item.setTitle(shell.choice === 'default' ? t('agent.shell') : shell.title).setIcon('terminal').onClick(() => { void this.newShell(shell.choice).catch(report); }));
		const agents = AGENT_CATALOG.filter((agent) => this.settings.get().agents.agents[agent.id]?.enabled);
		if (agents.length) menu.addSeparator();
		for (const agent of agents) menu.addItem((item) => item.setTitle(agent.title).setIcon('bot').onClick(() => { void this.newAgent(agent.id).catch(report); }));
		const presets = this.settings.get().presets;
		if (presets.length) menu.addSeparator();
		for (const preset of presets) menu.addItem((item) => item.setTitle(preset.name).setIcon(preset.icon || 'terminal').onClick(() => { void this.newPreset(preset).catch(report); }));
		return menu;
	}

	/** Palette commands (removed with the module). */
	registerCommands(): void {
		const add = this.context.commands.add.bind(this.context.commands);
		add({ id: 'terminal-new', name: t('agent.cmd.newShell'), nameKey: 'agent.cmd.newShell', callback: () => { void this.newShell().catch(report); } });
		for (const agent of AGENT_CATALOG) {
			add({
				id: `terminal-new-${agent.id}`,
				name: t('agent.cmd.newAgent', { title: agent.title }),
				checkCallback: (checking) => {
					if (!this.settings.get().agents.agents[agent.id]?.enabled) return false;
					if (!checking) void this.newAgent(agent.id).catch(report);
					return true;
				},
			});
		}
		add({ id: 'terminal-switch', name: t('agent.cmd.switch'), nameKey: 'agent.cmd.switch', callback: () => this.dialogs.switchSession(this) });
		const sendCommand = (id: string, nameKey: string, read: () => string | null | Promise<string | null>, missingKey: string) =>
			add({
				id,
				name: t(nameKey),
				nameKey,
				callback: () => {
					void Promise.resolve(read()).then((text) => {
						if (!text) new Notice(t(missingKey));
						else this.send(text);
					});
				},
			});
		sendCommand('terminal-send-selection', 'agent.cmd.sendSelection', () => this.app.workspace.activeEditor?.editor?.getSelection() || null, 'agent.noSelection');
		sendCommand('terminal-send-note', 'agent.cmd.sendNote', async () => {
			const file = this.app.workspace.getActiveFile();
			if (!file) return null;
			const editor = this.app.workspace.activeEditor;
			return editor?.file === file && editor.editor ? editor.editor.getValue() : this.app.vault.cachedRead(file);
		}, 'agent.noNote');
		sendCommand('terminal-send-path', 'agent.cmd.sendPath', () => {
			const file = this.app.workspace.getActiveFile();
			const vault = this.vaultPath();
			return file && vault ? `${vault}${Platform.isWin ? '\\' : '/'}${Platform.isWin ? file.path.replace(/\//g, '\\') : file.path}` : null;
		}, 'agent.noNote');
		sendCommand('terminal-insert-reference', 'agent.cmd.insertReference', () => {
			const text = collectReferences(this.app, 'absolute');
			return text ? `${text.split('\n').filter(Boolean).join(' ')} ` : null;
		}, 'agent.noReference');
		add({ id: 'terminal-usage', name: t('agent.cmd.usage'), nameKey: 'agent.cmd.usage', callback: () => { void this.open({ feature: 'terminal', section: 'usage' }); } });
		add({ id: 'terminal-settings', name: t('agent.cmd.settings'), nameKey: 'agent.cmd.settings', callback: () => { void this.context.shell.open({ feature: 'settings', section: 'terminal' }); } });
	}

	/** Statuses for the workbench status bar (interactive sessions only). */
	status(): Array<{ id: string; status: 'running' | 'waiting'; automated: boolean }> {
		return this.sessions.list().flatMap((session) => (session.running && session.agentId && (session.activity === 'running' || session.activity === 'waiting') ? [{ id: session.id, status: session.activity, automated: session.automated }] : []));
	}

	agentTitle(id: AgentId): string {
		return getAgent(id).title;
	}

	async dispose(): Promise<void> {
		this.materials.dispose();
		await this.prompts.dispose();
		this.runtime.dispose();
		this.hooks.dispose();
		this.usage.dispose();
		this.sessions.dispose();
		this.listeners.clear();
		await this.historyService?.dispose();
	}
}

function report(error: unknown): void {
	new Notice(error instanceof Error ? error.message : String(error));
}
