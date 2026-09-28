import type { AgentSettings } from '../../../core/agent-launch/types';
import { NativeHistory } from '../../obsidian/ai-vault/service';
import { AutomationHooks } from '../agent-hooks/automation-hooks';
/**
 * TerminalService - terminal service built on the unified Rust server
 * 
 * Responsibilities:
 * 1. Use ServerManager to manage the unified server
 * 2. Manage all terminal instances
 * 3. Handle server crashes and automatic restarts
 * 

 */

import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type { PendingTerminalSession } from '../../../core/agent-launch/types';
import type { ShellType, TerminalSettings } from '../../../core/pty/settings';
import { t } from '../../../shared/i18n/terminal-accessor';
import type { PtyClient } from '../../terminal-server/pty-client';
import type { ServerManager } from '../../terminal-server/server-manager';
import { debugLog, debugWarn, errorLog } from '../logger';
import { PtySession } from './pty-session';
import { getSelectableShellTypes } from './shell-profiles';
import { getCurrentPlatformCustomShellPath, getCurrentPlatformShell, setCurrentPlatformShell } from './shell-settings';

export interface DefaultShellOption {
	shellType: ShellType;
	label: string;
	selected: boolean;
}

/**
 * TerminalService
 *
 * Uses ServerManager to manage the unified server instead of managing the PTY server process independently
 */
export class TerminalService {
	private app: App;
	private settings: TerminalSettings;
	private serverManager: ServerManager;
	private getTerminalEnvironment: () => Record<string, string>;
	private saveSettings: () => Promise<void>;

	// Terminal instance registry
	private terminals: Map<string, PtySession> = new Map();
	private pendingSessions: PendingTerminalSession[] = [];
	private historyStore?: NativeHistory;
	private listeners = new Set<() => void>();
	history(settings: () => AgentSettings, dir: string): NativeHistory {
		return (this.historyStore ??= new NativeHistory(this.app, this, settings, dir));
	}
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	private emit(): void {
		for (const listener of this.listeners) listener();
	}
	hasPendingSession(): boolean {
		return this.pendingSessions.length > 0;
	}

	// Shutdown state flag
	private isShuttingDown = false;
	private hooks: AutomationHooks;

	constructor(
		app: App,
		settings: TerminalSettings,
		serverManager: ServerManager,
		getTerminalEnvironment: () => Record<string, string> = () => ({}),
		saveSettings: () => Promise<void> = () => Promise.resolve(),
	) {
		this.app = app;
		this.hooks = new AutomationHooks(app.workspace.containerEl.win);
		this.settings = settings;
		this.serverManager = serverManager;
		this.getTerminalEnvironment = getTerminalEnvironment;
		this.saveSettings = saveSettings;

		// Listen for server events
		this.setupServerEventHandlers();
	}

	/**
	 * Set up server event handlers
	 */
	private setupServerEventHandlers(): void {
		// Listen for server error events
		this.serverManager.on('server-error', (error) => {
			if (!this.isShuttingDown) {
				errorLog('[TerminalService] 服务器错误:', error);
				this.handleServerCrash();
			}
		});

		// Listen for WebSocket disconnect events
		this.serverManager.on('ws-disconnected', () => {
			if (!this.isShuttingDown) {
				debugLog('[TerminalService] WebSocket 断开');
				this.handleWebSocketDisconnected();
			}
		});

		this.serverManager.on('ws-connected', () => {
			if (!this.isShuttingDown) {
				debugLog('[TerminalService] WebSocket 已连接');
				void this.handleWebSocketConnected();
			}
		});

		// Listen for successful server starts
		this.serverManager.on('server-started', (port) => {
			debugLog(`[TerminalService] 服务器已启动，端口: ${port}`);
		});
	}

	/**
	 * Handle server crashes
	 */
	private handleServerCrash(): void {
		// Notify all terminal instances
		this.terminals.forEach((terminal) => {
			terminal.handleServerCrash();
		});
	}

	private handleWebSocketDisconnected(): void {
		this.terminals.forEach((terminal) => {
			terminal.handleWebSocketDisconnected();
		});
	}

	private async handleWebSocketConnected(): Promise<void> {
		for (const terminal of this.terminals.values()) {
			await terminal.handleWebSocketConnected(this.serverManager);
		}
	}

	/**
	 * Ensure the server is running
	 *
	 * @returns The server port number
	 */
	async ensureServer(): Promise<number> {
		await this.serverManager.ensureServer();
		const port = this.serverManager.getServerPort();
		if (port === null) {
			throw new Error(t('terminalService.serverNotRunning'));
		}
		return port;
	}

	/**
	 * Get the PTY client
	 */
	async historyClient() {
		await this.ensureServer();
		return this.serverManager.agentData();
	}

	getPtyClient(): PtyClient {
		return this.serverManager.pty();
	}

	getDefaultShellOptions(): DefaultShellOption[] {
		const currentShell = getCurrentPlatformShell(this.settings);
		const shellTypes = getSelectableShellTypes(currentShell);
		return shellTypes.map((shellType) => ({
			shellType,
			label: t(`shellOptions.${shellType}`),
			selected: shellType === currentShell,
		}));
	}

	async setDefaultShell(shellType: ShellType): Promise<void> {
		if (getCurrentPlatformShell(this.settings) === shellType) {
			return;
		}

		setCurrentPlatformShell(this.settings, shellType);
		await this.saveSettings();
		new Notice(
			t('notices.terminal.defaultShellChanged', {
				shell: t(`shellOptions.${shellType}`),
			}),
		);
	}

	/**
	 * Create a new terminal instance
	 *
	 * @returns The created terminal instance
	 * @throws Error if terminal creation fails
	 */
	queueSession(session: PendingTerminalSession): void {
		this.pendingSessions.push(session);
	}

	async createTerminal(
		session?: PendingTerminalSession,
		observe?: (terminal: PtySession) => void,
	): Promise<PtySession> {
		let created: PtySession | undefined;
		let closeHook: (() => void) | undefined;
		try {
			// Ensure the server is running
			await this.serverManager.ensureServer();

			debugLog('[TerminalService] 创建终端');

			const pending = session ?? this.pendingSessions.shift();

			let cwd: string | undefined;
			let shellType = '';
			let shellArgs: string[] | undefined;
			let env: Record<string, string> | undefined;
			if (pending) {
				shellType = pending.shellType;
				shellArgs = pending.shellArgs;
				cwd = pending.cwd ?? this.getVaultPath();
				env = {
					...this.getTerminalEnvironment(),
					...pending.env,
				};
			} else if (this.settings.autoEnterVaultDirectory) {
				cwd = this.getVaultPath();
				if (cwd) {
					debugLog(`[TerminalService] 自动进入项目目录: ${cwd}`);
				}
			}

			if (!pending) {
				const currentShell = getCurrentPlatformShell(this.settings);
				shellType = currentShell;
				if (currentShell === 'custom') {
					const customPath = getCurrentPlatformCustomShellPath(this.settings);
					if (customPath) {
						shellType = `custom:${customPath}`;
					}
				}
				shellArgs = this.settings.shellArgs.length > 0 ? this.settings.shellArgs : undefined;
				const terminalEnv = this.getTerminalEnvironment();
				env = Object.keys(terminalEnv).length > 0 ? terminalEnv : undefined;
			}

			if (pending?.agentId && !env?.NAND_HOOK_TOKEN) {
				const hook = await this.hooks.prepare(pending.agentId, env ?? {}, (event) => {
					if (!created || event.data.parent_session_id || event.data.subagent_id || event.data.agent_id)
						return;
					const id = event.data.session_id;
					if (typeof id === 'string') {
						if (created.nativeSessionId && id !== created.nativeSessionId && event.event !== 'SessionStart')
							return;
						created.nativeSessionId = id;
					}
					if (['UserPromptSubmit', 'BeforeAgent'].includes(event.event)) created.nativeStatus = 'running';
					if (event.event === 'PermissionRequest') created.nativeStatus = 'waiting';
					if (['Stop', 'AfterAgent', 'StopFailure', 'StopCancelled'].includes(event.event))
						created.nativeStatus = 'idle';
					this.emit();
				});
				closeHook = () => hook.close();
				env = { ...env, ...hook.env };
			}
			const terminal = new PtySession({
				shellType,
				shellArgs,
				cwd,
				env,
				fontSize: this.settings.fontSize,
				fontFamily: this.settings.fontFamily,
				cursorStyle: this.settings.cursorStyle,
				cursorBlink: this.settings.cursorBlink,
				scrollback: this.settings.scrollback,
				preferredRenderer: this.settings.preferredRenderer,
				useObsidianTheme: this.settings.useObsidianTheme,
				backgroundColor: this.settings.backgroundColor,
				foregroundColor: this.settings.foregroundColor,
				backgroundImage: this.settings.backgroundImage,
				backgroundImageOpacity: this.settings.backgroundImageOpacity,
				backgroundImageSize: this.settings.backgroundImageSize,
				backgroundImagePosition: this.settings.backgroundImagePosition,
				enableBlur: this.settings.enableBlur,
				blurAmount: this.settings.blurAmount,
				textOpacity: this.settings.textOpacity,
			});

			if (this.isShuttingDown) throw new Error('Terminal service stopped');
			created = terminal;
			terminal.onNativeStatusChange(() => this.emit());
			terminal.observeAutomation((event) => {
				if (event.kind !== 'data') {
					closeHook?.();
					terminal.nativeStatus = 'exited';
					this.emit();
				}
			});
			observe?.(terminal);
			// Initialize the terminal through ServerManager
			await terminal.initializeWithServerManager(this.serverManager);
			if (pending?.title) {
				terminal.setTitle(pending.title);
			}

			if (this.isShuttingDown) {
				terminal.destroy();
				throw new Error('Terminal service stopped');
			}
			this.terminals.set(terminal.id, terminal);
			this.emit();

			return terminal;
		} catch (error) {
			closeHook?.();
			created?.destroy();
			const errorMessage = error instanceof Error ? error.message : String(error);
			errorLog('[TerminalService] 创建终端实例失败:', errorMessage);

			new Notice(t('notices.terminal.createFailed', { message: errorMessage }), 5000);

			throw error;
		}
	}

	/**
	 * Get the Vault path
	 * @returns The absolute Vault path, or undefined if it cannot be resolved
	 */
	private getVaultPath(): string | undefined {
		try {
			const adapter = this.app.vault.adapter as { getBasePath?: () => string };
			if (adapter && typeof adapter.getBasePath === 'function') {
				return adapter.getBasePath();
			}
		} catch (error) {
			debugWarn('[TerminalService] 无法获取 Vault 路径:', error);
		}
		return undefined;
	}

	/**
	 * Get a terminal instance
	 *
	 * @param id The terminal instance ID
	 * @returns The terminal instance, or undefined if it does not exist
	 */
	getTerminal(id: string): PtySession | undefined {
		return this.terminals.get(id);
	}

	/**
	 * Get all terminal instances
	 *
	 * @returns An array of all terminal instances
	 */
	getAllTerminals(): PtySession[] {
		return Array.from(this.terminals.values());
	}

	/**
	 * Destroy the specified terminal instance
	 *
	 * @param id The terminal instance ID
	 */
	async destroyTerminal(id: string): Promise<void> {
		const terminal = this.terminals.get(id);
		if (terminal) {
			try {
				terminal.destroy();
			} catch (error) {
				errorLog(`[TerminalService] 销毁终端 ${id} 失败:`, error);
			} finally {
				this.terminals.delete(id);
				this.emit();

				// Stop the server if this was the last terminal
				if (this.terminals.size === 0 && !this.isShuttingDown) {
					debugLog('[TerminalService] 最后一个终端已关闭，停止服务器');
					await this.serverManager.shutdown();
				}
			}
		}
	}

	/**
	 * Destroy all terminal instances
	 */
	destroyAllTerminals(): void {
		this.hooks.dispose();
		const failedTerminals: string[] = [];

		for (const [id, terminal] of this.terminals.entries()) {
			try {
				terminal.destroy();
			} catch (error) {
				errorLog(`[TerminalService] 销毁终端 ${id} 失败:`, error);
				failedTerminals.push(id);
			}
		}

		// Clear the map
		this.terminals.clear();

		// Log a warning if any terminals failed to clean up
		if (failedTerminals.length > 0) {
			debugWarn(`[TerminalService] 以下终端清理失败: ${failedTerminals.join(', ')}`);
		}
	}

	/**
	 * Update settings
	 *
	 * @param settings The new settings
	 */
	updateSettings(settings: TerminalSettings): void {
		this.settings = settings;
	}

	/**
	 * Get the server status
	 *
	 * @returns Whether the server is currently running
	 */
	isServerRunning(): boolean {
		return this.serverManager.isServerRunning();
	}

	/**
	 * Get the server port
	 *
	 * @returns The server port, or null if the server is not running
	 */
	getServerPort(): number | null {
		return this.serverManager.getServerPort();
	}

	/**
	 * Get the terminal count
	 *
	 * @returns The current number of terminal instances
	 */
	getTerminalCount(): number {
		return this.terminals.size;
	}

	/**
	 * Shut down the service (called when the plugin unloads)
	 */
	async shutdown(): Promise<void> {
		this.isShuttingDown = true;

		debugLog('[TerminalService] 开始关闭终端服务');

		// Destroy all terminals
		this.destroyAllTerminals();

		// Ensure the server is stopped
		if (this.serverManager.isServerRunning()) {
			debugLog('[TerminalService] 停止服务器');
			await this.serverManager.shutdown();
		}

		debugLog('[TerminalService] 终端服务已关闭');
	}
}
