import type { ShellAccess } from '../../../app/contracts/module';
import type { AutomationDefinition } from '../../../shared/automation/types';
import type { AutomationSource } from '../../automations/api';
import { readReminders } from '../core/reminders';
import type { ContactsController } from '../platform/controller';

async function listContactReminders(controller: ContactsController): Promise<AutomationDefinition[]> {
	await controller.ensureLoaded();
	return [...controller.index.byPath.values()].flatMap((record) => {
		try {
			return readReminders(record.raw).map((definition) => ({
				...definition,
				source: { kind: 'contacts' as const, id: record.id, path: record.path },
			}));
		} catch (error) {
			console.error('[NAND reminders]', record.path, error);
			return [];
		}
	});
}

/** Archive reminders as an automation source (`automations.sources`). */
export function remindersAutomationSource(controller: ContactsController, shell: ShellAccess): AutomationSource {
	return {
		kinds: ['contacts'],
		list: () => listContactReminders(controller),
		save: (definition, remove) => controller.saveReminder(definition, remove),
		open: (source, ownerWindow) => shell.open({ feature: 'contacts', resourceId: source.id || source.path }, ownerWindow),
	};
}
