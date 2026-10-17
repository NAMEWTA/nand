// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { describe, expect, test } from 'vitest';
import { normalizeOverride, resolveAppearance, type ListAppearance } from './appearance';
import { folderNoteName, folderNotePath, isFolderNote } from './folder-notes';
import { compileHidden } from './hidden';
import { buildListItems, notePaths, notesForContext } from './note-list';
import { collectProperties } from './props';
import { moveSection, normalizeSections } from './sections';
import { dropShortcuts, makeShortcut, moveShortcut, normalizeShortcuts, pushRecent, remapShortcuts, shortcutContext, shortcutForContext, toggleShortcut } from './shortcuts';
import { contextKey, parseContextKey, type NoteEntry } from './types';

function note(path: string, extra: Partial<NoteEntry> = {}): NoteEntry {
	const slash = path.lastIndexOf('/');
	const file = path.slice(slash + 1);
	const dot = file.lastIndexOf('.');
	return { path, name: file.slice(0, dot), ext: file.slice(dot + 1), folder: slash < 0 ? '/' : path.slice(0, slash), ctime: 1, mtime: 1, tags: [], ...extra };
}
const none = { folders: [], tags: [], files: [], properties: [] };

describe('hidden rules', () => {
	test('no rules hide nothing', () => {
		const matcher = compileHidden(none);
		expect(matcher.empty).toBe(true);
		expect(matcher.note(note('a/b.md'))).toBe(false);
		expect(matcher.folder('a')).toBe(false);
	});
	test('a folder rule by name hides folders of that name anywhere, with everything inside', () => {
		const matcher = compileHidden({ ...none, folders: ['Archive'] });
		expect(matcher.folder('Archive')).toBe(true);
		expect(matcher.folder('Work/archive')).toBe(true);
		expect(matcher.folder('Work/archive/2020')).toBe(true);
		expect(matcher.folder('Work')).toBe(false);
		expect(matcher.note(note('Work/Archive/x.md'))).toBe(true);
		expect(matcher.note(note('Work/x.md'))).toBe(false);
	});
	test('a rooted folder rule matches that path only, and * is a wildcard', () => {
		const matcher = compileHidden({ ...none, folders: ['/Work/Old', '_*'] });
		expect(matcher.folder('Work/Old')).toBe(true);
		expect(matcher.folder('Other/Old')).toBe(false);
		expect(matcher.folder('Work/Old/Deep')).toBe(true);
		expect(matcher.folder('Work/_private')).toBe(true);
		expect(matcher.folder('Work/public_')).toBe(false);
	});
	test('tag rules hide notes with the tag or a nested tag', () => {
		const matcher = compileHidden({ ...none, tags: ['#draft', 'temp/*'] });
		expect(matcher.note(note('a.md', { tags: ['draft'] }))).toBe(true);
		expect(matcher.note(note('b.md', { tags: ['Draft/v2'] }))).toBe(true);
		expect(matcher.note(note('c.md', { tags: ['temp/x'] }))).toBe(true);
		expect(matcher.note(note('d.md', { tags: ['drafting'] }))).toBe(false);
		expect(matcher.note(note('e.md', { tags: ['temp'] }))).toBe(false);
	});
	test('file rules match a name or a path', () => {
		const matcher = compileHidden({ ...none, files: ['*.excalidraw.md', '/Templates/Daily.md'] });
		expect(matcher.note(note('a/Drawing.excalidraw.md'))).toBe(true);
		expect(matcher.note(note('Templates/Daily.md'))).toBe(true);
		expect(matcher.note(note('Other/Daily.md'))).toBe(false);
	});
	test('property rules match a key, or a key with a value', () => {
		const matcher = compileHidden({ ...none, properties: ['private', 'status=Done*'] });
		expect(matcher.note(note('a.md', { props: { Private: [] } }))).toBe(true);
		expect(matcher.note(note('b.md', { props: { status: ['done soon'] } }))).toBe(true);
		expect(matcher.note(note('c.md', { props: { status: ['open'] } }))).toBe(false);
		expect(matcher.note(note('d.md'))).toBe(false);
	});
	test('blank rules are ignored', () => {
		expect(compileHidden({ ...none, folders: ['  ', ''] }).empty).toBe(true);
	});
});

describe('folder notes', () => {
	test('the note is named like its folder, or with the fixed name', () => {
		expect(folderNoteName('Projects/Alpha', '')).toBe('Alpha');
		expect(folderNoteName('Projects/Alpha', 'index')).toBe('index');
		expect(folderNoteName('/', '')).toBeUndefined();
		expect(folderNoteName('/', 'index')).toBe('index');
		expect(folderNotePath('Projects/Alpha', '')).toBe('Projects/Alpha/Alpha.md');
		expect(folderNotePath('/', 'index')).toBe('index.md');
	});
	test('recognition needs a Markdown note of the right name inside the folder', () => {
		expect(isFolderNote(note('Alpha/Alpha.md'), '')).toBe(true);
		expect(isFolderNote(note('Alpha/Beta.md'), '')).toBe(false);
		expect(isFolderNote(note('Alpha/index.md'), 'index')).toBe(true);
		expect(isFolderNote(note('Alpha/Alpha.canvas'), '')).toBe(false);
		expect(isFolderNote(note('Alpha.md'), '')).toBe(false);
	});
});

describe('properties', () => {
	const notes = [
		note('a.md', { props: { Status: ['Active'], topics: ['Books', 'History'], tags: ['x'] } }),
		note('b.md', { props: { status: ['active'], topics: ['Books'] } }),
		note('c.md', { props: { status: ['Done'], empty: [] } }),
		note('d.md'),
	];
	test('keys merge by case, values group by case, counts are notes', () => {
		const keys = collectProperties(notes, []);
		expect(keys.map((key) => [key.key, key.label, key.count])).toEqual([['empty', 'empty', 1], ['status', 'Status', 3], ['topics', 'topics', 2]]);
		const status = keys.find((key) => key.key === 'status')!;
		expect(status.values.map((value) => [value.value, value.label, value.count])).toEqual([['active', 'Active', 2], ['done', 'Done', 1]]);
		expect(keys.find((key) => key.key === 'topics')!.values.map((value) => [value.label, value.count])).toEqual([['Books', 2], ['History', 1]]);
	});
	test('the key filter limits the browser and can bring back built-in keys', () => {
		expect(collectProperties(notes, ['STATUS']).map((key) => key.key)).toEqual(['status']);
		expect(collectProperties(notes, ['tags']).map((key) => key.key)).toEqual(['tags']);
	});
	test('values are natural-sorted and capped', () => {
		const many = Array.from({ length: 400 }, (_, index) => note(`n${index}.md`, { props: { id: [`v${index}`] } }));
		const [id] = collectProperties(many, []);
		expect(id!.values).toHaveLength(300);
		expect(id!.hiddenValues).toBe(100);
		expect(id!.values.slice(0, 3).map((value) => value.label)).toEqual(['v0', 'v1', 'v2']);
	});
	test('a property context lists notes with the key, or with the value', () => {
		const query = (context: Parameters<typeof notesForContext>[1]['context']) => notesForContext(notes, { context, includeDescendants: false }).map((entry) => entry.path);
		expect(query({ kind: 'property', key: 'status' })).toEqual(['a.md', 'b.md', 'c.md']);
		expect(query({ kind: 'property', key: 'status', value: 'active' })).toEqual(['a.md', 'b.md']);
		expect(query({ kind: 'property', key: 'topics', value: 'history' })).toEqual(['a.md']);
		expect(query({ kind: 'property', key: 'missing' })).toEqual([]);
	});
	test('property contexts round-trip through their key, whatever characters they hold', () => {
		for (const context of [{ kind: 'property', key: 'status' }, { kind: 'property', key: 'a=b', value: 'x y/z' }, { kind: 'property', key: 'k', value: '' }] as const) {
			expect(parseContextKey(contextKey(context))).toEqual(context);
		}
		expect(parseContextKey('property:')).toBeUndefined();
	});
});

describe('grouping by a property', () => {
	const notes = [
		note('a.md', { props: { status: ['Draft'] }, mtime: 5 }),
		note('b.md', { props: { status: ['published'] }, mtime: 4 }),
		note('c.md', { props: { status: ['draft'] }, mtime: 3 }),
		note('d.md', { mtime: 2 }),
		note('e.md', { props: { status: ['Item 10'] }, mtime: 1 }),
		note('f.md', { props: { status: ['Item 2'] }, mtime: 1 }),
		note('g.md', { props: { status: [] }, mtime: 1 }),
	];
	const options = { sortBy: 'modified' as const, direction: 'desc' as const, groupBy: 'property' as const, groupProperty: 'Status', pinned: new Set<string>(), now: 10 };
	test('same values share a heading in natural order, notes without a value go last under None', () => {
		const items = buildListItems(notes, options);
		const headers = items.flatMap((item) => (item.kind === 'header' ? [[item.value, item.count]] : []));
		expect(headers).toEqual([['Draft', 2], ['Item 2', 1], ['Item 10', 1], ['published', 1], [null, 2]]);
		expect(notePaths(items)).toEqual(['a.md', 'c.md', 'f.md', 'e.md', 'b.md', 'd.md', 'g.md']);
	});
	test('a list value is one combined group', () => {
		const items = buildListItems([note('a.md', { props: { topics: ['Books', 'History'] } }), note('b.md', { props: { topics: ['Books'] } })], { ...options, groupProperty: 'topics' });
		expect(items.flatMap((item) => (item.kind === 'header' ? [item.value] : []))).toEqual(['Books', 'Books, History']);
	});
	test('pinned notes stay on top and no property means no grouping', () => {
		const pinned = buildListItems(notes, { ...options, pinned: new Set(['b.md']) });
		expect(pinned[0]).toMatchObject({ kind: 'header', section: 'pinned' });
		expect(buildListItems(notes, { ...options, groupProperty: '' }).every((item) => item.kind === 'note')).toBe(true);
	});
});

describe('appearance overrides', () => {
	const base: ListAppearance = { sortBy: 'modified', sortDirection: 'desc', groupBy: 'date', groupProperty: '', titleRows: 1, previewRows: 2, compact: false, includeDescendants: false };
	test('an override wins over the global value, field by field', () => {
		expect(resolveAppearance(base, undefined)).toBe(base);
		expect(resolveAppearance(base, { compact: true, previewRows: 4 })).toEqual({ ...base, compact: true, previewRows: 4 });
	});
	test('stored overrides are cleaned up', () => {
		expect(normalizeOverride({ sortBy: 'name', sortDirection: 'up', previewRows: 99, titleRows: 0, compact: 'yes', includeDescendants: true, junk: 1, groupBy: 'property', groupProperty: 'status' }))
			.toEqual({ sortBy: 'name', previewRows: 5, titleRows: 1, includeDescendants: true, groupBy: 'property', groupProperty: 'status' });
		expect(normalizeOverride('nope')).toEqual({});
	});
});

describe('shortcuts', () => {
	test('toggling adds at the end and removes a second time', () => {
		let list = toggleShortcut([], makeShortcut('folder', 'Work'));
		list = toggleShortcut(list, makeShortcut('note', 'a.md'));
		expect(list.map((entry) => entry.id)).toEqual(['folder:Work', 'note:a.md']);
		expect(toggleShortcut(list, makeShortcut('folder', 'Work')).map((entry) => entry.id)).toEqual(['note:a.md']);
	});
	test('moving puts a shortcut in front of another, or last', () => {
		const list = ['a', 'b', 'c', 'd'].map((key) => makeShortcut('tag', key));
		const ids = (items: ReturnType<typeof moveShortcut>) => items.map((entry) => entry.key).join('');
		expect(ids(moveShortcut(list, 'tag:d', 'tag:b'))).toBe('adbc');
		expect(ids(moveShortcut(list, 'tag:a', null))).toBe('bcda');
		expect(ids(moveShortcut(list, 'tag:b', 'tag:b'))).toBe('abcd');
		expect(ids(moveShortcut(list, 'tag:zzz', 'tag:a'))).toBe('abcd');
	});
	test('renamed and deleted paths are followed', () => {
		const list = [makeShortcut('folder', 'Work'), makeShortcut('note', 'Work/a.md'), makeShortcut('note', 'Other/b.md'), makeShortcut('tag', 'work')];
		const renamed = remapShortcuts(list, 'Work', 'Job');
		expect(renamed.map((entry) => entry.id)).toEqual(['folder:Job', 'note:Job/a.md', 'note:Other/b.md', 'tag:work']);
		expect(dropShortcuts(list, 'Work').map((entry) => entry.id)).toEqual(['note:Other/b.md', 'tag:work']);
	});
	test('contexts map to shortcuts and back', () => {
		expect(shortcutForContext({ kind: 'folder', key: 'Work' })).toEqual(makeShortcut('folder', 'Work'));
		expect(shortcutForContext({ kind: 'untagged' })).toBeUndefined();
		const property = shortcutForContext({ kind: 'property', key: 'status', value: 'done' })!;
		expect(shortcutContext(property)).toEqual({ kind: 'property', key: 'status', value: 'done' });
		expect(shortcutContext(makeShortcut('search', '#a'))).toBeUndefined();
	});
	test('stored shortcuts are cleaned up and deduplicated', () => {
		const stored = normalizeShortcuts([{ kind: 'note', key: 'a.md', name: ' Mine ' }, { kind: 'note', key: 'a.md' }, { kind: 'bogus', key: 'x' }, { kind: 'tag', key: '' }, 5, { kind: 'search', key: '#a OR #b' }]);
		expect(stored).toEqual([{ id: 'note:a.md', kind: 'note', key: 'a.md', name: 'Mine' }, { id: 'search:#a OR #b', kind: 'search', key: '#a OR #b' }]);
		expect(normalizeShortcuts('x')).toEqual([]);
	});
	test('recent notes are newest first, unique and limited', () => {
		expect(pushRecent(['a', 'b', 'c'], 'c', 3)).toEqual(['c', 'a', 'b']);
		expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
	});
});

describe('sections', () => {
	test('a stored order is completed with the missing sections', () => {
		expect(normalizeSections(undefined)).toEqual(['shortcuts', 'recent', 'folders', 'tags', 'properties']);
		// Missing sections go back to their default places among the stored ones.
		expect(normalizeSections(['tags', 'bogus', 'tags', 'folders'])).toEqual(['shortcuts', 'recent', 'tags', 'folders', 'properties']);
	});
	test('moving a section puts it in front of another or last', () => {
		const order = normalizeSections([]);
		expect(moveSection(order, 'tags', 'folders')).toEqual(['shortcuts', 'recent', 'tags', 'folders', 'properties']);
		expect(moveSection(order, 'shortcuts', null)).toEqual(['recent', 'folders', 'tags', 'properties', 'shortcuts']);
	});
});
