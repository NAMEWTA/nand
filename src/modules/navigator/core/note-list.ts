// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { tagAncestry } from './nav-tree';
import { compareNames, propertyEntries, ROOT_FOLDER, type GroupBy, type NavContext, type NoteEntry, type SortBy, type SortDirection } from './types';

export interface ListQuery {
	context: NavContext;
	/** Folders and tags also list the notes of their descendants. */
	includeDescendants: boolean;
}

/** Notes shown for a navigation selection, unsorted. */
export function notesForContext(notes: readonly NoteEntry[], query: ListQuery): NoteEntry[] {
	const { context } = query;
	if (context.kind === 'untagged') return notes.filter((note) => note.tags.length === 0);
	if (context.kind === 'property') {
		const { key, value } = context;
		return notes.filter((note) => {
			const lists = propertyEntries(note, key);
			return lists.length > 0 && (value === undefined || lists.some((list) => list.some((entry) => entry.toLowerCase() === value)));
		});
	}
	if (context.kind === 'folder') {
		const folder = context.key;
		if (!query.includeDescendants) return notes.filter((note) => note.folder === folder);
		if (folder === ROOT_FOLDER) return [...notes];
		const prefix = `${folder}/`;
		return notes.filter((note) => note.folder === folder || note.folder.startsWith(prefix));
	}
	const wanted = context.key.toLowerCase();
	return notes.filter((note) =>
		note.tags.some((tag) => {
			const lower = tag.toLowerCase();
			return lower === wanted || (query.includeDescendants && lower.startsWith(`${wanted}/`));
		}),
	);
}

export function sortNotes(notes: readonly NoteEntry[], sortBy: SortBy, direction: SortDirection): NoteEntry[] {
	const sign = direction === 'asc' ? 1 : -1;
	const key = (note: NoteEntry): number => (sortBy === 'created' ? note.ctime : note.mtime);
	return [...notes].sort((a, b) => {
		const primary = sortBy === 'name' ? compareNames(a.name, b.name) : key(a) - key(b);
		if (primary !== 0) return primary * sign;
		return compareNames(a.name, b.name) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
	});
}

/** Which heading a timestamp falls under when notes are grouped by date. */
export type DateBucket =
	| { kind: 'today' }
	| { kind: 'yesterday' }
	| { kind: 'week' }
	| { kind: 'month30' }
	| { kind: 'month'; year: number; month: number }
	| { kind: 'year'; year: number };

const DAY = 86_400_000;
function startOfDay(time: number): number {
	const date = new Date(time);
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Today, Yesterday, the previous 7 and 30 days, then months of this year, then one heading per year. */
export function dateBucket(time: number, now: number): DateBucket {
	const today = startOfDay(now);
	if (time >= today) return { kind: 'today' };
	if (time >= today - DAY) return { kind: 'yesterday' };
	if (time >= today - 7 * DAY) return { kind: 'week' };
	if (time >= today - 30 * DAY) return { kind: 'month30' };
	const date = new Date(time);
	const year = date.getFullYear();
	return year === new Date(now).getFullYear() ? { kind: 'month', year, month: date.getMonth() } : { kind: 'year', year };
}
export function bucketId(bucket: DateBucket): string {
	return bucket.kind === 'month' ? `month:${bucket.year}-${bucket.month}` : bucket.kind === 'year' ? `year:${bucket.year}` : bucket.kind;
}

export type ListItem =
	| { kind: 'header'; key: string; section: 'pinned' | 'date' | 'folder' | 'property'; bucket?: DateBucket; folder?: string; /** Property groups: the shared value; null is the group of notes without one. */ value?: string | null; count: number }
	| { kind: 'note'; key: string; path: string; pinned: boolean };

export interface GroupOptions {
	sortBy: SortBy;
	direction: SortDirection;
	groupBy: GroupBy;
	/** The property `groupBy: 'property'` groups by. */
	groupProperty?: string;
	/** Paths pinned in this context, shown first under a "Pinned" heading. */
	pinned: ReadonlySet<string>;
	now: number;
}

/**
 * Turn the notes of a context into the flat list the list pane virtualizes: an optional pinned section,
 * then the rest either ungrouped, grouped by date (only for date sorts) or by parent folder.
 */
export function buildListItems(notes: readonly NoteEntry[], options: GroupOptions): ListItem[] {
	const items: ListItem[] = [];
	const pinnedNotes = notes.filter((note) => options.pinned.has(note.path));
	const rest = sortNotes(notes.filter((note) => !options.pinned.has(note.path)), options.sortBy, options.direction);
	if (pinnedNotes.length) {
		items.push({ kind: 'header', key: 'header:pinned', section: 'pinned', count: pinnedNotes.length });
		for (const note of sortNotes(pinnedNotes, options.sortBy, options.direction)) items.push({ kind: 'note', key: note.path, path: note.path, pinned: true });
	}
	const groupByDate = options.groupBy === 'date' && options.sortBy !== 'name';
	if (groupByDate) {
		let current = '';
		let header: Extract<ListItem, { kind: 'header' }> | undefined;
		for (const note of rest) {
			const bucket = dateBucket(options.sortBy === 'created' ? note.ctime : note.mtime, options.now);
			const id = bucketId(bucket);
			if (id !== current) {
				current = id;
				header = { kind: 'header', key: `header:date:${id}`, section: 'date', bucket, count: 0 };
				items.push(header);
			}
			header!.count++;
			items.push({ kind: 'note', key: note.path, path: note.path, pinned: false });
		}
	} else if (options.groupBy === 'property' && options.groupProperty) {
		const key = options.groupProperty.trim().toLowerCase();
		// A list value is one combined group ("Books, History"), not one group per item.
		const valueOf = (note: NoteEntry) => propertyEntries(note, key).flat().map((entry) => entry.trim()).filter(Boolean).join(', ');
		const groups = new Map<string, { label: string; notes: NoteEntry[] }>();
		const without: NoteEntry[] = [];
		for (const note of rest) {
			const value = valueOf(note);
			if (!value) { without.push(note); continue; }
			const group = groups.get(value.toLowerCase());
			if (group) group.notes.push(note); else groups.set(value.toLowerCase(), { label: value, notes: [note] });
		}
		for (const [id, group] of [...groups.entries()].sort((a, b) => compareNames(a[0], b[0]))) {
			items.push({ kind: 'header', key: `header:property:${id}`, section: 'property', value: group.label, count: group.notes.length });
			for (const note of group.notes) items.push({ kind: 'note', key: note.path, path: note.path, pinned: false });
		}
		if (without.length) {
			items.push({ kind: 'header', key: 'header:property:', section: 'property', value: null, count: without.length });
			for (const note of without) items.push({ kind: 'note', key: note.path, path: note.path, pinned: false });
		}
	} else if (options.groupBy === 'folder') {
		const groups = new Map<string, NoteEntry[]>();
		for (const note of rest) {
			const group = groups.get(note.folder);
			if (group) group.push(note); else groups.set(note.folder, [note]);
		}
		for (const folder of [...groups.keys()].sort(compareFolders)) {
			const group = groups.get(folder)!;
			items.push({ kind: 'header', key: `header:folder:${folder}`, section: 'folder', folder, count: group.length });
			for (const note of group) items.push({ kind: 'note', key: note.path, path: note.path, pinned: false });
		}
	} else {
		for (const note of rest) items.push({ kind: 'note', key: note.path, path: note.path, pinned: false });
	}
	return items;
}

function compareFolders(a: string, b: string): number {
	return compareNames(a === ROOT_FOLDER ? '' : a, b === ROOT_FOLDER ? '' : b);
}

/** Note paths in display order (headers dropped): what keyboard movement and range selection walk. */
export function notePaths(items: readonly ListItem[]): string[] {
	const paths: string[] = [];
	for (const item of items) if (item.kind === 'note') paths.push(item.path);
	return paths;
}

/** True if a note has `tag` or any tag below it (used for counts and drops onto tags). */
export function hasTagOrChild(note: NoteEntry, tag: string): boolean {
	const wanted = tag.toLowerCase();
	return note.tags.some((entry) => tagAncestry(entry.toLowerCase()).includes(wanted));
}

