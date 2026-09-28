import { readReminders } from '../../../core/contacts/reminders';
import type { AutomationDefinition } from '../../../shared/automation/types';
import type { ContactsController } from './controller';

export async function listContactReminders(
	controller: ContactsController | undefined,
): Promise<AutomationDefinition[]> {
	if (!controller) return [];
	await controller.ensureLoaded();
	return [...controller.index.byPath.values()].flatMap((record) => {
		try {
			return readReminders(record.raw).map((d) => ({
				...d,
				source: { kind: 'contacts' as const, id: record.id, path: record.path },
			}));
		} catch (error) {
			console.error('[NAND reminders]', record.path, error);
			return [];
		}
	});
}
