// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { describe, expect, test } from 'vitest';
import { buildNavTree, folderAncestors, parentRowKey } from './nav-tree';
import type { SectionId } from './sections';
import { makeShortcut } from './shortcuts';
import type { NoteEntry } from './types';

const note = (path: string, tags: string[] = []): NoteEntry => {
	const slash = path.lastIndexOf('/');
	return { path, name: path.slice(slash + 1).replace(/\.md$/, ''), ext: 'md', folder: slash < 0 ? '/' : path.slice(0, slash), ctime: 1, mtime: 1, tags };
};
const labels = { folders: 'Folders', tags: 'Tags', untagged: 'Untagged', root: 'Vault' };
const base = { showRoot: false, showTags: true, showUntagged: true, countDescendants: false, labels };

test('folders sort naturally, collapsed children stay hidden and counts are direct by default', () => {
	const notes = [note('a/x.md'), note('a/y.md'), note('a/b/z.md'), note('c10/q.md'), note('c2/q.md'), note('root.md')];
	const folders = ['/', 'a', 'a/b', 'c10', 'c2'];
	const closed = buildNavTree({ ...base, folders, notes, expandedFolders: new Set(['/']), expandedTags: new Set() });
	expect(closed.rows.map((row) => row.key)).toEqual(['section:folders', 'folder:a', 'folder:c2', 'folder:c10', 'section:tags', 'untagged']);
	expect(closed.rows.find((row) => row.path === 'a')).toMatchObject({ count: 2, hasChildren: true, expanded: false });
	const open = buildNavTree({ ...base, folders, notes, expandedFolders: new Set(['/', 'a']), expandedTags: new Set(), countDescendants: true });
	expect(open.rows.slice(1, 4).map((row) => [row.key, row.depth, row.count])).toEqual([['folder:a', 0, 3], ['folder:a/b', 1, 1], ['folder:c2', 0, 1]]);
	expect(open.indexByKey.get('folder:a/b')).toBe(2);
});

test('root can be shown as the top row', () => {
	const tree = buildNavTree({ ...base, showRoot: true, folders: ['/', 'a'], notes: [note('a/x.md'), note('r.md')], expandedFolders: new Set(['/']), expandedTags: new Set() });
	expect(tree.rows.slice(1, 3).map((row) => [row.label, row.depth, row.count])).toEqual([['Vault', 0, 1], ['a', 1, 1]]);
});

test('tags form a hierarchy with distinct note counts and an untagged row', () => {
	const notes = [note('1.md', ['work/plan', 'work']), note('2.md', ['work/review']), note('3.md', ['Home']), note('4.md')];
	const tree = buildNavTree({ ...base, folders: ['/'], notes, expandedFolders: new Set(['/']), expandedTags: new Set(['work']) });
	const tags = tree.rows.filter((row) => row.kind === 'tag');
	expect(tags.map((row) => [row.path, row.depth, row.count])).toEqual([['home', 0, 1], ['work', 0, 1], ['work/plan', 1, 1], ['work/review', 1, 1]]);
	const nested = buildNavTree({ ...base, countDescendants: true, folders: ['/'], notes, expandedFolders: new Set(['/']), expandedTags: new Set(['work']) });
	expect(nested.rows.find((row) => row.path === 'work')?.count).toBe(2);
	expect(tree.rows.at(-1)).toMatchObject({ kind: 'untagged', count: 1 });
	expect(tree.rows.some((row) => row.key === 'section:tags')).toBe(true);
});

test('tags can be hidden', () => {
	const tree = buildNavTree({ ...base, showTags: false, folders: ['/'], notes: [note('1.md', ['x'])], expandedFolders: new Set(['/']), expandedTags: new Set() });
	expect(tree.rows.map((row) => row.key)).toEqual(['section:folders']);
});

test('ancestors and parent rows', () => {
	expect(folderAncestors('a/b/c')).toEqual(['/', 'a', 'a/b']);
	expect(folderAncestors('a')).toEqual(['/']);
	const row = (kind: 'folder' | 'tag', path: string) => ({ key: `${kind}:${path}`, kind, depth: 0, path, label: path, count: 0, hasChildren: false, expanded: false });
	expect(parentRowKey(row('folder', 'a/b'), false)).toBe('folder:a');
	expect(parentRowKey(row('folder', 'a'), false)).toBeUndefined();
	expect(parentRowKey(row('folder', 'a'), true)).toBe('folder:/');
	expect(parentRowKey(row('tag', 'x/y'), false)).toBe('tag:x');
});

describe('root sections', () => {
	const notes: NoteEntry[] = [
		{ ...note('Work/a.md', ['plan']), props: { Status: ['Active'], Topic: ['Books', 'History'] } },
		{ ...note('Work/b.md'), props: { status: ['active'] } },
		{ ...note('c.md'), props: { status: ['Done'], tags: ['x'] } },
	];
	const input = { ...base, folders: ['/', 'Work'], notes, expandedFolders: new Set(['/']), expandedTags: new Set<string>(), showProperties: true };

	test('sections come in the stored order and each can be collapsed', () => {
		const order = buildNavTree({ ...input, sections: ['properties', 'folders', 'tags', 'recent', 'shortcuts'] });
		expect(order.rows.filter((row) => row.kind === 'section').map((row) => row.key)).toEqual(['section:properties', 'section:folders', 'section:tags']);
		const folded = buildNavTree({ ...input, collapsed: new Set<SectionId>(['folders', 'properties']) });
		expect(folded.rows.map((row) => row.key)).toEqual(['section:folders', 'section:tags', 'tag:plan', 'untagged', 'section:properties']);
		expect(folded.rows.find((row) => row.key === 'section:folders')).toMatchObject({ expanded: false });
	});

	test('shortcuts and recent notes appear only when there are some', () => {
		const empty = buildNavTree(input);
		expect(empty.rows.some((row) => row.key === 'section:shortcuts' || row.key === 'section:recent')).toBe(false);
		const shortcut = makeShortcut('folder', 'Work');
		const tree = buildNavTree({ ...input, shortcuts: [{ shortcut, label: 'Work', missing: false }, { shortcut: makeShortcut('note', 'gone.md'), label: 'gone', missing: true }], recent: [{ path: 'c.md', label: 'c' }] });
		expect(tree.rows.slice(0, 6).map((row) => row.key)).toEqual(['section:shortcuts', 'shortcut:folder:Work', 'shortcut:note:gone.md', 'section:recent', 'recent:c.md', 'section:folders']);
		expect(tree.rows[2]).toMatchObject({ missing: true });
		expect(tree.rows[1]?.shortcut).toBe(shortcut);
	});

	test('properties list keys, then values with file counts when a key is expanded', () => {
		const closed = buildNavTree(input);
		const keys = closed.rows.filter((row) => row.kind === 'property');
		expect(keys.map((row) => [row.label, row.count, row.hasChildren, row.expanded])).toEqual([['Status', 3, true, false], ['Topic', 1, true, false]]);
		const open = buildNavTree({ ...input, expandedProperties: new Set(['status']) });
		const values = open.rows.filter((row) => row.kind === 'propertyValue');
		expect(values.map((row) => [row.label, row.count, row.key])).toEqual([['Active', 2, 'property:status=active'], ['Done', 1, 'property:status=done']]);
		expect(values[0]?.context).toEqual({ kind: 'property', key: 'status', value: 'active' });
		expect(parentRowKey(values[0]!, false)).toBe('property:status');
	});

	test('the property browser can be limited to chosen keys, and built-in keys are left out by default', () => {
		const all = buildNavTree(input).rows.filter((row) => row.kind === 'property').map((row) => row.path);
		expect(all).not.toContain('tags');
		const some = buildNavTree({ ...input, propertyKeys: ['topic', 'tags'] }).rows.filter((row) => row.kind === 'property').map((row) => row.path);
		expect(some).toEqual(['tags', 'topic']);
		expect(buildNavTree({ ...input, showProperties: false }).rows.some((row) => row.kind === 'property')).toBe(false);
	});
});
