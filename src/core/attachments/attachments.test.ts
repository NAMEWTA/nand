import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AttachmentError, DEFAULT_ATTACHMENT_PATH_POLICY, type AttachmentFilePort, type AttachmentImportRequest, type AttachmentPathPolicy } from './model.ts';
import { attachmentName, attachmentTimestamp, MAX_ATTACHMENT_NAME_BYTES, normalizeAttachmentExtension, utf8Length } from './naming.ts';
import { normalizeAttachmentVaultPath, relativeAttachmentPath, resolveAttachmentDirectory } from './path-policy.ts';
import { attachmentMarkdownLink } from './markdown-link.ts';
import { AttachmentImportService } from './import-service.ts';
import { attachmentRelocationDecision } from './organization.ts';

const NOW = new Date(2026, 9, 4, 15, 30, 45).getTime();
const PREFIX = '20261004153045';
const policy = (overrides: Partial<AttachmentPathPolicy> = {}): AttachmentPathPolicy => ({
	...DEFAULT_ATTACHMENT_PATH_POLICY, ...overrides,
});
const errorCode = (code: string) => (error: unknown) => error instanceof AttachmentError && error.code === code;
const binary = (value = 1): ArrayBuffer => new Uint8Array([value]).buffer;
const request = (ids: string[] = ['one'], overrides: Partial<AttachmentImportRequest> = {}): AttachmentImportRequest => ({
	notePath: '项目/方案.md', nowMs: NOW, policy: policy(),
	items: ids.map((id) => ({ id, extension: 'png', readBytes: async () => binary() })), ...overrides,
});
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}
class MemoryFiles implements AttachmentFilePort {
	readonly files = new Map<string, number[]>();
	readonly directories: string[] = [];
	readonly attempts: string[] = [];
	async ensureDirectory(path: string): Promise<void> { this.directories.push(path); }
	async createNewBinary(path: string, data: ArrayBuffer): Promise<'created' | 'exists'> {
		this.attempts.push(path);
		if (this.files.has(path)) return 'exists';
		this.files.set(path, Array.from(new Uint8Array(data)));
		return 'created';
	}
}

test('default directory is adjacent to the source note, not a global bucket', () => {
	assert.deepEqual(resolveAttachmentDirectory('项目/方案.md'), {
		directory: '项目/assets', template: 'assets', source: 'default', matchedPath: null,
	});
	assert.equal(resolveAttachmentDirectory('方案.md').directory, 'assets');
});
test('all three directory layouts', () => {
	assert.equal(resolveAttachmentDirectory('项目/方案.md', policy({ defaultTemplate: 'assets/{note}' })).directory, '项目/assets/方案');
	assert.equal(resolveAttachmentDirectory('项目/方案.md', policy({ defaultTemplate: '{note}.assets' })).directory, '项目/方案.assets');
});
test('item override wins over note and ancestors', () => {
	const p = policy({ noteOverrides: { 'a/b/n.md': 'note' }, folderOverrides: { a: 'parent', 'a/b': 'nearest' } });
	assert.deepEqual(resolveAttachmentDirectory('a/b/n.md', p, 'chosen'), {
		directory: 'a/b/chosen', template: 'chosen', source: 'item', matchedPath: null,
	});
	assert.equal(resolveAttachmentDirectory('a/b/n.md', p).directory, 'a/b/note');
});
test('closest ancestor wins, root fallback is still note-relative', () => {
	const p = policy({ folderOverrides: { '': 'root-choice', a: 'parent', 'a/b': 'nearest' } });
	const closest = resolveAttachmentDirectory('a/b/n.md', p);
	assert.equal(closest.directory, 'a/b/nearest');
	assert.equal(closest.matchedPath, 'a/b');
	assert.equal(resolveAttachmentDirectory('a/c/n.md', p).directory, 'a/c/parent');
	assert.equal(resolveAttachmentDirectory('other/n.md', p).directory, 'other/root-choice');
});
test('inherited object properties never become rules', () => {
	const inherited = Object.create({ 'a/n.md': 'bad' }) as Record<string, string>;
	assert.equal(resolveAttachmentDirectory('a/n.md', policy({ noteOverrides: inherited })).source, 'default');
});
test('explicit blank override is invalid rather than silently using a global default', () => {
	assert.throws(() => resolveAttachmentDirectory('a.md', policy(), ''), errorCode('invalid-template'));
	assert.throws(() => resolveAttachmentDirectory('a.md', policy({ noteOverrides: { 'a.md': ' ' } })), errorCode('invalid-template'));
});
test('relative parent directories remain inside the Vault', () => {
	assert.equal(resolveAttachmentDirectory('a/b/n.md', policy(), '../images').directory, 'a/images');
	assert.equal(resolveAttachmentDirectory('a/n.md', policy(), '..').directory, '');
	assert.throws(() => resolveAttachmentDirectory('n.md', policy(), '../images'), errorCode('path-outside-vault'));
	assert.throws(() => resolveAttachmentDirectory('a/n.md', policy(), '../../images'), errorCode('path-outside-vault'));
});
for (const value of ['/tmp', '\\server', 'C:\\images', 'D:images', '//server/share']) {
	test(`rejects non-Vault absolute path ${JSON.stringify(value)}`, () => {
		assert.throws(() => resolveAttachmentDirectory('a/n.md', policy(), value), errorCode('invalid-path'));
	});
}
for (const value of ['.nand', '.obsidian', '.trash', '.git', '.NAND/sub']) {
	test(`rejects protected root ${value}`, () => {
		assert.throws(() => resolveAttachmentDirectory('n.md', policy(), value), errorCode('protected-path'));
	});
}
for (const value of ['con', 'AUX.txt', 'lpt9', 'invalid?', 'bad.', 'bad ', 'bad:name']) {
	test(`rejects nonportable directory ${JSON.stringify(value)}`, () => {
		assert.throws(() => resolveAttachmentDirectory('n.md', policy(), value), errorCode('invalid-path'));
	});
}
test('unknown variables are rejected, braces originating in note names are literal', () => {
	assert.throws(() => resolveAttachmentDirectory('n.md', policy(), 'assets/{unknown}'), errorCode('invalid-template'));
	assert.equal(resolveAttachmentDirectory('{draft}.md', policy(), 'assets/{note}').directory, 'assets/{draft}');
	assert.equal(resolveAttachmentDirectory('CON.md', policy(), 'assets/{note}').directory, 'assets/_CON');
});
test('path normalization preserves literal percent signs and uses whole segments', () => {
	assert.equal(normalizeAttachmentVaultPath('a\\b/../c%20d.png'), 'a/c%20d.png');
	assert.equal(resolveAttachmentDirectory('a/b/n.md', policy({ folderOverrides: { 'a/bc': 'wrong' } })).source, 'default');
	assert.throws(() => normalizeAttachmentVaultPath('../../a'), errorCode('path-outside-vault'));
	assert.throws(() => resolveAttachmentDirectory('a.pdf'), errorCode('invalid-note'));
});
test('timestamp uses the captured device-local 24-hour time', () => {
	assert.equal(attachmentTimestamp(NOW), PREFIX);
	assert.equal(attachmentTimestamp(new Date(2026, 0, 2, 0, 3, 4).getTime()), '20260102000304');
	for (const invalid of [NaN, Infinity, -Infinity, 1e30]) assert.throws(() => attachmentTimestamp(invalid), errorCode('invalid-timestamp'));
});
test('empty name does not append source filename or extra dash', () => {
	assert.equal(attachmentName(PREFIX, 'png').filename, `${PREFIX}.png`);
	assert.equal(attachmentName(PREFIX, 'png', '  ').filename, `${PREFIX}.png`);
	assert.equal(attachmentName(PREFIX, '').filename, PREFIX);
});
test('custom names, duplicate extensions, and differing extensions', () => {
	assert.equal(attachmentName(PREFIX, '.PNG', '架构图').filename, `${PREFIX}-架构图.png`);
	assert.equal(attachmentName(PREFIX, 'png', '架构图.PNG ').filename, `${PREFIX}-架构图.png`);
	assert.equal(attachmentName(PREFIX, 'pdf', 'archive.zip').filename, `${PREFIX}-archive.zip.pdf`);
	assert.equal(attachmentName(PREFIX, 'tar.gz', 'archive.tar.gz').filename, `${PREFIX}-archive.tar.gz`);
});
test('name sanitization is visible and cannot inject directories', () => {
	const name = attachmentName(PREFIX, 'png', '../a\\b:*?\u0000x.');
	assert.equal(name.filename, `${PREFIX}-.._a_b_x.png`);
	assert.ok(name.warnings.includes('name-sanitized'));
	assert.equal(attachmentName(PREFIX, 'png', 'CON').filename, `${PREFIX}-CON.png`);
	assert.equal(attachmentName(PREFIX, 'png', '..').filename, `${PREFIX}.png`);
});
test('Unicode normalization and broken surrogate input', () => {
	assert.equal(attachmentName(PREFIX, 'png', 'e\u0301').filename, `${PREFIX}-é.png`);
	assert.equal(attachmentName(PREFIX, 'png', '\ud800A').filename, `${PREFIX}-_A.png`);
});
test('long Unicode names reserve the suffix and do not split code points', () => {
	const name = attachmentName(PREFIX, 'png', '图😀'.repeat(100), 1000);
	assert.ok(utf8Length(name.filename) <= MAX_ATTACHMENT_NAME_BYTES);
	assert.ok(name.filename.endsWith('-1000.png'));
	assert.ok(name.warnings.includes('name-truncated'));
	assert.doesNotThrow(() => encodeURIComponent(name.filename));
	assert.equal(utf8Length('a图😀'), 8);
});
test('sequence never wraps at 999 and invalid input is rejected', () => {
	assert.equal(attachmentName(PREFIX, 'png', '', 1).filename, `${PREFIX}-001.png`);
	assert.equal(attachmentName(PREFIX, 'png', '图', 1000).filename, `${PREFIX}-图-1000.png`);
	for (const n of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => attachmentName(PREFIX, 'png', '', n), errorCode('invalid-sequence'));
	assert.throws(() => attachmentName('now', 'png'), errorCode('invalid-timestamp'));
});
test('extension normalization does not turn a bad type into an apparently valid file', () => {
	for (const ext of ['.', '..png', 'png/../x', 'png ', ' png', 'a\n', 'x:', 'a'.repeat(226)]) {
		assert.throws(() => normalizeAttachmentExtension(ext), errorCode('invalid-extension'));
	}
	assert.equal(normalizeAttachmentExtension('.PDF'), 'pdf');
	assert.equal(attachmentName(PREFIX, 'a'.repeat(225)).filename.length, 240);
});
test('relative links encode path syntax once, including hashes and literal percentages', () => {
	assert.equal(relativeAttachmentPath('a/b/n.md', 'a/assets/i.png'), '../assets/i.png');
	assert.equal(relativeAttachmentPath('n.md', 'assets/i.png'), 'assets/i.png');
	assert.equal(attachmentMarkdownLink('a/n.md', 'a/assets/a #?%(x).png', { embed: true, label: '图[一]\\\n<ok>' }),
		'![图\\[一\\]\\\\ \\<ok\\>](assets/a%20%23%3F%25%28x%29.png)');
	assert.equal(attachmentMarkdownLink('a/n.md', 'a/assets/中文.pdf', { embed: false, label: '说明' }),
		'[说明](assets/%E4%B8%AD%E6%96%87.pdf)');
});
test('batch uses names and directories from the original request in input order', async () => {
	const files = new MemoryFiles();
	const service = new AttachmentImportService(files);
	const result = await service.importBatch(request(['a', 'b']));
	assert.equal(result.status, 'completed');
	assert.deepEqual(result.items.map((item) => item.status === 'created' && item.path), [
		`项目/assets/${PREFIX}.png`, `项目/assets/${PREFIX}-001.png`,
	]);
});
test('existing file bytes are never overwritten', async () => {
	const files = new MemoryFiles();
	const path = `项目/assets/${PREFIX}.png`;
	files.files.set(path, [9]);
	const result = await new AttachmentImportService(files).importBatch(request());
	assert.deepEqual(files.files.get(path), [9]);
	assert.equal(result.items[0]?.status, 'created');
	assert.deepEqual(files.files.get(`项目/assets/${PREFIX}-001.png`), [1]);
});
test('read errors preserve successful item order and do not create false links', async () => {
	const files = new MemoryFiles();
	const error = new Error('read denied');
	const batch = request(['a', 'bad', 'c']);
	const result = await new AttachmentImportService(files).importBatch({ ...batch, items: batch.items.map((item) => item.id === 'bad'
		? { ...item, readBytes: async () => { throw error; } } : item) });
	assert.equal(result.status, 'partial');
	assert.deepEqual(result.items.map((item) => [item.id, item.status]), [['a', 'created'], ['bad', 'failed'], ['c', 'created']]);
	assert.deepEqual(result.items[1], { id: 'bad', status: 'failed', stage: 'read', error });
	assert.equal(files.files.size, 2);
});
test('one bad item path fails independently without a fallback directory', async () => {
	const files = new MemoryFiles();
	const batch = request(['bad', 'good']);
	const result = await new AttachmentImportService(files).importBatch({ ...batch, items: batch.items.map((item) => item.id === 'bad'
		? { ...item, directoryTemplate: '../../outside' } : item) });
	assert.equal(result.status, 'partial');
	const first = result.items[0];
	assert.equal(first?.status, 'failed');
	if (first?.status === 'failed') assert.equal(first.stage, 'prepare');
	assert.equal(files.files.size, 1);
	assert.deepEqual(files.directories, ['项目/assets']);
});
test('directory errors and unknown write errors are not treated as name collisions', async () => {
	const directoryError = new Error('directory denied');
	let attempts = 0;
	const first = await new AttachmentImportService({
		ensureDirectory: async () => { throw directoryError; },
		createNewBinary: async () => { attempts++; return 'created'; },
	}).importBatch(request());
	assert.deepEqual(first.items[0], { id: 'one', status: 'failed', stage: 'directory', error: directoryError });
	assert.equal(attempts, 0);
	const writeError = new Error('disk full');
	const second = await new AttachmentImportService({
		ensureDirectory: async () => {},
		createNewBinary: async () => { attempts++; throw writeError; },
	}).importBatch(request());
	assert.deepEqual(second.items[0], { id: 'one', status: 'failed', stage: 'create', error: writeError });
	assert.equal(attempts, 1);
});
test('collision budget is finite and never chooses another directory', async () => {
	const paths: string[] = [];
	const result = await new AttachmentImportService({
		ensureDirectory: async () => {},
		createNewBinary: async (path) => { paths.push(path); return 'exists'; },
	}, 3).importBatch(request());
	assert.equal(paths.length, 3);
	assert.ok(paths.every((path) => path.startsWith('项目/assets/')));
	const failure = result.items[0];
	assert.equal(failure?.status, 'failed');
	if (failure?.status === 'failed') assert.ok(errorCode('name-space-exhausted')(failure.error));
});
test('duplicate IDs and invalid timestamps fail before any filesystem work', async () => {
	const files = new MemoryFiles();
	const service = new AttachmentImportService(files);
	await assert.rejects(service.importBatch(request(['same', 'same'])), errorCode('invalid-batch'));
	await assert.rejects(service.importBatch(request(['a'], { nowMs: NaN })), errorCode('invalid-timestamp'));
	assert.equal(files.files.size, 0);
	assert.deepEqual(files.directories, []);
});
test('queued batches are serialized and capture path/name settings immediately', async () => {
	const files = new MemoryFiles();
	const started = deferred<void>();
	const release = deferred<ArrayBuffer>();
	const service = new AttachmentImportService(files);
	const first = service.importBatch(request(['first'], { items: [{ id: 'first', extension: 'png', readBytes: () => { started.resolve(); return release.promise; } }] }));
	await started.promise;
	const mutablePolicy = { defaultTemplate: 'chosen', noteOverrides: {}, folderOverrides: {} };
	const mutableItem = { id: 'second', extension: 'pdf', customName: '原名', readBytes: async () => binary(2) };
	const second = service.importBatch(request(['second'], { policy: mutablePolicy, items: [mutableItem] }));
	mutablePolicy.defaultTemplate = 'wrong';
	mutableItem.customName = '错名';
	mutableItem.extension = 'png';
	release.resolve(binary(1));
	await first;
	const result = await second;
	assert.equal(result.items[0]?.status, 'created');
	assert.ok(files.files.has(`项目/chosen/${PREFIX}-原名.pdf`));
	assert.equal(files.files.size, 2);
});
test('concurrent batches do not reuse a filename', async () => {
	const files = new MemoryFiles();
	const service = new AttachmentImportService(files);
	await Promise.all(Array.from({ length: 20 }, (_, index) => service.importBatch(request([String(index)]))));
	assert.equal(files.files.size, 20);
	assert.ok(files.files.has(`项目/assets/${PREFIX}-019.png`));
});
test('a rejected read does not poison later batches', async () => {
	const files = new MemoryFiles();
	const service = new AttachmentImportService(files);
	await service.importBatch(request(['bad'], { items: [{ id: 'bad', extension: 'png', readBytes: async () => { throw new Error('bad'); } }] }));
	assert.equal((await service.importBatch(request())).status, 'completed');
});
test('cancel before admission performs no IO', async () => {
	const files = new MemoryFiles();
	const result = await new AttachmentImportService(files).importBatch(request(['a', 'b']), () => true);
	assert.equal(result.status, 'cancelled');
	assert.equal(files.files.size, 0);
	assert.deepEqual(files.directories, []);
});
test('cancel during read stops before directory and file creation', async () => {
	const files = new MemoryFiles();
	const started = deferred<void>();
	const release = deferred<ArrayBuffer>();
	let cancelled = false;
	const result = new AttachmentImportService(files).importBatch(request(['a'], { items: [{ id: 'a', extension: 'png', readBytes: () => { started.resolve(); return release.promise; } }] }), () => cancelled);
	await started.promise;
	cancelled = true;
	release.resolve(binary());
	assert.equal((await result).status, 'cancelled');
	assert.deepEqual(files.directories, []);
	assert.equal(files.files.size, 0);
});
test('stop seals new work synchronously but reports an already-started successful write', async () => {
	const writeStarted = deferred<void>();
	const finishWrite = deferred<'created' | 'exists'>();
	let writes = 0;
	const service = new AttachmentImportService({
		ensureDirectory: async () => {},
		createNewBinary: () => { writes++; writeStarted.resolve(); return finishWrite.promise; },
	});
	const active = service.importBatch(request(['first', 'later']));
	await writeStarted.promise;
	const queued = service.importBatch(request(['queued']));
	const drain = service.stop();
	assert.equal((await service.importBatch(request(['new']))).status, 'cancelled');
	finishWrite.resolve('created');
	const result = await active;
	assert.equal(result.status, 'partial');
	assert.deepEqual(result.items.map((item) => item.status), ['created', 'cancelled']);
	assert.equal((await queued).status, 'cancelled');
	await drain;
	assert.equal(writes, 1);
});
test('independent service instances do not share lifecycle state', async () => {
	const one = new AttachmentImportService(new MemoryFiles());
	const two = new AttachmentImportService(new MemoryFiles());
	await one.stop();
	assert.equal((await two.importBatch(request())).status, 'completed');
});
test('empty batch is completed without filesystem work', async () => {
	const files = new MemoryFiles();
	assert.deepEqual(await new AttachmentImportService(files).importBatch(request([])), { status: 'completed', items: [] });
	assert.equal(files.files.size, 0);
});
test('shared or incomplete references never authorize a move', () => {
	assert.deepEqual(attachmentRelocationDecision('n.md', 'assets/a.png', 'other/a.png', { complete: true, notePaths: ['n.md', 'other.md'] }), { action: 'copy', reason: 'shared-reference' });
	assert.deepEqual(attachmentRelocationDecision('n.md', 'assets/a.png', 'other/a.png', { complete: false, notePaths: ['n.md'] }), { action: 'copy', reason: 'incomplete-references' });
	assert.deepEqual(attachmentRelocationDecision('n.md', 'assets/a.png', 'other/a.png', { complete: true, notePaths: [] }), { action: 'copy', reason: 'not-owned' });
});
test('only a complete exclusive reference allows a single-file move', () => {
	assert.deepEqual(attachmentRelocationDecision('n.md', 'assets/a.png', 'other/a.png', { complete: true, notePaths: ['n.md', './n.md'] }), { action: 'move', reason: 'exclusive-reference' });
	assert.deepEqual(attachmentRelocationDecision('n.md', 'assets/a.png', './assets/a.png', { complete: false, notePaths: [] }), { action: 'keep', reason: 'same-path' });
});
test('unexpected port responses do not authorize collision retries', async () => {
	let attempts = 0;
	const port = {
		ensureDirectory: async () => {},
		createNewBinary: async () => { attempts++; return 'unknown'; },
	} as unknown as AttachmentFilePort;
	const result = await new AttachmentImportService(port).importBatch(request());
	const item = result.items[0];
	assert.equal(item?.status, 'failed');
	if (item?.status === 'failed') assert.ok(errorCode('invalid-create-result')(item.error));
	assert.equal(attempts, 1);
});
test('explicit root directory does not ask the port to create an empty directory', async () => {
	const files = new MemoryFiles();
	const result = await new AttachmentImportService(files).importBatch(request(['root'], {
		items: [{ id: 'root', extension: 'pdf', directoryTemplate: '..', readBytes: async () => binary() }],
	}));
	assert.equal(result.status, 'completed');
	assert.ok(files.files.has(`${PREFIX}.pdf`));
	assert.deepEqual(files.directories, []);
});
test('cancellation during directory creation reports no file creation', async () => {
	const started = deferred<void>();
	const finish = deferred<void>();
	let cancelled = false;
	let writes = 0;
	const result = new AttachmentImportService({
		ensureDirectory: () => { started.resolve(); return finish.promise; },
		createNewBinary: async () => { writes++; return 'created'; },
	}).importBatch(request(), () => cancelled);
	await started.promise;
	cancelled = true;
	finish.resolve();
	assert.equal((await result).status, 'cancelled');
	assert.equal(writes, 0);
});
test('deterministic Unicode naming corpus preserves filesystem invariants', () => {
	const alphabet = Array.from('汉字😀e\u0301 ./\\:?*<>|"\r\n_%#[]{}()\ud800');
	let state = 79;
	for (let sample = 0; sample < 256; sample++) {
		let raw = '';
		for (let index = 0; index < 200; index++) {
			state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
			raw += alphabet[state % alphabet.length];
		}
		const { filename } = attachmentName(PREFIX, 'png', raw, sample);
		assert.ok(filename.startsWith(PREFIX));
		assert.ok(filename.endsWith('.png'));
		assert.doesNotMatch(filename, /[\x00-\x1f<>:"/\\|?*]/);
		assert.equal(utf8Length(filename), Buffer.byteLength(filename));
		assert.ok(Buffer.byteLength(filename) <= MAX_ATTACHMENT_NAME_BYTES);
	}
});
