// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { describe, expect, test } from 'vitest';
import type { NoteEntry } from '../types';
import { parseDateExpression } from './dates';
import { compileSearch, noteHasProperty } from './evaluate';
import { propertyTerm, tagTerm, toggleFilter } from './compose';
import { parseQuery, splitTokens, type ParseOptions } from './parse';

// Wednesday 11 February 2026, noon. Week 7 starts Monday the 9th.
const NOW = new Date(2026, 1, 11, 12).getTime();
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime();
const options: ParseOptions = { now: NOW, defaultField: 'modified', weekStart: 1, dateOrder: 'dmy' };

function note(path: string, extra: Partial<NoteEntry> = {}): NoteEntry {
	const slash = path.lastIndexOf('/');
	const file = path.slice(slash + 1);
	const dot = file.lastIndexOf('.');
	return { path, name: file.slice(0, dot), ext: file.slice(dot + 1), folder: slash < 0 ? '/' : path.slice(0, slash), ctime: at(2026, 1, 1), mtime: at(2026, 1, 1), tags: [], ...extra };
}

const vault: NoteEntry[] = [
	note('Project plan.md', { tags: ['work', 'work/plan'], aliases: ['Roadmap'], props: { status: ['Active'], 'Reading Status': ['In Progress'] }, mtime: at(2026, 2, 11), ctime: at(2026, 2, 1), hasTask: true }),
	note('work/meetings/Weekly sync.md', { tags: ['work/meeting'], props: { status: ['done'] }, mtime: at(2026, 2, 10), ctime: at(2026, 2, 10) }),
	note('work/meetings/Kickoff.md', { tags: ['work'], mtime: at(2026, 2, 2), ctime: at(2025, 12, 30) }),
	note('work/archive/Old.md', { tags: ['archive'], props: { status: ['archived'] }, mtime: at(2025, 11, 4), ctime: at(2025, 11, 4) }),
	note('personal/Journal.md', { tags: [], mtime: at(2026, 2, 7), ctime: at(2026, 2, 7) }),
	note('personal/.F notes.md', { tags: ['life'], mtime: at(2026, 2, 5), ctime: at(2026, 2, 5) }),
	note('scans/Receipt.pdf', { mtime: at(2026, 2, 11, 8), ctime: at(2026, 2, 11, 8) }),
	note('Q2 review.md', { tags: ['Work'], mtime: at(2026, 4, 20), ctime: at(2026, 4, 20) }),
];

const find = (query: string, opts: Partial<ParseOptions> = {}) => {
	const search = compileSearch(query, { ...options, ...opts });
	return vault.filter((entry) => search.matches(entry)).map((entry) => entry.path);
};

describe('tokens', () => {
	test('splits on spaces and keeps quoted text together, even in the middle of a token', () => {
		expect(splitTokens('a "b c" ."Reading Status"="In Progress" -folder:"x y"').map((token) => token.raw)).toEqual(['a', '"b c"', '."Reading Status"="In Progress"', '-folder:"x y"']);
		expect(splitTokens('  open "quote').map((token) => token.raw)).toEqual(['open', '"quote']);
	});
});

describe('file names and aliases', () => {
	test('word matches the name or an alias, case-insensitively', () => {
		expect(find('plan')).toEqual(['Project plan.md']);
		expect(find('roadmap')).toEqual(['Project plan.md']);
		expect(find('SYNC')).toEqual(['work/meetings/Weekly sync.md']);
	});
	test('every word must match somewhere across name and aliases', () => {
		expect(find('project roadmap')).toEqual(['Project plan.md']);
		expect(find('project nothing')).toEqual([]);
	});
	test('-word excludes name and alias matches', () => {
		expect(find('-plan -roadmap meet')).toEqual([]);
		expect(find('o -project -weekly -kickoff -old -journal -review -notes')).toEqual([]);
		expect(find('-project').includes('Project plan.md')).toBe(false);
		expect(find('-roadmap').includes('Project plan.md')).toBe(false);
	});
	test('a term that opens with a double quote is literal text', () => {
		expect(find('".F"')).toEqual(['personal/.F notes.md']);
		expect(find('.F')).toEqual([]);
		expect(find('-".F"').includes('personal/.F notes.md')).toBe(false);
		expect(find('"#work"')).toEqual([]);
		expect(find('"weekly sync"')).toEqual(['work/meetings/Weekly sync.md']);
	});
});

describe('tags', () => {
	test('#tag includes nested tags and ignores case', () => {
		expect(find('#work')).toEqual(['Project plan.md', 'work/meetings/Weekly sync.md', 'work/meetings/Kickoff.md', 'Q2 review.md']);
		expect(find('#work/plan')).toEqual(['Project plan.md']);
		expect(find('#wor')).toEqual([]);
	});
	test('# is any tag and -# is no tag', () => {
		expect(find('#')).toHaveLength(6);
		expect(find('-#')).toEqual(['personal/Journal.md', 'scans/Receipt.pdf']);
	});
	test('-#tag excludes the tag and its nested tags', () => {
		expect(find('-#work -#archive -#life')).toEqual(['personal/Journal.md', 'scans/Receipt.pdf']);
	});
	test('implicit and explicit AND need both tags', () => {
		expect(find('#work #work/plan')).toEqual(['Project plan.md']);
		expect(find('#work AND #work/plan')).toEqual(['Project plan.md']);
	});
	test('OR matches either tag and AND binds tighter than OR', () => {
		expect(find('#archive OR #life')).toEqual(['work/archive/Old.md', 'personal/.F notes.md']);
		expect(find('#life OR #work AND #work/meeting')).toEqual(['work/meetings/Weekly sync.md', 'personal/.F notes.md']);
		expect(find('#work/meeting AND #work OR #life')).toEqual(['work/meetings/Weekly sync.md', 'personal/.F notes.md']);
	});
	test('operators work between tags and properties', () => {
		expect(find('#archive OR .status=done')).toEqual(['work/meetings/Weekly sync.md', 'work/archive/Old.md']);
		expect(find('-#work OR .status=active')).toEqual(['Project plan.md', 'work/archive/Old.md', 'personal/Journal.md', 'personal/.F notes.md', 'scans/Receipt.pdf']);
	});
	test('AND and OR are plain words once the query holds anything but tags and properties', () => {
		expect(find('#work OR ext:md')).toEqual([]);
		const parsed = parseQuery('#work OR ext:md', options);
		expect(parsed.operators).toBe(false);
		expect(parsed.tokens.map((token) => token.term?.type)).toEqual(['tag', 'name', 'ext']);
		expect(find('plan AND roadmap')).toEqual([]);
		expect(find('and')).toEqual([]);
	});
	test('lower-case and/or are always name words', () => {
		expect(parseQuery('#a or #b', options).operators).toBe(false);
	});
});

describe('properties', () => {
	test('.key matches by key prefix and ignores case', () => {
		expect(find('.status')).toEqual(['Project plan.md', 'work/meetings/Weekly sync.md', 'work/archive/Old.md']);
		expect(find('.stat')).toHaveLength(3);
		expect(find('.READING')).toEqual(['Project plan.md']);
		expect(find('.tatus')).toEqual([]);
	});
	test('.key=value matches when a value contains the text', () => {
		expect(find('.status=act')).toEqual(['Project plan.md']);
		expect(find('.status=ARCH')).toEqual(['work/archive/Old.md']);
		expect(find('.status=zzz')).toEqual([]);
	});
	test('.key=value looks only at the key of exactly that name; only .key matches by prefix', () => {
		const near = note('near.md', { props: { 'status-old': ['done'], statusX: ['done'] } });
		const exact = note('exact.md', { props: { Status: ['Done'] } });
		const match = (query: string, entry: NoteEntry) => compileSearch(query, options).matches(entry);
		expect(match('.status=done', near)).toBe(false);
		expect(match('-.status=done', near)).toBe(true);
		expect(match('.status=done', exact)).toBe(true);
		expect(match('-.status=done', exact)).toBe(false);
		expect(match('.stat=done', exact)).toBe(false);
		expect(match('.stat', exact)).toBe(true);
		expect(match('.status', near)).toBe(true);
		expect(match('."status-old"=done', near)).toBe(true);
		expect(match('."status-old"=done', exact)).toBe(false);
		expect(match('.STATUS=DON', exact)).toBe(true);
	});
	test('quoted keys and values may hold whitespace', () => {
		expect(find('."Reading Status"')).toEqual(['Project plan.md']);
		expect(find('."Reading Status"="In Progress"')).toEqual(['Project plan.md']);
		expect(find('."Reading Status"=progress')).toEqual(['Project plan.md']);
		expect(find('."Reading Status"="Not started"')).toEqual([]);
	});
	test('-.key and -.key=value exclude', () => {
		expect(find('-.status')).toHaveLength(5);
		expect(find('-.status=done').includes('work/meetings/Weekly sync.md')).toBe(false);
		expect(find('-.status=done').includes('Project plan.md')).toBe(true);
	});
	test('list values: any item can match', () => {
		const listed = note('l.md', { props: { topics: ['books', 'history'] } });
		expect(compileSearch('.topics=hist', options).matches(listed)).toBe(true);
	});
});

describe('filters', () => {
	test('has:task finds notes with unfinished tasks', () => {
		expect(find('has:task')).toEqual(['Project plan.md']);
		expect(find('-has:task')).toHaveLength(7);
		expect(find('has:foo')).toEqual([]);
	});
	test('folder:name matches any folder name containing the text, subfolders included', () => {
		expect(find('folder:meetings')).toEqual(['work/meetings/Weekly sync.md', 'work/meetings/Kickoff.md']);
		expect(find('folder:MEET')).toHaveLength(2);
		expect(find('folder:work')).toHaveLength(3);
		expect(find('-folder:archive').includes('work/archive/Old.md')).toBe(false);
	});
	test('folder:/path matches that folder only, not its subfolders', () => {
		expect(find('folder:/work/meetings')).toEqual(['work/meetings/Weekly sync.md', 'work/meetings/Kickoff.md']);
		expect(find('folder:/work')).toEqual([]);
		expect(find('-folder:/work/archive').includes('work/archive/Old.md')).toBe(false);
		expect(find('-folder:/work/archive')).toHaveLength(7);
	});
	test('folder:/ is the vault root', () => {
		expect(find('folder:/')).toEqual(['Project plan.md', 'Q2 review.md']);
	});
	test('ext: accepts a leading dot and negation', () => {
		expect(find('ext:pdf')).toEqual(['scans/Receipt.pdf']);
		expect(find('ext:.pdf')).toEqual(['scans/Receipt.pdf']);
		expect(find('-ext:pdf')).toHaveLength(7);
		expect(find('ext:md folder:/work/meetings')).toHaveLength(2);
	});
	test('unfinished filters are ignored while typing', () => {
		expect(find('folder:')).toHaveLength(8);
		expect(find('ext:')).toHaveLength(8);
		expect(find('@')).toHaveLength(8);
		expect(compileSearch('', options).active).toBe(false);
		expect(compileSearch('  ', options).active).toBe(false);
	});
});

describe('dates', () => {
	test('relative keywords use the default field, which follows the sort', () => {
		expect(find('@today')).toEqual(['Project plan.md', 'scans/Receipt.pdf']);
		expect(find('@yesterday')).toEqual(['work/meetings/Weekly sync.md']);
		expect(find('@today', { defaultField: 'created' })).toEqual(['scans/Receipt.pdf']);
		expect(find('@last7d')).toEqual(['Project plan.md', 'work/meetings/Weekly sync.md', 'personal/Journal.md', 'personal/.F notes.md', 'scans/Receipt.pdf']);
		expect(find('@last30d')).toHaveLength(6);
		expect(find('@thisweek')).toEqual(['Project plan.md', 'work/meetings/Weekly sync.md', 'scans/Receipt.pdf']);
		expect(find('@thismonth')).toEqual(['Project plan.md', 'work/meetings/Weekly sync.md', 'work/meetings/Kickoff.md', 'personal/Journal.md', 'personal/.F notes.md', 'scans/Receipt.pdf']);
	});
	test('@c: and @m: pick the field', () => {
		expect(find('@c:today')).toEqual(['scans/Receipt.pdf']);
		expect(find('@m:today')).toEqual(['Project plan.md', 'scans/Receipt.pdf']);
		expect(find('@c:2025')).toEqual(['work/meetings/Kickoff.md', 'work/archive/Old.md']);
		expect(find('@c:thisweek', { defaultField: 'modified' })).toEqual(['work/meetings/Weekly sync.md', 'scans/Receipt.pdf']);
	});
	test('-@ excludes a date match', () => {
		expect(find('-@today').includes('Project plan.md')).toBe(false);
		expect(find('-@2026')).toEqual(['work/archive/Old.md']);
	});
	test('a day, with or without dashes', () => {
		expect(find('@2026-02-07')).toEqual(['personal/Journal.md']);
		expect(find('@20260207')).toEqual(['personal/Journal.md']);
	});
	test('a year, month, ISO week and quarter', () => {
		expect(find('@2025')).toEqual(['work/archive/Old.md']);
		expect(find('@2026-02')).toEqual(['Project plan.md', 'work/meetings/Weekly sync.md', 'work/meetings/Kickoff.md', 'personal/Journal.md', 'personal/.F notes.md', 'scans/Receipt.pdf']);
		expect(find('@202602')).toHaveLength(6);
		expect(find('@2026-W06')).toEqual(['work/meetings/Kickoff.md', 'personal/Journal.md', 'personal/.F notes.md']);
		expect(find('@2026W06')).toHaveLength(3);
		expect(find('@2026-Q2')).toEqual(['Q2 review.md']);
		expect(find('@2026Q2')).toEqual(['Q2 review.md']);
		expect(find('@2026-Q1').includes('Q2 review.md')).toBe(false);
	});
	test('numeric formats with separators; ambiguous ones follow the locale', () => {
		expect(find('@07/02/2026')).toEqual(['personal/Journal.md']);
		expect(find('@07/02/2026', { dateOrder: 'mdy' })).toEqual([]);
		expect(find('@02/07/2026', { dateOrder: 'mdy' })).toEqual(['personal/Journal.md']);
		expect(find('@13/02/2026')).toEqual([]);
		const day = (text: string, order: 'dmy' | 'mdy' = 'dmy') => parseDateExpression(text, { now: NOW, dateOrder: order })?.start;
		expect(day('13/02/2026')).toBe(new Date(2026, 1, 13).getTime());
		expect(day('02/13/2026')).toBe(new Date(2026, 1, 13).getTime());
		expect(day('07022026')).toBe(new Date(2026, 1, 7).getTime());
		expect(day('07022026', 'mdy')).toBe(new Date(2026, 6, 2).getTime());
		expect(day('7.2.2026')).toBe(new Date(2026, 1, 7).getTime());
		expect(day('30/02/2026')).toBeUndefined();
	});
	test('ranges are inclusive and may be open at either end', () => {
		expect(find('@2026-02-05..2026-02-07')).toEqual(['personal/Journal.md', 'personal/.F notes.md']);
		expect(find('@2026-02-10..')).toEqual(['Project plan.md', 'work/meetings/Weekly sync.md', 'scans/Receipt.pdf', 'Q2 review.md']);
		expect(find('@..2025-12')).toEqual(['work/archive/Old.md']);
		expect(find('@2026-02-07..2026-02-05')).toHaveLength(2);
		expect(find('@2025-11..2025-12')).toEqual(['work/archive/Old.md']);
		expect(find('@c:2025-12-30..2025-12-31')).toEqual(['work/meetings/Kickoff.md']);
	});
	test('week start can be Sunday', () => {
		const sunday = new Date(2026, 1, 8, 12).getTime();
		const search = compileSearch('@thisweek', { ...options, weekStart: 0 });
		expect(search.matches(note('s.md', { mtime: sunday }))).toBe(true);
		const monday = compileSearch('@thisweek', { ...options, weekStart: 1 });
		expect(monday.matches(note('s.md', { mtime: sunday }))).toBe(false);
	});
	test('an invalid date is searched as text instead', () => {
		const parsed = parseQuery('@2026-13-45 @nonsense @2026-W60', options);
		expect(parsed.tokens.map((token) => token.term?.type)).toEqual(['name', 'name', 'name']);
	});
	test('the ISO week of early January can belong to the previous year', () => {
		const range = parseDateExpression('2026-W01', { now: NOW });
		expect(range?.start).toBe(new Date(2025, 11, 29).getTime());
		expect(parseDateExpression('2026-W53', { now: NOW })).toBeDefined();
		expect(parseDateExpression('2025-W53', { now: NOW })).toBeUndefined();
	});
});

describe('combined queries', () => {
	test('names, properties, tags and dates together', () => {
		expect(find('meeting .status=done #work @thisweek')).toEqual([]);
		expect(find('sync .status=done #work @thisweek')).toEqual(['work/meetings/Weekly sync.md']);
		expect(find('folder:/work/meetings ext:md @thisweek')).toEqual(['work/meetings/Weekly sync.md']);
	});
	test('noteHasProperty compares keys and values without case', () => {
		expect(noteHasProperty(vault[0]!, 'status')).toBe(true);
		expect(noteHasProperty(vault[0]!, 'status', 'active')).toBe(true);
		expect(noteHasProperty(vault[0]!, 'status', 'done')).toBe(false);
		expect(noteHasProperty(vault[4]!, 'status')).toBe(false);
	});
});

describe('composing filters from clicks', () => {
	test('first filter, AND, OR and toggling off', () => {
		expect(toggleFilter('', '#a', 'and', options)).toBe('#a');
		expect(toggleFilter('#a', '#b', 'and', options)).toBe('#a #b');
		expect(toggleFilter('#a', '#b', 'or', options)).toBe('#a OR #b');
		expect(toggleFilter('#a OR #b', '#c', 'and', options)).toBe('#a OR #b AND #c');
		expect(toggleFilter('#a OR #b', '#b', 'and', options)).toBe('#a');
		expect(toggleFilter('#a OR #b', '#a', 'and', options)).toBe('#b');
		expect(toggleFilter('#a', '#a', 'and', options)).toBe('');
		expect(toggleFilter('#A', '#a', 'and', options)).toBe('');
	});
	test('a query with names or other filters takes the new term implicitly', () => {
		expect(toggleFilter('meeting', '#a', 'or', options)).toBe('meeting #a');
		expect(toggleFilter('ext:md', '.status=done', 'or', options)).toBe('ext:md .status=done');
		expect(toggleFilter('#a -#b', '#c', 'and', options)).toBe('#a -#b #c');
	});
	test('a negated filter typed by hand is not removed by clicking the tag', () => {
		expect(toggleFilter('-#a', '#a', 'and', options)).toBe('-#a #a');
	});
	test('property and tag terms are quoted when they need it', () => {
		expect(propertyTerm('status', 'done')).toBe('.status=done');
		expect(propertyTerm('Reading Status', 'In Progress')).toBe('."Reading Status"="In Progress"');
		expect(propertyTerm('status')).toBe('.status');
		expect(tagTerm('work')).toBe('#work');
		expect(toggleFilter('', propertyTerm('Reading Status', 'In Progress'), 'and', options)).toBe('."Reading Status"="In Progress"');
		expect(find(propertyTerm('Reading Status', 'In Progress'))).toEqual(['Project plan.md']);
	});
});
