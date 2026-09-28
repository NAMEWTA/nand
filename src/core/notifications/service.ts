import type { AutomationMessage, NotificationChannelId, RunStatus, SourceRef } from '../../shared/automation/types';
import { automationOutcome } from '../../shared/automation/errors';
import { t } from '../../shared/i18n/index';
import { JsonStore } from '../../shared/json-store';
import type { TextStorage } from '../../shared/storage/ports';
import type { NotificationDelivery } from './ports';

export interface NotificationTarget {
	runId: string;
	automationId: string;
	terminalId?: string;
}
export interface NotificationRequest {
	target?: NotificationTarget;
	id: string;
	title: string;
	body: string;
	/** Optional presentation data; body remains the original delivery snapshot. */
	presentation?: AutomationMessage & { kind: 'automation-run'; status: RunStatus };
	source?: SourceRef;
	channels: NotificationChannelId[];
}
export function notificationBody(record: NotificationRequest): string {
	const value = record.presentation;
	if (!value || value.kind !== 'automation-run' ||
		!['pending', 'running', 'unknown', 'succeeded', 'failed', 'cancelled', 'interrupted', 'skipped'].includes(value.status))
		return record.body;
	return automationOutcome(value);
}
export interface NotificationRecord extends NotificationRequest {
	createdAt: number;
	read: boolean;
	deliveries: Partial<Record<NotificationChannelId, 'pending' | 'sent' | 'failed' | 'unknown'>>;
}
interface InboxState {
	records: NotificationRecord[];
	/** Independent of visible inbox retention. A reserved delivery is never replayed. */
	receipts: Record<string, NotificationRecord['deliveries']>;
}
export class NotificationService {
	private state: InboxState = { records: [], receipts: {} };
	get records(): NotificationRecord[] {
		return this.state.records;
	}
	get unread(): number {
		return this.records.filter((r) => !r.read).length;
	}
	private store: JsonStore<InboxState>;
	private listeners = new Set<() => void>();
	private tail: Promise<void> = Promise.resolve();

	private stopped = false;
	private loaded = false;
	constructor(
		storage: TextStorage,
		path: string,
		private openSource: (source: SourceRef) => Promise<void>,
		private openTarget: ((target: NotificationTarget) => Promise<void>) | undefined,
		private deliveryAdapter: NotificationDelivery,
	) {
		this.store = new JsonStore(storage, path, (v): v is InboxState => {
			if (!v || typeof v !== 'object') return false;
			const s = v as InboxState;
			return (
				!!s.receipts &&
				typeof s.receipts === 'object' &&
				Array.isArray(s.records) &&
				s.records.every((r) => r && typeof r.id === 'string' && Array.isArray(r.channels) && !!r.deliveries)
			);
		});
	}
	async load(): Promise<void> {
		this.loaded = false;
		const state = await this.store.load({ records: [], receipts: {} });
		for (const deliveries of Object.values(state.receipts))
			for (const channel of Object.keys(deliveries) as NotificationChannelId[])
				if (deliveries[channel] === 'pending') deliveries[channel] = 'unknown';
		for (const row of state.records) row.deliveries = { ...state.receipts[row.id] };
		this.state = state;
		this.loaded = true;
		this.emit();
	}
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	private emit(): void {
		for (const listener of this.listeners) listener();
	}
	private enqueue(operation: () => Promise<void>): Promise<void> {
		const result = this.tail.then(() => {
			if (!this.loaded) throw new Error(t('automation.failedLoad'));
			return operation();
		});
		this.tail = result.catch(() => {});
		return result;
	}
	private async commit(change: (state: InboxState) => void): Promise<void> {
		const next = structuredClone(this.state);
		change(next);
		await this.store.save(next);
		this.state = next;
		this.emit();
	}
	available(channel: NotificationChannelId): boolean {
		return this.deliveryAdapter.available(channel);
	}

	send(request: NotificationRequest): Promise<void> {
		return this.enqueue(async () => {
			if (this.stopped || this.state.receipts[request.id]) return;
			const row: NotificationRecord = {
				...request,
				channels: [...new Set(request.channels)],
				createdAt: Date.now(),
				read: false,
				deliveries: {},
			};
			// Reserve every channel before any external side effect. A crash after
			// submission is reported as unknown, never retried as a duplicate notice.
			for (const channel of row.channels) row.deliveries[channel] = 'pending';
			await this.commit((state) => {
				state.records.push(row);
				state.receipts[row.id] = { ...row.deliveries };
			});
			for (const channel of row.channels) {
				let status: 'sent' | 'failed' | 'unknown' = 'unknown';
				if (!this.stopped) {
					try {
						if (!this.available(channel)) throw new Error(t('automation.channelUnavailable'));
						await this.deliveryAdapter.send(channel, row, {
							open: () => this.open(row),
							failed: () => {
								void this.enqueue(() => this.delivery(row.id, channel, 'failed')).catch(console.error);
							},
						});
						status = 'sent';
					} catch {
						status = 'failed';
					}
				}
				await this.delivery(row.id, channel, status);
			}
		});
	}
	private delivery(id: string, channel: NotificationChannelId, status: 'sent' | 'failed' | 'unknown'): Promise<void> {
		return this.commit((state) => {
			state.receipts[id] = { ...state.receipts[id], [channel]: status };
			const row = state.records.find((r) => r.id === id);
			if (row) row.deliveries = { ...state.receipts[id] };
		});
	}
	markRead(id?: string): Promise<void> {
		return this.enqueue(() =>
			this.commit((state) => {
				for (const row of state.records) if (!id || row.id === id) row.read = true;
			}),
		);
	}
	clearRead(): Promise<void> {
		return this.enqueue(() =>
			this.commit((state) => {
				state.records = state.records.filter((r) => !r.read);
			}),
		);
	}
	async open(record: NotificationRecord): Promise<void> {
		if (record.source) await this.openSource(record.source);
		else if (record.target) await this.openTarget?.(record.target);
		await this.markRead(record.id);
	}
	dispose(): void {
		this.stopped = true;
		this.deliveryAdapter.dispose();
		this.listeners.clear();
	}
}
