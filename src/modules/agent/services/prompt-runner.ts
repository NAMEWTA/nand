import type { AgentPromptRequest, AgentPromptResult, AgentPromptRunner, AgentRunContextLease, AgentRunContextProvider } from '../api';
import type { AgentId } from '../core/launch/types';
import { AutomationError } from '../../../shared/automation/errors';
import type { AgentDescription, AgentRunHandle, AutomationAction } from '../../../shared/automation/types';
import type { AgentExecution } from './agent-runtime';

interface PromptRuntime {
	listAgents(): AgentDescription[];
	execute(action: Extract<AutomationAction, { kind: 'agent' }>, execution: AgentExecution, previousTerminal?: string): Promise<AgentRunHandle>;
	stop(id: string): Promise<void>;
	open(id: string): Promise<void>;
}

/** Owns only the prompt executions it starts; manual and scheduled sessions are separate. */
export class PromptRunner implements AgentPromptRunner {
	private disposed = false;
	private readonly active = new Set<AbortController>();
	private readonly finishes = new Set<Promise<void>>();
	private readonly terminals = new Set<string>();
	private readonly contextualTerminals = new Set<string>();
	constructor(
		private readonly runtime: PromptRuntime,
		private readonly vaultCwd: () => string,
		private readonly providers: () => Promise<readonly AgentRunContextProvider[]>,
		private readonly clock: Pick<Window, 'setTimeout' | 'clearTimeout'>,
	) {}

	async run(request: AgentPromptRequest): Promise<AgentPromptResult> {
		if (this.disposed) return { status: 'interrupted', text: '', errorCode: 'agentUnavailable' };
		if (request.signal?.aborted) return { status: 'cancelled', text: '' };
		if (!request.prompt.trim()) return { status: 'failed', text: '', errorCode: 'promptEmpty' };
		if (request.continueTerminalId && !this.terminals.has(request.continueTerminalId)) return { status: 'failed', text: '', errorCode: 'sessionMissing' };
		if (request.continueTerminalId && (request.runContext || this.contextualTerminals.has(request.continueTerminalId))) return { status: 'failed', text: '', errorCode: 'runContextInvalid' };
		const agentId = request.agentId ?? this.runtime.listAgents().find(agent => agent.enabled && agent.installed)?.id as AgentId | undefined;
		if (!agentId) return { status: 'failed', text: '', errorCode: 'cliMissing' };
		const abort = new AbortController();
		this.active.add(abort);
		const cancel = () => abort.abort('cancelled');
		request.signal?.addEventListener('abort', cancel, { once: true });
		const duration = request.timeoutMs ?? 10 * 60_000;
		if (!Number.isFinite(duration) || duration <= 0 || duration > 2_147_483_647) {
			request.signal?.removeEventListener('abort', cancel);
			this.active.delete(abort);
			return { status: 'failed', text: '', errorCode: 'timeoutInvalid' };
		}
		const timer = this.clock.setTimeout(() => abort.abort('timeout'), duration);
		let finish!: () => void;
		const settled = new Promise<void>(resolve => { finish = resolve; });
		this.finishes.add(settled);
		let terminalId: string | undefined;
		let context: AgentRunContextLease | undefined;
		let finished = false;
		let result: AgentPromptResult | undefined;
		let identity: { agentId: AgentId; accountIdentity: string } | undefined;
		const runId = crypto.randomUUID();
		const interrupted = () => ({
			status: abort.signal.reason === 'timeout' ? 'timeout' : abort.signal.reason === 'interrupted' ? 'interrupted' : 'cancelled',
			text: '', terminalId, ...identity,
		} as AgentPromptResult);
		let onAbort!: () => void;
		const stopped = new Promise<AgentPromptResult>(resolve => {
			onAbort = () => resolve(interrupted());
			abort.signal.addEventListener('abort', onAbort, { once: true });
		});
		const execute = async (): Promise<AgentPromptResult> => {
			let provider: AgentRunContextProvider | undefined;
			if (request.runContext) {
				const matches = (await this.providers()).filter(item => item.id === request.runContext!.provider);
				if (matches.length !== 1) return { status: 'failed', text: '', errorCode: 'runContextUnavailable' };
				provider = matches[0];
			}
			abort.signal.throwIfAborted();
			const handle = await this.runtime.execute({ kind: 'agent', agentId, cwd: request.cwd ?? this.vaultCwd(), prompt: request.prompt, sessionMode: request.continueTerminalId ? 'reuse' : 'fresh' }, {
				id: runId, title: request.purpose, kind: 'prompt', reveal: request.reveal, signal: abort.signal,
				onPrepared: value => { identity = value; },
				resolveContext: provider ? async cwd => {
					const lease = await provider.resolve(request.runContext!.handle, { runId, cwd, signal: abort.signal });
					if (!lease) throw new AutomationError('runContextInvalid');
					if (finished || abort.signal.aborted) {
						await lease.dispose();
						abort.signal.throwIfAborted();
						throw new AutomationError('runContextInvalid');
					}
					context = lease;
					return lease.env;
				} : undefined,
				onTerminal: id => {
					terminalId = id;
					this.terminals.add(id);
					if (request.runContext) this.contextualTerminals.add(id);
					if (finished || abort.signal.aborted) void this.close(id);
					else request.onState?.({ status: 'needs-attention', terminalId: id });
				},
				onState: (status, id) => { if (!finished && !abort.signal.aborted) request.onState?.({ status, terminalId: id }); },
			}, request.continueTerminalId);
			const answer = await handle.completion;
			return { status: answer.status, text: answer.status === 'succeeded' ? answer.message : '', terminalId: handle.terminalId, usage: answer.usage, errorCode: answer.errorCode, ...identity };
		};
		try {
			result = await Promise.race([execute().catch((error): AgentPromptResult => abort.signal.aborted ? interrupted() : ({ status: 'failed', text: '', terminalId, errorCode: error instanceof AutomationError ? error.code : 'agentUnavailable', ...identity })), stopped]);
			return result;
		} finally {
			finished = true;
			this.clock.clearTimeout(timer);
			abort.signal.removeEventListener('abort', onAbort);
			request.signal?.removeEventListener('abort', cancel);
			this.active.delete(abort);
			// Revoke a context even if its terminal is retained for inspection.
			try {
				const lease = context;
				context = undefined;
				await lease?.dispose();
			} catch {
				if (result) Object.assign(result, { status: 'failed', text: '', errorCode: 'runContextReleaseFailed' });
			}
			finally {
				try {
					if (terminalId && (!request.keepTerminal || result?.status !== 'succeeded')) await this.close(terminalId);
				} finally {
					this.finishes.delete(settled);
					finish();
				}
			}
		}
	}

	async open(id: string): Promise<void> { if (this.terminals.has(id)) await this.runtime.open(id); }
	async close(id: string): Promise<void> {
		if (!this.terminals.delete(id)) return;
		this.contextualTerminals.delete(id);
		await this.runtime.stop(id);
	}
	async dispose(): Promise<void> {
		this.disposed = true;
		for (const abort of this.active) abort.abort('interrupted');
		await Promise.all([...this.terminals].map(id => this.close(id)));
		await Promise.all([...this.finishes]);
	}
}
