import { AUTOMATION_AGENTS } from '../../core/agent-launch/automation-catalog';
import { AGENT_CATALOG, getAgent } from '../../core/agent-launch/catalog';
import { effectivePermission, launchArgs } from '../../core/agent-launch/flags';
import type { AgentId } from '../../core/agent-launch/types';
import { AutomationHooks, type NativeHookEvent } from '../../platform/desktop/agent-hooks/automation-hooks';
import { absolutePluginDir, accountEnv } from '../../platform/desktop/agents/accounts';
import { resolveCli } from '../../platform/desktop/agents/resolver';
import { runtimeProcess } from '../../platform/desktop/agents/runtime-process';
import { canonicalVaultCwd } from '../../platform/desktop/ai-vault/canonical-cwd';
import { createNodeSessionIo } from '../../platform/desktop/ai-vault/scan';
import { isCwdInsideVault } from '../../platform/desktop/ai-vault/scope';
import type { PtySession } from '../../platform/desktop/terminal/pty-session';
import { AutomationError } from '../../shared/automation/errors';
import type {
	AgentRunHandle,
	AgentRuntimePort,
	AgentSessionRef,
	AutomationAction,
	AutomationRun,
} from '../../shared/automation/types';
import { t } from '../../shared/i18n/index';
import { JsonStore } from '../../shared/json-store';
import type { TerminalAgentController } from '../modules/terminal/controller';

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
	terminal?: PtySession;
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
			host.app.vault.adapter,
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
			installed: !!resolveCli(a.detectCommand, this.host.settings.agentSettings.agents[a.id]?.cliPath ?? '', ''),
		}));
	}
	async listSessions(cwd: string): Promise<AgentSessionRef[]> {
		await this.loaded;
		const vault = (this.host.app.vault.adapter as unknown as { getBasePath(): string }).getBasePath();
		const canonical = await canonicalVaultCwd(vault, cwd);
		const service = await this.host.getTerminalService();
		const history = service.history(() => this.host.settings.agentSettings, this.host.manifest.dir ?? '');
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
			if (slot.terminal) slot.terminal.nativeStatus = 'running';
			slot.started = true;
			for (const listener of slot.listeners ?? []) listener();
		}
		if (slot.started && ['Stop', 'AfterAgent', 'StopFailure', 'StopCancelled'].includes(event.event)) {
			slot.busy = false;
			if (slot.terminal) slot.terminal.nativeStatus = 'idle';
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
			const service = await this.host.getTerminalService();
			const history = service.history(() => this.host.settings.agentSettings, this.host.manifest.dir ?? '');
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
		const agent = getAgent(id),
			settings = this.host.settings.agentSettings;
		const entry = settings.agents[id];
		if (!entry?.enabled) throw new AutomationError('agentDisabled');
		if (
			effectivePermission(settings, id) === 'yolo' &&
			!settings.yoloAcknowledged &&
			launchArgs(settings, id).length
		)
			throw new Error(t('automation.permissionRequired'));
		const io = createNodeSessionIo();
		await canonicalVaultCwd(
			(this.host.app.vault.adapter as unknown as { getBasePath(): string }).getBasePath(),
			action.cwd,
		);
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
				: accountEnv(
						agent,
						entry.accountId,
						absolutePluginDir(
							(this.host.app.vault.adapter as unknown as { getBasePath(): string }).getBasePath(),
							this.host.manifest.dir ?? '',
						),
					);
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
		if (reuse && terminal) terminal.write(`\x1b[200~${action.prompt}\x1b[201~\r`);
		else {
			const command = resolveCli(agent.detectCommand, entry.cliPath, '');
			if (!command) throw new AutomationError('cliMissing');
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
			completion: measuredCompletion,
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
