import { Notice, Platform, type App } from 'obsidian';
import { JsonStore } from '../shared/json-store';
import { t } from '../shared/i18n';
import type { NotificationChannelId, SourceRef } from '../shared/automation/types';

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
	source?: SourceRef;
	channels: NotificationChannelId[];
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
	private native = new Set<Notification>();
	private stopped = false;
	private loaded = false;
	constructor(
		private app: App,
		path: string,
		private openSource: (source: SourceRef) => Promise<void>,
		private openTarget?: (target: NotificationTarget) => Promise<void>,
	) {
		this.store = new JsonStore(app, path, (v): v is InboxState => {
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
		return (
			channel === 'in-app' ||
			(channel === 'system' &&
				Platform.isDesktopApp &&
				typeof (this.app.workspace.containerEl.win as Window & { Notification: typeof Notification })
					.Notification === 'function')
		);
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
						if (channel === 'in-app')
							new Notice(row.title === row.body ? row.title : `${row.title}\n${row.body}`);
						else {
							const notification = new (
								this.app.workspace.containerEl.win as Window & { Notification: typeof Notification }
							).Notification(row.title, { body: row.title === row.body ? '' : row.body, tag: row.id });
							this.native.add(notification);
							notification.onerror = () => {
								void this.enqueue(() => this.delivery(row.id, channel, 'failed')).catch(console.error);
							};
							notification.onclose = () => {
								this.native.delete(notification);
							};
							notification.onclick = () => {
								void this.open(row).catch(console.error);
							};
						}
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
		for (const item of this.native) item.close();
		this.native.clear();
		this.listeners.clear();
	}
}
