// Retained baseline logic assertions; renderer behavior is verified against the current React components.
import { strict as assert } from 'node:assert';
import { runHomeReactChecks } from './run-home-react-checks';
import { parse, serialize } from '../src/modules/home/core/board/parser';
import { groupLibraryResults } from '../src/modules/home/ui/library/library-groups';
import type { LibraryFileResult } from '../src/modules/home/ui/library/library-file-result';
// ---------- 1. Parser round-trip ----------

interface RoundTripOutcome {
	mode: string | undefined;
	by: string | undefined;
	serialized: string;
}

const roundTrip = (libraryLines: string[]): RoundTripOutcome => {
	const dash = parse(
		[
			'---',
			'columns:',
			'  - name: C1',
			'    type: folder',
			'    library:',
			...libraryLines,
			'---',
			'',
			'## C1',
		].join('\n'),
	);
	const lc = dash.columns[0]!.libraryConfig!;
	return {
		mode: lc.viewGroupMode,
		by: lc.viewGroupBy,
		serialized: serialize(dash),
	};
};

const folderCase = roundTrip(['      viewGroupMode: folder']);
assert.equal(folderCase.mode, 'folder', 'folder mode parses');
assert.equal(folderCase.by, undefined, 'folder mode carries no property key');
assert.match(folderCase.serialized, /viewGroupMode: folder/, 'folder mode persists');
assert.doesNotMatch(folderCase.serialized, /viewGroupBy/, 'folder mode writes no viewGroupBy');

const propCase = roundTrip(['      viewGroupMode: property', '      viewGroupBy: "status"']);
assert.equal(propCase.mode, 'property', 'property mode parses');
assert.equal(propCase.by, 'status', 'property key parses');
assert.match(propCase.serialized, /viewGroupMode: property/, 'property mode persists');
assert.match(propCase.serialized, /viewGroupBy: "status"/, 'property key persists');

const noneCase = roundTrip(['      viewGroupMode: none']);
assert.equal(noneCase.mode, 'none', "'none' parses as explicit off");
assert.match(noneCase.serialized, /viewGroupMode: none/, 'explicit default is preserved');

const absentCase = roundTrip(['      viewMode: grid']);
assert.equal(absentCase.mode, undefined, 'absent mode parses to undefined');
assert.doesNotMatch(absentCase.serialized, /viewGroup/, 'absent mode writes nothing');

const garbageCase = roundTrip(['      viewGroupMode: sideways']);
assert.equal(garbageCase.mode, undefined, 'garbage mode dropped');
assert.match(garbageCase.serialized, /viewGroupMode: sideways/, 'unknown author value is preserved');

const strayByKey = roundTrip(['      viewGroupBy: "status"']);
assert.equal(strayByKey.by, undefined, 'viewGroupBy without property mode is ignored');
assert.match(strayByKey.serialized, /viewGroupBy/, 'unused author property is preserved');

const folderByKey = roundTrip(['      viewGroupMode: folder', '      viewGroupBy: "status"']);
assert.equal(folderByKey.by, undefined, 'viewGroupBy under folder mode is ignored');

console.log('viewGroup parser round-trip: PASS');

// ---------- 2. groupLibraryResults ----------

const mk = (path: string, frontmatter: Record<string, unknown>): LibraryFileResult => ({
	file: { path } as unknown as LibraryFileResult['file'],
	basename: path.split('/').pop() ?? path,
	mtime: 1,
	ctime: 1,
	frontmatter,
	preview: '',
	tags: [],
});

// Property: scalars bucket by value in first-occurrence order; missing value
// falls to a trailing not-set bucket.
const propGroups = groupLibraryResults(
	[mk('a.md', { status: 'done' }), mk('b.md', { status: 'todo' }), mk('c.md', { status: 'done' }), mk('d.md', {})],
	'property',
	'status',
	[],
);
assert.deepEqual(
	propGroups.map((g) => g.label),
	['done', 'todo', '(未设置)'],
	'scalar buckets in first-occurrence order, not-set last',
);
assert.equal(propGroups[0]!.items.length, 2, 'done bucket holds both files');
assert.equal(propGroups[2]!.isNoGroup, true, 'trailing bucket flagged isNoGroup');

// Property: array values fan a file into every value's group.
const arrayGroups = groupLibraryResults(
	[mk('a.md', { tags: ['x', 'y'] }), mk('b.md', { tags: 'x' })],
	'property',
	'tags',
	[],
);
assert.deepEqual(
	arrayGroups.map((g) => g.label),
	['x', 'y'],
	'array value fans out',
);
assert.equal(arrayGroups[0]!.items.length, 2, 'file appears in every matched group');

// Folder: scan-root subfolders key by their top segment; a scan root's direct
// files group under the root's own name; files outside every scan root fall
// back to their first parent segment; vault-root files are not-set.
const folderGroups = groupLibraryResults(
	[mk('notes/b/2.md', {}), mk('notes/a/1.md', {}), mk('notes/3.md', {}), mk('other/4.md', {}), mk('5.md', {})],
	'folder',
	undefined,
	['notes'],
);
assert.deepEqual(
	folderGroups.map((g) => g.label),
	['a', 'b', 'notes', 'other', '(未设置)'],
	'folder keys: subfolders, root-own-name, parent fallback, alphabetical + not-set last',
);

// Folder: numeric-aware ordering (a2 before a10 — lexical would flip them).
const numericGroups = groupLibraryResults([mk('notes/a10/1.md', {}), mk('notes/a2/2.md', {})], 'folder', undefined, [
	'notes',
]);
assert.deepEqual(
	numericGroups.map((g) => g.label),
	['a2', 'a10'],
	'numeric-aware alphabetical folder order',
);

console.log('groupLibraryResults: PASS');

runHomeReactChecks(['ui/sections/library.dom.test.tsx']);
