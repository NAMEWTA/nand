import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, test } from 'vitest';
import type { TextStorage } from '../../shared/storage/ports';
import { chmodAllowed, privatePathHasSymlink, privateTextStorage, tightenPrivateAbsolute } from './private-mode';

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
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

describe('private storage modes', () => {
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
});

function exists(file: string): boolean {
	try {
		lstatSync(file);
		return true;
	} catch {
		return false;
	}
}
