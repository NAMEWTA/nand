import { installPreactMiniDom } from './preact-mini-dom';
/**
 * Verifies the vault-refresh scope filtering and signature skip for scanning
 * (library/folder) sections — the fix for the "workbench refreshes rapidly"
 * report:
 *
 * 1. Predicate filter — refreshScanningSections only refreshes the sections
 *    the caller marks relevant; out-of-scope sections keep their DOM identity.
 * 2. Signature skip — a second refresh with unchanged render inputs (same
 *    config, same in-scope path/mtime/ctime set) swaps nothing.
 * 3. In-scope mtime change — one file's mtime bump under the scan folder
 *    refreshes the section again.
 * 4. Excluded folder — a write inside an excludeFolders path passes the
 *    caller's prefix check but is invisible to the signature: no refresh.
 * 5. invalidateScanningSectionSignatures — clearing the cache forces the next
 *    refresh to requery even though nothing changed (metadata resolve path).
 * 6. Scope isolation — a different signatureScope (another board) keeps its
 *    own cache entries.
 *
 * Run: `pnpm run test:refresh-scope`
 */
import { strict as assert } from 'node:assert';
import type { App } from 'obsidian';
import { El } from './mini-dom';
installPreactMiniDom();
import {
	renderSection,
	refreshScanningSections,
	invalidateScanningSectionSignatures,
} from '../src/modules/home/ui/renderer/index';
import type { DashboardColumn, LibraryConfig } from '../src/modules/home/core/board/types/index';
import type { RenderCallbacks } from '../src/modules/home/ui/render-contract';

// Obsidian globals absent in Node (see verify-card-new-note for the idiom):
// activeDocument for theme/hover queries, window for blur timers, the bare
// global createDiv() renderSection's root element uses, and CSS.escape for
// the section-row selectors (identity stand-in: the kanban querySelector is
// patched below and matches on dataset directly).
(globalThis as { activeDocument?: unknown }).activeDocument = {
	querySelector: () => null,
	querySelectorAll: () => [],
	addEventListener: () => {},
	removeEventListener: () => {},
};
(globalThis as { window?: unknown }).window = globalThis;
(globalThis as Record<string, unknown>).createDiv = (o?: { cls?: string; text?: string }): El => {
	const el = new El('div');
	if (o?.cls) el.addClass(...o.cls.split(/\s+/));
	if (o?.text !== undefined) el.textContent = o.text;
	return el;
};
(globalThis as unknown as { CSS?: { escape: (s: string) => string } }).CSS = {
	escape: (s: string): string => s.replace(/[^\w-]/g, '\\$&'),
};

// Mutable file table: the signature reads path + stat, and the tests bump
// mtimes in place to simulate writes.
interface StubFile {
	path: string;
	basename: string;
	extension: string;
	stat: { mtime: number; ctime: number };
}
const files: StubFile[] = [
	{ path: 'rss/a.md', basename: 'a', extension: 'md', stat: { mtime: 100, ctime: 10 } },
	{ path: 'rss/hidden/x.md', basename: 'x', extension: 'md', stat: { mtime: 100, ctime: 10 } },
	{ path: 'wiki/c.md', basename: 'c', extension: 'md', stat: { mtime: 100, ctime: 10 } },
];

const app = {
	vault: {
		getMarkdownFiles: () => files,
		getFileByPath: () => null,
	},
	metadataCache: {
		on: () => ({}),
		offref: () => {},
		getFileCache: (f: { path: string }) => ({ frontmatter: { title: f.path }, tags: [] }),
		fileToLinktext: (f: { path: string }) => f.path,
	},
	workspace: { on: () => {}, off: () => {} },
	fileManager: {},
	loadLocalStorage: () => null,
	saveLocalStorage: () => {},
} as unknown as App;

const makeColumn = (name: string, config: LibraryConfig): DashboardColumn =>
	({ name, color: '', sectionType: 'folder', cards: [], libraryConfig: config }) as unknown as DashboardColumn;

const newsCfg: LibraryConfig = {
	filters: [],
	viewMode: 'grid',
	sortBy: 'modified',
	sortDesc: true,
	folders: ['rss'],
	excludeFolders: ['rss/hidden'],
};
const columns: DashboardColumn[] = [
	makeColumn('News', newsCfg),
	makeColumn('Wiki', { filters: [], viewMode: 'grid', sortBy: 'modified', sortDesc: true, folders: ['wiki'] }),
	{ ...makeColumn('All', { filters: [], viewMode: 'grid', sortBy: 'modified', sortDesc: true }), sectionType: 'library' },
];
const data = { columns } as unknown as Parameters<typeof refreshScanningSections>[1];
const callbacks = {} as RenderCallbacks;

// Board: a kanban host whose querySelector understands the section-row
// selector mini-dom cannot express, and rows that know how to be replaced.
// replaceWith goes on the prototype so rows created by refreshScanningSections
// (inside renderSection) get it too.
const kanban = new El('div');
kanban.addClass('dashboard-kanban');
(El.prototype as unknown as { replaceWith: (node: El) => void }).replaceWith = function replaceWith(
	this: El,
	node: El,
): void {
	const row: El = this;
	const parent = row.parent;
	if (!parent) return;
	parent.appendChild(node);
	const i = parent.children.indexOf(row);
	if (i >= 0) parent.children.splice(i, 1);
	row.parent = null;
};
for (const column of columns) {
	const row = renderSection(column, callbacks, app) as unknown as El;
	row.dataset.column = column.name;
	kanban.appendChild(row);
}
(kanban as unknown as { querySelector: (sel: string) => El | null }).querySelector = (sel: string): El | null => {
	const m = /^:scope > \[data-column="(.*)"\]$/.exec(sel);
	if (!m) return null;
	return kanban.children.find((c) => c.dataset.column === m[1]) ?? null;
};

const rowOf = (name: string): El => {
	const hit = kanban.children.find((c) => c.dataset.column === name);
	assert.ok(hit, `section row ${name} present`);
	return hit;
};

const refreshedNames: string[] = [];
for (const column of columns) {
	rowOf(column.name).querySelector('.dashboard-library-content')!.addEventListener('dashboard-library-refresh', () => refreshedNames.push(column.name));
}

// The view-side scope predicate from refreshSectionsFor, exercised through
// the renderer: in-scope prefix match, no-folders = whole vault.
const inScope = (col: DashboardColumn, lowerPaths: readonly string[]): boolean => {
	const folders = (col.libraryConfig?.folders ?? [])
		.map((f) => f.trim().replace(/^\/+|\/+$/g, ''))
		.filter((f) => f.length > 0);
	if (folders.length === 0) return true;
	return lowerPaths.some((p) => folders.some((f) => p.startsWith(f.toLowerCase() + '/')));
};
const changed = ['rss/new.md'];

// 1. Predicate filter: News and All requery in place; Wiki is untouched.
const wikiBefore = rowOf('Wiki');
const newsBefore = rowOf('News');
let n = refreshScanningSections(
	kanban as unknown as HTMLElement,
	data,
	callbacks,
	app,
	undefined,
	null,
	(col) => inScope(col, changed),
	'board-a',
);
assert.equal(n, 0, 'mounted panels refresh without replacing their rows');
assert.deepEqual(refreshedNames.splice(0), ['News', 'All'], 'predicate filters in-place refreshes');
assert.equal(rowOf('News'), newsBefore, 'in-scope section keeps its controls and focus');
assert.equal(rowOf('Wiki'), wikiBefore, 'out-of-scope section DOM untouched');
console.log('scope predicate filter: PASS');

// 2. Signature skip: nothing changed, second refresh swaps nothing.
const newsAfterFirst = rowOf('News');
n = refreshScanningSections(
	kanban as unknown as HTMLElement,
	data,
	callbacks,
	app,
	undefined,
	null,
	(col) => inScope(col, changed),
	'board-a',
);
assert.equal(n, 0, 'unchanged inputs skip the DOM swap');
assert.deepEqual(refreshedNames.splice(0), [], 'unchanged inputs do not requery');
assert.equal(rowOf('News'), newsAfterFirst, 'in-scope section identity kept when unchanged');
console.log('signature skip: PASS');

// 3. In-scope mtime bump refreshes mounted panels again.
files[0]!.stat.mtime = 200;
n = refreshScanningSections(
	kanban as unknown as HTMLElement,
	data,
	callbacks,
	app,
	undefined,
	null,
	(col) => inScope(col, changed),
	'board-a',
);
assert.equal(n, 0, 'mtime changes keep mounted controls');
assert.deepEqual(refreshedNames.splice(0), ['News', 'All'], 'mtime changes refresh matching sections');
assert.equal(rowOf('News'), newsAfterFirst, 'News row retained after mtime bump');
console.log('mtime in-place refresh: PASS');

// 4. Excluded-folder write: prefix check passes (rss/hidden is under rss/)
//    but the signature excludes the file from the News section.
const newsAfterMtime = rowOf('News');
files[1]!.stat.mtime = 300;
n = refreshScanningSections(
	kanban as unknown as HTMLElement,
	data,
	callbacks,
	app,
	undefined,
	null,
	(col) => inScope(col, ['rss/hidden/x.md']),
	'board-a',
);
assert.equal(n, 0, 'excluded-folder write needs no DOM swap');
assert.deepEqual(refreshedNames.splice(0), ['All'], 'excluded-folder write refreshes only the whole-vault section');
assert.equal(rowOf('News'), newsAfterMtime, 'News skips rebuild for excluded-folder write');
console.log('excluded-folder skip: PASS');

// 5. Invalidation forces a requery on the next pass despite no change.
invalidateScanningSectionSignatures(kanban as unknown as HTMLElement);
n = refreshScanningSections(
	kanban as unknown as HTMLElement,
	data,
	callbacks,
	app,
	undefined,
	null,
	(col) => inScope(col, changed),
	'board-a',
);
assert.equal(n, 0, 'invalidated cache retains controls');
assert.deepEqual(refreshedNames.splice(0), ['News', 'All'], 'invalidated cache refreshes relevant sections');
console.log('signature invalidation: PASS');

// 6. A different board scope keeps its own cache.
n = refreshScanningSections(
	kanban as unknown as HTMLElement,
	data,
	callbacks,
	app,
	undefined,
	null,
	(col) => inScope(col, changed),
	'board-b',
);
assert.equal(n, 0, 'fresh signature scope retains controls');
assert.deepEqual(refreshedNames.splice(0), ['News', 'All'], 'fresh signature scope refreshes independently');
console.log('scope isolation: PASS');

console.log('verify-refresh-scope: ALL PASS');
