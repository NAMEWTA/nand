import { AutomationError, automationFailure } from '../../shared/automation/errors';
import { isDefinition } from '../../shared/automation/metadata';
import {
	isActiveRun,
	type AgentRuntimePort,
	type AutomationDefinition,
	type AutomationRun,
	type AutomationSourcePort,
} from '../../shared/automation/types';
import { t } from '../../shared/i18n/index';
import { JsonStore } from '../../shared/json-store';
import type { TextStorage } from '../../shared/storage/ports';
import { latestOccurrence, validateSchedule } from './schedule';
import type { AutomationDefinitionsRepository } from './documents';
import { actionAvailability, type ActionExecutor } from '../actions/executor';

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
	constructor(
		storage: TextStorage,
		path: string,
		readonly deviceId: string,
		readonly sources: AutomationSourcePort,
		readonly agent: () => AgentRuntimePort | undefined,
		private notify: (run: AutomationRun, definition: AutomationDefinition) => Promise<void>,
		private enabled = true,
		private options: { definitions?: AutomationDefinitionsRepository; executor?: ActionExecutor; desktop?: boolean } = {},
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
					if (isActiveRun(run) || this.ownedAgents.has(run.id)) await this.stop(run);
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
	private async execute(
		d: AutomationDefinition,
		trigger: 'manual' | 'scheduled' = 'manual',
		at = Date.now(),
		now = Date.now(),
	): Promise<AutomationRun | undefined> {
		this.requireExecution();
		if (!this.loaded || this.stopped || this.launching.has(d.id)) return undefined;
		if (!validDefinition(d)) throw new AutomationError('invalid');
		const unavailable = actionAvailability(d.action.kind, trigger, this.options.desktop !== false);
		if (unavailable) throw new Error(t(unavailable));
		if (d.deviceId !== this.deviceId) throw new AutomationError('otherDevice');
		const active = this.state.runs.find((r) => r.automationId === d.id && isActiveRun(r));
		if (active && trigger === 'manual') {
			if (active.terminalId) await this.agent()?.open(active.terminalId);
			return active;
		}
		this.launching.add(d.id);
		d = structuredClone(d);
		const run: AutomationRun = {
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
			if (active || (trigger === 'scheduled' && now - at > d.graceMinutes * 60_000 + 120_000)) {
				await this.updateRun(run, {
					status: 'skipped',
					message: t(active ? 'automation.busy' : 'automation.missed'),
					errorCode: active ? 'busy' : 'missed',
					endedAt: Date.now(),
				});
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
					message = (await this.options.executor.execute(d.action, { run, desktop: this.options.desktop !== false })).message;
				}
				await this.updateRun(run, { status: 'succeeded', message, endedAt: Date.now() });
			}
		} catch (error) {
			await this.updateRun(run, {
				status: 'failed',
				endedAt: Date.now(),
				...automationFailure(error),
			});
		} finally {
			this.launching.delete(d.id);
		}
		if (!this.stopped && !isActiveRun(run) && run.status !== 'skipped') await this.publish(run, d);
		return run;
	}
	async stop(run: AutomationRun): Promise<void> {
		const owned = this.ownedAgents.get(run.id);
		if (!isActiveRun(run) && !owned) return;
		// Persist cancellation first so a simultaneous completion cannot overwrite it.
		await this.updateRun(run, {
			status: 'cancelled', endedAt: Date.now(), terminalId: owned?.terminalId ?? run.terminalId,
		}, true);
		try {
			if (owned) await owned.agent.stop(owned.terminalId);
			else if (run.terminalId) await this.agent()?.stop(run.terminalId);
			if (this.ownedAgents.get(run.id) === owned) this.ownedAgents.delete(run.id);
		} catch (error) {
			await this.updateRun(run, { status: 'unknown', endedAt: undefined, ...automationFailure(error) }, true);
			throw error;
		}
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
		this.listeners.clear();
		if (!this.loaded) return;
		await Promise.allSettled([...this.launches]);
		await Promise.all([...this.ownedAgents.values()].map(owned => owned.agent.stop(owned.terminalId)));
		this.ownedAgents.clear();
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
