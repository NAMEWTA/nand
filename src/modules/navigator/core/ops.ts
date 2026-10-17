// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { joinPath, ROOT_FOLDER, splitName } from './types';

/** Characters a file name must not contain on common file systems or in Obsidian links. */
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/;

export type NameProblem = 'empty' | 'characters' | 'dot' | 'exists';

export function nameProblem(name: string, exists: (candidate: string) => boolean): NameProblem | undefined {
	const trimmed = name.trim();
	if (!trimmed) return 'empty';
	if (FORBIDDEN.test(trimmed)) return 'characters';
	if (trimmed.startsWith('.') || trimmed.endsWith('.')) return 'dot';
	if (exists(trimmed)) return 'exists';
	return undefined;
}

/** First "Name", "Name 2", "Name 3"... for which `exists(path)` is false. */
export function uniquePath(folder: string, name: string, ext: string, exists: (path: string) => boolean): string {
	const suffix = ext ? `.${ext}` : '';
	let path = joinPath(folder, `${name}${suffix}`);
	for (let n = 2; exists(path); n++) path = joinPath(folder, `${name} ${n}${suffix}`);
	return path;
}

/** The path of a copy: "Name copy", "Name copy 2"... next to the original. */
export function copyPath(path: string, copySuffix: string, exists: (path: string) => boolean): string {
	const slash = path.lastIndexOf('/');
	const folder = slash < 0 ? ROOT_FOLDER : path.slice(0, slash);
	const { name, ext } = splitName(path.slice(slash + 1));
	return uniquePath(folder, `${name} ${copySuffix}`, ext, exists);
}

/** The path a file gets when renamed to `newName`; the extension is kept unless the user typed it too. */
export function renamedPath(path: string, newName: string): string {
	const slash = path.lastIndexOf('/');
	const folder = slash < 0 ? ROOT_FOLDER : path.slice(0, slash);
	const { ext } = splitName(path.slice(slash + 1));
	const name = newName.trim();
	return joinPath(folder, !ext || name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`);
}
