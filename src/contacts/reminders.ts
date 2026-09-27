import type { AutomationDefinition } from '../shared/automation/types';
import { isDefinition } from '../shared/automation/metadata';
import type { ContactsController } from './controller';

const OPEN = '<!-- nand:reminders -->';
const CLOSE = '<!-- /nand:reminders -->';
export function readReminders(raw: string): AutomationDefinition[] {
	const start = raw.indexOf(OPEN),
		end = raw.indexOf(CLOSE);
	if (start < 0 && end < 0) return [];
	if (
		start < 0 ||
		end < start ||
		raw.indexOf(OPEN, start + OPEN.length) >= 0 ||
		raw.indexOf(CLOSE, end + CLOSE.length) >= 0
	)
		throw new Error('Invalid reminder region');
	const text = raw
		.slice(start + OPEN.length, end)
		.trim()
		.replace(/^```json\s*/, '')
		.replace(/\s*```$/, '');
	const value: unknown = JSON.parse(text || '[]');
	if (!Array.isArray(value) || !value.every(isDefinition)) throw new Error('Invalid reminders');
	return value;
}
export function patchReminders(raw: string, definition: AutomationDefinition, remove = false): string {
	const definitions = readReminders(raw).filter((d) => d.id !== definition.id);
	if (!remove) definitions.push(definition);
	const region = `${OPEN}\n\`\`\`json\n${JSON.stringify(definitions, null, 2).replace(/</g, '\\u003c')}\n\`\`\`\n${CLOSE}`;
	const start = raw.indexOf(OPEN),
		end = raw.indexOf(CLOSE);
	return start < 0 ? `${raw.trimEnd()}\n\n${region}\n` : raw.slice(0, start) + region + raw.slice(end + CLOSE.length);
}
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
