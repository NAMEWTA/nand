// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** A user-defined "create note" command shown in the command palette as "NAND: <name>". */
export interface CreateNoteCommand {
	/** Stable id of the command. */
	id: string;
	name: string;
	/** Template note path; empty means the folder template of the target folder, if any. */
	template: string;
	/** File name pattern without extension; may contain `{{prompt:Label}}`, `{{date:FORMAT}}` and `{{number:00}}`. Empty gives the default (translated) name. */
	fileName: string;
	/** `selected`: the folder open in the navigator; `folder`: always `folder`. */
	location: 'selected' | 'folder';
	folder: string;
}

export const MAX_CREATE_COMMANDS = 30;

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export function normalizeCreateCommands(value: unknown): CreateNoteCommand[] {
	if (!Array.isArray(value)) return [];
	const ids = new Set<string>();
	const result: CreateNoteCommand[] = [];
	for (const item of value) {
		if (!isRecord(item)) continue;
		const name = text(item['name'], 80);
		const id = text(item['id'], 60);
		if (!name || !id || ids.has(id)) continue;
		ids.add(id);
		result.push({
			id,
			name,
			template: text(item['template'], 300),
			fileName: text(item['fileName'], 200),
			location: item['location'] === 'folder' ? 'folder' : 'selected',
			folder: text(item['folder'], 300).replace(/^\/+|\/+$/g, ''),
		});
	}
	return result.slice(0, MAX_CREATE_COMMANDS);
}

export function newCreateCommand(existing: readonly CreateNoteCommand[], name: string): CreateNoteCommand {
	let id = '';
	do id = `c${Math.random().toString(36).slice(2, 8)}`; while (existing.some((entry) => entry.id === id));
	return { id, name, template: '', fileName: '', location: 'selected', folder: '' };
}
