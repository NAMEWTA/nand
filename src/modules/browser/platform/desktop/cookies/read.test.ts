import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCookieRows } from './read';
describe('isolated Cookie SQLite copies', () => {
	it.each([false, true])('copies WAL/SHM and removes private temporary files after failure=%s', async (failure) => {
		const root = await fs.mkdtemp(join(tmpdir(), 'nand-cookies-'));
		try {
			const source = join(root, 'original');
			await fs.writeFile(source, 'db');
			await fs.writeFile(source + '-wal', 'wal');
			await fs.writeFile(source + '-shm', 'shm');
			const result = readCookieRows(source, 'chromium', join(root, 'private'), {
				readCookies: async (path, kind) => {
					expect(path).not.toBe(source);
					expect(kind).toBe('chromium');
					expect(await fs.readFile(path, 'utf8')).toBe('db');
					expect(await fs.readFile(path + '-wal', 'utf8')).toBe('wal');
					expect(await fs.readFile(path + '-shm', 'utf8')).toBe('shm');
					if (failure) throw Error('reader failure');
					return { rows: [{ name: 'sid' }] };
				},
			});
			if (failure) await expect(result).rejects.toThrow('reader failure');
			else expect(await result).toEqual([{ name: 'sid' }]);
			expect(await fs.readdir(join(root, 'private'))).toEqual([]);
			expect(await fs.readFile(source, 'utf8')).toBe('db');
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});
});
