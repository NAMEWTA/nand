import type { NotificationOpener, NotificationRecord } from '../../notifications/api';

/** Idempotent inbox id. The run id is resolved from the news run index, not an automation target. */
export function newsNotificationId(runId: string, outcome: string): string {
	return `news:${runId}:${outcome}`;
}

export function newsRunFromNotification(id: string): string | undefined {
	const match = /^news:([^:]+):([a-z-]+)$/.exec(id);
	return match?.[1];
}

export function newsOpener(
	lookup: (runId: string) => { materialId?: string; storyId?: string } | undefined,
	open: (resourceId: string) => Promise<void>,
): NotificationOpener {
	return {
		canOpen(record: NotificationRecord) {
			const runId = newsRunFromNotification(record.id);
			return !!runId && !!lookup(runId);
		},
		async open(record: NotificationRecord) {
			const runId = newsRunFromNotification(record.id);
			if (!runId) return;
			const run = lookup(runId);
			if (!run) return;
			await open(run.materialId || run.storyId || runId);
		},
	};
}
