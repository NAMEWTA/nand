import { SerializeAddon } from '@xterm/addon-serialize';
import type { Terminal } from '@xterm/headless';
import Headless from '@xterm/headless';
import process from 'node:process';
import {
	createSynchronizedOutputCompatibilityState,
	filterSynchronizedOutputScrollbackPurge,
} from '../../../core/pty/ai-tui-compatibility';
import { ClaudeCodeSessionState } from '../../../core/pty/claude-code-session-state';
import {
	buildClaudeCodeTuiEnv,
	XTVERSION_RESPONSE,
	type ClaudeCodeExtendedKeyboardMode,
} from '../../../core/pty/claude-code-tui-support';
import {
	extractCmdCwd,
	extractCwdFromPromptLines,
	extractGitBashPromptCwd,
	extractGitBashWindowTitleCwd,
	extractPowerShellCwd,
	extractWslPromptCwd,
} from '../../../core/pty/prompt-cwd-parsers';
import type { TerminalOptions } from '../../../core/pty/terminal-options';
import { TerminalTitleState } from '../../../core/pty/terminal-title-state';
import { t } from '../../../shared/i18n/terminal-accessor';
import type { PtyClient } from '../../terminal-server/pty-client';
import type { ServerManager } from '../../terminal-server/server-manager';
import type { ShellEvent, ShellEventSource } from '../../terminal-server/types';
import { debugLog, debugWarn } from '../logger';
import { getHomeDir } from '../platform';
type NativeTerminalStatus = 'unknown' | 'running' | 'waiting' | 'idle' | 'exited';

/** Process, VT state and automation survive independently of any renderer or leaf. */
export class PtySession {
	private automationObservers = new Set<
		(
			event:
				{ kind: 'data'; text: string } | { kind: 'exit'; code: number } | { kind: 'cancelled' | 'interrupted' },
		) => void
	>();
	automationManaged = false;
	observeAutomation(
		callback: (
			event:
				{ kind: 'data'; text: string } | { kind: 'exit'; code: number } | { kind: 'cancelled' | 'interrupted' },
		) => void,
	): () => void {
		this.automationObservers.add(callback);
		return () => this.automationObservers.delete(callback);
	}
	private emitAutomation(
		event: { kind: 'data'; text: string } | { kind: 'exit'; code: number } | { kind: 'cancelled' | 'interrupted' },
	): void {
		for (const observer of this.automationObservers) observer(event);
	}
	private nativeState: NativeTerminalStatus = 'unknown';
	private nativeStateListeners = new Set<() => void>();
	get nativeStatus(): NativeTerminalStatus {
		return this.nativeState;
	}
	set nativeStatus(value: NativeTerminalStatus) {
		if (this.nativeState === value) return;
		this.nativeState = value;
		for (const listener of this.nativeStateListeners) listener();
	}
	onNativeStatusChange(listener: () => void): () => void {
		this.nativeStateListeners.add(listener);
		return () => {
			this.nativeStateListeners.delete(listener);
		};
	}
	nativeSessionId?: string;
	private titleState: TerminalTitleState;
	private titleChangeCallbacks: Set<(title: string) => void> = new Set();
	private currentCwd: string | null = null;
	private commandHistory: Array<{
		startTime: number;
		endTime: number;
		durationMs: number;
		exitCode: number | null;
		source: ShellEventSource;
	}> = [];
	private activeCommandStart: number | null = null;
	private claudeCodeSessionState = new ClaudeCodeSessionState();
	private synchronizedOutputCompatibilityState = createSynchronizedOutputCompatibilityState();
	getClaudeCodeExtendedKeyboardMode(): ClaudeCodeExtendedKeyboardMode {
		return this.claudeCodeSessionState.getExtendedKeyboardMode();
	}
	observeClaudeCodeXtversionQuery(): void {
		this.claudeCodeSessionState.observeXtversionQuery();
		this.applyTitleChange(this.titleState.setAutomaticTitle('Claude Code'));
	}
	observeClaudeCodeModifyOtherKeysMode(enabled: boolean): void {
		this.claudeCodeSessionState.observeModifyOtherKeysMode(enabled);
		this.applyTitleChange(
			enabled ? this.titleState.setAutomaticTitle('Claude Code') : this.titleState.clearAutomaticTitle(),
		);
	}
	observeShellPrompt(): void {
		this.claudeCodeSessionState.observeShellPrompt();
		this.applyTitleChange(this.titleState.clearAutomaticTitle());
	}
	private applyTitleChange(changed: boolean): void {
		if (changed) {
			const title = this.titleState.getTitle();
			this.titleChangeCallbacks.forEach((callback) => callback(title));
		}
	}
	getTitle(): string {
		return this.titleState.getTitle();
	}
	isClaudeCodeSession(): boolean {
		return this.claudeCodeSessionState.isActive();
	}
	setTitle(title: string): void {
		this.applyTitleChange(this.titleState.setCustomTitle(title));
	}
	private extractCwdFromOutput(data: string): void {
		// OSC 7 format (standard): \x1b]7;file://hostname/path\x07 or \x1b]7;file://hostname/path\x1b\\
		// eslint-disable-next-line no-control-regex -- Need to match ANSI control sequences
		const osc7Match = data.match(/\x1b\]7;file:\/\/[^/]*([^\x07\x1b]+)[\x07\x1b]/);
		if (osc7Match?.[1]) {
			try {
				const path = decodeURIComponent(osc7Match[1]);
				this.currentCwd = path;
				debugLog('[Terminal CWD] OSC7 matched:', path);
				return;
			} catch {
				// Ignore decode failures
			}
		}

		// OSC 9;9 format (Windows Terminal/PowerShell): \x1b]9;9;path\x07
		// eslint-disable-next-line no-control-regex -- Need to match ANSI control sequences
		const osc9Match = data.match(/\x1b\]9;9;([^\x07\x1b]+)[\x07\x1b]/);
		if (osc9Match?.[1]) {
			this.currentCwd = osc9Match[1];
			debugLog('[Terminal CWD] OSC9 matched:', this.currentCwd);
			return;
		}

		// OSC 0 (Git Bash window title): \x1b]0;MINGW64:/path\x07
		const gitBashWindowTitleCwd = extractGitBashWindowTitleCwd(data);
		if (gitBashWindowTitleCwd) {
			this.currentCwd = gitBashWindowTitleCwd;
			debugLog('[Terminal CWD] OSC0 (Git Bash) matched:', gitBashWindowTitleCwd);
			return;
		}

		// Prompt parsing (fallback for shells that do not emit OSC sequences).
		// eslint-disable-next-line no-control-regex -- Need to strip CSI sequences before prompt matching
		const cleanData = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

		const psCwd = extractPowerShellCwd(cleanData);
		if (psCwd) {
			this.currentCwd = psCwd;
			debugLog('[Terminal CWD] PowerShell prompt matched:', psCwd);
			return;
		}

		const cmdCwd = extractCmdCwd(cleanData);
		if (cmdCwd) {
			this.currentCwd = cmdCwd;
			debugLog('[Terminal CWD] CMD prompt matched:', cmdCwd);
			return;
		}

		const gitBashCwd = extractGitBashPromptCwd(cleanData, getHomeDir());
		if (gitBashCwd) {
			this.currentCwd = gitBashCwd;
			debugLog('[Terminal CWD] Git Bash prompt matched:', gitBashCwd);
			return;
		}

		const wslCwd = extractWslPromptCwd(cleanData);
		if (wslCwd) {
			this.currentCwd = wslCwd;
			debugLog('[Terminal CWD] WSL prompt matched:', wslCwd);
		}
	}
	getInitialCwd(): string {
		return this.options.cwd || getHomeDir() || process.cwd();
	}
	private readCwdFromScreen(): string | null {
		try {
			const buffer = this.emulator.buffer.active;
			const cursorAbsoluteRow = buffer.baseY + buffer.cursorY;

			const cursorLine = buffer.getLine(cursorAbsoluteRow)?.translateToString(true) ?? '';
			const previousLine =
				cursorAbsoluteRow > 0 ? (buffer.getLine(cursorAbsoluteRow - 1)?.translateToString(true) ?? null) : null;

			return extractCwdFromPromptLines(cursorLine, previousLine, getHomeDir());
		} catch (error) {
			debugWarn('[Terminal CWD] readCwdFromScreen failed:', error);
			return null;
		}
	}
	onTitleChange(callback: (title: string) => void): () => void {
		this.titleChangeCallbacks.add(callback);
		return () => {
			this.titleChangeCallbacks.delete(callback);
		};
	}
	readonly id = 'terminal-' + crypto.randomUUID();
	readonly shellType: string;
	private emulator: Terminal;
	private serializer = new SerializeAddon();
	private client: PtyClient | null = null;
	private sessionId: string | null = null;
	private stopped = false;
	private exited = false;
	private needsRecovery = false;
	private recovering = false;
	private subscriptions: (() => void)[] = [];
	private outputs = new Set<(text: string) => void>();
	private shellEvents = new Set<(event: ShellEvent) => void>();
	private disposals = new Set<() => void>();
	private decoder = new TextDecoder();
	private options: TerminalOptions;
	constructor(options: TerminalOptions = {}) {
		this.options = options;
		this.shellType = options.shellType || 'default';
		this.titleState = new TerminalTitleState(t('terminal.defaultTitle'));
		this.emulator = new Headless.Terminal({
			cols: 80,
			rows: 24,
			scrollback: options.scrollback ?? 1000,
			allowProposedApi: true,
		});
		// SerializeAddon uses the common terminal buffer API; its declarations name the browser Terminal.
		this.emulator.loadAddon(this.serializer);
		this.emulator.onData((data) => this.write(data));
		this.emulator.parser.registerCsiHandler({ prefix: '>', final: 'q' }, (params) => {
			if (params.length > 1 || (params[0] ?? 0) !== 0) return false;
			this.observeClaudeCodeXtversionQuery();
			this.write(XTVERSION_RESPONSE);
			return true;
		});
		this.emulator.parser.registerCsiHandler({ prefix: '>', final: 'm' }, (params) => {
			if (params[0] !== 4) return false;
			this.observeClaudeCodeModifyOtherKeysMode(params[1] === 2);
			return true;
		});
	}
	getOptions(): Readonly<TerminalOptions> {
		return this.options;
	}
	getCwd(): string {
		return this.readCwdFromScreen() || this.currentCwd || this.getInitialCwd();
	}
	getCommandHistory() {
		return [...this.commandHistory];
	}
	get isDisposed(): boolean {
		return this.stopped;
	}
	isAlive(): boolean {
		return !this.stopped && !this.exited && !!this.sessionId && !!this.client?.isConnected();
	}
	write(data: string): void {
		if (!this.stopped && !this.exited && this.sessionId) this.client?.write(this.sessionId, data);
	}
	sendText(data: string): void {
		this.write(data);
	}
	writeBinary(data: Uint8Array): void {
		if (!this.stopped && !this.exited && this.sessionId) this.client?.writeBinary(this.sessionId, data);
	}
	resize(cols: number, rows: number): void {
		if (this.stopped || cols < 1 || rows < 1) return;
		this.emulator.resize(cols, rows);
		if (this.sessionId) this.client?.resize(this.sessionId, cols, rows);
	}
	/** Subscribe and replay the parsed screen atomically; no prompt is submitted. */
	onOutput(listener: (text: string) => void): () => void {
		if (this.stopped) return () => {};
		listener(this.serializer.serialize());
		this.outputs.add(listener);
		return () => {
			this.outputs.delete(listener);
		};
	}
	onShellEvent(listener: (event: ShellEvent) => void): () => void {
		this.shellEvents.add(listener);
		return () => {
			this.shellEvents.delete(listener);
		};
	}
	onDispose(listener: () => void): () => void {
		if (this.stopped) {
			listener();
			return () => {};
		}
		this.disposals.add(listener);
		return () => {
			this.disposals.delete(listener);
		};
	}
	private paint(text: string): void {
		if (this.stopped) return;
		this.emulator.write(text, () => {
			if (!this.stopped) for (const listener of this.outputs) listener(text);
		});
	}
	async initializeWithServerManager(manager: ServerManager): Promise<void> {
		if (this.stopped || this.sessionId) return;
		await manager.ensureServer();
		if (this.stopped) return;
		await this.initialize(manager, this.options.cwd);
	}
	private async initialize(manager: ServerManager, cwd?: string): Promise<void> {
		const client = manager.pty();
		this.decoder = new TextDecoder();
		this.claudeCodeSessionState.reset();
		this.synchronizedOutputCompatibilityState = createSynchronizedOutputCompatibilityState();
		await client.init(
			{
				shell_type: this.shellType === 'default' ? undefined : this.shellType,
				shell_args: this.options.shellArgs,
				cwd,
				env: buildClaudeCodeTuiEnv(process.env, this.options.env),
				cols: this.emulator.cols,
				rows: this.emulator.rows,
			},
			(id) => {
				if (this.stopped) {
					client.destroySession(id);
					return;
				}
				this.client = client;
				this.sessionId = id;
				this.exited = false;
				this.subscriptions.push(
					client.onSessionOutput(id, (bytes) => {
						const raw = this.decoder.decode(bytes, { stream: true });
						this.emitAutomation({ kind: 'data', text: raw });
						const text = filterSynchronizedOutputScrollbackPurge(
							raw,
							this.synchronizedOutputCompatibilityState,
						);
						this.extractCwdFromOutput(text);
						this.paint(text);
					}),
					client.onSessionExit(id, (code) => {
						this.exited = true;
						this.nativeStatus = 'exited';
						const tail = this.decoder.decode();
						if (tail) {
							this.emitAutomation({ kind: 'data', text: tail });
							this.paint(tail);
						}
						this.emitAutomation({ kind: 'exit', code });
						this.paint('\r\n' + t('terminal.processExited', { code }) + '\r\n');
					}),
					client.onSessionError(id, (_code, message) => this.paint('\r\n' + message + '\r\n')),
					client.onSessionShellEvent(id, (event) => {
						if (event.type === 'prompt_start') this.observeShellPrompt();
						if (event.type === 'command_start') this.activeCommandStart = Date.now();
						if (event.type === 'command_end') {
							const endTime = Date.now(),
								startTime = this.activeCommandStart ?? endTime;
							this.commandHistory.push({
								startTime,
								endTime,
								durationMs: Math.max(0, endTime - startTime),
								exitCode: event.exitCode,
								source: event.source,
							});
							this.activeCommandStart = null;
						}
						for (const listener of this.shellEvents) listener(event);
					}),
				);
			},
		);
	}
	private disconnect(): void {
		for (const off of this.subscriptions) off();
		this.subscriptions = [];
		this.sessionId = null;
	}
	handleServerCrash(): void {
		this.handleWebSocketDisconnected();
	}
	handleWebSocketDisconnected(): void {
		if (this.stopped || this.exited) return;
		if (this.automationManaged) {
			this.emitAutomation({ kind: 'interrupted' });
			this.destroy();
			return;
		}
		if (!this.needsRecovery) this.paint('\r\n' + t('notices.terminal.reconnecting') + '\r\n');
		this.needsRecovery = true;
		this.nativeStatus = 'unknown';
		this.disconnect();
	}
	async handleWebSocketConnected(manager: ServerManager): Promise<void> {
		if (this.stopped || !this.needsRecovery || this.recovering) return;
		this.recovering = true;
		try {
			const cwd = this.getCwd();
			try {
				await this.initialize(manager, cwd);
			} catch (error) {
				if (cwd === this.getInitialCwd() || this.stopped) throw error;
				this.disconnect();
				await this.initialize(manager, this.options.cwd);
			}
			this.needsRecovery = false;
		} catch (error) {
			debugWarn('[Terminal] Session recovery failed', error);
		} finally {
			this.recovering = false;
		}
	}
	destroy(): void {
		if (this.stopped) return;
		this.stopped = true;
		if (!this.exited) this.emitAutomation({ kind: 'cancelled' });
		this.nativeStatus = 'exited';
		if (this.sessionId) this.client?.destroySession(this.sessionId);
		this.disconnect();
		this.client = null;
		for (const dispose of this.disposals) dispose();
		this.disposals.clear();
		this.outputs.clear();
		this.shellEvents.clear();
		this.automationObservers.clear();
		this.nativeStateListeners.clear();
		this.titleChangeCallbacks.clear();
		this.emulator.dispose();
	}
}
