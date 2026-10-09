import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { deviceId } from '../../host/obsidian/storage/device-id';
import { NOTIFICATION_INBOX, NOTIFICATION_OPENERS, type NotificationRecord } from './api';
import { NotificationService } from './core/service';
import { createNotificationDelivery } from './platform/delivery';
import { registerMessages } from '../../shared/i18n/index';
import { messages } from './i18n';
import { messages as automationStrings } from '../../shared/i18n/lazy/automation';

registerMessages(automationStrings);
registerMessages(messages);

/**
 * Notifications module: owns the per-device inbox (`.nand/notifications/<device>/inbox.json`) and native
 * delivery. Senders acquire `notifications.inbox`; opening a record goes to the sender's contributed opener.
 */
export default function createNotificationsModule(context: ModuleContext): ModuleInstance {
	const report = (error: unknown) => console.error('[NAND notifications]', error);
	// Only active senders can open their records; opening a notification never turns a module on.
	const open = async (record: NotificationRecord): Promise<void> => {
		const openers = await context.contributions.collect(NOTIFICATION_OPENERS);
		await openers.find((item) => item.value.canOpen(record))?.value.open(record);
	};
	const inbox = new NotificationService(context.app.vault.adapter, `.nand/notifications/${deviceId(context.app)}/inbox.json`, open, createNotificationDelivery(context.app));
	return {
		services: [[NOTIFICATION_INBOX, inbox]],
		pages: {
			inbox: async () => (await import('./ui/workbench-page')).createInboxPage(inbox, report),
		},
		activate: () => inbox.load(),
		dispose: () => inbox.shutdown(),
	};
}
