import type { NotificationChannelId, NotificationRequest } from '../api';

export interface NotificationDelivery {
	available(channel: NotificationChannelId): boolean;
	send(
		channel: NotificationChannelId,
		request: NotificationRequest,
		events: {
			open(): Promise<void>;
			failed(): void;
		},
	): void | Promise<void>;
	dispose(): void;
}
