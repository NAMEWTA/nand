// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { TFile, TFolder, normalizePath, type App, type TAbstractFile } from 'obsidian';
import { copyPath, renamedPath, uniquePath } from '../core/ops';
import { joinPath, parentFolder, ROOT_FOLDER } from '../core/types';

const exists = (app: App) => (path: string): boolean => app.vault.getAbstractFileByPath(normalizePath(path)) !== null;

/** Folder object for a navigator folder key ('/' is the vault root). */
export function folderOf(app: App, path: string): TFolder | null {
	if (path === ROOT_FOLDER) return app.vault.getRoot();
	const folder = app.vault.getAbstractFileByPath(path);
	return folder instanceof TFolder ? folder : null;
}

/** Create an empty note in `folder`; `tag` is written to its frontmatter when the note is created inside a tag. */
export async function createNote(app: App, folder: string, baseName: string, tag?: string): Promise<TFile> {
	const path = uniquePath(folder, baseName, 'md', exists(app));
	const content = tag ? `---\ntags:\n  - ${tag}\n---\n` : '';
	return app.vault.create(normalizePath(path), content);
}

export async function createFolder(app: App, parent: string, name: string): Promise<TFolder> {
	const path = uniquePath(parent, name, '', exists(app));
	return app.vault.createFolder(normalizePath(path));
}

export async function renameEntry(app: App, entry: TAbstractFile, newName: string): Promise<string> {
	const target = entry instanceof TFolder
		? joinPath(parentFolder(entry.path), newName.trim())
		: renamedPath(entry.path, newName);
	const normalized = normalizePath(target);
	if (normalized === entry.path) return entry.path;
	const clash = app.vault.getAbstractFileByPath(normalized);
	if (clash && clash.path.toLowerCase() !== entry.path.toLowerCase()) throw new Error('exists');
	await app.fileManager.renameFile(entry, normalized);
	return normalized;
}

export async function duplicateNote(app: App, file: TFile, suffix: string): Promise<TFile> {
	return app.vault.copy(file, normalizePath(copyPath(file.path, suffix, exists(app))));
}

/**
 * Move entries into `folder`. Entries already there, a folder into itself and a name that is taken at the
 * destination are skipped (never overwritten) and reported in `skipped`; `moved` maps old path to new path.
 */
export async function moveEntries(app: App, entries: readonly TAbstractFile[], folder: string): Promise<{ moved: Map<string, string>; skipped: string[] }> {
	const moved = new Map<string, string>();
	const skipped: string[] = [];
	for (const entry of entries) {
		// renameFile updates the entry in place, so the old path has to be read first.
		const from = entry.path;
		if (entry.parent && (entry.parent.isRoot() ? ROOT_FOLDER : entry.parent.path) === folder) continue;
		const base = from.slice(from.lastIndexOf('/') + 1);
		const target = normalizePath(joinPath(folder, base));
		if ((entry instanceof TFolder && (folder === from || folder.startsWith(`${from}/`))) || exists(app)(target)) {
			skipped.push(from);
			continue;
		}
		await app.fileManager.renameFile(entry, target);
		moved.set(from, target);
	}
	return { moved, skipped };
}

/** Trash entries following the user's Obsidian deletion preference. */
export async function trashEntries(app: App, entries: readonly TAbstractFile[]): Promise<void> {
	for (const entry of entries) await app.fileManager.trashFile(entry);
}

/** Add `tag` to a note's frontmatter `tags` list. */
export async function addTag(app: App, file: TFile, tag: string): Promise<void> {
	if (file.extension !== 'md') return;
	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
		const current: unknown = frontmatter['tags'];
		const list = Array.isArray(current) ? current.map(String) : typeof current === 'string' ? current.split(/[,\s]+/).filter(Boolean) : [];
		if (!list.some((entry) => entry.replace(/^#/, '').toLowerCase() === tag.toLowerCase())) list.push(tag);
		frontmatter['tags'] = list;
	});
}
