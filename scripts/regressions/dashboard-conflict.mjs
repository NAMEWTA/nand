import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(process.cwd() + '/');
const { SyncEngine } = await import(new URL('src/modules/home/platform/board/sync.ts', root));
const { parse, serialize } = await import(new URL('src/modules/home/core/board/parser/index.ts', root));
const { generateDefaultMarkdown } = await import(new URL('src/modules/home/core/board/parser/default-document.ts', root));
const { TFile } = await import(new URL('scripts/obsidian-stub.ts', root));
globalThis.window = globalThis;
const file = Object.assign(new TFile(), { path: 'Board.md', basename: 'Board', extension: 'md' });
let disk = generateDefaultMarkdown();
const backup = new Map(),
	handlers = new Map();
let entering, release;
const entered = new Promise((r) => (entering = r)),
	gate = new Promise((r) => (release = r));
let hold = true;
const app = {
	vault: {
		getFileByPath: (p) => (p === file.path ? file : null),
		read: async () => disk,
		modify: async (f, text) => {
			disk = text;
			for (const cb of handlers.get('modify') ?? []) cb(f);
		},
		process: async (f, fn) => {
			disk = fn(disk);
			for (const cb of handlers.get('modify') ?? []) cb(f);
			return disk;
		},
		on: (name, cb) => {
			handlers.set(name, [...(handlers.get(name) ?? []), cb]);
			return { name, cb };
		},
		offref: (ref) =>
			handlers.set(
				ref.name,
				(handlers.get(ref.name) ?? []).filter((x) => x !== ref.cb),
			),
		adapter: {
			exists: async () => true,
			mkdir: async () => {},
			list: async () => ({ files: [...backup.keys()] }),
			remove: async (p) => backup.delete(p),
			write: async (p, text) => {
				if (hold) {
					hold = false;
					entering();
					await gate;
				}
				backup.set(p, text);
			},
		},
	},
};
const engine = new SyncEngine(app, { dashboardFile: 'Board.md' });
await engine.init();
const oldAuthor = parse(disk).banner.author;
const update = engine.updateBanner({ quote: 'LOCAL-QUOTE-CHANGE' });
const rejected = assert.rejects(update);
await entered;
const outside = parse(disk);
outside.banner.author = 'EXTERNAL-AUTHOR-CHANGE';
await app.vault.modify(file, serialize(outside));
release();
await rejected;
await engine.writeQueue;
await new Promise((r) => setTimeout(r, 350));
assert.equal(parse(disk).banner.author, 'EXTERNAL-AUTHOR-CHANGE');
assert.equal(engine.getData().banner.quote, 'LOCAL-QUOTE-CHANGE');
const recovery = JSON.parse([...backup.entries()].find(([name]) => name.includes('/conflicts/'))[1]);
assert.ok(recovery.local.includes('LOCAL-QUOTE-CHANGE'));
assert.ok(recovery.remote.includes('EXTERNAL-AUTHOR-CHANGE'));
assert.ok(recovery.base.includes(oldAuthor));
// Further local edits while blocked update the protected recovery copy.
await assert.rejects(engine.updateBanner({ quote: 'LATER-LOCAL-EDIT' }));
assert.ok(
	JSON.parse([...backup.entries()].find(([name]) => name.includes('/conflicts/'))[1]).local.includes(
		'LATER-LOCAL-EDIT',
	),
);
await engine.reloadFromDisk();
assert.equal(engine.getData().banner.author, 'EXTERNAL-AUTHOR-CHANGE');
await engine.updateBanner({ quote: 'AFTER-REVIEW' });
assert.equal(parse(disk).banner.quote, 'AFTER-REVIEW');
assert.equal(parse(disk).banner.author, 'EXTERNAL-AUTHOR-CHANGE');
// Backup failure must retain local edits even when an external modify event arrives.
const writeBackup = app.vault.adapter.write;
app.vault.adapter.write = async () => {
	throw Error('backup unavailable');
};
await assert.rejects(engine.updateBanner({ quote: 'RETRY-AFTER-BACKUP-FAILURE' }), /backup unavailable/);
const changed = parse(disk);
changed.banner.author = 'SECOND-EXTERNAL-EDIT';
await app.vault.modify(file, serialize(changed));
await new Promise((r) => setTimeout(r, 350));
assert.equal(engine.getData().banner.quote, 'RETRY-AFTER-BACKUP-FAILURE');
assert.equal(parse(disk).banner.author, 'SECOND-EXTERNAL-EDIT');
app.vault.adapter.write = writeBackup;
await assert.rejects(engine.updateBanner({ quote: 'RETRY-AFTER-BACKUP-FAILURE' }));
assert.ok(
	[...backup.values()].some(
		(text) => text.includes('RETRY-AFTER-BACKUP-FAILURE') && text.includes('SECOND-EXTERNAL-EDIT'),
	),
);
await engine.reloadFromDisk();
await engine.updateBanner({ quote: 'RECOVERED' });
assert.equal(parse(disk).banner.quote, 'RECOVERED');
engine.destroy();
console.log('Dashboard conflict: external file and local recovery preserved; reload resumes safe writes');
