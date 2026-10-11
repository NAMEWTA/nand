import type { BrowserControl } from '../api';
import type { AutomationWorkflowInvocations, AutomationWorkflowReceipt } from '../../automations/api';
import type { AutomationActionCompletion, AutomationActionHandle, BrowserWorkflowAction } from '../../../shared/automation/types';
import type { BrowserActionReview, BrowserElementRef, BrowserElementValue, BrowserObservation, BrowserPageTarget } from '../core/control';
import type { AssistantStep } from '../core/assistant/model';
import type { PageLease } from '../core/page-ownership';
import { ScopedBrowserGrant, type ScopedBrowserOperation, type ScopedBrowserPermit } from '../core/scoped-grant';
import { BrowserError } from '../core/model';
import { snapshotJson } from '../core/workspace/snapshot';
import type { BrowserWorkflowSpec, WorkflowBinding, WorkflowCondition, WorkflowExecution, WorkflowLocator, WorkflowReview, WorkflowStep, WorkflowValue } from '../core/workflows/model';
import { interpolateWorkflow, validateWorkflow, validateWorkflowPublicInputs, workflowInputs, workflowMaterial, workflowScopeMatches } from '../core/workflows/validate';
import type { WorkflowStore } from '../platform/workflow-store';
import { ScopedBrowserExecutor } from './scoped-executor';

interface WorkflowPorts {
	store: WorkflowStore; control: BrowserControl;
	owner(): AutomationWorkflowInvocations | undefined;
	claim(target: BrowserPageTarget, runId: string, signal: AbortSignal): PageLease;
	scopedControl(permit: ScopedBrowserPermit, lease: PageLease, signal: AbortSignal): BrowserControl;
	accountLabel(profileId: string): string;
	open(runId: string): Promise<void>;
	artifact(runId: string): string;
	id(): string; now(): number; changed(): void; after(ms: number, work: () => void): () => void;
}
interface WorkflowLive {
	record: WorkflowExecution; values: Record<string, WorkflowValue>; trigger: 'manual' | 'scheduled';
	abort: AbortController; segment: AbortController; grant: ScopedBrowserGrant; executor: ScopedBrowserExecutor;
	leases: Map<string, PageLease>; pump?: Promise<void>; completion: Promise<AutomationActionCompletion>; settle(value: AutomationActionCompletion): void;
	stop?: 'cancelled' | 'interrupted'; clear(): void; release(): void;
	decision?: { review: BrowserActionReview; settle(allowed: boolean): void };
}
const active = (run: WorkflowExecution) => ['pending', 'running', 'confirming', 'paused'].includes(run.phase);
const same = (left: unknown, right: unknown) => snapshotJson(left) === snapshotJson(right);

/** Finite typed steps share native leases/queues and one automations receipt. No timer triggers or agent process live here. */
export class BrowserWorkflows {
	private closed = false;
	private readonly reviews = new Map<string, { review: WorkflowReview; values: Record<string, WorkflowValue> }>();
	private readonly runs = new Map<string, WorkflowLive>();
	private readonly facts = new Map<string, WorkflowExecution>();
	private readonly baselines = new Map<string, WorkflowExecution>();
	private readonly errors = new Map<string, string | undefined>();
	private writes: Promise<unknown> = Promise.resolve();
	readonly ready: Promise<void>;
	constructor(private readonly ports: WorkflowPorts) { this.ready = this.recover(); void this.ready.catch(() => undefined); }
	private check(signal?: AbortSignal): void {
		if (this.closed) throw new BrowserError('browser_disabled');
		if (signal?.aborted) throw new BrowserError('browser_scoped_grant_revoked');
	}
	definitions(): BrowserWorkflowSpec[] { return this.ports.store.data().workflows; }
	records(): WorkflowExecution[] {
		const rows = new Map(this.ports.store.data().executions.map(run => [run.runId, run]));
		for (const [id, run] of this.facts) rows.set(id, structuredClone(run));
		return [...rows.values()].sort((a, b) => b.createdAt - a.createdAt || a.runId.localeCompare(b.runId));
	}
	busy(id: string): boolean { return this.runs.has(id); }
	unsaved(id: string): boolean { return this.errors.has(id); }
	recoveryPath(id: string): string | undefined { return this.errors.get(id); }
	async save(spec: BrowserWorkflowSpec, expected?: BrowserWorkflowSpec): Promise<BrowserWorkflowSpec> {
		this.check(); await this.ready; const frozen = structuredClone(spec), baseline = expected && structuredClone(expected);
		await this.ports.store.refresh(); this.check();
		const old = this.definitions().find(row => row.id === frozen.id);
		if (!same(old, baseline)) throw new BrowserError('browser_workspace_storage_changed');
		delete frozen.verification;
		frozen.version = old ? old.version + (workflowMaterial(frozen) === workflowMaterial(old) ? 0 : 1) : 1;
		frozen.createdAt = old?.createdAt ?? this.ports.now(); frozen.updatedAt = this.ports.now();
		if (old?.verification && workflowMaterial(frozen) === workflowMaterial(old)) frozen.verification = old.verification;
		validateWorkflow(frozen); await this.ports.store.putWorkflow(frozen, old); this.reviews.clear(); this.ports.changed(); return frozen;
	}
	async saveVerified(runId: string): Promise<void> {
		this.check(); await this.ready; await this.ports.store.refresh(); this.check();
		const run = this.records().find(row => row.runId === runId), spec = this.definitions().find(row => row.id === run?.spec.id);
		if (!run || run.phase !== 'succeeded' || this.unsaved(runId) || !spec || spec.version !== run.spec.version || workflowMaterial(spec) !== workflowMaterial(run.spec))
			throw new BrowserError('browser_workflow_verify');
		const next = { ...spec, verification: { runId, version: spec.version, at: this.ports.now(), material: workflowMaterial(spec) } };
		await this.ports.store.putWorkflow(next, spec); this.ports.changed();
	}
	async validate(action: BrowserWorkflowAction): Promise<void> {
		this.check(); await this.ready; await this.ports.store.refresh(); this.check();
		const spec = this.definitions().find(row => row.id === action.workflowId);
		if (!spec || spec.version !== action.version || action.scope.length !== spec.targetScope.length
			|| new Set(action.scope.map(s => s.id)).size !== action.scope.length || new Set(action.scope.map(s => s.pageId)).size !== action.scope.length
			|| action.scope.some(s => !spec.targetScope.some(scope => scope.id === s.id && scope.profileId === s.profileId))) throw new BrowserError('browser_workflow_changed');
		validateWorkflowPublicInputs(spec, action.variables);
	}
	private bindings(spec: BrowserWorkflowSpec, scope: BrowserWorkflowAction['scope']): WorkflowBinding[] {
		const pages = this.ports.control.list();
		return spec.targetScope.map(area => {
			const selected = scope.find(row => row.id === area.id), page = pages.find(row => row.target.pageId === selected?.pageId && row.target.profileId === selected.profileId);
			if (!page || page.loading || page.error || !workflowScopeMatches(area, page.target.profileId, page.url)) throw new BrowserError('browser_workflow_scope');
			return { scopeId: area.id, target: { ...page.target }, url: page.url, title: page.title, accountLabel: this.ports.accountLabel(page.target.profileId) };
		});
	}
	async review(workflowId: string, supplied: Record<string, unknown>, scope: BrowserWorkflowAction['scope']): Promise<WorkflowReview> {
		this.check(); await this.ready; await this.ports.store.refresh(); this.check();
		if (this.errors.size) throw new BrowserError('browser_workspace_save_pending');
		const spec = this.definitions().find(row => row.id === workflowId); if (!spec) throw new BrowserError('browser_workflow_changed');
		const { values, publicInputs, secretNames } = workflowInputs(spec, structuredClone(supplied));
		const action: BrowserWorkflowAction = { kind: 'browser-workflow', workflowId, version: spec.version, variables: publicInputs, scope: structuredClone(scope) };
		await this.validate(action);
		const review: WorkflowReview = { id: this.ports.id(), spec, action, bindings: this.bindings(spec, scope), secretNames, createdAt: this.ports.now() };
		this.reviews.clear(); this.reviews.set(review.id, { review, values }); return structuredClone(review);
	}
	async invoke(reviewId: string): Promise<AutomationWorkflowReceipt> {
		this.check(); const pending = this.reviews.get(reviewId), owner = this.ports.owner();
		if (!pending || !owner) throw new BrowserError('browser_workflow_owner');
		const { review } = pending;
		return owner.invoke({ invocationId: review.id, title: review.spec.title, action: review.action,
			source: { kind: 'browser-workflow', path: '', id: review.spec.id } }, { authorizationId: review.id });
	}
	async start(action: BrowserWorkflowAction, context: { runId: string; trigger: 'manual' | 'scheduled'; signal: AbortSignal; authorizationId?: string }): Promise<AutomationActionHandle> {
		await this.validate(action); this.check(context.signal);
		if (this.runs.has(context.runId) || this.records().some(row => row.runId === context.runId) || this.errors.size) throw new BrowserError('browser_workspace_busy');
		const spec = this.definitions().find(row => row.id === action.workflowId)!;
		const pending = context.authorizationId ? this.reviews.get(context.authorizationId) : undefined;
		if (context.authorizationId) this.reviews.delete(context.authorizationId);
		if (context.authorizationId && (!pending || !same(pending.review.action, action) || !same(pending.review.spec, spec) || this.ports.now() - pending.review.createdAt > 120_000))
			throw new BrowserError('browser_workspace_preview_changed');
		if (!pending && !spec.verification) throw new BrowserError('browser_workflow_verify');
		const { values, publicInputs, secretNames } = workflowInputs(spec, pending?.values ?? action.variables);
		const bindings = this.bindings(spec, action.scope);
		if (pending && !same(bindings, pending.review.bindings)) throw new BrowserError('browser_workspace_preview_changed');
		const now = this.ports.now();
		const record: WorkflowExecution = { runId: context.runId, spec: structuredClone(spec), bindings, publicInputs, secretNames, phase: 'pending',
			steps: spec.steps.map(step => ({ id: step.id, state: 'pending', precondition: [], postcondition: [] })), events: [], result: '', createdAt: now, updatedAt: now };
		this.publish(record);
		try { await this.persist(record); this.check(context.signal); }
		catch (error) {
			record.phase = context.signal.reason === 'cancelled' ? 'cancelled' : 'interrupted';
			record.errorCode = this.errors.has(record.runId) ? 'browser_workspace_save_pending' : 'browser_scoped_grant_revoked';
			await this.persist(record).catch(() => undefined); throw error;
		}
		const operations = new Set<ScopedBrowserOperation>(['snapshot', 'get']);
		if (context.trigger === 'manual') operations.add('tab.switch');
		for (const step of spec.steps) if (step.operation !== 'observe' && step.operation !== 'read') operations.add(step.operation === 'navigate' ? 'goto' : step.operation);
		let settle!: (value: AutomationActionCompletion) => void;
		const completion = new Promise<AutomationActionCompletion>(resolve => { settle = resolve; });
		const abort = new AbortController(), segment = new AbortController();
		const grant = new ScopedBrowserGrant({ id: this.ports.id(), taskId: context.runId, targets: bindings.map(b => b.target), operations: [...operations], expiresAt: now + 600_000, maxOperations: 200 }, () => this.ports.now());
		const run: WorkflowLive = { record, values, trigger: context.trigger, abort, segment, grant, leases: new Map(), completion, settle, clear: () => {}, release: () => {}, executor: undefined! };
		run.executor = new ScopedBrowserExecutor(grant, { id: () => this.ports.id(), now: () => this.ports.now(),
			control: (permit, signal) => {
				const lease = run.leases.get(permit.target.pageId); if (!lease) throw new BrowserError('browser_workflow_scope');
				return this.ports.scopedControl({ ...permit, admit: () => { permit.admit(); this.current(run, permit.target); } }, lease, signal);
			}, step: event => this.event(run, event), confirm: (review, signal) => this.confirm(run, review, signal) });
		this.runs.set(record.runId, run);
		const cancel = () => { void this.cancel(record.runId, context.signal.reason === 'cancelled' ? 'cancelled' : 'interrupted'); };
		context.signal.addEventListener('abort', cancel, { once: true }); run.release = () => context.signal.removeEventListener('abort', cancel);
		run.clear = this.ports.after(600_000, () => { record.errorCode = 'browser_scoped_grant_expired'; void this.cancel(record.runId, 'interrupted'); });
		if (context.signal.aborted) cancel(); else this.launch(run);
		return { completion, cancel: () => this.cancel(record.runId), open: () => this.ports.open(record.runId) };
	}
	private current(run: WorkflowLive, target: BrowserPageTarget): void {
		this.check(run.segment.signal); run.grant.assertActive();
		const binding = run.record.bindings.find(row => same(row.target, target));
		const scope = run.record.spec.targetScope.find(row => row.id === binding?.scopeId);
		const page = this.ports.control.list().find(row => same(row.target, target));
		if (!scope || !page || page.error || !workflowScopeMatches(scope, target.profileId, page.url)) throw new BrowserError('browser_workflow_scope');
	}
	private async event(run: WorkflowLive, event: AssistantStep): Promise<void> {
		const safe = structuredClone(event); if (run.record.secretNames.length) delete safe.evidence;
		run.record.events = [...run.record.events.filter(row => row.id !== safe.id), safe];
		if (run.record.phase !== 'paused' && !run.stop) run.record.phase = event.state === 'confirming' ? 'confirming' : 'running';
		await this.persist(run.record);
	}
	private async observe(run: WorkflowLive, binding: WorkflowBinding): Promise<BrowserObservation> {
		this.current(run, binding.target);
		const observation = await run.executor.execute('snapshot', { page: binding.target.pageId }, run.segment.signal) as BrowserObservation;
		this.current(run, binding.target); return observation;
	}
	private ref(run: WorkflowLive, observation: BrowserObservation, locator: WorkflowLocator): BrowserElementRef {
		const name = interpolateWorkflow(locator.name, run.values);
		const matches = observation.refs.filter(ref => ref.role === locator.role && ref.name === name);
		if (matches.length !== 1 || matches[0]!.ambiguous) throw new BrowserError('browser_workflow_element');
		return { revision: observation.revision, element: matches[0]!.ref };
	}
	private async conditions(run: WorkflowLive, index: number, kind: 'precondition' | 'postcondition'): Promise<boolean> {
		const spec = run.record.spec.steps[index]!, evidence = run.record.steps[index]!, binding = run.record.bindings.find(b => b.scopeId === spec.target)!;
		evidence[kind] = [];
		for (const condition of spec[kind]) {
			const observation = await this.observe(run, binding); let observed = '', matched = false;
			if (condition.kind === 'url') { observed = observation.url; matched = observed === interpolateWorkflow(condition.equals, run.values); }
			else {
				const ref = this.ref(run, observation, condition.element);
				if (condition.kind === 'exists') matched = true;
				else {
					const value = await run.executor.execute('get', { page: binding.target.pageId, ...ref }, run.segment.signal) as BrowserElementValue;
					observed = condition.kind === 'value' ? value.value ?? '' : value.text;
					matched = (condition.kind !== 'value' || value.value !== undefined) && observed === interpolateWorkflow(condition.equals, run.values);
				}
			}
			evidence[kind].push({ condition: structuredClone(condition), matched, ...(run.record.secretNames.length ? {} : { observed }) });
			await this.persist(run.record); if (!matched) return false;
		}
		return true;
	}
	private async act(run: WorkflowLive, step: WorkflowStep): Promise<void> {
		const binding = run.record.bindings.find(b => b.scopeId === step.target)!, observation = await this.observe(run, binding), page = binding.target.pageId;
		if (step.operation === 'observe') { if (!run.record.secretNames.length) run.record.result = observation.snapshot; return; }
		if (step.operation === 'navigate') {
			const url = interpolateWorkflow(step.args.url, run.values), scope = run.record.spec.targetScope.find(s => s.id === step.target)!;
			if (!workflowScopeMatches(scope, binding.target.profileId, url)) throw new BrowserError('browser_workflow_scope');
			await run.executor.execute('goto', { page, url }, run.segment.signal); return;
		}
		const ref = this.ref(run, observation, step.args.element);
		if (step.operation === 'read') {
			const result = await run.executor.execute('get', { page, ...ref }, run.segment.signal) as BrowserElementValue;
			if (!run.record.secretNames.length) run.record.result = result.value ?? result.text; return;
		}
		const params: Record<string, unknown> = { page, ...ref };
		if (step.operation === 'fill') {
			const guard = step.precondition.find(c => c.kind === 'value' && same(c.element, step.args.element)) as Extract<WorkflowCondition, { kind: 'value' | 'text' }>;
			params.value = interpolateWorkflow(step.args.value, run.values); params.expectedValue = interpolateWorkflow(guard.equals, run.values);
		}
		if (step.operation === 'keypress') params.key = step.args.key;
		await run.executor.execute(step.operation, params, run.segment.signal);
	}
	private launch(run: WorkflowLive): void {
		run.pump = this.pump(run).catch(error => { run.record.errorCode = error instanceof BrowserError ? error.code : 'browser_failed'; return this.finish(run, 'failed'); });
		void run.pump.catch(() => undefined);
	}
	private async pump(run: WorkflowLive): Promise<void> {
		let index = -1;
		try {
			this.check(run.segment.signal);
			for (const binding of run.record.bindings) {
				this.current(run, binding.target);
				const lease = this.ports.claim(binding.target, run.record.runId, run.segment.signal); run.leases.set(binding.target.pageId, lease);
				lease.signal.addEventListener('abort', () => { if (!run.segment.signal.aborted) this.pause(run.record.runId); }, { once: true, signal: run.segment.signal });
			}
			run.record.phase = 'running'; await this.persist(run.record);
			for (index = 0; index < run.record.steps.length; index++) {
				this.check(run.segment.signal); run.grant.assertActive();
				const row = run.record.steps[index]!; if (row.state === 'succeeded') continue;
				const uncertain = ['unknown', 'acting', 'postcondition'].includes(row.state);
				if (!uncertain) {
					const step = run.record.spec.steps[index]!;
					if (run.trigger === 'manual' && ['fill', 'click', 'keypress'].includes(step.operation)) {
						const binding = run.record.bindings.find(b => b.scopeId === step.target)!;
						await run.executor.execute('tab.switch', { page: binding.target.pageId }, run.segment.signal);
					}
					row.state = 'precondition'; row.startedAt ??= this.ports.now(); await this.persist(run.record);
					if (!await this.conditions(run, index, 'precondition')) throw new BrowserError('browser_workflow_precondition');
					row.state = 'acting'; await this.persist(run.record); this.check(run.segment.signal);
					await this.act(run, run.record.spec.steps[index]!);
				}
				row.state = 'postcondition'; await this.persist(run.record);
				if (!await this.conditions(run, index, 'postcondition')) {
					if (uncertain) { row.state = 'unknown'; run.record.errorCode = 'browser_workflow_postcondition'; this.pause(run.record.runId); await this.persist(run.record); return; }
					throw new BrowserError('browser_workflow_postcondition');
				}
				row.state = 'succeeded'; row.finishedAt = this.ports.now(); delete row.errorCode; await this.persist(run.record);
			}
			this.check(run.segment.signal); await this.finish(run, 'succeeded');
		} catch (error) {
			const row = run.record.steps[index];
			if (row && row.state !== 'succeeded') {
				const last = run.record.events.at(-1);
				row.state = ['acting', 'postcondition', 'unknown'].includes(row.state) && (last?.state === 'unknown' || last?.state === 'returned') ? 'unknown' : run.record.phase === 'paused' ? 'pending' : 'failed';
				row.errorCode = error instanceof BrowserError ? error.code : 'browser_failed';
			}
			if (run.record.phase === 'paused' && !run.stop) await this.persist(run.record);
			else {
				run.record.errorCode ??= error instanceof BrowserError ? error.code : 'browser_failed';
				await this.finish(run, run.stop ?? (run.record.errorCode === 'browser_workflow_confirmation_required' ? 'interrupted' : 'failed'));
			}
		} finally { this.releaseLeases(run); }
	}
	private releaseLeases(run: WorkflowLive): void { for (const lease of run.leases.values()) lease.release(); run.leases.clear(); }
	pause(id: string): void {
		const run = this.runs.get(id); if (!run || run.stop || !active(run.record)) return;
		run.record.phase = 'paused'; run.grant.pause(); run.segment.abort(); run.decision?.settle(false); this.releaseLeases(run); this.publish(run.record);
	}
	async resume(id: string): Promise<void> {
		this.check(); const run = this.runs.get(id); if (!run || run.record.phase !== 'paused' || run.stop) throw new BrowserError('browser_workflow_changed');
		await run.pump; this.check(); if (!this.runs.has(id) || run.stop || run.record.phase !== 'paused') throw new BrowserError('browser_workflow_changed');
		run.grant.resume(); run.segment = new AbortController(); run.record.phase = 'running'; delete run.record.errorCode; this.launch(run);
	}
	async takeover(id: string, target: BrowserPageTarget): Promise<void> {
		const run = this.runs.get(id); if (!run || !run.record.bindings.some(b => same(b.target, target))) throw new BrowserError('browser_workflow_scope');
		this.pause(id); await run.pump; await this.ports.control.activate(target);
	}
	async cancel(id: string, reason: 'cancelled' | 'interrupted' = 'cancelled'): Promise<void> {
		const run = this.runs.get(id); if (!run) return;
		run.stop ??= reason; run.abort.abort(); run.segment.abort(); run.grant.revoke(); run.decision?.settle(false); this.releaseLeases(run);
		if (run.pump) await run.pump;
		if (this.runs.has(id)) await this.finish(run, run.stop);
	}
	confirmation(id: string): BrowserActionReview | undefined { const review = this.runs.get(id)?.decision?.review; return review && structuredClone(review); }
	decide(id: string, reviewId: string, allowed: boolean): void {
		const decision = this.runs.get(id)?.decision; if (!decision || decision.review.id !== reviewId) throw new BrowserError('browser_action_review_changed'); decision.settle(allowed);
	}
	private confirm(run: WorkflowLive, review: BrowserActionReview, signal: AbortSignal): Promise<boolean> {
		this.check(signal); if (run.trigger === 'scheduled') throw new BrowserError('browser_workflow_confirmation_required');
		return new Promise(resolve => {
			let settled = false, clear = () => {};
			const abort = () => settle(false);
			const settle = (allowed: boolean) => { if (settled) return; settled = true; clear(); signal.removeEventListener('abort', abort); run.decision = undefined;
				this.ports.changed(); resolve(allowed && !signal.aborted && this.ports.now() < review.expiresAt); };
			run.decision = { review: structuredClone(review), settle }; signal.addEventListener('abort', abort, { once: true });
			clear = this.ports.after(Math.max(0, Math.min(60_000, review.expiresAt - this.ports.now())), () => settle(false)); this.ports.changed();
		});
	}
	private async finish(run: WorkflowLive, phase: WorkflowExecution['phase']): Promise<void> {
		if (!this.runs.has(run.record.runId)) return;
		run.record.phase = phase; run.clear(); run.release(); run.segment.abort(); run.grant.revoke(); run.decision?.settle(false); this.releaseLeases(run);
		try { await this.persist(run.record); } catch { run.record.phase = 'interrupted'; run.record.errorCode = 'browser_workspace_save_pending'; this.publish(run.record); }
		this.runs.delete(run.record.runId); run.values = {};
		if (!this.errors.has(run.record.runId)) this.facts.delete(run.record.runId);
		run.settle({ status: ['succeeded', 'cancelled', 'interrupted'].includes(run.record.phase) ? run.record.phase as 'succeeded' | 'cancelled' | 'interrupted' : 'failed',
			message: '', errorCode: run.record.errorCode, output: this.ports.artifact(run.record.runId) }); this.ports.changed();
	}
	private publish(run: WorkflowExecution): void { this.facts.set(run.runId, structuredClone(run)); this.ports.changed(); }
	private persist(run: WorkflowExecution): Promise<void> {
		run.updatedAt = this.ports.now(); this.publish(run); const frozen = structuredClone(run);
		const next = this.writes.then(async () => {
			try { await this.ports.store.putExecution(frozen, this.baselines.get(frozen.runId)); this.baselines.set(frozen.runId, frozen); this.errors.delete(frozen.runId);
				if (!this.runs.has(frozen.runId) && same(this.facts.get(frozen.runId), frozen)) this.facts.delete(frozen.runId);
			}
			catch (error) {
				if (same(this.ports.store.data().executions.find(row => row.runId === frozen.runId), frozen)) this.baselines.set(frozen.runId, frozen);
				this.errors.set(frozen.runId, undefined); const path = await this.ports.store.preserve(frozen).catch(() => undefined); this.errors.set(frozen.runId, path); throw error;
			} finally { this.ports.changed(); }
		}); this.writes = next.catch(() => undefined); return next;
	}
	async retrySave(): Promise<void> {
		await this.ports.store.retrySave(); for (const id of [...this.errors.keys()]) { const run = this.facts.get(id); if (run) await this.persist(run); }
	}
	private async recover(): Promise<void> {
		await this.ports.store.ready;
		for (const run of this.ports.store.data().executions) {
			this.baselines.set(run.runId, structuredClone(run)); if (!active(run)) continue;
			run.phase = 'interrupted'; for (const step of run.steps) if (['acting', 'postcondition'].includes(step.state)) step.state = 'unknown';
			await this.persist(run);
		}
	}
	async shutdown(): Promise<void> {
		this.closed = true; this.reviews.clear(); await Promise.all([...this.runs.keys()].map(id => this.cancel(id, 'interrupted'))); await this.writes; await this.ports.store.shutdown();
	}
}
