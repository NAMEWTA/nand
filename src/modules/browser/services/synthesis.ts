import type { AgentDirectory, AgentDirectoryEntry, AgentDispatch, AgentPromptRunner, AgentSessionsPort, AgentSessionSummary } from '../../agent/api';
import { BrowserError } from '../core/model';
import type { CaptureReference } from '../core/workspace/comparison';
import { synthesisInputs, synthesisMaterial, synthesisPrompt } from '../core/workspace/synthesis';
import type { SynthesisDestination, SynthesisRecord } from '../core/workspace/synthesis-model';
import { snapshotJson } from '../core/workspace/snapshot';
import type { WorkspaceStore } from '../platform/workspace-store';

export interface SynthesisAgents {
	directory(): AgentDirectory | undefined;
	sessions(): AgentSessionsPort | undefined;
	runner(): AgentPromptRunner | undefined;
	dispatch(): AgentDispatch | undefined;
}
export interface SynthesisChoices { agents: AgentDirectoryEntry[]; sessions: AgentSessionSummary[]; automatic: boolean; existing: boolean }
export interface SynthesisRequest { taskId: string; references: CaptureReference[]; title: string; instruction: string; destination: SynthesisDestination }
interface SynthesisPorts { store: WorkspaceStore; agents?: SynthesisAgents; id(): string; now(): number; changed(): void }
const unfinished = (record: SynthesisRecord) => ['pending', 'running', 'needs-attention'].includes(record.status);

/** Opt-in owner calls. A one-use preview authorizes one delivery; saving cannot call an agent. */
export class WorkspaceSynthesis {
	private preview?: SynthesisRecord;
	private readonly runs = new Map<string, { abort: AbortController; done: Promise<void>; runner?: AgentPromptRunner }>();
	private readonly facts = new Map<string, SynthesisRecord>();
	private readonly intents = new Map<string, SynthesisRecord>();
	private readonly errors = new Set<string>();
	private writes: Promise<unknown> = Promise.resolve();
	private closed = false;
	constructor(private readonly ports: SynthesisPorts) {}
	private check(signal?: AbortSignal): void {
		if (this.closed) throw new BrowserError('browser_disabled');
		if (signal?.aborted) throw new BrowserError('browser_workspace_paused');
	}
	async choices(): Promise<SynthesisChoices> {
		this.check(); const agents = this.ports.agents;
		const result = { agents: structuredClone(agents?.directory()?.list() ?? []).filter(row => row.enabled && row.installed),
			sessions: await agents?.sessions()?.list() ?? [], automatic: !!agents?.runner(), existing: !!agents?.dispatch() };
		this.check(); return result;
	}
	private async destination(value: SynthesisDestination): Promise<SynthesisDestination> {
		const choices = await this.choices();
		if (value.kind === 'automatic' && choices.automatic && choices.agents.some(row => row.id === value.agentId)) return { ...value };
		const session = choices.sessions.find(row => row.id === (value.kind === 'existing' ? value.sessionId : '') && row.agentId === value.agentId);
		if (value.kind === 'existing' && choices.existing && session) return { ...value, sessionTitle: session.title };
		throw new BrowserError('browser_workspace_synthesis_agent');
	}
	async review(request: SynthesisRequest): Promise<SynthesisRecord> {
		this.check(); this.preview = undefined;
		const frozen = structuredClone(request), destination = await this.destination(frozen.destination);
		if (!frozen.title.trim() || !frozen.instruction.trim()) throw new BrowserError('browser_workspace_synthesis_scope');
		await this.ports.store.refresh(); this.check();
		if (this.ports.store.hasPendingSave() || this.errors.size) throw new BrowserError('browser_workspace_save_pending');
		const data = this.ports.store.data(), inputs = synthesisInputs(data, frozen.taskId, frozen.references), now = this.ports.now();
		const record: SynthesisRecord = { id: this.ports.id(), taskId: frozen.taskId, taskTitle: data.tasks.find(row => row.id === frozen.taskId)!.title,
			title: frozen.title.trim(), instruction: frozen.instruction, prompt: synthesisPrompt(frozen.instruction, inputs), inputs, destination,
			createdAt: now, updatedAt: now, status: 'pending', text: '' };
		this.preview = record; return structuredClone(record);
	}
	/** Consume synchronously so simultaneous clicks or another workbench window cannot replay it. */
	start(id: string): Promise<void> {
		this.check(); const record = this.preview;
		if (!record || record.id !== id) return Promise.reject(new BrowserError('browser_workspace_preview_changed'));
		this.preview = undefined;
		const abort = new AbortController();
		const done = this.execute(record, abort.signal).finally(() => { this.runs.delete(id); this.ports.changed(); });
		this.runs.set(id, { abort, done }); this.ports.changed(); return done;
	}
	records(): SynthesisRecord[] {
		const records = new Map(this.ports.store.data().syntheses.map(row => [row.id, row]));
		for (const [id, fact] of this.facts) records.set(id, structuredClone(fact));
		return [...records.values()].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
	}
	busy(id: string): boolean { return this.runs.has(id); }
	active(): boolean { return this.runs.size > 0; }
	unsaved(id: string): boolean { return this.errors.has(id); }
	cancel(id: string): void { this.runs.get(id)?.abort.abort(); }
	async open(id: string): Promise<void> {
		const run = this.runs.get(id), record = this.facts.get(id);
		if (!run?.runner?.open || !record?.terminalId) throw new BrowserError('browser_workspace_synthesis_agent');
		await run.runner.open(record.terminalId);
	}
	private publish(record: SynthesisRecord): void { this.facts.set(record.id, structuredClone(record)); this.ports.changed(); }
	private persist(record: SynthesisRecord): Promise<void> {
		const frozen = structuredClone(record);
		const next = this.writes.then(async () => {
			const update = (data: ReturnType<WorkspaceStore['data']>) => {
				const current = data.syntheses.find(row => row.id === frozen.id);
				if (!current || synthesisMaterial(current) !== synthesisMaterial(frozen)) throw new BrowserError('browser_workspace_storage_changed');
				Object.assign(current, { status: frozen.status, text: frozen.text, updatedAt: frozen.updatedAt,
					terminalId: frozen.terminalId, errorCode: frozen.errorCode, usage: frozen.usage });
			};
			try {
				if (this.ports.store.hasPendingSave()) {
					await this.ports.store.retainPending(update); throw new BrowserError('browser_workspace_save_pending');
				}
				await this.ports.store.edit(update); this.errors.delete(frozen.id);
				if (snapshotJson(this.facts.get(frozen.id)) === snapshotJson(frozen)) { this.facts.delete(frozen.id); this.intents.delete(frozen.id); }
			} catch (error) {
				this.errors.add(frozen.id);
				const intent = this.intents.get(frozen.id);
				if (!this.ports.store.hasPendingSave() && intent) await this.ports.store.preserveSynthesis(frozen, intent);
				throw error;
			}
			finally { this.ports.changed(); }
		});
		this.writes = next.catch(() => undefined); return next;
	}
	private async execute(record: SynthesisRecord, signal: AbortSignal): Promise<void> {
		const destination = await this.destination(record.destination); this.check(signal);
		if (snapshotJson(destination) !== snapshotJson(record.destination)) throw new BrowserError('browser_workspace_preview_changed');
		this.intents.set(record.id, structuredClone(record));
		// Persist the intent and exact material before any owner call; failure authorizes no execution.
		try {
			await this.ports.store.edit(data => {
				this.check(signal);
				if (snapshotJson(synthesisInputs(data, record.taskId, record.inputs)) !== snapshotJson(record.inputs)) throw new BrowserError('browser_workspace_preview_changed');
				data.syntheses.push(structuredClone(record));
			});
		} catch (error) {
			if (this.ports.store.data().syntheses.some(row => row.id === record.id)) {
				record.status = 'failed'; record.errorCode = 'browser_workspace_save_pending'; this.publish(record);
				await this.persist(record).catch(() => undefined);
			} else this.intents.delete(record.id);
			throw error;
		}
		this.publish(record);
		try {
			this.check(signal);
			if (destination.kind === 'automatic') {
				const runner = this.ports.agents?.runner(), agent = this.ports.agents?.directory()?.list().find(row => row.id === destination.agentId && row.enabled && row.installed);
				if (!runner || !agent) throw new BrowserError('browser_workspace_synthesis_agent');
				this.runs.get(record.id)!.runner = runner;
				record.status = 'running'; this.publish(record);
				const result = await runner.run({ agentId: agent.id, prompt: record.prompt, purpose: record.title,
					timeoutMs: 15 * 60_000, signal, reveal: false, keepTerminal: false, resultChannel: 'native',
					onState: state => { if (signal.aborted || !unfinished(record)) return;
						record.status = state.status; record.terminalId = state.terminalId; this.publish(record); } });
				Object.assign(record, { status: result.status, text: result.text, usage: result.usage, terminalId: result.terminalId, errorCode: result.errorCode });
				if (result.status === 'succeeded' && !result.text.trim()) { record.status = 'failed'; record.errorCode = 'browser_workspace_synthesis_empty'; }
			} else {
				const dispatch = this.ports.agents?.dispatch(); if (!dispatch) throw new BrowserError('browser_workspace_synthesis_agent');
				const receipt = await dispatch.dispatch({ invocationId: record.id, title: record.title, agentId: destination.agentId,
					source: { kind: 'browser', path: '', id: record.taskId }, destination: { kind: 'existing', sessionId: destination.sessionId }, finalPrompt: record.prompt, files: [] }, { signal });
				// Only the matching existing-session paste receipt is accepted. It is never a model result.
				if (receipt.invocationId !== record.id) record.status = 'failed';
				else if (receipt.delivery === 'pasted') record.status = 'pasted';
				else if (signal.aborted || receipt.errorCode === 'cancelled') record.status = 'cancelled';
				else record.status = receipt.delivery === 'timeout' ? 'timeout' : 'failed';
				record.terminalId = receipt.terminalId; record.errorCode = record.status === 'pasted' ? undefined : receipt.errorCode ?? 'browser_workspace_synthesis_delivery';
			}
		} catch (error) {
			record.status = signal.aborted ? 'cancelled' : 'failed';
			record.errorCode = error instanceof BrowserError ? error.code : 'browser_workspace_synthesis_failed';
		}
		record.updatedAt = this.ports.now(); this.publish(record); await this.persist(record);
	}
	/** Restarts never repeat an execution whose intent was already saved. */
	async recover(): Promise<void> {
		await this.ports.store.ready;
		for (const record of this.ports.store.data().syntheses.filter(record => unfinished(record) && !this.runs.has(record.id))) {
			this.intents.set(record.id, structuredClone(record));
			record.status = 'interrupted'; record.updatedAt = this.ports.now(); this.publish(record); await this.persist(record);
		}
	}
	async retrySave(): Promise<void> {
		await this.ports.store.retrySave();
		for (const id of [...this.errors]) { const record = this.facts.get(id); if (record) await this.persist(record); }
	}
	async shutdown(): Promise<void> {
		this.closed = true; this.preview = undefined;
		for (const run of this.runs.values()) run.abort.abort();
		await Promise.allSettled([...this.runs.values()].map(run => run.done)); await this.writes;
	}
}
