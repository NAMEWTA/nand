// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { buildListItems, dateBucket, notePaths, notesForContext, sortNotes } from './note-list';
import type { NoteEntry } from './types';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 15, 12).getTime();
const note = (path: string, mtime: number, tags: string[] = [], ctime = mtime): NoteEntry => {
	const slash = path.lastIndexOf('/');
	return { path, name: path.slice(slash + 1).replace(/\.md$/, ''), ext: 'md', folder: slash < 0 ? '/' : path.slice(0, slash), ctime, mtime, tags };
};

test('context filters: folder, descendants, tags with children, untagged', () => {
	const notes = [note('a/1.md', 1, ['work/x']), note('a/b/2.md', 1, ['work']), note('3.md', 1), note('ab/4.md', 1, ['Work/Y'])];
	const paths = (list: NoteEntry[]) => list.map((entry) => entry.path).sort();
	expect(paths(notesForContext(notes, { context: { kind: 'folder', key: 'a' }, includeDescendants: false }))).toEqual(['a/1.md']);
	expect(paths(notesForContext(notes, { context: { kind: 'folder', key: 'a' }, includeDescendants: true }))).toEqual(['a/1.md', 'a/b/2.md']);
	expect(paths(notesForContext(notes, { context: { kind: 'folder', key: '/' }, includeDescendants: true }))).toHaveLength(4);
	expect(paths(notesForContext(notes, { context: { kind: 'tag', key: 'work' }, includeDescendants: false }))).toEqual(['a/b/2.md']);
	expect(paths(notesForContext(notes, { context: { kind: 'tag', key: 'work' }, includeDescendants: true }))).toEqual(['a/1.md', 'a/b/2.md', 'ab/4.md']);
	expect(paths(notesForContext(notes, { context: { kind: 'untagged' }, includeDescendants: false }))).toEqual(['3.md']);
});

test('sorting by name is natural; by date breaks ties by name', () => {
	const notes = [note('Note 10.md', 5), note('note 2.md', 5), note('Alpha.md', 9)];
	expect(sortNotes(notes, 'name', 'asc').map((n) => n.name)).toEqual(['Alpha', 'note 2', 'Note 10']);
	expect(sortNotes(notes, 'modified', 'desc').map((n) => n.name)).toEqual(['Alpha', 'note 2', 'Note 10']);
	expect(sortNotes(notes, 'modified', 'asc').map((n) => n.name)).toEqual(['note 2', 'Note 10', 'Alpha']);
});

test('date buckets', () => {
	expect(dateBucket(NOW - 1000, NOW).kind).toBe('today');
	expect(dateBucket(NOW - DAY, NOW).kind).toBe('yesterday');
	expect(dateBucket(NOW - 5 * DAY, NOW).kind).toBe('week');
	expect(dateBucket(NOW - 20 * DAY, NOW).kind).toBe('month30');
	expect(dateBucket(new Date(2026, 3, 2).getTime(), NOW)).toEqual({ kind: 'month', year: 2026, month: 3 });
	expect(dateBucket(new Date(2024, 3, 2).getTime(), NOW)).toEqual({ kind: 'year', year: 2024 });
});

test('grouping by date puts pinned notes first and counts per heading', () => {
	const notes = [note('a.md', NOW - 100), note('b.md', NOW - 2 * DAY), note('c.md', NOW - 3 * DAY), note('d.md', new Date(2020, 1, 1).getTime())];
	const items = buildListItems(notes, { sortBy: 'modified', direction: 'desc', groupBy: 'date', pinned: new Set(['c.md']), now: NOW });
	expect(items.map((item) => (item.kind === 'header' ? `#${item.section}:${item.count}` : item.path))).toEqual(['#pinned:1', 'c.md', '#date:1', 'a.md', '#date:1', 'b.md', '#date:1', 'd.md']);
	expect(notePaths(items)).toEqual(['c.md', 'a.md', 'b.md', 'd.md']);
});

test('date grouping is ignored when sorting by name; folder grouping sorts folders', () => {
	const notes = [note('z/1.md', 1), note('a/2.md', 2), note('0.md', 3)];
	const byName = buildListItems(notes, { sortBy: 'name', direction: 'asc', groupBy: 'date', pinned: new Set(), now: NOW });
	expect(byName.every((item) => item.kind === 'note')).toBe(true);
	const byFolder = buildListItems(notes, { sortBy: 'modified', direction: 'desc', groupBy: 'folder', pinned: new Set(), now: NOW });
	expect(byFolder.filter((item) => item.kind === 'header').map((item) => (item.kind === 'header' ? item.folder : ''))).toEqual(['/', 'a', 'z']);
});
