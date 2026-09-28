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
	private store: JsonStore<AutomationState>;
	private listeners = new Set<() => void>();
	private evaluating = false;
	private stopped = false;
	private launching = new Set<string>();
	private refreshing?: Promise<void>;
	private writes: Promise<void> = Promise.resolve();
	constructor(
		storage: TextStorage,
		path: string,
		readonly deviceId: string,
		readonly sources: AutomationSourcePort,
		readonly agent: () => AgentRuntimePort | undefined,
		private notify: (run: AutomationRun, definition: AutomationDefinition) => Promise<void>,
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
		const rows = [...this.state.definitions, ...this.sourceDefinitions];
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
			(this.refreshing = this.sources
				.list()
				.then((rows) => {
					this.sourceDefinitions = rows;
					this.emit();
				})
				.finally(() => {
					this.refreshing = undefined;
				}))
		);
	}
	async save(d: AutomationDefinition): Promise<void> {
		if (!this.loaded) throw new AutomationError('failedLoad');
		if (!validDefinition(d)) throw new AutomationError('invalid');
		const old = this.definitions.find((item) => item.id === d.id);
		if (old && old.deviceId !== this.deviceId) throw new AutomationError('otherDevice');
		const changed =
			!old ||
			JSON.stringify(old.schedule) !== JSON.stringify(d.schedule) ||
			JSON.stringify(old.action) !== JSON.stringify(d.action);
		const next = { ...d, revision: old ? old.revision + (changed ? 1 : 0) : 1, updatedAt: Date.now() };
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
			if (!next.source) {
				const index = state.definitions.findIndex((item) => item.id === next.id);
				if (index < 0) state.definitions.push(next);
				else state.definitions[index] = next;
			}
		});
	}
	async remove(d: AutomationDefinition): Promise<void> {
		if (d.deviceId !== this.deviceId) throw new AutomationError('otherDevice');
		if (this.state.runs.some((r) => r.automationId === d.id && isActiveRun(r)))
			throw new AutomationError('stopFirst');
		if (d.source) {
			await this.sources.remove(d);
			await this.refresh();
		}
		await this.commit((state) => {
			state.definitions = state.definitions.filter((item) => item.id !== d.id);
		});
	}
	async clearHistory(): Promise<void> {
		if (!this.loaded) throw new AutomationError('failedLoad');
		await this.commit((state) => {
			state.runs = state.runs.filter(isActiveRun);
		});
	}

	async tick(now = Date.now()): Promise<void> {
		if (!this.loaded || this.stopped || this.evaluating) return;
		this.evaluating = true;
		try {
			await this.refresh();
			const launches: Promise<unknown>[] = [];
			for (const d of this.definitions) {
				if (this.stopped) break;
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
	async run(
		d: AutomationDefinition,
		trigger: 'manual' | 'scheduled' = 'manual',
		at = Date.now(),
		now = Date.now(),
	): Promise<AutomationRun | undefined> {
		if (!this.loaded || this.stopped || this.launching.has(d.id)) return undefined;
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
			if (this.stopped || !isActiveRun(run)) return run;
			if (active || (trigger === 'scheduled' && now - at > d.graceMinutes * 60_000 + 120_000)) {
				await this.updateRun(run, {
					status: 'skipped',
					message: t(active ? 'automation.busy' : 'automation.missed'),
					errorCode: active ? 'busy' : 'missed',
					endedAt: Date.now(),
				});
			} else if (d.action.kind === 'agent') {
				const agent = this.agent();
				if (!agent) throw new AutomationError('agentUnavailable');
				const handle = await agent.start(d.action, run, previous);
				if (this.stopped || !isActiveRun(run)) {
					await agent.stop(handle.terminalId);
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
						if (!isActiveRun(run)) return;
						await this.updateRun(run, { ...result, endedAt: Date.now() });
						if (!this.stopped) await this.publish(run, d);
					})
					.catch(console.error);
			} else {
				if (d.action.kind === 'create-task') await this.sources.createTask(d.action, run.id);
				await this.updateRun(run, { status: 'succeeded', endedAt: Date.now() });
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
		if (!isActiveRun(run)) return;
		// Persist cancellation first so a simultaneous completion cannot overwrite it.
		await this.updateRun(run, { status: 'cancelled', endedAt: Date.now() });
		try {
			if (run.terminalId) await this.agent()?.stop(run.terminalId);
		} catch (error) {
			await this.updateRun(run, { status: 'unknown', endedAt: undefined, ...automationFailure(error) }, true);
			throw error;
		}
	}
	private async publish(run: AutomationRun, definition: AutomationDefinition): Promise<void> {
		if (run.notificationAttempted) return;
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
			next.runs = next.runs.map((row) => {
				const existing = this.state.runs.find((r) => r.id === row.id);
				return existing ? Object.assign(existing, row) : row;
			});
			this.state = next;
			this.emit();
		});
		this.writes = operation.catch(() => {});
		return operation;
	}
	dispose(): void {
		this.stopped = true;
		this.listeners.clear();
		if (!this.loaded) return;
		void this.commit((state) => {
			for (const run of state.runs)
				if (isActiveRun(run)) {
					run.status = 'interrupted';
					run.endedAt = Date.now();
				}
		}).catch(console.error);
	}
}
