import { AutomationError, automationFailure } from '../../../shared/automation/errors';
import { isDefinition } from '../../../shared/automation/metadata';
import {
	isActiveRun,
	type AgentRuntimePort,
	type AutomationDefinition,
	type AutomationRun,
	type AutomationSourcePort,
	type AutomationActionHandle,
} from '../../../shared/automation/types';
import { t } from '../../../shared/i18n/index';
import { JsonStore } from '../../../shared/json-store';
import type { TextStorage } from '../../../shared/storage/ports';
import { latestOccurrence, validateSchedule } from './schedule';
import type { AutomationDefinitionsRepository } from './documents';
import { actionAvailability, type ActionExecutor } from './actions/executor';
import { dispatchIdentity, dispatchMaterial, type AgentDispatchRequest, type AgentDispatchReceipt } from '../../../shared/agent-dispatch';
import type { AutomationWorkflowRequest, AutomationWorkflowReceipt } from '../api';

export interface AutomationState {
	definitions: AutomationDefinition[];
	runs: AutomationRun[];
	cursors: Record<string, number>;
}
export function validDefinition(value: unknown): value is AutomationDefinition {
	if (!isDefinition(value)) return false;
	const d = value;
	try {
		validateSchedule(d.schedule);
		return true;
	} catch {
		return false;
	}
}
export class AutomationService {
	loadError = '';
	private loaded = false;
	state: AutomationState = { definitions: [], runs: [], cursors: {} };
	private sourceDefinitions: AutomationDefinition[] = [];
	private savedDefinitions: AutomationDefinition[] = [];
	private store: JsonStore<AutomationState>;
	private listeners = new Set<() => void>();
	private evaluating = false;
	private stopped = false;
	private launching = new Set<string>();
	private refreshing?: Promise<void>;
	private writes: Promise<void> = Promise.resolve();
	private launches = new Set<Promise<unknown>>();
	private ownedAgents = new Map<string, { agent: AgentRuntimePort; terminalId: string }>();
	private transitions: Promise<void> = Promise.resolve();
	private needsShutdown = false;
	private invocations = new Map<string, { identity: string; result: Promise<AgentDispatchReceipt> }>();
	private pendingMaterials = new Map<string, AbortController>();
	private pendingActions = new Map<string, AbortController>();
	private ownedActions = new Map<string, { handle: AutomationActionHandle; abort: AbortController }>();
	private workflowInvocations = new Map<string, { identity: string; result: Promise<AutomationWorkflowReceipt> }>();
	constructor(
		storage: TextStorage,
		path: string,
		readonly deviceId: string,
		readonly sources: AutomationSourcePort,
		readonly agent: () => AgentRuntimePort | undefined,
		private notify: (run: AutomationRun, definition: AutomationDefinition) => Promise<void>,
		private enabled = true,
		private options: { definitions?: AutomationDefinitionsRepository; executor?: ActionExecutor; desktop?: boolean;
			attachMaterial?: (request: AgentDispatchRequest, signal: AbortSignal) => Promise<void> } = {},
	) {
		this.store = new JsonStore(storage, path, (value): value is AutomationState => {
			if (!value || typeof value !== 'object') return false;
			const s = value as AutomationState;
			return (
				Array.isArray(s.definitions) &&
				s.definitions.every(validDefinition) &&
				Array.isArray(s.runs) &&
				s.runs.every((r) => r && typeof r.id === 'string' && typeof r.status === 'string') &&
				!!s.cursors &&
				typeof s.cursors === 'object'
			);
		});
	}
	get executionEnabled(): boolean {
		return this.enabled && !this.stopped;
	}
	/** Close admission immediately; await starts, owned processes and durable cancellation. */
	setExecutionEnabled(enabled: boolean): Promise<void> {
		if (!enabled) {
			this.enabled = false;
			for (const pending of this.pendingActions.values()) pending.abort('cancelled');
			this.needsShutdown = true;
			this.emit();
		}
		const transition = this.transitions.then(async () => {
			if (this.stopped) return;
			if (this.needsShutdown) {
				// Stop known processes while an in-flight start finishes. A later pass
				// also catches handles returned after the gate closed.
				const stopping = this.state.runs.filter(isActiveRun).map(run => this.stop(run));
				const results = await Promise.allSettled([...stopping, ...this.launches]);
				const failure = results.slice(0, stopping.length).find(result => result.status === 'rejected');
				if (failure?.status === 'rejected') throw failure.reason;
				for (const run of this.state.runs) {
					if (isActiveRun(run) || this.ownedAgents.has(run.id) || this.ownedActions.has(run.id)) await this.stop(run);
				}
				await this.writes;
				this.needsShutdown = false;
			}
			this.enabled = enabled;
			this.emit();
		});
		this.transitions = transition.catch(() => {});
		return transition;
	}
	private requireExecution(): void {
		if (!this.executionEnabled) throw new AutomationError('moduleOff');
	}
	async load(): Promise<void> {
		try {
			await this.loadData();
			this.loaded = true;
			this.loadError = '';
		} catch (error) {
			this.loadError = String(error);
			throw error;
		} finally {
			this.emit();
		}
	}
	private async loadData(): Promise<void> {
		this.state = await this.store.load(this.state);
		await this.commit((state) => {
			for (const run of state.runs)
				if (isActiveRun(run)) {
					run.status = 'interrupted';
					run.endedAt = Date.now();
					run.message = '';
				}
		});
		await this.refresh();
		// Delivery uses run IDs as idempotency keys, including recovery after a crash
		// between committing the run and committing its notification.
		for (const run of this.state.runs) {
			const d = run.definition ?? this.definitions.find((d) => d.id === run.automationId);
			if (d && run.status !== 'skipped') await this.publish(run, d);
		}
	}
	get definitions(): AutomationDefinition[] {
		const rows = [...(this.options.definitions ? this.savedDefinitions : this.state.definitions), ...this.sourceDefinitions];
		const counts = new Map<string, number>();
		for (const d of rows) counts.set(d.id, (counts.get(d.id) ?? 0) + 1);
		return rows.filter((d) => counts.get(d.id) === 1);
	}
	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
	private emit(): void {
		for (const fn of this.listeners) fn();
	}
	refresh(): Promise<void> {
		return (
			this.refreshing ??
			(this.refreshing = Promise.all([this.sources.list(), this.options.definitions?.list() ?? Promise.resolve([])])
				.then(([rows, saved]) => {
					this.sourceDefinitions = rows;
					this.savedDefinitions = saved;
					this.emit();
				})
				.finally(() => {
					this.refreshing = undefined;
				}))
		);
	}
	async save(d: AutomationDefinition): Promise<void> {
		this.requireExecution();
		if (!this.loaded) throw new AutomationError('failedLoad');
		if (!validDefinition(d)) throw new AutomationError('invalid');
		const unavailable = actionAvailability(d.action.kind, d.schedule.kind === 'manual' ? 'manual' : 'scheduled', this.options.desktop !== false);
		if (unavailable) throw new Error(t(unavailable));
		const old = this.definitions.find((item) => item.id === d.id);
		if (d.action.kind === 'browser-workflow') {
			if (!this.options.executor?.validate) throw new AutomationError('workflowUnavailable');
			await this.options.executor.validate(d.action);
			this.requireExecution();
		}
		if (old && old.deviceId !== this.deviceId) throw new AutomationError('otherDevice');
		const changed =
			!old ||
			JSON.stringify(old.schedule) !== JSON.stringify(d.schedule) ||
			JSON.stringify(old.action) !== JSON.stringify(d.action);
		const next = { ...d, revision: old ? old.revision + (changed ? 1 : 0) : 1, updatedAt: Date.now() };
		if (!next.source && this.options.definitions) {
			await this.options.definitions.save(next);
			await this.refresh();
		}
		if (next.source) {
			await this.sources.save(next);
			if (this.refreshing) await this.refreshing;
			await this.refresh();
		}
		await this.commit((state) => {
			if (old && changed && JSON.stringify(old.schedule) === JSON.stringify(next.schedule)) {
				const cursor = state.cursors[`${old.id}:${old.revision}`];
				if (cursor !== undefined) state.cursors[`${next.id}:${next.revision}`] = cursor;
			}
			if (!next.source && !this.options.definitions) {
				const index = state.definitions.findIndex((item) => item.id === next.id);
				if (index < 0) state.definitions.push(next);
				else state.definitions[index] = next;
			}
		});
	}
	async remove(d: AutomationDefinition): Promise<void> {
		this.requireExecution();
		if (d.deviceId !== this.deviceId) throw new AutomationError('otherDevice');
		if (this.state.runs.some((r) => r.automationId === d.id && isActiveRun(r)))
			throw new AutomationError('stopFirst');
		if (d.source) {
			await this.sources.remove(d);
			await this.refresh();
		}
		else if (this.options.definitions) { await this.options.definitions.remove(d); await this.refresh(); }
		await this.commit((state) => {
			state.definitions = state.definitions.filter((item) => item.id !== d.id);
		});
	}
	async clearHistory(): Promise<void> {
		this.requireExecution();
		if (!this.loaded) throw new AutomationError('failedLoad');
		await this.commit((state) => {
			state.runs = state.runs.filter(isActiveRun);
		});
	}

	async tick(now = Date.now()): Promise<void> {
		if (!this.loaded || !this.executionEnabled || this.evaluating) return;
		this.evaluating = true;
		try {
			await this.refresh();
			const launches: Promise<unknown>[] = [];
			for (const d of this.definitions) {
				if (!this.executionEnabled) break;
				if (!d.enabled || d.deviceId !== this.deviceId) continue;
				try {
					const at = latestOccurrence(d.schedule, now);
					const key = `${d.id}:${d.revision}`;
					if (at === null || at <= (this.state.cursors[key] ?? -Infinity)) continue;
					launches.push(
						this.run(d, 'scheduled', at, now).catch((error) =>
							console.error('[NAND automation]', d.id, error),
						),
					);
				} catch (error) {
					console.error('[NAND automation]', d.id, error);
				}
			}
			await Promise.all(launches);
		} finally {
			this.evaluating = false;
		}
	}
	run(
		d: AutomationDefinition,
		trigger: 'manual' | 'scheduled' = 'manual',
		at = Date.now(),
		now = Date.now(),
	): Promise<AutomationRun | undefined> {
		const launch = this.execute(d, trigger, at, now);
		this.launches.add(launch);
		void launch.finally(() => this.launches.delete(launch)).catch(() => {});
		return launch;
	}
	/** Dynamic deliveries use the same durable journal and owned runtime as saved automations. */
	invokeAgent(request: AgentDispatchRequest, signal?: AbortSignal): Promise<AgentDispatchReceipt> {
		this.requireExecution();
		if (!this.loaded || this.loadError) return Promise.reject(new AutomationError('failedLoad'));
		const snapshot = structuredClone(request);
		const identity = dispatchIdentity(snapshot);
		const rejected = (errorCode: string, runId?: string): AgentDispatchReceipt => ({ invocationId: snapshot.invocationId, delivery: 'rejected', errorCode, runId });
		if (signal?.aborted) return Promise.resolve(rejected('cancelled'));
		if (!snapshot.invocationId || !snapshot.agentId || !snapshot.finalPrompt.trim() || snapshot.files.some(file => !file || /[\r\n\0]/.test(file))) return Promise.resolve(rejected('invalid'));
		const material = dispatchMaterial(snapshot);
		if (material.length > 64_000) return Promise.resolve(rejected('promptTooLarge'));
		if ([...material].some(char => { const code = char.charCodeAt(0); return (code < 32 && code !== 9 && code !== 10) || code === 127 || (code >= 128 && code <= 159); })) return Promise.resolve(rejected('invalid'));
		const pending = this.invocations.get(snapshot.invocationId);
		if (pending) return pending.identity === identity ? pending.result : Promise.resolve(rejected('invocationConflict'));
		const recorded = this.state.runs.find(run => run.invocation?.request.invocationId === snapshot.invocationId);
		if (recorded?.invocation) {
			if (dispatchIdentity(recorded.invocation.request) !== identity) return Promise.resolve(rejected('invocationConflict', recorded.id));
			return Promise.resolve(recorded.invocation.receipt ?? rejected(recorded.status, recorded.id));
		}
		const now = Date.now();
		const definition: AutomationDefinition = { id: `invocation:${snapshot.invocationId}`, name: snapshot.title, enabled: true,
			deviceId: this.deviceId, revision: 1, schedule: { kind: 'manual' },
			action: { kind: 'agent', agentId: snapshot.agentId, cwd: snapshot.destination.kind === 'fresh' ? snapshot.destination.cwd : '',
				prompt: material, sessionMode: 'fresh' }, source: snapshot.source,
			channels: ['in-app'], notifyOn: 'always', graceMinutes: 0, createdAt: now, updatedAt: now };
		const launch = this.execute(definition, 'manual', now, now, snapshot, signal);
		this.launches.add(launch);
		const result = launch.then(run => run?.invocation?.receipt ?? rejected(run?.status ?? 'invalid', run?.id), error => {
			// A failed notification cannot turn a durably recorded delivery into a failed delivery.
			const receipt = this.state.runs.find(run => run.invocation?.request.invocationId === snapshot.invocationId)?.invocation?.receipt;
			if (receipt) return receipt;
			throw error;
		});
		this.invocations.set(snapshot.invocationId, { identity, result });
		void result.finally(() => { this.invocations.delete(snapshot.invocationId); this.launches.delete(launch); }).catch(() => {});
		return result;
	}
	workflowReceipt(invocationId: string): AutomationWorkflowReceipt | undefined {
		const run = this.state.runs.find(row => row.workflowInvocation?.invocationId === invocationId);
		return run && { invocationId, runId: run.id, status: run.status, errorCode: run.errorCode, output: run.output };
	}
	/** The browser keeps secret inputs and its one-use review in memory. Only the validated public request is journaled. */
	invokeWorkflow(request: AutomationWorkflowRequest, options?: { signal?: AbortSignal; authorizationId?: string }): Promise<AutomationWorkflowReceipt> {
		this.requireExecution();
		if (!this.loaded || this.loadError) return Promise.reject(new AutomationError('failedLoad'));
		const input = structuredClone(request);
		if (!input || !/^[\w-]{1,100}$/.test(input.invocationId) || typeof input.title !== 'string' || !input.title.trim()
			|| input.source?.kind !== 'browser-workflow' || options?.signal?.aborted) return Promise.reject(new AutomationError('workflowInvalid'));
		const now = Date.now();
		const definition: AutomationDefinition = { id: `workflow:${input.invocationId}`, name: input.title, enabled: true,
			deviceId: this.deviceId, revision: 1, schedule: { kind: 'manual' }, action: input.action, source: input.source,
			channels: ['in-app'], notifyOn: 'failure', graceMinutes: 0, createdAt: now, updatedAt: now };
		if (!validDefinition(definition)) return Promise.reject(new AutomationError('workflowInvalid'));
		const a = input.action;
		const identity = JSON.stringify([input.title, input.source.kind, input.source.path, input.source.id, a.workflowId, a.version,
			Object.entries(a.variables).sort(([left], [right]) => left.localeCompare(right)),
			a.scope.map(s => [s.id, s.pageId, s.profileId]).sort(([left], [right]) => left!.localeCompare(right!))]);
		const pending = this.workflowInvocations.get(input.invocationId);
		if (pending) return pending.identity === identity ? pending.result : Promise.reject(new AutomationError('invocationConflict'));
		const recorded = this.state.runs.find(run => run.workflowInvocation?.invocationId === input.invocationId);
		if (recorded) return recorded.workflowInvocation?.identity === identity ? Promise.resolve(this.workflowReceipt(input.invocationId)!) : Promise.reject(new AutomationError('invocationConflict'));
		const launch = (async () => {
			if (!this.options.executor?.validate) throw new AutomationError('workflowUnavailable');
			await this.options.executor.validate(input.action);
			this.requireExecution();
			if (options?.signal?.aborted) throw new AutomationError('workflowInvalid');
			const run = await this.execute(definition, 'manual', now, now, undefined, options?.signal,
				{ invocation: { invocationId: input.invocationId, identity }, authorizationId: options?.authorizationId });
			if (!run) throw new AutomationError('workflowUnavailable');
			return this.workflowReceipt(input.invocationId)!;
		})();
		this.launches.add(launch);
		this.workflowInvocations.set(input.invocationId, { identity, result: launch });
		void launch.finally(() => { this.workflowInvocations.delete(input.invocationId); this.launches.delete(launch); }).catch(() => {});
		return launch;
	}
	private async execute(
		d: AutomationDefinition,
		trigger: 'manual' | 'scheduled' = 'manual',
		at = Date.now(),
		now = Date.now(),
		invocation?: AgentDispatchRequest,
		deliverySignal?: AbortSignal,
		workflow?: { invocation: NonNullable<AutomationRun['workflowInvocation']>; authorizationId?: string },
	): Promise<AutomationRun | undefined> {
		this.requireExecution();
		if (!this.loaded || this.stopped || this.launching.has(d.id)) return undefined;
		if (!validDefinition(d)) throw new AutomationError('invalid');
		const unavailable = actionAvailability(d.action.kind, trigger, this.options.desktop !== false);
		if (unavailable) throw new Error(t(unavailable));
		if (d.deviceId !== this.deviceId) throw new AutomationError('otherDevice');
		const active = this.state.runs.find((r) => r.automationId === d.id && isActiveRun(r));
		if (active && trigger === 'manual') {
			await this.openRun(active);
			return active;
		}
		this.launching.add(d.id);
		d = structuredClone(d);
		let admissionError: Error | undefined;
		if (d.action.kind === 'browser-workflow') {
			try {
				if (!this.options.executor?.validate) throw new AutomationError('workflowUnavailable');
				await this.options.executor.validate(d.action);
			} catch (error) {
				// A manually edited definition may contain a secret value. Never copy unvalidated inputs into history.
				admissionError = error instanceof AutomationError ? error : new AutomationError('workflowInvalid'); d.action.variables = {};
			}
		}
		const run: AutomationRun = {
			...(workflow ? { workflowInvocation: workflow.invocation } : {}),
			...(invocation ? { invocation: { request: invocation } } : {}),
			definition: d,
			id: crypto.randomUUID(),
			automationId: d.id,
			revision: d.revision,
			title: d.name,
			scheduledFor: at,
			trigger,
			status: 'pending',
			startedAt: now,
			message: '',
			source: d.source,
		};
		const previous = [...this.state.runs].reverse().find((r) => r.automationId === d.id && r.terminalId);
		try {
			// No process or external effect may start before the run and cursor are durable.
			await this.commit((state) => {
				state.runs.push(run);
				if (trigger === 'scheduled') state.cursors[`${d.id}:${d.revision}`] = at;
			});
		} catch (error) {
			this.launching.delete(d.id);
			throw error;
		}
		try {
			if (!this.executionEnabled || !isActiveRun(run)) return run;
			if (admissionError) throw admissionError;
			if (invocation && deliverySignal?.aborted) {
				const timeout = deliverySignal.reason === 'timeout';
				await this.updateRun(run, { status: timeout ? 'failed' : 'cancelled', endedAt: Date.now(), invocation: { request: invocation,
					receipt: { invocationId: invocation.invocationId, runId: run.id, delivery: timeout ? 'timeout' : 'rejected', errorCode: timeout ? 'timeout' : 'cancelled' } } });
				return run;
			}
			if (active || (trigger === 'scheduled' && now - at > d.graceMinutes * 60_000 + 120_000)) {
				await this.updateRun(run, {
					status: 'skipped',
					message: t(active ? 'automation.busy' : 'automation.missed'),
					errorCode: active ? 'busy' : 'missed',
					endedAt: Date.now(),
				});
			} else if (invocation?.destination.kind === 'existing') {
				if (!this.options.attachMaterial) throw new AutomationError('agentUnavailable');
				const abort = new AbortController();
				const cancel = () => abort.abort(deliverySignal?.reason);
				deliverySignal?.addEventListener('abort', cancel, { once: true });
				this.pendingMaterials.set(run.id, abort);
				try {
					await this.options.attachMaterial(invocation, abort.signal);
					if (isActiveRun(run)) await this.updateRun(run, { status: 'delivered', endedAt: Date.now(),
						terminalId: invocation.destination.sessionId, invocation: { request: invocation,
							receipt: { invocationId: invocation.invocationId, runId: run.id, terminalId: invocation.destination.sessionId, delivery: 'pasted' } } });
				} finally { deliverySignal?.removeEventListener('abort', cancel); this.pendingMaterials.delete(run.id); }
			} else if (d.action.kind === 'agent' || d.action.kind === 'script') {
				const agent = this.agent();
				if (!agent) throw new AutomationError('agentUnavailable');
				const handle = d.action.kind === 'agent' ? await agent.start(d.action, run, previous) : await agent.startScript?.(d.action, run);
				if (!handle) throw new AutomationError('agentUnavailable');
				this.ownedAgents.set(run.id, { agent, terminalId: handle.terminalId });
				if (!this.executionEnabled && !this.stopped) return run;
				if (this.stopped || !isActiveRun(run)) {
					await agent.stop(handle.terminalId);
					this.ownedAgents.delete(run.id);
					return run;
				}
				try {
					await this.updateRun(run, {
						...(invocation ? { invocation: { request: invocation, receipt: { invocationId: invocation.invocationId, delivery: 'started' as const, runId: run.id, terminalId: handle.terminalId } } } : {}),
						terminalId: handle.terminalId,
						session: handle.session,
						status: 'unknown',
					});
				} catch (error) {
					await agent.stop(handle.terminalId);
					this.ownedAgents.delete(run.id);
					throw error;
				}
				const unsubscribe = handle.onRunning?.(() => {
					if (isActiveRun(run)) {
						void this.updateRun(run, { status: 'running' }).catch(console.error);
					}
				});
				void handle.completion
					.then(async (result) => {
						unsubscribe?.();
						this.ownedAgents.delete(run.id);
						if (!isActiveRun(run)) return;
						await this.updateRun(run, { ...result, endedAt: Date.now() });
						if (!this.stopped) await this.publish(run, d);
					})
					.catch(console.error);
			} else {
				if (d.action.kind === 'create-task') await this.sources.createTask(d.action, run.id);
				let message = '';
				if (d.action.kind !== 'create-task' && d.action.kind !== 'notify') {
					if (!this.options.executor) throw new AutomationError('invalid');
					const abort = new AbortController();
					const cancel = () => { abort.abort('cancelled'); void this.stop(run).catch(console.error); };
					deliverySignal?.addEventListener('abort', cancel, { once: true });
					let retained = false;
					this.pendingActions.set(run.id, abort);
					try {
						if (deliverySignal?.aborted || !this.executionEnabled || !isActiveRun(run)) { cancel(); return run; }
						const result = await this.options.executor.execute(d.action, { run, desktop: this.options.desktop !== false, signal: abort.signal, authorizationId: workflow?.authorizationId });
						message = result.message;
						if (result.handle) {
							void result.handle.completion.catch(() => undefined);
							const owned = { handle: result.handle, abort };
							this.ownedActions.set(run.id, owned);
							if (!this.executionEnabled || !isActiveRun(run) || abort.signal.aborted) {
								abort.abort(); await result.handle.cancel(); this.ownedActions.delete(run.id); return run;
							}
							try { await this.updateRun(run, { status: 'running', message }); }
							catch (error) { abort.abort(); await result.handle.cancel(); this.ownedActions.delete(run.id); throw error; }
							retained = true;
							void result.handle.completion.then(async completion => {
								if (isActiveRun(run)) await this.updateRun(run, { ...completion, endedAt: Date.now() });
								if (!this.stopped) await this.publish(run, d);
							}, async error => {
								if (isActiveRun(run)) await this.updateRun(run, { status: 'failed', endedAt: Date.now(), ...automationFailure(d.action.kind === 'browser-workflow' ? new AutomationError('workflowInvalid') : error) });
								if (!this.stopped) await this.publish(run, d);
							}).finally(() => {
								deliverySignal?.removeEventListener('abort', cancel);
								if (this.ownedActions.get(run.id) === owned) this.ownedActions.delete(run.id);
							}).catch(console.error);
							return run;
						}
					} finally { this.pendingActions.delete(run.id); if (!retained) deliverySignal?.removeEventListener('abort', cancel); }
				}
				await this.updateRun(run, { status: 'succeeded', message, endedAt: Date.now() });
			}
		} catch (error) {
			const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : 'operationFailed';
			await this.updateRun(run, {
				...(invocation ? { invocation: { request: invocation, receipt: { invocationId: invocation.invocationId, runId: run.id, delivery: code === 'timeout' ? 'timeout' as const : 'rejected' as const, errorCode: code } } } : {}),
				status: 'failed',
				endedAt: Date.now(),
				...automationFailure(d.action.kind === 'browser-workflow' && !(error instanceof AutomationError) ? new AutomationError('workflowInvalid') : error),
			});
		} finally {
			this.launching.delete(d.id);
		}
		if (!this.stopped && !isActiveRun(run) && run.status !== 'skipped') await this.publish(run, d);
		return run;
	}
	async stop(run: AutomationRun): Promise<void> {
		this.pendingMaterials.get(run.id)?.abort();
		this.pendingActions.get(run.id)?.abort('cancelled');
		const action = this.ownedActions.get(run.id);
		action?.abort.abort('cancelled');
		const owned = this.ownedAgents.get(run.id);
		if (!isActiveRun(run) && !owned && !action) return;
		// Persist cancellation first so a simultaneous completion cannot overwrite it.
		await this.updateRun(run, {
			status: 'cancelled', endedAt: Date.now(), terminalId: owned?.terminalId ?? run.terminalId,
			...(run.invocation && !run.invocation.receipt ? { invocation: { ...run.invocation, receipt: { invocationId: run.invocation.request.invocationId, runId: run.id, delivery: 'rejected' as const, errorCode: 'cancelled' } } } : {}),
		}, true);
		try {
			if (action) await action.handle.cancel();
			if (owned) await owned.agent.stop(owned.terminalId);
			else if (run.terminalId) await this.agent()?.stop(run.terminalId);
			if (this.ownedAgents.get(run.id) === owned) this.ownedAgents.delete(run.id);
			if (this.ownedActions.get(run.id) === action) this.ownedActions.delete(run.id);
		} catch (error) {
			await this.updateRun(run, { status: 'unknown', endedAt: undefined, ...automationFailure(run.definition?.action.kind === 'browser-workflow' ? new AutomationError('workflowInvalid') : error) }, true);
			throw error;
		}
	}
	async openRun(run: AutomationRun): Promise<void> {
		const action = this.ownedActions.get(run.id);
		if (action) await action.handle.open();
		else if (run.terminalId) await this.agent()?.open(run.terminalId);
		else await this.options.executor?.open?.(run);
	}
	private async publish(run: AutomationRun, definition: AutomationDefinition): Promise<void> {
		if (!this.executionEnabled || run.notificationAttempted) return;
		await this.notify(run, definition);
		await this.updateRun(run, { notificationAttempted: true }, true);
	}
	private updateRun(run: AutomationRun, patch: Partial<AutomationRun>, terminal = false): Promise<void> {
		return this.commit((state) => {
			const row = state.runs.find((r) => r.id === run.id);
			if (row && (terminal || isActiveRun(row))) Object.assign(row, patch);
		});
	}
	/** Serialize state transitions; publish only after successful persistence. */
	private commit(change: (state: AutomationState) => void): Promise<void> {
		const operation = this.writes.then(async () => {
			const next = structuredClone(this.state);
			change(next);
			const counts = new Map<string, number>();
			next.runs = next.runs
				.slice()
				.reverse()
				.filter((r) => {
					if (isActiveRun(r)) return true;
					const n = (counts.get(r.automationId) ?? 0) + 1;
					counts.set(r.automationId, n);
					return n <= 100;
				})
				.reverse();
			await this.store.save(next);
			// Preserve references held by live completion handlers and callers.
			const live = new Map(this.state.runs.map(row => [row.id, row]));
			next.runs = next.runs.map((row) => {
				const existing = live.get(row.id);
				return existing ? Object.assign(existing, row) : row;
			});
			this.state = next;
			this.emit();
		});
		this.writes = operation.catch(() => {});
		return operation;
	}
	dispose(): void {
		void this.shutdown().catch(console.error);
	}
	async shutdown(): Promise<void> {
		this.stopped = true;
		for (const pending of this.pendingMaterials.values()) pending.abort();
		for (const pending of this.pendingActions.values()) pending.abort('interrupted');
		for (const action of this.ownedActions.values()) action.abort.abort('interrupted');
		this.listeners.clear();
		if (!this.loaded) return;
		await Promise.allSettled([...this.launches]);
		await Promise.all([...this.ownedAgents.values()].map(owned => owned.agent.stop(owned.terminalId)));
		await Promise.all([...this.ownedActions.values()].map(owned => owned.handle.cancel()));
		this.ownedAgents.clear();
		this.ownedActions.clear();
		await this.commit((state) => {
			for (const run of state.runs)
				if (isActiveRun(run)) {
					run.status = 'interrupted';
					run.endedAt = Date.now();
				}
		});
		await this.store.flush();
	}
}
