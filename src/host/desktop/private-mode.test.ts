import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, test, vi } from 'vitest';
import type { TextStorage } from '../../shared/storage/ports';
import { chmodAllowed, privatePathHasSymlink, privateTextStorage, tightenPrivateAbsolute } from './private-mode';

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
	vi.restoreAllMocks();
});

function disk(root: string): TextStorage {
	return {
		async exists(relative) {
			try {
				lstatSync(path.join(root, relative));
				return true;
			} catch {
				return false;
			}
		},
		async read(relative) {
			return readFileSync(path.join(root, relative), 'utf8');
		},
		async write(relative, content) {
			mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
			writeFileSync(path.join(root, relative), content);
		},
		async mkdir(relative) {
			mkdirSync(path.join(root, relative), { recursive: true });
		},
	};
}

test('Windows keeps the native storage port and never performs POSIX repair', async () => {
	assert.equal(chmodAllowed('win32'), false);
	assert.equal(chmodAllowed('android'), false);
	assert.equal(chmodAllowed('ios'), false);
	assert.equal(chmodAllowed('unknown'), false);
	assert.equal(chmodAllowed('linux'), true);
	if (process.platform !== 'win32') return;
	const inner = disk('unused');
	assert.equal(privateTextStorage(inner, 'unused'), inner);
	assert.equal(await tightenPrivateAbsolute('unused', 'file'), 'skipped');
});

describe.skipIf(!chmodAllowed(process.platform))('POSIX private storage modes', () => {
	test('posix private files are 0700 and 0600, notes stay as written, and a symlink is not followed', async () => {
		assert.equal(chmodAllowed('win32'), false);
		assert.equal(chmodAllowed('linux'), true);
		const root = mkdtempSync(path.join(tmpdir(), 'nand-private-'));
		roots.push(root);
		const storage = privateTextStorage(disk(root), root);
		await storage.write('notes/plain.md', 'plain\n');
		const noteMode = lstatSync(path.join(root, 'notes/plain.md')).mode & 0o777;
		await storage.mkdir('.nand');
		await storage.write('.nand/config/settings.json', '{}\n');
		await storage.write('.nand/agent/history.sqlite', 'db');
		await storage.write('.nand/agent/history.sqlite-wal', 'wal');
		await storage.write('.nand/agent/history.sqlite-shm', 'shm');
		const mode = (relative: string) => (lstatSync(path.join(root, relative)).mode & 0o777).toString(8).padStart(3, '0');
		const measured = { dir: mode('.nand'), nested: mode('.nand/config'), file: mode('.nand/config/settings.json'), db: mode('.nand/agent/history.sqlite'), wal: mode('.nand/agent/history.sqlite-wal'), shm: mode('.nand/agent/history.sqlite-shm') };
		console.log(JSON.stringify(measured));
		assert.equal(measured.dir, '700');
		assert.equal(measured.nested, '700');
		assert.equal(measured.file, '600');
		assert.equal(measured.db, '600');
		assert.equal(measured.wal, '600');
		assert.equal(measured.shm, '600');
		assert.equal(readFileSync(path.join(root, 'notes/plain.md'), 'utf8'), 'plain\n');
		assert.equal(lstatSync(path.join(root, 'notes/plain.md')).mode & 0o777, noteMode);
		const outside = mkdtempSync(path.join(tmpdir(), 'nand-private-out-'));
		roots.push(outside);
		writeFileSync(path.join(outside, 'secret'), 'keep\n');
		symlinkSync(outside, path.join(root, '.nand', 'link'));
		await assert.rejects(storage.write('.nand/link/secret', 'changed\n'), /private-storage\.symlink/);
		assert.equal(readFileSync(path.join(outside, 'secret'), 'utf8'), 'keep\n');
		assert.equal(await privatePathHasSymlink(path.join(root, '.nand', 'link', 'secret')), true);
		assert.equal(await tightenPrivateAbsolute(path.join(root, 'missing-file'), 'file'), 'failed');
		assert.equal(exists(path.join(outside, 'secret')), true);
	});

	test('new files are private before the adapter writes, and legacy data is repaired before reads', async () => {
		const root = mkdtempSync(path.join(tmpdir(), 'nand-private-create-'));
		roots.push(root);
		const legacy = '.nand/config/settings.json';
		mkdirSync(path.join(root, '.nand/config'), { recursive: true, mode: 0o755 });
		writeFileSync(path.join(root, legacy), 'existing', { mode: 0o644 });
		const inner = disk(root);
		const write = inner.write;
		inner.write = async (relative, text) => {
			assert.equal(lstatSync(path.join(root, relative)).mode & 0o777, 0o600);
			assert.equal(lstatSync(path.dirname(path.join(root, relative))).mode & 0o777, 0o700);
			await write(relative, text);
		};
		const storage = privateTextStorage(inner, root);
		assert.equal(await storage.read(legacy), 'existing');
		assert.equal(lstatSync(path.join(root, legacy)).mode & 0o777, 0o600);
		await storage.write('.nand/notifications/device/inbox.json', 'private');
		await assert.rejects(storage.write('.nand/../note.md', 'escape'), /private-storage.path/);
		assert.equal(exists(path.join(root, 'note.md')), false);
	});

	test('root and intermediate links are rejected before mkdir, reads and writes, including in-vault targets', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		for (const linked of ['.nand', '.nand/config']) {
			const root = mkdtempSync(path.join(tmpdir(), 'nand-private-link-'));
			roots.push(root);
			const notes = path.join(root, 'notes');
			mkdirSync(notes, { mode: 0o755 });
			writeFileSync(path.join(notes, 'secret'), 'keep', { mode: 0o644 });
			mkdirSync(path.dirname(path.join(root, linked)), { recursive: true });
			symlinkSync(notes, path.join(root, linked));
			const storage = privateTextStorage(disk(root), root);
			await assert.rejects(storage.mkdir(`${linked}/new`), /private-storage.symlink/);
			await assert.rejects(storage.read(`${linked}/secret`), /private-storage.symlink/);
			await assert.rejects(storage.write(`${linked}/secret`, 'bad'), /private-storage.symlink/);
			assert.equal(exists(path.join(notes, 'new')), false);
			assert.equal(readFileSync(path.join(notes, 'secret'), 'utf8'), 'keep');
			assert.equal(lstatSync(path.join(notes, 'secret')).mode & 0o777, 0o644);
			assert.equal(lstatSync(notes).mode & 0o777, 0o755);
		}
	});
});

function exists(file: string): boolean {
	try {
		lstatSync(file);
		return true;
	} catch {
		return false;
	}
}
