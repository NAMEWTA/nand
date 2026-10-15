// Retained baseline logic assertions; renderer behavior is verified against the current React components.
import { strict as assert } from 'node:assert';
import { runHomeReactChecks } from './run-home-react-checks';
import { memoryVault } from './fixtures/memory-vault';
import type { App } from 'obsidian';
import type { LibraryConfig } from '../src/modules/home/core/board/types';
import { queryVaultFiles } from '../src/modules/home/services/library-query';
// Five files covering the interesting shapes: exact value, substring-only
// value, unrelated value, missing property, array-valued property.
const files = [
	{ path: 'a.md', basename: 'a', fm: { channel: 'Ali Abdaal', tags: ['work', 'project'] } },
	{ path: 'b.md', basename: 'b', fm: { channel: 'Ali', tags: ['work'] } },
	{ path: 'c.md', basename: 'c', fm: { channel: 'Dan Koe', tags: ['life'] } },
	{ path: 'd.md', basename: 'd', fm: { tags: ['life', 'project'] } },
	{ path: 'e.md', basename: 'e', fm: { channel: ['Ali Abdaal', 'Matt Gray'], tags: ['fun'] } },
];

const stat = { mtime: 1, ctime: 1 };
const app = {
	vault: {
		...memoryVault().app.vault,
		getMarkdownFiles: () => files.map((f) => ({ path: f.path, basename: f.basename, stat })),
	},
	metadataCache: {
		getFileCache: (f: { path: string }) => {
			const rec = files.find((x) => x.path === f.path)!;
			return { frontmatter: rec.fm, tags: rec.fm.tags?.map((tag: string) => ({ tag })) };
		},
	},
} as unknown as App;

const baseConfig: LibraryConfig = {
	filters: [],
	viewMode: 'grid',
	sortBy: 'name',
	sortDesc: false,
};

const query = (property: string, values: string[], operator?: LibraryConfig['filters'][number]['operator']): string[] =>
	queryVaultFiles(app, { ...baseConfig, filters: [{ property, values, operator }] }).map((r) => r.basename);

// --- equals (default + explicit) ---
assert.deepEqual(query('channel', ['Ali Abdaal']).sort(), ['a', 'e'], 'equals: scalar + array-item exact match');
assert.deepEqual(
	query('channel', ['Ali Abdaal'], 'equals').sort(),
	['a', 'e'],
	'equals: explicit operator same as default',
);
assert.deepEqual(query('channel', ['Ali Abdaal', 'Dan Koe']).sort(), ['a', 'c', 'e'], 'equals: OR across values');

// --- contains ---
assert.deepEqual(query('channel', ['ali'], 'contains').sort(), ['a', 'b', 'e'], 'contains: case-insensitive substring');
assert.deepEqual(
	query('channel', ['ALI', 'koe'], 'contains').sort(),
	['a', 'b', 'c', 'e'],
	'contains: OR across patterns',
);
assert.deepEqual(query('channel', ['Tiago'], 'contains'), [], 'contains: no match');
assert.deepEqual(query('channel', [''], 'contains'), [], 'contains: empty pattern matches nothing');

// --- notEquals ---
assert.deepEqual(
	query('channel', ['Ali Abdaal'], 'notEquals').sort(),
	['b', 'c'],
	'notEquals: excludes exact matches; missing property excluded',
);

// --- tags pseudo-property ---
assert.deepEqual(query('tags', ['work']).sort(), ['a', 'b'], 'tags equals');
assert.deepEqual(query('tags', ['proj'], 'contains').sort(), ['a', 'd'], 'tags contains');
assert.deepEqual(query('tags', ['work'], 'notEquals').sort(), ['c', 'd', 'e'], 'tags notEquals');

// Empty values is a no-op filter under every operator.
assert.equal(query('channel', [], 'notEquals').length, 5, 'empty values: no-op');

runHomeReactChecks(['ui/sections/library.dom.test.tsx']);
