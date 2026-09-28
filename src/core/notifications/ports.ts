import type { NotificationChannelId } from '../../shared/automation/types';
import type { NotificationRequest } from './service';

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
