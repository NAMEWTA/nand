import { Notice, Platform, type App } from 'obsidian';
import { JsonStore } from '../shared/json-store';
import { t } from '../shared/i18n';
import type { NotificationChannelId, SourceRef } from '../shared/automation/types';

export interface NotificationRequest {
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
export class NotificationService {
	records: NotificationRecord[] = [];
	private store: JsonStore<NotificationRecord[]>;
	private listeners = new Set<() => void>();
	private tail: Promise<unknown> = Promise.resolve();
	private native = new Set<Notification>();
	private stopped = false;
	constructor(
		private app: App,
		path: string,
		private openSource: (source: SourceRef) => Promise<void>,
	) {
		this.store = new JsonStore(
			app,
			path,
			(v): v is NotificationRecord[] =>
				Array.isArray(v) &&
				v.every((value: unknown) => {
					if (!value || typeof value !== 'object') return false;
					const r = value as NotificationRecord;
					return (
						typeof r.id === 'string' &&
						Array.isArray(r.channels) &&
						!!r.deliveries &&
						typeof r.deliveries === 'object'
					);
				}),
		);
	}
	async load(): Promise<void> {
		this.records = await this.store.load([]);
		for (const row of this.records)
			for (const channel of row.channels)
				if (row.deliveries[channel] === 'pending') row.deliveries[channel] = 'unknown';
	}
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	private emit(): void {
		for (const listener of this.listeners) listener();
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
		const operation = this.tail.then(() => this.deliver(request));
		this.tail = operation.catch(() => {});
		return operation;
	}
	private async deliver(request: NotificationRequest): Promise<void> {
		if (this.stopped) return;
		let row = this.records.find((item) => item.id === request.id);
		if (!row) {
			row = {
				...request,
				channels: [...new Set(request.channels)],
				createdAt: Date.now(),
				read: false,
				deliveries: {},
			};
			this.records.push(row);
		}
		for (const channel of row.channels) {
			if (row.deliveries[channel]) continue;
			row.deliveries[channel] = 'pending';
			await this.store.save(this.records);
			if (this.stopped) {
				row.deliveries[channel] = 'unknown';
				await this.store.save(this.records);
				return;
			}
			try {
				if (!this.available(channel)) throw new Error(t('automation.channelUnavailable'));
				if (channel === 'in-app') new Notice(`${row.title}\n${row.body}`);
				else {
					const notification = new (
						this.app.workspace.containerEl.win as Window & { Notification: typeof Notification }
					).Notification(row.title, { body: row.body, tag: row.id });
					this.native.add(notification);
					notification.onerror = () => {
						if (row) {
							row.deliveries[channel] = 'failed';
							void this.store
								.save(this.records)
								.then(() => this.emit())
								.catch(console.error);
						}
					};
					notification.onclose = () => this.native.delete(notification);
					notification.onclick = () => {
						if (row?.source) void this.openSource(row.source).catch(console.error);
					};
				}
				row.deliveries[channel] = 'sent';
			} catch {
				row.deliveries[channel] = 'failed';
			}
			await this.store.save(this.records);
		}
		// Never silently remove unread reminders. Trim only old read items.
		const read = this.records.filter((r) => r.read).slice(-500);
		this.records = this.records.filter((r) => !r.read || read.includes(r));
		await this.store.save(this.records);
		this.emit();
	}
	async markRead(id: string): Promise<void> {
		const row = this.records.find((r) => r.id === id);
		if (row) row.read = true;
		await this.store.save(this.records);
		this.emit();
	}
	async open(record: NotificationRecord): Promise<void> {
		if (record.source) await this.openSource(record.source);
		await this.markRead(record.id);
	}
	dispose(): void {
		this.stopped = true;
		for (const item of this.native) item.close();
		this.native.clear();
		this.listeners.clear();
	}
}
