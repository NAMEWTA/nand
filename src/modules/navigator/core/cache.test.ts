// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { CACHE_VERSION, isFresh, staleProcessors, type CacheRecord } from './cache';
import { LruMap } from './lru';
import { copyPath, nameProblem, renamedPath, uniquePath } from './ops';
import { noteRowHeight } from './layout';

const record: CacheRecord = { path: 'a.md', version: CACHE_VERSION, contentMtime: 10, imageMtime: 10, imageSig: 'cover', preview: 'x', image: null };

test('processors rerun only for what changed', () => {
	expect(staleProcessors(undefined, 10, 'cover')).toEqual({ content: true, image: true });
	expect(staleProcessors(record, 10, 'cover')).toEqual({ content: false, image: false });
	expect(staleProcessors(record, 11, 'cover')).toEqual({ content: true, image: true });
	expect(staleProcessors({ ...record, contentMtime: 11 }, 11, 'cover')).toEqual({ content: false, image: true });
	expect(staleProcessors(record, 10, 'cover,image')).toEqual({ content: false, image: true });
	expect(staleProcessors({ ...record, version: CACHE_VERSION - 1 }, 10, 'cover').content).toBe(true);
	expect(isFresh(record, 10, 'cover')).toBe(true);
	expect(isFresh(record, 12, 'cover')).toBe(false);
});

test('lru evicts the least recently used', () => {
	const lru = new LruMap<string, number>(2);
	lru.set('a', 1); lru.set('b', 2);
	expect(lru.get('a')).toBe(1);
	lru.set('c', 3);
	expect(lru.has('b')).toBe(false);
	expect([...lru.keys()]).toEqual(['a', 'c']);
	expect(lru.peek('a')).toBe(1);
});

test('file naming', () => {
	const taken = new Set(['Untitled.md', 'Untitled 2.md', 'f/a copy.md']);
	expect(uniquePath('/', 'Untitled', 'md', (p) => taken.has(p))).toBe('Untitled 3.md');
	expect(uniquePath('f', 'New', '', () => false)).toBe('f/New');
	expect(copyPath('f/a.md', 'copy', (p) => taken.has(p))).toBe('f/a copy 2.md');
	expect(renamedPath('f/a.md', 'b')).toBe('f/b.md');
	expect(renamedPath('f/a.md', 'b.md')).toBe('f/b.md');
	expect(renamedPath('a.canvas', 'c')).toBe('c.canvas');
	expect(nameProblem('  ', () => false)).toBe('empty');
	expect(nameProblem('a/b', () => false)).toBe('characters');
	expect(nameProblem('.x', () => false)).toBe('dot');
	expect(nameProblem('x', () => true)).toBe('exists');
	expect(nameProblem('x', () => false)).toBeUndefined();
});

test('row height is a pure function of the display settings', () => {
	const base = { compact: false, titleRows: 1, previewRows: 2, showPreview: true, showThumbnail: false, showDate: true, showTags: false, showParentFolder: false };
	expect(noteRowHeight({ ...base, previewRows: 1 })).toBeLessThan(noteRowHeight({ ...base, previewRows: 5 }));
	expect(noteRowHeight({ ...base, titleRows: 3 })).toBeGreaterThan(noteRowHeight(base));
	expect(noteRowHeight({ ...base, compact: true })).toBeLessThan(noteRowHeight(base));
	expect(noteRowHeight({ ...base, showDate: false })).toBeLessThan(noteRowHeight(base));
	expect(noteRowHeight({ ...base, showThumbnail: true, previewRows: 1 })).toBeGreaterThanOrEqual(noteRowHeight({ ...base, previewRows: 1 }));
});

import { formatNoteDate } from './format-date';
test('date text', () => {
	const now = new Date(2026, 9, 15, 12, 0).getTime();
	expect(formatNoteDate(new Date(2026, 9, 15, 9, 5).getTime(), now, '')).toBe('09:05');
	expect(formatNoteDate(new Date(2026, 8, 2, 9, 5).getTime(), now, 'YYYY-MM-DD HH:mm')).toBe('2026-09-02 09:05');
	expect(formatNoteDate(new Date(2024, 8, 2).getTime(), now, '', 'en-US')).toBe('Sep 2, 2024');
});
