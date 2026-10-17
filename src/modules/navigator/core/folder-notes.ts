// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { baseName, joinPath, ROOT_FOLDER, type NoteEntry } from './types';

/**
 * The name (without extension) of the folder note of `folder`: `configured` when set (for example "index"),
 * otherwise the folder's own name. The vault root has none unless a fixed name is configured.
 */
export function folderNoteName(folder: string, configured: string): string | undefined {
	const fixed = configured.trim();
	if (fixed) return fixed;
	return folder === ROOT_FOLDER ? undefined : baseName(folder);
}

/** Path where the folder note of `folder` would live, or undefined for the root without a fixed name. */
export function folderNotePath(folder: string, configured: string): string | undefined {
	const name = folderNoteName(folder, configured);
	return name === undefined ? undefined : joinPath(folder, `${name}.md`);
}

/** True for a Markdown note that is the folder note of the folder it sits in. */
export function isFolderNote(note: Pick<NoteEntry, 'ext' | 'name' | 'folder'>, configured: string): boolean {
	return note.ext === 'md' && note.folder !== ROOT_FOLDER && note.name === folderNoteName(note.folder, configured);
}
