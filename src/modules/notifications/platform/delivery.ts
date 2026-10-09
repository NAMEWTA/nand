import { Notice, Platform, type App } from 'obsidian';
import type { NotificationDelivery } from '../core/ports';

/** Native delivery belongs to the plugin lifetime, independently of inbox views. */
export function createNotificationDelivery(app: App): NotificationDelivery {
	const active = new Set<Notification>();
	const nativeWindow = () => app.workspace.containerEl.win as Window & { Notification: typeof Notification };
	return {
		available: (channel) =>
			channel === 'in-app' ||
			(channel === 'system' && Platform.isDesktopApp && typeof nativeWindow().Notification === 'function'),
		send(channel, row, events) {
			if (channel === 'in-app') {
				new Notice(row.title === row.body ? row.title : `${row.title}\n${row.body}`);
				return;
			}
			const item = new (nativeWindow().Notification)(row.title, {
				body: row.title === row.body ? '' : row.body,
				tag: row.id,
			});
			active.add(item);
			item.onerror = () => events.failed();
			item.onclose = () => {
				active.delete(item);
			};
			item.onclick = () => {
				void events.open().catch(console.error);
			};
		},
		dispose() {
			for (const item of active) item.close();
			active.clear();
		},
	};
}
