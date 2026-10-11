import type { App } from 'obsidian';
import type { AgentId } from '../../core/launch/types';
import { EMPTY_TABS, type TabsState } from '../../core/terminal/layout';
import type { TerminalSettings } from '../../core/terminal/settings';
import type { HistoryClient } from '../../platform/desktop/server/agent-data-client';
import type { PtyHelper } from '../../platform/desktop/pty/helper';
import { TerminalSession, type Activity, type SessionColors, type SessionKind } from './session';

export interface TerminalHost {
	app: App;
	/** Absolute plugin folder (the helper binary lives in `binaries/`). */
	pluginDir(): string;
	version: string;
	/** `process.platform` of the desktop app. */
	platform: string;
	settings(): TerminalSettings;
	colors(): SessionColors;
	/** Install or locate the helper; reports download progress through notices. */
	binary(): Promise<string>;
	/** Native lifecycle events for an agent session (hooks), returning extra environment. */
	agentHooks?(agentId: AgentId, env: Record<string, string>, activity: (activity: Activity, data: Record<string, unknown>) => void): Promise<{ env: Record<string, string>; close(): void }>;
}

export interface CreateSession {
	signal?: AbortSignal;
	kind: SessionKind;
	title: string;
	file: string;
	args: string[];
	cwd: string;
	env?: Record<string, string>;
	agentId?: AgentId;
	automated?: boolean;
	/** Watch native lifecycle hooks for this agent session (interactive agents). */
	hooks?: boolean;
	cols?: number;
	rows?: number;
	/** Runs before the process starts, so observers see its very first output. */
	prepare?: (session: TerminalSession) => void;
}

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;

/** Activity reported by a CLI's native lifecycle event. */
export function hookActivity(event: string): Activity | undefined {
	if (event === 'UserPromptSubmit' || event === 'BeforeAgent' || event === 'PreToolUse' || event === 'BeforeTool') return 'running';
	if (event === 'Notification' || event === 'PermissionRequest') return 'waiting';
	if (event === 'Stop' || event === 'AfterAgent' || event === 'StopFailure' || event === 'StopCancelled' || event === 'Interrupt' || event === 'SessionStart') return 'idle';
	return undefined;
}

/**
 * Every terminal session of one module activation, the helper process behind them and the tab layout
 * that all workbench pages show. Sessions outlive their pages; disposing the module ends them.
 */
export class TerminalSessions {
	private helper?: PtyHelper;
	private starting?: Promise<PtyHelper>;
	private readonly sessions = new Map<string, TerminalSession>();
	private readonly bySid = new Map<number, TerminalSession>();
	private readonly hooks = new Map<string, () => void>();
	private readonly listeners = new Set<() => void>();
	private readonly connectionListeners = new Set<() => void>();
	private connectionRevision = 0;
	private nextSid = 1;
	private disposed = false;
	private tabState: TabsState = EMPTY_TABS;
	/** The session that "send to terminal" commands target. */
	private lastFocused?: string;

	constructor(private readonly host: TerminalHost) {}

	private changed(): void {
		for (const listener of [...this.listeners]) listener();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	list(): TerminalSession[] {
		return [...this.sessions.values()];
	}

	get(id: string): TerminalSession | undefined {
		return this.sessions.get(id);
	}

	get tabs(): TabsState {
		return this.tabState;
	}

	setTabs(state: TabsState): void {
		if (state === this.tabState) return;
		this.tabState = state;
		this.changed();
	}

	focus(id: string): void {
		if (!this.sessions.has(id) || this.lastFocused === id) return;
		this.lastFocused = id;
	}

	/** The session commands like "send selection to terminal" go to. */
	get focused(): TerminalSession | undefined {
		const last = this.lastFocused ? this.sessions.get(this.lastFocused) : undefined;
		if (last?.running) return last;
		return this.list().filter((session) => session.running && !session.automated).at(-1);
	}

	/** Start the helper if needed (installing it first). */
	async ensureHelper(): Promise<PtyHelper> {
		if (this.disposed) throw new Error('The terminal module is off');
		if (this.helper?.alive) return this.helper;
		this.starting ??= (async () => {
			const binary = await this.host.binary();
			const { PtyHelper } = await import('../../platform/desktop/pty/helper');
			let started: PtyHelper | undefined;
			const helper = await PtyHelper.start(binary, {
				output: (sid, bytes) => this.bySid.get(sid)?.receive(bytes),
				exit: (sid, code, signal) => this.exited(sid, code, signal),
				closed: (reason) => {
					if (started) this.helperClosed(started, reason);
				},
			}, this.host.app.workspace.containerEl.win);
			started = helper;
			if (this.disposed) {
				helper.dispose();
				throw new Error('The terminal module is off');
			}
			this.helper = helper;
			this.connectionRevision++;
			for (const listener of [...this.connectionListeners]) listener();
			return helper;
		})().finally(() => {
			this.starting = undefined;
		});
		return this.starting;
	}

	private helperClosed(helper: PtyHelper, reason: string): void {
		if (this.helper && this.helper !== helper) return;
		this.helper = undefined;
		for (const session of this.sessions.values()) session.disconnect(reason);
		this.connectionRevision++;
		for (const listener of [...this.connectionListeners]) listener();
		this.changed();
	}

	private exited(sid: number, code: number | null, signal: string | null): void {
		const session = this.bySid.get(sid);
		if (!session) return;
		session.exit(code, signal);
		this.hooks.get(session.id)?.();
		this.hooks.delete(session.id);
		this.changed();
	}

	async create(request: CreateSession): Promise<TerminalSession> {
		request.signal?.throwIfAborted();
		const helper = await this.ensureHelper();
		request.signal?.throwIfAborted();
		if (this.disposed) throw new Error('The terminal module is off');
		const settings = this.host.settings();
		const sid = this.nextSid++;
		const session = new TerminalSession({
			id: `terminal-${crypto.randomUUID()}`,
			sid,
			kind: request.kind,
			title: request.title,
			cwd: request.cwd,
			agentId: request.agentId,
			automated: request.automated,
			cols: request.cols ?? DEFAULT_COLS,
			rows: request.rows ?? DEFAULT_ROWS,
			scrollback: settings.scrollback,
			platform: this.host.platform,
			colors: () => this.host.colors(),
		});
		this.sessions.set(session.id, session);
		this.bySid.set(sid, session);
		session.onChange(() => this.changed());
		request.prepare?.(session);
		this.changed();
		let env: Record<string, string> = {
			TERM: 'xterm-256color',
			COLORTERM: 'truecolor',
			TERM_PROGRAM: 'nand',
			...request.env,
			NAND_SESSION_ID: session.id,
		};
		let spawning = false;
		const abort = () => { if (spawning) helper.end(sid, true); };
		request.signal?.addEventListener('abort', abort, { once: true });
		try {
			if (request.hooks && request.agentId && this.host.agentHooks) {
				const hook = await this.host.agentHooks(request.agentId, env, (activity) => session.setActivity(activity));
				env = { ...env, ...hook.env };
				this.hooks.set(session.id, () => hook.close());
			}
			request.signal?.throwIfAborted();
			if (this.disposed || !this.sessions.has(session.id)) throw new Error('The terminal session is closed');
			spawning = true;
			const pid = await helper.spawnSession(sid, { file: request.file, args: request.args, cwd: request.cwd, env, cols: session.cols, rows: session.rows });
			if (request.signal?.aborted || this.disposed || !this.sessions.has(session.id)) {
				helper.end(sid, true);
				throw new Error('The terminal session is closed');
			}
			session.attach(
				{
					input: (id, data) => this.helper?.input(id, data),
					resize: (id, cols, rows) => this.helper?.resize(id, cols, rows),
					acknowledge: (id, bytes) => this.helper?.acknowledge(id, bytes),
					end: (id, force) => this.helper?.end(id, force),
				},
				pid,
			);
		} catch (error) {
			this.hooks.get(session.id)?.();
			this.hooks.delete(session.id);
			session.fail(error instanceof Error ? error.message : String(error));
		} finally {
			request.signal?.removeEventListener('abort', abort);
		}
		this.changed();
		return session;
	}

	/** Hang up a running session (force kills). The session stays listed until removed. */
	end(id: string, force = false): void {
		this.sessions.get(id)?.end(force);
	}

	/** Forget a session; a running one is ended first. */
	remove(id: string): void {
		const session = this.sessions.get(id);
		if (!session) return;
		if (session.running) {
			session.end();
			session.exit(-1, null);
		}
		this.hooks.get(id)?.();
		this.hooks.delete(id);
		this.sessions.delete(id);
		this.bySid.delete(session.sid);
		if (this.lastFocused === id) this.lastFocused = undefined;
		session.dispose();
		this.changed();
	}

	/** The native history channel through the helper. */
	historyClient(): HistoryClient {
		const revision = () => this.connectionRevision;
		return {
			request: async <T>(op: 'scan' | 'query' | 'read', payload: Record<string, unknown>, signal?: AbortSignal) => (await this.ensureHelper()).history<T>(op, payload, signal),
			isConnected: () => !!this.helper?.alive,
			get connectionRevision() {
				return revision();
			},
			subscribeConnection: (listener) => {
				this.connectionListeners.add(listener);
				return () => this.connectionListeners.delete(listener);
			},
		};
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const close of this.hooks.values()) close();
		this.hooks.clear();
		for (const session of this.sessions.values()) session.dispose();
		this.sessions.clear();
		this.bySid.clear();
		this.helper?.dispose();
		this.helper = undefined;
		this.listeners.clear();
		this.connectionListeners.clear();
	}
}
