import { deviceId as getDeviceId } from '../../../host/obsidian/storage/device-id';
import { AGENT_CATALOG, getAgent } from '../core/launch/catalog';
import { effectivePermission, launchArgs } from '../core/launch/flags';
import type { AgentId, AgentSettings } from '../core/launch/types';
import { AutomationHooks, type NativeHookEvent } from '../platform/desktop/hooks/automation-hooks';
import { absolutePluginDir, accountEnv } from '../platform/desktop/agents/accounts';
import { resolveCli } from '../platform/desktop/agents/resolver';
import { runtimeProcess } from '../platform/desktop/agents/runtime-process';
import { canonicalVaultCwd } from '../platform/desktop/history/canonical-cwd';
import { createNodeSessionIo } from '../platform/desktop/history/scan';
import { isCwdInsideVault } from '../platform/desktop/history/scope';
import { AutomationError } from '../../../shared/automation/errors';
import type {
	AgentRunHandle,
	AgentRuntimePort,
	AgentSessionRef,
	AutomationAction,
	AutomationRun,
} from '../../../shared/automation/types';
import { JsonStore } from '../../../shared/json-store';
import type { App } from 'obsidian';
import type { NativeHistory } from '../platform/history/service';
import type { ShellCommand } from '../platform/desktop/pty/shells';
import type { TerminalSession } from './terminal/session';
import type { CreateSession } from './terminal/sessions';

/** What the automation runtime needs from the agent module. */
export interface AutomationRuntimeHost {
	app: App;
	/** Plugin folder as given in the manifest (vault-relative or absolute). */
	pluginDir: string;
	agentSettings(): AgentSettings;
	history(): NativeHistory;
	create(request: CreateSession): Promise<TerminalSession>;
	remove(id: string): void;
	open(id: string): Promise<void>;
	shell(kind: 'bash' | 'powershell'): ShellCommand;
}

// Orca's native resume capability set, pinned to 27b823f (MIT, Lovecast Inc.).
export const RESUME_FLAGS: Readonly<Record<AgentId, readonly string[]>> = {
	'claude-code': ['--resume'],
	codex: ['resume'],
	gemini: ['--resume'],
	opencode: ['--session'],
	pi: ['--session'],
	grok: ['--resume'],
};
export function automationArgs(
	agentId: AgentId,
	prompt: string,
	base: string[],
	session?: AgentSessionRef,
): string[] {
	const agent = getAgent(agentId);
	const args = [...base];
	if (session) {
		// Pi resumes from its transcript file; every other CLI from the session id.
		const locator = agentId === 'pi' ? session.transcriptPath : session.sessionId;
		if (!locator) throw new AutomationError('sessionMissing');
		args.push(...RESUME_FLAGS[agentId], locator);
	}
	if (agent.promptFlag) args.push(agent.promptFlag, prompt);
	else {
		if (agent.promptSeparator) args.push('--');
		args.push(prompt);
	}
	return args;
}
type AgentAction = Extract<AutomationAction, { kind: 'agent' }>;
type RunResult = Awaited<AgentRunHandle['completion']>;
interface LiveSession {
	listeners?: Set<() => void>;
	terminal?: TerminalSession;
	action: AgentAction;
	accountKey: string;
	busy: boolean;
	started: boolean;
	since: number;
	output: string;
	session?: AgentSessionRef;
	finish?: (result: RunResult) => void;
	hookClose?: () => void;
}
function accountIdentity(key: string): string {
	const value = JSON.parse(key) as Record<string, string>;
	return JSON.stringify(
		Object.keys(value)
			.sort()
			.map((name) => [name, value[name]]),
	);
}
const vaultPath = (app: App): string => (app.vault.adapter as unknown as { getBasePath(): string }).getBasePath();

export class TerminalAutomationRuntime implements AgentRuntimePort {
	private readonly reservations = new Set<string>();
	private disposed = false;

	private live = new Map<string, LiveSession>();
	private hooks: AutomationHooks;
	private registry: AgentSessionRef[] = [];
	private store: JsonStore<AgentSessionRef[]>;
	private loaded: Promise<void>;
	constructor(private host: AutomationRuntimeHost) {
		this.hooks = new AutomationHooks(host.app.workspace.containerEl.win);
		const device = getDeviceId(host.app);
		this.store = new JsonStore(
			host.app.vault.adapter,
			`.nand/terminal-agent/${device}/automation-sessions.json`,
			(v): v is AgentSessionRef[] =>
				Array.isArray(v) &&
				v.every(
					(item: unknown) =>
						!!item && typeof item === 'object' && typeof (item as AgentSessionRef).sessionId === 'string',
				),
		);
		this.loaded = this.store.load([]).then((rows) => {
			this.registry = rows;
		});
	}
	listAgents() {
		const settings = this.host.agentSettings();
		return AGENT_CATALOG.map((a) => ({
			id: a.id,
			title: a.title,
			enabled: settings.agents[a.id]?.enabled ?? false,
			installed: !!resolveCli(a.detectCommand, settings.agents[a.id]?.cliPath ?? '', ''),
		}));
	}
	async listSessions(cwd: string): Promise<AgentSessionRef[]> {
		await this.loaded;
		const canonical = await canonicalVaultCwd(vaultPath(this.host.app), cwd);
		const history = this.host.history();
		await history.scan();
		const result: AgentSessionRef[] = [];
		for (let offset = 0; ; offset += 100) {
			const page = await history.query('', offset);
			result.push(...page.rows.filter((s) => isCwdInsideVault(canonical, s.cwd, runtimeProcess().platform)));
			if (offset + 100 >= page.total) break;
		}
		return result;
	}

	private receive(slot: LiveSession, event: NativeHookEvent): void {
		if (event.at < slot.since || event.data.agent_id || event.data.subagent_id || event.data.parent_session_id)
			return;
		const id = event.data.session_id ?? event.data.sessionId;
		if (typeof id === 'string' && id) {
			slot.session = {
				agentId: slot.action.agentId,
				sessionId: id,
				cwd: slot.action.cwd,
				title: slot.action.prompt.slice(0, 100),
				modifiedAtMs: event.at,
				accountKey: slot.accountKey,
				transcriptPath: typeof event.data.transcript_path === 'string' ? event.data.transcript_path : undefined,
			};
			this.registry = [
				...this.registry.filter(
					(s) =>
						!(s.agentId === slot.action.agentId && s.sessionId === id && s.accountKey === slot.accountKey),
				),
				slot.session,
			];
			void this.store.save(this.registry).catch(console.error);
		}
		if (event.event === 'UserPromptSubmit' || event.event === 'BeforeAgent') {
			slot.busy = true;
			slot.terminal?.setActivity('running');
			slot.started = true;
			for (const listener of slot.listeners ?? []) listener();
		}
		if (slot.started && ['Stop', 'AfterAgent', 'StopFailure', 'StopCancelled'].includes(event.event)) {
			slot.busy = false;
			slot.terminal?.setActivity('idle');
			slot.started = false;
			const message =
				typeof event.data.last_assistant_message === 'string'
					? event.data.last_assistant_message.slice(-8000)
					: '';
			slot.finish?.({
				status:
					event.event === 'StopFailure'
						? 'failed'
						: event.event === 'StopCancelled'
							? 'cancelled'
							: 'succeeded',
				message,
				output: slot.output,
				session: slot.session,
			});
			slot.finish = undefined;
		}
	}
	private async sessionUsage(session: AgentSessionRef) {
		const abort = new AbortController();
		const timeout = this.host.app.workspace.containerEl.win.setTimeout(() => abort.abort(), 10_000);
		try {
			const history = this.host.history();
			await history.scan(abort.signal);
			for (let offset = 0; ; offset += 100) {
				const page = await history.query('', offset, abort.signal);
				const row = page.rows.find(
					(s) =>
						s.agentId === session.agentId &&
						s.sessionId === session.sessionId &&
						s.accountKey === session.accountKey,
				);
				if (row) return row.usage;
				if (offset + 100 >= page.total) return undefined;
			}
		} finally {
			this.host.app.workspace.containerEl.win.clearTimeout(timeout);
		}
	}
	async start(action: AgentAction, run: AutomationRun, previous?: AutomationRun): Promise<AgentRunHandle> {
		await this.loaded;
		const id = action.agentId as AgentId;
		const settings = this.host.agentSettings();
		const entry = settings.agents[id];
		if (!entry?.enabled || !AGENT_CATALOG.some((agent) => agent.id === id))
			throw new AutomationError('agentDisabled');
		const agent = getAgent(id);
		const command = resolveCli(agent.detectCommand, entry.cliPath, '');
		if (!command) throw new AutomationError('cliMissing');
		try {
			await canonicalVaultCwd(vaultPath(this.host.app), action.cwd);
		} catch {
			throw new AutomationError('cwdInvalid');
		}
		if (
			effectivePermission(settings, id) === 'yolo' &&
			!settings.yoloAcknowledged &&
			launchArgs(settings, id).length
		)
			throw new AutomationError('permissionRequired');
		const io = createNodeSessionIo();
		if (
			action.sessionMode === 'specific' &&
			(!action.session ||
				action.session.agentId !== id ||
				action.session.cwd !== action.cwd ||
				!action.session.sessionId)
		)
			throw new AutomationError('sessionMissing');
		if (
			action.sessionMode === 'specific' &&
			action.session?.transcriptPath &&
			!(await io.stat(action.session.transcriptPath))?.isFile
		)
			throw new AutomationError('sessionMissing');
		let sessionEnv: Record<string, string> | undefined;
		if (action.sessionMode === 'specific' && action.session?.accountKey) {
			try {
				sessionEnv = JSON.parse(action.session.accountKey) as Record<string, string>;
			} catch {
				throw new AutomationError('sessionMissing');
			}
			if (
				!sessionEnv ||
				typeof sessionEnv !== 'object' ||
				Array.isArray(sessionEnv) ||
				Object.values(sessionEnv).some((value) => typeof value !== 'string')
			)
				throw new AutomationError('sessionMissing');
		}
		const env = sessionEnv ?? accountEnv(agent, entry.accountId, absolutePluginDir(vaultPath(this.host.app), this.host.pluginDir));
		const accountKey = JSON.stringify(env);
		if (action.sessionMode === 'specific') {
			const sessions = await this.listSessions(action.cwd);
			if (
				!sessions.some(
					(session) =>
						session.agentId === id &&
						session.sessionId === action.session?.sessionId &&
						accountIdentity(session.accountKey) === accountIdentity(accountKey) &&
						session.cwd === action.cwd,
				)
			)
				throw new AutomationError('sessionMissing');
		}
		if (
			action.sessionMode === 'specific' &&
			[...this.live.values()].some(
				(v) =>
					v.busy &&
					(v.session || v.action.session)?.sessionId === action.session?.sessionId &&
					v.action.agentId === id &&
					accountIdentity(v.accountKey) === accountIdentity(accountKey),
			)
		)
			throw new AutomationError('busy');
		const reservation =
			action.sessionMode === 'specific'
				? JSON.stringify([id, accountIdentity(accountKey), action.session!.sessionId])
				: null;
		if (this.disposed) throw new AutomationError('busy');
		if (reservation && this.reservations.has(reservation)) throw new AutomationError('busy');
		if (reservation) this.reservations.add(reservation);
		try {
			const prior =
				action.sessionMode === 'reuse' && previous?.terminalId ? this.live.get(previous.terminalId) : undefined;
			const reuse =
				prior &&
				!prior.busy &&
				prior.terminal?.running &&
				prior.action.agentId === id &&
				prior.action.cwd === action.cwd &&
				prior.accountKey === accountKey
					? prior
					: undefined;
			const slot: LiveSession = reuse ?? {
				action,
				accountKey,
				busy: true,
				started: false,
				since: Date.now(),
				output: '',
			};
			slot.action = action;
			slot.busy = true;
			slot.started = false;
			slot.since = Date.now();
			slot.output = '';
			const completion = new Promise<RunResult>((resolve) => {
				slot.finish = resolve;
			});
			const priorSession = action.sessionMode === 'specific' ? action.session : reuse?.session;
			const baseline = priorSession ? await this.sessionUsage(priorSession).catch(() => undefined) : undefined;
			const measuredCompletion = completion.then(async (result) => {
				if (!result.session) return result;
				try {
					const usage = await this.sessionUsage(result.session);
					if (usage?.known && (!priorSession || baseline?.known))
						result.usage = {
							input: Math.max(0, usage.input - (baseline?.input ?? 0)),
							output: Math.max(0, usage.output - (baseline?.output ?? 0)),
							cacheRead: Math.max(0, usage.cacheRead - (baseline?.cacheRead ?? 0)),
							cacheWrite: Math.max(0, usage.cacheWrite - (baseline?.cacheWrite ?? 0)),
							cost:
								usage.cost === null || (baseline && baseline.cost === null)
									? null
									: Math.max(0, usage.cost - (baseline?.cost ?? 0)),
							known: true,
						};
				} catch {
					/* Unavailable native usage must never change the run result. */
				}
				return result;
			});
			let terminal = slot.terminal;
			if (reuse && terminal) {
				terminal.paste(action.prompt);
				terminal.input('\r');
			} else {
				const args = automationArgs(
					id,
					action.prompt,
					launchArgs(settings, id),
					action.sessionMode === 'specific' ? action.session : undefined,
				);
				const hook = await this.hooks.prepare(id, env, (event) => this.receive(slot, event));
				slot.hookClose = () => hook.close();
				try {
					if (this.disposed) throw new AutomationError('busy');
					terminal = await this.host.create({
						kind: 'automation',
						title: run.title,
						file: command,
						args,
						cwd: action.cwd,
						env: { ...env, ...hook.env, NAND_AUTOMATION_RUN_ID: run.id },
						agentId: id,
						automated: true,
						prepare: (session) => {
							slot.terminal = session;
							this.live.set(session.id, slot);
							session.observe((event) => {
								if (event.kind === 'data') {
									slot.output = (slot.output + event.text).slice(-8000);
									return;
								}
								slot.busy = false;
								slot.finish?.({
									status:
										event.kind === 'exit'
											? event.code === 0
												? 'succeeded'
												: event.code < 0
													? 'interrupted'
													: 'failed'
											: 'interrupted',
									message: event.kind === 'exit' ? String(event.code) : '',
									errorCode: event.kind === 'exit' ? 'processExit' : undefined,
									errorParams: event.kind === 'exit' ? { code: event.code } : undefined,
									output: slot.output,
									session: slot.session,
								});
								slot.finish = undefined;
								hook.close();
								this.live.delete(session.id);
							});
						},
					});
					if (terminal.connection === 'failed') throw new AutomationError('cliMissing');
				} catch (error) {
					hook.close();
					if (slot.terminal) await this.stop(slot.terminal.id);
					throw error;
				}
			}
			if (run.trigger === 'manual') void this.open(terminal.id).catch(console.error);
			return {
				terminalId: terminal.id,
				session: slot.session ?? action.session,
				completion: measuredCompletion,
				onRunning: (listener) => {
					slot.listeners ??= new Set();
					slot.listeners.add(listener);
					if (slot.started) listener();
					return () => slot.listeners?.delete(listener);
				},
			};
		} finally {
			if (reservation) this.reservations.delete(reservation);
		}
	}
	async stop(id: string): Promise<void> {
		this.host.remove(id);
		this.live.get(id)?.hookClose?.();
		this.live.delete(id);
		return Promise.resolve();
	}
	async startScript(action: Extract<AutomationAction, { kind: 'script' }>, run: AutomationRun): Promise<AgentRunHandle> {
		if (this.disposed) throw new AutomationError('agentUnavailable');
		let finish!: (result: RunResult) => void;
		const completion = new Promise<RunResult>((resolve) => { finish = resolve; });
		let output = '';
		const shell = this.host.shell(action.shell);
		const terminal = await this.host.create({
			kind: 'script',
			title: run.title,
			file: shell.file,
			args: action.shell === 'powershell' ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', action.script] : ['-lc', action.script],
			cwd: action.cwd,
			env: { NAND_AUTOMATION_RUN_ID: run.id },
			automated: true,
			prepare: (session) => {
				const unsubscribe = session.observe((event) => {
					if (event.kind === 'data') { output = (output + event.text).slice(-8000); return; }
					unsubscribe();
					finish({ status: event.kind === 'exit' ? (event.code === 0 ? 'succeeded' : 'failed') : 'interrupted', message: event.kind === 'exit' ? `Exit ${event.code}` : '', output });
				});
			},
		});
		if (terminal.connection === 'failed') {
			this.host.remove(terminal.id);
			throw new AutomationError('agentUnavailable');
		}
		if (this.disposed) { this.host.remove(terminal.id); throw new AutomationError('agentUnavailable'); }
		if (run.trigger === 'manual') {
			try { await this.open(terminal.id); }
			catch (error) { this.host.remove(terminal.id); throw error; }
		}
		return { terminalId: terminal.id, completion, onRunning: (listener) => { listener(); return () => undefined; } };
	}
	async open(id: string): Promise<void> {
		await this.host.open(id);
	}
	dispose(): void {
		this.disposed = true;
		this.hooks.dispose();
	}
}
