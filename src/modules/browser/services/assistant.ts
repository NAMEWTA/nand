import type { BrowserControl } from '../api';
import type { AgentPromptRunner } from '../../agent/api';
import type { AssistantData, AssistantTask, AssistantStep, AssistantRequest } from '../core/assistant/model';
import { interruptAssistant, type AssistantRecoveryDraft } from '../core/assistant/recovery';
import { validateAssistant } from '../core/assistant/documents';
import { assistantPrompt } from '../core/assistant/prompt';
import type { BrowserActionReview, BrowserPageTarget } from '../core/control';
import { BrowserError } from '../core/model';
import type { PageLease } from '../core/page-ownership';
import type { ScopedBrowserGrant, ScopedBrowserPermit } from '../core/scoped-grant';
import { snapshotJson } from '../core/workspace/snapshot';
import type { SynthesisDestination } from '../core/workspace/synthesis-model';
import type { AssistantStore } from '../platform/assistant-store';
import type { SynthesisAgents, SynthesisChoices } from './synthesis';
import type { ScopedBrowserRuns } from './scoped-runs';
import { ScopedBrowserExecutor } from './scoped-executor';

export type { AssistantRequest } from '../core/assistant/model';
export interface AssistantConfirmation { taskId: string; review: BrowserActionReview }
interface AssistantPorts {
	store: AssistantStore;
	agents: SynthesisAgents;
	control: BrowserControl;
	contexts(): Promise<ScopedBrowserRuns>;
	claim(target: BrowserPageTarget, taskId: string, signal: AbortSignal): PageLease;
	scopedControl(permit: ScopedBrowserPermit, lease: PageLease, signal: AbortSignal): BrowserControl;
	accountLabel(profileId: string): string;
	id(): string;
	now(): number;
	changed(): void;
	after(ms: number, work: () => void): () => void;
}
interface AssistantRun {
	record: AssistantTask;
	abort: AbortController;
	done: Promise<void>;
	leases: Map<string, PageLease>;
	grant?: ScopedBrowserGrant;
	disposeContext?: () => void;
	runner?: AgentPromptRunner;
	stopReason?: 'paused' | 'cancelled' | 'timeout' | 'failed';
	decision?: { review: BrowserActionReview; settle(allowed: boolean): void };
}
const unfinished = (status: AssistantTask['status']): boolean => ['pending', 'running', 'needs-attention', 'confirming'].includes(status);

/** One explicit review starts one owner call. Browser owns scope, native evidence and document lifetime. */
export class WebAssistant {
	private preview?: AssistantTask;
	private readonly runs = new Map<string, AssistantRun>();
	private readonly facts = new Map<string, AssistantTask>();
	private readonly baselines = new Map<string, AssistantTask>();
	private readonly errors = new Map<string, string | undefined>();
	private writes: Promise<unknown> = Promise.resolve();
	private closed = false;
	private restoring = false;
	readonly ready: Promise<void>;
	constructor(private readonly ports: AssistantPorts) {
		this.ready = this.recover(); void this.ready.catch(() => undefined);
	}
	private check(signal?: AbortSignal): void {
		if (this.closed) throw new BrowserError('browser_disabled');
		if (this.restoring) throw new BrowserError('browser_workspace_busy');
		if (signal?.aborted) throw new BrowserError('browser_scoped_grant_revoked');
	}
	async choices(): Promise<SynthesisChoices> {
		this.check(); const agents = this.ports.agents;
		const result = { agents: structuredClone(agents.directory()?.list() ?? []).filter(row => row.enabled && row.installed),
			sessions: await agents.sessions()?.list() ?? [], automatic: !!agents.runner(), existing: !!agents.dispatch() };
		this.check(); return result;
	}
	private async destination(value: SynthesisDestination): Promise<SynthesisDestination> {
		const choices = await this.choices();
		if (value.kind === 'automatic' && choices.automatic && choices.agents.some(agent => agent.id === value.agentId)) return { ...value };
		if (value.kind === 'existing' && choices.existing) {
			const session = choices.sessions.find(row => row.id === value.sessionId && row.agentId === value.agentId);
			if (session) return { ...value, sessionTitle: session.title };
		}
		throw new BrowserError('browser_workspace_synthesis_agent');
	}
	async review(request: AssistantRequest): Promise<AssistantTask> {
		this.check(); this.preview = undefined; await this.ready;
		const frozen = structuredClone(request), destination = await this.destination(frozen.destination);
		await this.ports.store.refresh(); this.check();
		if (this.ports.store.hasPendingSave() || this.errors.size) throw new BrowserError('browser_workspace_save_pending');
		const available = this.ports.control.list();
		const pages = frozen.targets.map(target => {
			const page = available.find(page => snapshotJson(page.target) === snapshotJson(target));
			if (!page) throw new BrowserError('browser_stale_target');
			return { target: { ...target }, title: page.title, url: page.url, accountLabel: this.ports.accountLabel(target.profileId) };
		});
		if (!frozen.title.trim() || !frozen.goal.trim() || !frozen.operations.includes('snapshot')) throw new BrowserError('browser_scoped_grant_invalid');
		const previous = frozen.previousTaskId ? this.records().find(task => task.id === frozen.previousTaskId) : undefined;
		if (frozen.previousTaskId && (!previous || this.busy(previous.id))) throw new BrowserError('browser_workspace_busy');
		const now = this.ports.now();
		const record: AssistantTask = { id: this.ports.id(), title: frozen.title.trim(), goal: frozen.goal, prompt: '', pages,
			operations: frozen.operations, maxOperations: frozen.maxOperations, timeoutMs: frozen.timeoutMs, destination,
			createdAt: now, updatedAt: now, status: 'pending', steps: [], text: '', ...(previous ? { previousTaskId: previous.id } : {}) };
		record.prompt = assistantPrompt(record, previous);
		if (destination.kind === 'existing') record.prompt = 'This is pasted planning material only. No browser grant is attached to this existing session. Do not use other browser credentials or execute page actions. Wait for the user to submit this material and provide guidance only.\n\n' + record.prompt;
		validateAssistant({ version: 1, tasks: [record] });
		this.preview = record; return structuredClone(record);
	}
	start(id: string): Promise<void> {
		this.check(); const record = this.preview;
		if (!record || record.id !== id) return Promise.reject(new BrowserError('browser_workspace_preview_changed'));
		this.preview = undefined;
		const run: AssistantRun = { record, abort: new AbortController(), leases: new Map(), done: Promise.resolve() };
		this.runs.set(id, run);
		run.done = this.execute(run).finally(() => { this.runs.delete(id); this.ports.changed(); });
		this.ports.changed(); return run.done;
	}
	records(): AssistantTask[] {
		const rows = new Map(this.ports.store.data().tasks.map(task => [task.id, task]));
		for (const [id, task] of this.facts) rows.set(id, structuredClone(task));
		return [...rows.values()].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
	}
	busy(id: string): boolean { return this.runs.has(id); }
	unsaved(id: string): boolean { return this.errors.has(id); }
	recoveryPath(id: string): string | undefined { return this.errors.get(id); }
	confirmation(id: string): AssistantConfirmation | undefined {
		const decision = this.runs.get(id)?.decision; return decision ? { taskId: id, review: structuredClone(decision.review) } : undefined;
	}
	decide(id: string, reviewId: string, allowed: boolean): void {
		const run = this.runs.get(id), decision = run?.decision;
		if (!decision || decision.review.id !== reviewId || run.abort.signal.aborted) throw new BrowserError('browser_action_review_changed');
		decision.settle(allowed);
	}
	stop(id: string, reason: 'paused' | 'cancelled' | 'timeout' = 'cancelled'): void {
		const run = this.runs.get(id); if (!run) return;
		if (!run.stopReason) run.stopReason = reason;
		run.record.status = run.stopReason;
		run.grant?.revoke(); run.disposeContext?.(); run.abort.abort(); run.decision?.settle(false);
		for (const lease of run.leases.values()) lease.release();
		this.publish(run.record);
	}
	async takeover(id: string, target: BrowserPageTarget): Promise<void> {
		const record = this.records().find(task => task.id === id);
		if (!record?.pages.some(page => snapshotJson(page.target) === snapshotJson(target))) throw new BrowserError('browser_scoped_grant_scope');
		this.stop(id, 'paused'); await this.ports.control.activate(target);
	}
	async openTerminal(id: string): Promise<void> {
		const run = this.runs.get(id); if (!run?.runner?.open || !run.record.terminalId) throw new BrowserError('browser_workspace_synthesis_agent');
		await run.runner.open(run.record.terminalId);
	}
	private publish(task: AssistantTask): void { this.facts.set(task.id, structuredClone(task)); this.ports.changed(); }
	private persist(task: AssistantTask): Promise<void> {
		const frozen = structuredClone(task);
		const next = this.writes.then(async () => {
			const baseline = this.baselines.get(frozen.id);
			try {
				await this.ports.store.put(frozen, baseline); this.baselines.set(frozen.id, frozen); this.errors.delete(frozen.id);
				if (!this.runs.has(frozen.id) && snapshotJson(this.facts.get(frozen.id)) === snapshotJson(frozen)) this.facts.delete(frozen.id);
			} catch (error) {
				// An unwritten local draft will become this exact baseline when the user retries saving it.
				if (snapshotJson(this.ports.store.data().tasks.find(task => task.id === frozen.id)) === snapshotJson(frozen)) this.baselines.set(frozen.id, frozen);
				this.errors.set(frozen.id, undefined);
				const path = await this.ports.store.preserve(frozen, baseline).catch(() => undefined); this.errors.set(frozen.id, path);
				const run = this.runs.get(frozen.id);
				if (run) { run.stopReason = 'failed'; run.record.errorCode = 'browser_workspace_save_pending'; this.stop(run.record.id); }
				throw error;
			} finally { this.ports.changed(); }
		});
		this.writes = next.catch(() => undefined); return next;
	}
	private async step(run: AssistantRun, step: AssistantStep): Promise<void> {
		run.record.steps = [...run.record.steps.filter(row => row.id !== step.id), structuredClone(step)];
		if (!run.stopReason) run.record.status = step.state === 'confirming' ? 'confirming' : 'running';
		run.record.updatedAt = this.ports.now(); this.publish(run.record); await this.persist(run.record);
	}
	private confirm(run: AssistantRun, review: BrowserActionReview, signal: AbortSignal): Promise<boolean> {
		this.check(signal); if (run.decision) throw new BrowserError('browser_workspace_busy');
		return new Promise(resolve => {
			const abort = () => settle(false);
			let settled = false, clear = () => {};
			const settle = (allowed: boolean) => {
				if (settled) return; settled = true; clear(); signal.removeEventListener('abort', abort);
				run.decision = undefined; this.ports.changed(); resolve(allowed && this.ports.now() < review.expiresAt && !signal.aborted);
			};
			run.decision = { review: structuredClone(review), settle };
			signal.addEventListener('abort', abort, { once: true });
			clear = this.ports.after(Math.max(0, Math.min(60_000, review.expiresAt - this.ports.now())), () => settle(false));
			this.ports.changed();
		});
	}
	private async execute(run: AssistantRun): Promise<void> {
		const record = run.record, signal = run.abort.signal; let clearTimeout = () => {};
		try {
			const destination = await this.destination(record.destination); this.check(signal);
			if (snapshotJson(destination) !== snapshotJson(record.destination)) throw new BrowserError('browser_workspace_preview_changed');
			const current = this.ports.control.list();
			if (record.pages.some(page => !current.some(row => snapshotJson(row.target) === snapshotJson(page.target) && row.url === page.url))) throw new BrowserError('browser_stale_target');
			this.publish(record); await this.persist(record); this.check(signal);
			clearTimeout = this.ports.after(record.timeoutMs, () => this.stop(record.id, 'timeout'));
			if (destination.kind === 'automatic') {
				const runner = this.ports.agents.runner(), agent = this.ports.agents.directory()?.list().find(row => row.id === destination.agentId && row.enabled && row.installed);
				if (!runner || !agent) throw new BrowserError('browser_workspace_synthesis_agent');
				run.runner = runner;
				for (const page of record.pages) {
					const lease = this.ports.claim(page.target, record.id, signal); run.leases.set(page.target.pageId, lease);
					lease.signal.addEventListener('abort', () => { if (!signal.aborted) this.stop(record.id, 'paused'); }, { once: true, signal });
				}
				const contexts = await this.ports.contexts(); this.check(signal);
				const prepared = contexts.create({ id: this.ports.id(), taskId: record.id, targets: record.pages.map(page => page.target),
					operations: record.operations, expiresAt: this.ports.now() + record.timeoutMs, maxOperations: record.maxOperations }, grant =>
					new ScopedBrowserExecutor(grant, { id: () => this.ports.id(), now: () => this.ports.now(),
						control: (permit, requestSignal) => {
							const lease = run.leases.get(permit.target.pageId); if (!lease) throw new BrowserError('browser_scoped_grant_scope');
							return this.ports.scopedControl(permit, lease, AbortSignal.any([requestSignal, signal]));
						}, step: step => this.step(run, step), confirm: (review, requestSignal) => this.confirm(run, review, AbortSignal.any([requestSignal, signal])),
						exhausted: () => { run.stopReason = 'failed'; record.errorCode = 'browser_scoped_grant_limit'; this.stop(record.id); } }));
				run.grant = prepared.grant; run.disposeContext = () => prepared.dispose(); record.status = 'running'; this.publish(record);
				const result = await runner.run({ agentId: agent.id, prompt: record.prompt, purpose: record.title, timeoutMs: record.timeoutMs,
					signal, keepTerminal: false, reveal: false, resultChannel: 'native', runContext: { provider: 'browser', handle: prepared.handle },
					onState: state => { if (signal.aborted || !unfinished(record.status)) return;
						record.status = run.decision ? 'confirming' : state.status; record.terminalId = state.terminalId; this.publish(record); } });
				record.status = run.stopReason ?? result.status; record.text = result.text; record.terminalId = result.terminalId; record.usage = result.usage;
				if (!run.stopReason) record.errorCode = result.errorCode;
				if (record.status === 'succeeded' && !record.text.trim()) { record.status = 'failed'; record.errorCode = 'browser_workspace_synthesis_empty'; }
			} else {
				const dispatch = this.ports.agents.dispatch(); if (!dispatch) throw new BrowserError('browser_workspace_synthesis_agent');
				const receipt = await dispatch.dispatch({ invocationId: record.id, title: record.title, agentId: destination.agentId,
					source: { kind: 'browser', path: '', id: record.id }, destination: { kind: 'existing', sessionId: destination.sessionId }, finalPrompt: record.prompt, files: [] }, { signal });
				record.status = receipt.invocationId !== record.id ? 'failed' : receipt.delivery === 'pasted' ? 'pasted' : run.stopReason
					?? (receipt.errorCode === 'cancelled' ? 'cancelled' : receipt.delivery === 'timeout' ? 'timeout' : 'failed');
				record.terminalId = receipt.terminalId; record.errorCode = record.status === 'pasted' ? undefined : receipt.errorCode ?? 'browser_workspace_synthesis_delivery';
			}
		} catch (error) {
			record.status = run.stopReason ?? (signal.aborted ? 'cancelled' : 'failed');
			if (!record.errorCode) record.errorCode = error instanceof BrowserError ? error.code : 'browser_failed';
		} finally {
			clearTimeout(); run.disposeContext?.(); run.abort.abort(); run.decision?.settle(false);
			for (const lease of run.leases.values()) lease.release();
		}
		record.updatedAt = this.ports.now(); this.publish(record);
		// No saved intent means no result replacement; retain failures as recoverable local drafts.
		await this.persist(record);
		if (!this.errors.has(record.id)) this.facts.delete(record.id);
	}
	private async recover(): Promise<void> {
		await this.ports.store.ready;
		for (const task of this.ports.store.data().tasks) {
			this.baselines.set(task.id, structuredClone(task));
			if (!unfinished(task.status)) continue;
			interruptAssistant(task, this.ports.now());
			this.publish(task); await this.persist(task);
		}
	}
	async retrySave(): Promise<void> {
		await this.ports.store.retrySave();
		for (const id of [...this.errors.keys()]) { const task = this.facts.get(id); if (task) await this.persist(task); }
	}
	async restoreRecovery(record: AssistantRecoveryDraft, expected: AssistantData): Promise<void> {
		this.check(); if (this.runs.size || this.errors.size) throw new BrowserError('browser_workspace_busy');
		this.restoring = true; this.preview = undefined;
		try {
			await this.writes; await this.ports.store.restore(record, expected); this.baselines.clear(); this.facts.clear();
			for (const task of this.ports.store.data().tasks) this.baselines.set(task.id, structuredClone(task));
		} finally { this.restoring = false; this.ports.changed(); }
	}
	async shutdown(): Promise<void> {
		this.closed = true; this.preview = undefined;
		for (const id of this.runs.keys()) this.stop(id, 'cancelled');
		await Promise.allSettled([...this.runs.values()].map(run => run.done)); await this.writes; await this.ports.store.shutdown();
	}
}
