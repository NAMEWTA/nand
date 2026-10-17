// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { parentFolder, ROOT_FOLDER } from './types';

/** A template applied to notes created in a folder (and, unless `exact`, in its sub-folders). */
export interface FolderTemplate {
	/** Folder path, '/' for the vault root. */
	folder: string;
	/** Template note path. */
	template: string;
	/** Apply to this folder only, not its sub-folders. */
	exact: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function normalizeFolderTemplates(value: unknown): FolderTemplate[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const result: FolderTemplate[] = [];
	for (const item of value) {
		if (!isRecord(item) || typeof item['folder'] !== 'string' || typeof item['template'] !== 'string') continue;
		const folder = item['folder'].trim().replace(/^\/+|\/+$/g, '') || ROOT_FOLDER;
		const template = item['template'].trim();
		if (!template || seen.has(folder)) continue;
		seen.add(folder);
		result.push({ folder, template, exact: item['exact'] === true });
	}
	return result.slice(0, 200);
}

/** The template for a new note in `folder`: the closest folder (itself first, the vault root last) whose template applies. */
export function resolveFolderTemplate(templates: readonly FolderTemplate[], folder: string): FolderTemplate | undefined {
	const byFolder = new Map(templates.map((entry) => [entry.folder, entry]));
	for (let current = folder === '' ? ROOT_FOLDER : folder; ; current = parentFolder(current)) {
		const found = byFolder.get(current);
		if (found && (!found.exact || current === folder || (folder === '' && current === ROOT_FOLDER))) return found;
		if (current === ROOT_FOLDER) return undefined;
	}
}

/** Set (or, with an empty template, remove) the template of a folder. */
export function setFolderTemplate(templates: readonly FolderTemplate[], entry: FolderTemplate): FolderTemplate[] {
	const rest = templates.filter((other) => other.folder !== entry.folder);
	return entry.template.trim() ? [...rest, entry] : rest;
}

/** Follow a folder rename or move: templates of the folder and everything below it change path. */
export function remapFolderTemplates(templates: readonly FolderTemplate[], from: string, to: string): FolderTemplate[] {
	return templates.map((entry) => (entry.folder === from ? { ...entry, folder: to } : entry.folder.startsWith(`${from}/`) ? { ...entry, folder: `${to}${entry.folder.slice(from.length)}` } : entry));
}
