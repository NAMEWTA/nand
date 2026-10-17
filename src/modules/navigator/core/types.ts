// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** One file the navigator can list. `folder` is the parent folder path ('/' for the vault root). */
export interface NoteEntry {
	path: string;
	name: string;
	ext: string;
	folder: string;
	ctime: number;
	mtime: number;
	/** Tags without the leading '#', as written in the note. */
	tags: readonly string[];
	/** Frontmatter `aliases`, matched by search together with the name. */
	aliases?: readonly string[];
	/** Frontmatter properties as text values (a list contributes one value per item), keyed as written. */
	props?: Readonly<Record<string, readonly string[]>>;
	/** The note has at least one unfinished task. */
	hasTask?: boolean;
}

/** What the navigation pane has selected; the list pane shows the notes it covers. */
export type NavContext =
	| { kind: 'folder'; key: string }
	| { kind: 'tag'; key: string }
	| { kind: 'untagged' }
	/** A frontmatter property (lower-case key), optionally one of its values (lower-case). */
	| { kind: 'property'; key: string; value?: string };

export const ROOT_FOLDER = '/';

export type SortBy = 'modified' | 'created' | 'name';
export type SortDirection = 'asc' | 'desc';
export type GroupBy = 'none' | 'date' | 'folder' | 'property';

export function contextKey(context: NavContext): string {
	if (context.kind === 'untagged') return 'untagged';
	if (context.kind === 'property') {
		const key = encodeURIComponent(context.key);
		return context.value === undefined ? `property:${key}` : `property:${key}=${encodeURIComponent(context.value)}`;
	}
	return `${context.kind}:${context.key}`;
}
export function sameContext(a: NavContext, b: NavContext): boolean {
	return contextKey(a) === contextKey(b);
}
export function parseContextKey(value: string): NavContext | undefined {
	if (value === 'untagged') return { kind: 'untagged' };
	if (value.startsWith('folder:')) return { kind: 'folder', key: value.slice(7) };
	if (value.startsWith('tag:')) return { kind: 'tag', key: value.slice(4) };
	if (value.startsWith('property:')) {
		const body = value.slice(9);
		const eq = body.indexOf('=');
		try {
			const key = decodeURIComponent(eq < 0 ? body : body.slice(0, eq));
			if (!key) return undefined;
			return eq < 0 ? { kind: 'property', key } : { kind: 'property', key, value: decodeURIComponent(body.slice(eq + 1)) };
		} catch {
			return undefined;
		}
	}
	return undefined;
}

export function parentFolder(path: string): string {
	const index = path.lastIndexOf('/');
	return index <= 0 ? ROOT_FOLDER : path.slice(0, index);
}
export function baseName(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1);
}
export function splitName(fileName: string): { name: string; ext: string } {
	const dot = fileName.lastIndexOf('.');
	return dot <= 0 ? { name: fileName, ext: '' } : { name: fileName.slice(0, dot), ext: fileName.slice(dot + 1).toLowerCase() };
}
export function joinPath(folder: string, name: string): string {
	return folder === ROOT_FOLDER || folder === '' ? name : `${folder}/${name}`;
}
/** Case-insensitive natural ordering ("note 2" before "note 10"). */
export function compareNames(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Property keys are compared case-insensitively; contexts and search use the lower-case form. */
export function propertyEntries(note: NoteEntry, lowerKey: string): Array<readonly string[]> {
	if (!note.props) return [];
	const found: Array<readonly string[]> = [];
	for (const key of Object.keys(note.props)) if (key.toLowerCase() === lowerKey) found.push(note.props[key]!);
	return found;
}
