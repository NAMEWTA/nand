import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { AUTOMATIONS, AUTOMATION_SOURCES, type AutomationSource } from '../automations/api';
import { remindersAutomationSource } from './contrib/reminders-source';
import { ContactsController } from './platform/controller';
import { archivesSettings } from './settings';
import type { ContactsHost } from './services/page-host';
import type { ArchiveRecord } from './core/model';
import { registerMessages } from '../../shared/i18n/index';
import { messages } from './i18n';

registerMessages(messages);

/** Archives module: the archive index, its vault listeners, the archives page and its settings. */
export default function createArchivesModule(context: ModuleContext): ModuleInstance {
	const settings = context.settings.bind('archives', archivesSettings);
	let controller: ContactsController | undefined;
	let reminders: AutomationSource | undefined;
	const host = (): ContactsHost => {
		if (!controller) throw new Error('Archives are not loaded');
		return {
			controller,
			settings,
			get newReminder() {
				const automations = context.services.peek(AUTOMATIONS);
				return automations ? (record: ArchiveRecord) => automations.edit({ kind: 'contacts', path: record.path, id: record.id }, record.fields.name) : undefined;
			},
		};
	};
	return {
		/** Read after `activate()`. */
		get contributions() {
			return reminders ? [[AUTOMATION_SOURCES, reminders] as const] : [];
		},
		pages: {
			archives: async () => (await import('./ui/workbench-page')).createArchivesPage(host),
		},
		settingsPage: async () => {
			if (!controller) throw new Error('Archives are not loaded');
			return (await import('./ui/settings-page')).archivesSettingsPage(context.app, controller, settings);
		},
		activate() {
			controller = new ContactsController(context.app, () => settings.get());
			controller.load();
			reminders = remindersAutomationSource(controller, context.shell);
		},
		async dispose() {
			if (controller) {
				await controller.queue.settled();
				controller.unload();
			}
			controller = undefined;
		},
	};
}
