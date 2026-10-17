// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import '../../../../scripts/navigator-test-moment';
import { expect, test } from 'vitest';
import { normalizeCreateCommands } from './create-commands';
import { remapFolderTemplates, resolveFolderTemplate, normalizeFolderTemplates, setFolderTemplate, type FolderTemplate } from './folder-templates';
import { mergedName, mergeNotes, mergeProperties } from './merge';
import { emptyProfileData, listProfiles, normalizeProfiles, switchProfile, type Profile } from './profiles';
import { cleanTag, hashText, isTagOrChild, mapTagList, removeMapper, renameMapper, rewriteTagsAt, validTagName, type TagPosition } from './tag-edit';

const tpl = (folder: string, template: string, exact = false): FolderTemplate => ({ folder, template, exact });

test('the closest folder template wins, and exact ones skip sub-folders', () => {
	const list = [tpl('/', 'T/all.md'), tpl('Personal/DailyNotes', 'T/daily.md'), tpl('Work', 'T/work.md', true)];
	expect(resolveFolderTemplate(list, 'Personal/DailyNotes')?.template).toBe('T/daily.md');
	expect(resolveFolderTemplate(list, 'Personal/DailyNotes/2026')?.template).toBe('T/daily.md');
	expect(resolveFolderTemplate(list, 'Personal')?.template).toBe('T/all.md');
	expect(resolveFolderTemplate(list, 'Work')?.template).toBe('T/work.md');
	expect(resolveFolderTemplate(list, 'Work/Sub')?.template).toBe('T/all.md');
	expect(resolveFolderTemplate(list, '/')?.template).toBe('T/all.md');
	expect(resolveFolderTemplate([tpl('Work', 'x')], 'Home')).toBeUndefined();
});

test('folder templates are normalized, set, removed and followed through renames', () => {
	expect(normalizeFolderTemplates([{ folder: '/A/', template: ' t.md ' }, { folder: 'A', template: 'dup.md' }, { folder: 'B', template: '' }, 5])).toEqual([tpl('A', 't.md')]);
	expect(setFolderTemplate([tpl('A', 'a.md')], tpl('A', 'b.md', true))).toEqual([tpl('A', 'b.md', true)]);
	expect(setFolderTemplate([tpl('A', 'a.md')], tpl('A', ''))).toEqual([]);
	expect(remapFolderTemplates([tpl('A', 'a.md'), tpl('A/B', 'b.md'), tpl('AB', 'c.md')], 'A', 'X')).toEqual([tpl('X', 'a.md'), tpl('X/B', 'b.md'), tpl('AB', 'c.md')]);
});

test('create-note commands are repaired', () => {
	const [first, ...rest] = normalizeCreateCommands([
		{ id: 'a', name: ' Meeting ', template: 'T/m.md', fileName: '{{date}} {{prompt:Title}}', location: 'folder', folder: '/Meetings/' },
		{ id: 'a', name: 'Duplicate id' },
		{ id: 'b', name: '' },
		{ id: 'c', name: 'Bare' },
	]);
	expect(first).toEqual({ id: 'a', name: 'Meeting', template: 'T/m.md', fileName: '{{date}} {{prompt:Title}}', location: 'folder', folder: 'Meetings' });
	expect(rest).toEqual([{ id: 'c', name: 'Bare', template: '', fileName: '', location: 'selected', folder: '' }]);
});

const profile = (id: string, name: string, extra: Partial<Profile> = {}): Profile => ({ id, name, banner: '', ...emptyProfileData(), ...extra });

test('switching profiles saves the live data and loads the target', () => {
	const work = profile('work', 'Work', { hiddenFolders: ['Personal'], shortcuts: [{ id: 'folder:Work', kind: 'folder', key: 'Work' }] });
	const live = { ...emptyProfileData(), hiddenFolders: ['Archive'] };
	const result = switchProfile([work], 'default', live, 'work', 'Default')!;
	expect(result.activeId).toBe('work');
	expect(result.data.hiddenFolders).toEqual(['Personal']);
	expect(result.data.shortcuts).toHaveLength(1);
	expect(result.profiles.find((entry) => entry.id === 'default')?.hiddenFolders).toEqual(['Archive']);
	const back = switchProfile(result.profiles, 'work', { ...result.data, hiddenFolders: ['Personal', 'Tmp'] }, 'default', 'Default')!;
	expect(back.data.hiddenFolders).toEqual(['Archive']);
	expect(back.profiles.find((entry) => entry.id === 'work')?.hiddenFolders).toEqual(['Personal', 'Tmp']);
});

test('switching to the active or an unknown profile does nothing', () => {
	expect(switchProfile([], 'default', emptyProfileData(), 'default', 'Default')).toBeUndefined();
	expect(switchProfile([], 'default', emptyProfileData(), 'nope', 'Default')).toBeUndefined();
});

test('profiles are normalized and the default one is listed first', () => {
	const saved = normalizeProfiles([{ id: 'p1', name: ' One ', hiddenTags: ['x', 5], banner: 'img.png' }, { id: 'p1', name: 'dup' }, { name: 'no id' }]);
	expect(saved).toHaveLength(1);
	expect(saved[0]).toMatchObject({ id: 'p1', name: 'One', hiddenTags: ['x'], banner: 'img.png', shortcuts: [] });
	expect(listProfiles(saved, 'Default').map((entry) => entry.id)).toEqual(['default', 'p1']);
});

test('merging joins the bodies in order, one heading per note', () => {
	const merged = mergeNotes([
		{ name: 'One', body: 'First body\n' },
		{ name: 'Two', body: 'Second body\n\nmore' },
		{ name: 'Empty', body: '' },
	]);
	expect(merged).toBe('# One\n\nFirst body\n\n# Two\n\nSecond body\n\nmore\n\n# Empty\n');
	expect(mergeNotes([{ name: 'Solo', body: 'text' }])).toBe('# Solo\n\ntext\n');
});

test('merged properties keep the first note, combine tags and lists, add what is missing and report conflicts', () => {
	const result = mergeProperties([
		{ status: 'draft', aliases: ['One'], tags: ['a'], rating: 3, position: { start: 0 } },
		{ status: 'done', aliases: ['One', 'Uno'], tag: '#b, #A', source: 'web', rating: 3 },
		{ cssclasses: ['wide'], tags: ['c d'], status: 'done', source: 'book' },
	]);
	expect(result.properties).toEqual({ status: 'draft', aliases: ['One', 'Uno'], position: { start: 0 }, rating: 3, source: 'web', cssclasses: ['wide'], tags: ['a', 'b', 'c d'] });
	expect(result.conflicts).toEqual(['status', 'source']);
});

test('a first note without properties still gets the properties of the others', () => {
	expect(mergeProperties([{}, { status: 'x', tags: ['t'] }]).properties).toEqual({ status: 'x', tags: ['t'] });
	expect(mergeProperties([{}, {}])).toEqual({ properties: {}, conflicts: [] });
});

test('merged name is unique', () => {
	expect(mergedName('One', 'merged', (name) => name === 'One merged' || name === 'One merged 2')).toBe('One merged 3');
});

test('tag helpers', () => {
	expect(cleanTag(' #a//b/ ')).toBe('a/b');
	expect(isTagOrChild('a/b', 'a')).toBe(true);
	expect(isTagOrChild('ab', 'a')).toBe(false);
	expect(isTagOrChild('A', 'a')).toBe(true);
	expect(validTagName('project/x-1')).toBe(true);
	expect(validTagName('2026')).toBe(false);
	expect(validTagName('a b')).toBe(false);
	expect(validTagName('a//b')).toBe(false);
});

test('frontmatter tag lists are renamed, merged and cleaned', () => {
	expect(mapTagList(['#a', 'a/x', 'b'], renameMapper('a', 'z'))).toEqual(['z', 'z/x', 'b']);
	expect(mapTagList(['a', 'z', 'Z'], renameMapper('a', 'z'))).toEqual(['z']);
	expect(mapTagList(['a', 'a/x', 'b'], removeMapper('a', false))).toEqual(['a/x', 'b']);
	expect(mapTagList(['a', 'a/x', 'b'], removeMapper('a', true))).toEqual(['b']);
});


/** Positions as Obsidian reports them: every `#word` in `text` that the test says is a real tag. */
const at = (text: string, ...only: number[]): TagPosition[] => {
	const found: TagPosition[] = [];
	for (const match of text.matchAll(/#[\w/-]*[A-Za-z_/-][\w/-]*/g)) found.push({ tag: match[0], start: match.index!, end: match.index! + match[0].length });
	return only.length ? only.map((index) => found[index]!) : found;
};

test('only the reported tag positions change; every other byte stays', () => {
	const text = '#edge\n\n- item\n\n      #edge\n\n>     #edge\n';
	// Obsidian reports only the first one: the others are code
	const result = rewriteTagsAt(text, at(text, 0), renameMapper('edge', 'changed'));
	expect(result).toEqual({ text: '#changed\n\n- item\n\n      #edge\n\n>     #edge\n', stale: false, changed: true });
});

test('removing a tag right after a code span never duplicates or truncates the text', () => {
	const withNewline = '`code`#tailprobe trailing prose\n';
	expect(rewriteTagsAt(withNewline, at(withNewline), removeMapper('tailprobe', true)).text).toBe('`code` trailing prose\n');
	expect(rewriteTagsAt('`code`#old', at('`code`#old'), removeMapper('old', true)).text).toBe('`code`');
	expect(rewriteTagsAt('a #x b\n#x start\n(#x)', at('a #x b\n#x start\n(#x)'), removeMapper('x', true)).text).toBe('a b\n start\n()');
});

test('children follow a rename and unrelated tags are untouched', () => {
	const text = '#todo and #todo/later and #todos and #other';
	expect(rewriteTagsAt(text, at(text), renameMapper('todo', 'done')).text).toBe('#done and #done/later and #todos and #other');
	expect(rewriteTagsAt(text, at(text), renameMapper('nothing', 'x'))).toMatchObject({ changed: false, text, stale: false });
});

test('positions that no longer match the text are refused as stale and nothing is changed', () => {
	const text = 'inserted line\n#edge here';
	expect(rewriteTagsAt(text, [{ tag: '#edge', start: 0, end: 5 }], renameMapper('edge', 'x'))).toEqual({ text, stale: true, changed: false });
	// out of range, overlapping and empty positions
	expect(rewriteTagsAt('#a', [{ tag: '#a', start: 5, end: 7 }], () => null).stale).toBe(true);
	expect(rewriteTagsAt('#ab', [{ tag: '#ab', start: 0, end: 3 }, { tag: '#b', start: 2, end: 3 }], () => null).stale).toBe(true);
	// one wrong entry makes the whole note stale, even if the first is right
	const two = '#a #b';
	expect(rewriteTagsAt(two, [{ tag: '#a', start: 0, end: 2 }, { tag: '#c', start: 3, end: 5 }], renameMapper('a', 'z'))).toMatchObject({ stale: true, text: two });
});

test('hashes tell texts apart', () => {
	expect(hashText('abc')).toBe(hashText('abc'));
	expect(hashText('abc')).not.toBe(hashText('abd'));
	expect(hashText('')).not.toBe(hashText(' '));
});

test('every property is a user property, whatever its name: position, prototype names and __proto__', () => {
	const first = JSON.parse('{"position":7,"constructor":"Builder","toString":"x","status":"published","__proto__":"own"}') as Record<string, unknown>;
	const result = mergeProperties([first, { note: 'later' }]);
	expect(Object.keys(result.properties)).toEqual(['position', 'constructor', 'toString', 'status', '__proto__', 'note']);
	expect(result.properties['position']).toBe(7);
	expect(result.properties['constructor']).toBe('Builder');
	expect(Object.getOwnPropertyDescriptor(result.properties, '__proto__')?.value).toBe('own');
	expect(result.conflicts).toEqual([]);
	// the same names in a later note are real conflicts only when the values differ
	const later = JSON.parse('{"position":8,"constructor":"Builder","toString":["a"]}') as Record<string, unknown>;
	expect(mergeProperties([first, later]).conflicts).toEqual(['position', 'toString']);
	// a name that only the prototype has is not "already there"
	expect(mergeProperties([{}, JSON.parse('{"constructor":"Later","hasOwnProperty":1}') as Record<string, unknown>])).toEqual({ properties: { constructor: 'Later', hasOwnProperty: 1 }, conflicts: [] });
});

test('merged lists keep items of different types apart: null and 1, "2026-10-17" and a date, 1 and "1"', () => {
	const date = new Date('2026-10-17T00:00:00.000Z');
	const merged = mergeProperties([{ items: [null, 1, 'x'], when: [date] }, { items: [0, '1', 1, null, false], when: ['2026-10-17T00:00:00.000Z', new Date('2026-10-17T00:00:00.000Z')] }]);
	expect(merged.properties['items']).toEqual([null, 1, 'x', 0, '1', false]);
	expect(merged.properties['when']).toEqual([date, '2026-10-17T00:00:00.000Z']);
	// scalar conflicts use the same comparison
	expect(mergeProperties([{ n: 1 }, { n: '1' }]).conflicts).toEqual(['n']);
	expect(mergeProperties([{ d: date }, { d: '2026-10-17T00:00:00.000Z' }]).conflicts).toEqual(['d']);
	expect(mergeProperties([{ d: date }, { d: new Date(date.getTime()) }]).conflicts).toEqual([]);
});
