import { scanNativeAutomationSessions } from '../sessions/automation-scan';
import type {
	AgentRuntimePort,
	AgentSessionRef,
	AutomationAction,
	AutomationRun,
	AgentRunHandle,
} from '../../shared/automation/types';
import { JsonStore } from '../../shared/json-store';
import { AutomationHooks, type NativeHookEvent } from './automation-hooks';
import { t } from '../../shared/i18n';
import type { TerminalAgentController } from '../host/controller';
import type { TerminalInstance } from '../terminal/terminal-instance';
import { AGENT_CATALOG, getAgent } from './catalog';
import { AUTOMATION_AGENTS } from './automation-catalog';
import { accountEnv } from './accounts';
import { effectivePermission, launchArgs } from './flags';
import { resolveCli } from './resolver';
import type { AgentId } from './types';
import { createNodeSessionIo, scanVaultSessions } from '../sessions/scan';
import { accountConfigDir } from './accounts';

// Orca's native resume capability set, pinned to 27b823f (MIT, Lovecast Inc.).
export const RESUME_FLAGS: Readonly<Record<string, readonly string[]>> = {
	'claude-code': ['--resume'],
	codex: ['resume'],
	gemini: ['--resume'],
	antigravity: ['--conversation'],
	opencode: ['--session'],
	opencode2: ['--session'],
	pi: ['--session'],
	'mimo-code': ['--session'],
	droid: ['--resume'],
	grok: ['--resume'],
	devin: ['--resume'],
	omp: ['--resume'],
	'prime-agent': ['--resume'],
	copilot: ['--resume'],
	kimi: ['--session'],
	muse: ['resume'],
	zcode: ['--resume'],
};
export function automationArgs(
	agentId: AgentId,
	prompt: string,
	base: string[],
	session?: AgentSessionRef,
): { args: string[]; paste: boolean } {
	const config = AUTOMATION_AGENTS[agentId];
	const args = [
		...(agentId === 'kiro'
			? ['chat', '--tui']
			: agentId === 'opencode2'
				? ['--standalone']
				: agentId === 'hermes'
					? ['--tui']
					: []),
		...base,
	];
	if (session) {
		const flags = RESUME_FLAGS[agentId];
		if (!flags) throw new Error(t('automation.sessionMissing'));
		const locator =
			agentId === 'pi' || agentId === 'prime-agent'
				? session.transcriptPath
				: agentId === 'omp'
					? session.transcriptPath || session.sessionId
					: session.sessionId;
		if (!locator) throw new Error(t('automation.sessionMissing'));
		if (agentId === 'copilot') args.push(`--resume=${locator}`);
		else args.push(...flags, locator);
	}
	switch (config.mode) {
		case 'argv':
			if (config.separator) args.push('--');
			args.push(prompt);
			break;
		case 'flag-prompt':
			args.push('--prompt', prompt);
			break;
		case 'flag-prompt-interactive':
			args.push('--prompt-interactive', prompt);
			break;
		case 'flag-interactive':
			args.push('-i', prompt);
			break;
		case 'hermes-query':
			args.push('--query', prompt);
			break;
		default:
			return { args, paste: true };
	}
	return { args, paste: false };
}
type AgentAction = Extract<AutomationAction, { kind: 'agent' }>;
type RunResult = Awaited<AgentRunHandle['completion']>;
interface LiveSession {
	listeners?: Set<() => void>;
	terminal?: TerminalInstance;
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
export class TerminalAutomationRuntime implements AgentRuntimePort {
	private live = new Map<string, LiveSession>();
	private hooks: AutomationHooks;
	private registry: AgentSessionRef[] = [];
	private store: JsonStore<AgentSessionRef[]>;
	private loaded: Promise<void>;
	constructor(private host: TerminalAgentController) {
		this.hooks = new AutomationHooks(host.app.workspace.containerEl.win);
		const device = String(host.app.loadLocalStorage('nand.automation.device') || 'local');
		this.store = new JsonStore(
			host.app,
			`.nand/automation-sessions/${device}.json`,
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
		return AGENT_CATALOG.map((a) => ({
			id: a.id,
			title: a.title,
			enabled: this.host.settings.agentSettings.agents[a.id]?.enabled ?? false,
			resumable: !!RESUME_FLAGS[a.id],
		}));
	}
	async listSessions(cwd: string): Promise<AgentSessionRef[]> {
		await this.loaded;
		const settings = this.host.settings.agentSettings;
		const dir = this.host.manifest.dir ?? '';
		const claude = accountConfigDir('claude', settings.agents['claude-code'].accountId, dir);
		const codex = accountConfigDir('codex', settings.agents.codex.accountId, dir);
		const sessions = await scanVaultSessions({
			key: `${cwd}:${claude}:${codex}`,
			vaultPath: cwd,
			io: createNodeSessionIo(),
			claudeConfigDirs: claude ? [claude] : [],
			codexHomes: codex ? [codex] : [],
			limit: 1000,
		});
		const native = await scanNativeAutomationSessions(createNodeSessionIo(), cwd);
		const unique = new Map<string, AgentSessionRef>();
		for (const s of [
			...sessions.map((s) => ({ ...s, accountKey: JSON.stringify(s.env) })),
			...native,
			...this.registry.filter((s) => s.cwd === cwd),
		])
			unique.set(`${s.agentId}:${s.accountKey}:${s.sessionId}`, s);
		return [...unique.values()].sort((a, b) => b.modifiedAtMs - a.modifiedAtMs);
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
			slot.started = true;
			for (const listener of slot.listeners ?? []) listener();
		}
		if (slot.started && ['Stop', 'AfterAgent', 'StopFailure'].includes(event.event)) {
			slot.busy = false;
			slot.started = false;
			const message =
				typeof event.data.last_assistant_message === 'string'
					? event.data.last_assistant_message.slice(-8000)
					: '';
			slot.finish?.({
				status: event.event === 'StopFailure' ? 'failed' : 'succeeded',
				message,
				output: slot.output,
				session: slot.session,
			});
			slot.finish = undefined;
		}
	}
	async start(action: AgentAction, run: AutomationRun, previous?: AutomationRun): Promise<AgentRunHandle> {
		await this.loaded;
		const id = action.agentId as AgentId;
		const agent = getAgent(id),
			settings = this.host.settings.agentSettings;
		const entry = settings.agents[id];
		if (!entry?.enabled) throw new Error(t('automation.agentUnavailable'));
		if (
			effectivePermission(settings, id) === 'yolo' &&
			!settings.yoloAcknowledged &&
			launchArgs(settings, id).length
		)
			throw new Error(t('automation.permissionRequired'));
		const io = createNodeSessionIo();
		if (!(await io.stat(action.cwd))?.isDirectory) throw new Error(t('automation.invalid'));
		if (
			action.sessionMode === 'specific' &&
			(!action.session ||
				action.session.agentId !== id ||
				action.session.cwd !== action.cwd ||
				!action.session.sessionId)
		)
			throw new Error(t('automation.sessionMissing'));
		if (
			action.sessionMode === 'specific' &&
			action.session?.transcriptPath &&
			!(await io.stat(action.session.transcriptPath))?.isFile
		)
			throw new Error(t('automation.sessionMissing'));
		const env =
			action.sessionMode === 'specific' && action.session?.accountKey
				? (JSON.parse(action.session.accountKey) as Record<string, string>)
				: accountEnv(agent, entry.accountId, this.host.manifest.dir ?? '');
		if (!env || typeof env !== 'object' || Object.values(env).some((v) => typeof v !== 'string'))
			throw new Error(t('automation.sessionMissing'));
		const accountKey = JSON.stringify(env);
		if (
			action.sessionMode === 'specific' &&
			[...this.live.values()].some(
				(v) =>
					v.busy &&
					(v.session || v.action.session)?.sessionId === action.session?.sessionId &&
					v.action.agentId === id &&
					v.accountKey === accountKey,
			)
		)
			throw new Error(t('automation.busy'));
		const prior =
			action.sessionMode === 'reuse' && previous?.terminalId ? this.live.get(previous.terminalId) : undefined;
		const reuse =
			prior &&
			!prior.busy &&
			prior.terminal?.isAlive() &&
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
		let terminal = slot.terminal;
		if (reuse && terminal) terminal.write(`\x1b[200~${action.prompt}\x1b[201~\r`);
		else {
			const command = resolveCli(agent.detectCommand, entry.cliPath, '');
			if (!command) throw new Error(t('automation.agentUnavailable'));
			const built = automationArgs(
				id,
				action.prompt,
				launchArgs(settings, id),
				action.sessionMode === 'specific' ? action.session : undefined,
			);
			let readyResolve!: () => void;
			const ready = new Promise<void>((resolve) => {
				readyResolve = resolve;
			});
			let startup = '';
			const hook = await this.hooks.prepare(id, env, (event) => this.receive(slot, event));
			slot.hookClose = () => hook.close();
			try {
				terminal = await (
					await this.host.getTerminalService()
				).createTerminal(
					{
						shellType: `custom:${command}`,
						shellArgs: built.args,
						cwd: action.cwd,
						env: { ...env, ...hook.env, TERM: 'xterm-256color', NAND_AUTOMATION_RUN_ID: run.id },
						title: run.title,
					},
					(instance) => {
						slot.terminal = instance;
						this.live.set(instance.id, slot);
						instance.automationManaged = true;
						instance.observeAutomation((event) => {
							if (event.kind === 'data') {
								slot.output = (slot.output + event.text).slice(-8000);
								startup = (startup + event.text).slice(-16000);
								const pasteAt = startup.indexOf('\x1b[?2004h');
								const cursorNeeded = ['opencode', 'opencode2', 'mimo-code'].includes(id);
								if (pasteAt >= 0 && (!cursorNeeded || startup.indexOf('\x1b[?25h', pasteAt) >= 0))
									readyResolve();
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
										: event.kind,
								message: event.kind === 'exit' ? String(event.code) : '',
								output: slot.output,
								session: slot.session,
							});
							slot.finish = undefined;
							hook.close();
							this.live.delete(instance.id);
						});
					},
				);
				if (built.paste) {
					const win = this.host.app.workspace.containerEl.win;
					let timeout: number | undefined;
					try {
						await Promise.race([
							ready,
							completion.then(() => {
								throw new Error(t('automation.sessionMissing'));
							}),
							new Promise<never>((_, reject) => {
								timeout = win.setTimeout(
									() => reject(new Error(t('automation.inputNotReady'))),
									20_000,
								);
							}),
						]);
						terminal.write(`\x1b[200~${action.prompt}\x1b[201~\r`);
					} finally {
						if (timeout !== undefined) win.clearTimeout(timeout);
					}
				}
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
			completion,
			onRunning: (listener) => {
				slot.listeners ??= new Set();
				slot.listeners.add(listener);
				if (slot.started) listener();
				return () => slot.listeners?.delete(listener);
			},
		};
	}
	async stop(id: string): Promise<void> {
		await (await this.host.getTerminalService()).destroyTerminal(id);
		this.live.get(id)?.hookClose?.();
		this.live.delete(id);
	}
	async open(id: string): Promise<void> {
		await this.host.openAutomationTerminal(id);
	}
	dispose(): void {
		this.hooks.dispose();
	}
}
