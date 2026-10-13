import { realpath, mkdtemp, mkdir, symlink, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { absoluteNandPath } from './nand-paths';
import { privateTextStorage } from './private-mode';

test('Windows junctions and POSIX symlinks cannot redirect owned writes outside .nand', async () => {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-path-')));
	try {
		await mkdir(path.join(root, 'vault/.nand'), { recursive: true }); await mkdir(path.join(root, 'outside'));
		await writeFile(path.join(root, 'outside/keep'), 'keep');
		await symlink(path.join(root, 'outside'), path.join(root, 'vault/.nand/link'), process.platform === 'win32' ? 'junction' : 'dir');
		await expect(absoluteNandPath(path.join(root, 'vault'), '.nand/link/keep')).rejects.toThrow('symlink');
		const storage = privateTextStorage({ exists: async () => true, read: async () => '', mkdir: async () => {}, write: async (name, text) => { await writeFile(path.join(root, 'vault', name), text); } }, path.join(root, 'vault'));
		await expect(storage.write('.nand/link/keep', 'bad')).rejects.toThrow('symlink');
		expect(await readFile(path.join(root, 'outside/keep'), 'utf8')).toBe('keep');
		await expect(absoluteNandPath(path.join(root, 'vault'), '.nand/config/../../outside')).rejects.toThrow('invalid-path');
		expect(await absoluteNandPath(path.join(root, 'vault'), '.nand/config/new.json')).toBe(path.join(root, 'vault/.nand/config/new.json'));
	} finally { await rm(root, { recursive: true, force: true }); }
});
