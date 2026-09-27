import type { App } from 'obsidian';
import { JsonStore } from '../shared/json-store';
import { t } from '../shared/i18n';
import {
	isActiveRun,
	type AutomationDefinition,
	type AutomationRun,
	type AutomationSourcePort,
	type AgentRuntimePort,
} from '../shared/automation/types';
import { isDefinition } from '../shared/automation/metadata';
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
	state: AutomationState = { definitions: [], runs: [], cursors: {} };
	private sourceDefinitions: AutomationDefinition[] = [];
	private store: JsonStore<AutomationState>;
	private listeners = new Set<() => void>();
	private evaluating = false;
	private stopped = false;
	private launching = new Set<string>();
	private refreshing?: Promise<void>;
	constructor(
		app: App,
		path: string,
		readonly deviceId: string,
		readonly sources: AutomationSourcePort,
		readonly agent: () => AgentRuntimePort | undefined,
		private notify: (run: AutomationRun, definition: AutomationDefinition) => Promise<void>,
	) {
		this.store = new JsonStore(app, path, (value): value is AutomationState => {
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
		this.state = await this.store.load(this.state);
		for (const run of this.state.runs)
			if (isActiveRun(run)) {
				run.status = 'interrupted';
				run.endedAt = Date.now();
				run.message = t('automation.interrupted');
			}
		await this.persist();
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
		if (!validDefinition(d)) throw new Error(t('automation.invalid'));
		const old = this.definitions.find((item) => item.id === d.id);
		if (old && old.deviceId !== this.deviceId) throw new Error(t('automation.otherDevice'));
		const changed =
			!old ||
			JSON.stringify(old.schedule) !== JSON.stringify(d.schedule) ||
			JSON.stringify(old.action) !== JSON.stringify(d.action);
		const next = { ...d, revision: old ? old.revision + (changed ? 1 : 0) : 1, updatedAt: Date.now() };
		if (old && changed && JSON.stringify(old.schedule) === JSON.stringify(next.schedule)) {
			const cursor = this.state.cursors[`${old.id}:${old.revision}`];
			if (cursor !== undefined) this.state.cursors[`${next.id}:${next.revision}`] = cursor;
		}
		if (next.source) {
			await this.sources.save(next);
			if (this.refreshing) await this.refreshing;
			await this.refresh();
			await this.persist();
		} else {
			this.state.definitions = [...this.state.definitions.filter((item) => item.id !== next.id), next];
			await this.persist();
		}
		this.emit();
	}
	async remove(d: AutomationDefinition): Promise<void> {
		if (d.deviceId !== this.deviceId) throw new Error(t('automation.otherDevice'));
		if (this.state.runs.some((r) => r.automationId === d.id && isActiveRun(r)))
			throw new Error(t('automation.stopFirst'));
		if (d.source) {
			await this.sources.remove(d);
			await this.refresh();
		} else this.state.definitions = this.state.definitions.filter((item) => item.id !== d.id);
		this.state.runs = this.state.runs.filter((r) => r.automationId !== d.id);
		await this.persist();
		this.emit();
	}
	async tick(now = Date.now()): Promise<void> {
		if (this.stopped || this.evaluating) return;
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
		if (this.stopped || this.launching.has(d.id)) return undefined;
		if (d.deviceId !== this.deviceId) throw new Error(t('automation.otherDevice'));
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
		this.state.runs.push(run);
		if (trigger === 'scheduled') this.state.cursors[`${d.id}:${d.revision}`] = at;
		try {
			await this.persist();
			if (this.stopped || !isActiveRun(run)) return run;
			if (active || (trigger === 'scheduled' && now - at > d.graceMinutes * 60_000 + 120_000)) {
				run.status = 'skipped';
				run.message = t(active ? 'automation.busy' : 'automation.missed');
			} else if (d.action.kind === 'agent') {
				const agent = this.agent();
				if (!agent) throw new Error(t('automation.agentUnavailable'));
				const handle = await agent.start(d.action, run, previous);
				if (this.stopped || !isActiveRun(run)) {
					await agent.stop(handle.terminalId);
					return run;
				}
				run.terminalId = handle.terminalId;
				run.session = handle.session;
				run.status = 'unknown';
				const unsubscribe = handle.onRunning?.(() => {
					if (isActiveRun(run)) {
						run.status = 'running';
						this.emit();
						void this.persist().catch(console.error);
					}
				});
				void handle.completion
					.then(async (result) => {
						unsubscribe?.();
						if (!isActiveRun(run)) return;
						Object.assign(run, result);
						run.endedAt = Date.now();
						await this.persist();
						this.emit();
						if (!this.stopped) await this.publish(run, d);
					})
					.catch(console.error);
			} else {
				if (d.action.kind === 'create-task') await this.sources.createTask(d.action, run.id);
				run.status = 'succeeded';
			}
		} catch (error) {
			run.status = 'failed';
			run.message = error instanceof Error ? error.message : String(error);
		} finally {
			this.launching.delete(d.id);
		}
		if (!isActiveRun(run)) run.endedAt = Date.now();
		await this.persist();
		this.emit();
		if (!this.stopped && !isActiveRun(run) && run.status !== 'skipped') await this.publish(run, d);
		return run;
	}
	async stop(run: AutomationRun): Promise<void> {
		if (!isActiveRun(run)) return;
		run.status = 'cancelled';
		run.endedAt = Date.now();
		try {
			if (run.terminalId) await this.agent()?.stop(run.terminalId);
		} catch (error) {
			run.status = 'unknown';
			run.endedAt = undefined;
			run.message = String(error);
			throw error;
		} finally {
			await this.persist();
			this.emit();
		}
	}
	private async publish(run: AutomationRun, definition: AutomationDefinition): Promise<void> {
		if (run.notificationAttempted) return;
		await this.notify(run, definition);
		run.notificationAttempted = true;
		await this.persist();
	}

	private async persist(): Promise<void> {
		const counts = new Map<string, number>();
		this.state.runs = [...this.state.runs]
			.reverse()
			.filter((r) => {
				if (isActiveRun(r)) return true;
				const n = (counts.get(r.automationId) ?? 0) + 1;
				counts.set(r.automationId, n);
				return n <= 100;
			})
			.reverse();
		await this.store.save(this.state);
	}
	dispose(): void {
		this.stopped = true;
		this.listeners.clear();
		for (const run of this.state.runs)
			if (isActiveRun(run)) {
				run.status = 'interrupted';
				run.endedAt = Date.now();
			}
		void this.persist().catch(console.error);
	}
}
