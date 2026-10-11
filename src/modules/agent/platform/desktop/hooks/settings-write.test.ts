import path from 'node:path';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { writeHookSettings } from './settings-write';

const check = async () => {};
const merge = (raw?: string) => JSON.stringify({ ...JSON.parse(raw ?? '{}'), hooks: 'installed' });

test('a recreated provider file wins publication and both versions survive the retry', async () => {
	const root = await fs.mkdtemp(path.join(tmpdir(), 'nand-hook-publish-')), file = path.join(root, 'settings.json');
	await fs.writeFile(file, '{"original":true}');
	const wrapped = { ...fs, link: async (from: string, to: string) => {
		if (from.endsWith(path.sep + 'next')) await fs.writeFile(to, '{"external":true}');
		return fs.link(from, to);
	} };
	try {
		await expect(writeHookSettings(wrapped, file, merge, check)).rejects.toThrow();
		expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ external: true });
		expect(JSON.parse(await fs.readFile(file + '.nand-install/original', 'utf8'))).toEqual({ original: true });
		await writeHookSettings(fs, file, merge, check);
		expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ external: true, hooks: 'installed' });
		const backups = await fs.readdir(root);
		const versions = await Promise.all(backups.filter(name => name.startsWith('settings.json.nand-backup-')).map(name => fs.readFile(path.join(root, name, 'original'), 'utf8')));
		expect(versions).toContain('{"original":true}');
		expect(versions).toContain('{"external":true}');
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('an interrupted publish and failed immediate restore preserve the original for the next installation', async () => {
	const root = await fs.mkdtemp(path.join(tmpdir(), 'nand-hook-recover-')), file = path.join(root, 'settings.json');
	await fs.writeFile(file, '{"custom":"kept"}');
	const failure = () => Promise.reject(Object.assign(new Error('injected I/O failure'), { code: 'EIO' }));
	try {
		await expect(writeHookSettings({ ...fs, link: failure, copyFile: failure }, file, merge, check)).rejects.toThrow('injected');
		await expect(fs.readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await fs.readFile(file + '.nand-install/original', 'utf8')).toBe('{"custom":"kept"}');
		await writeHookSettings(fs, file, merge, check);
		expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ custom: 'kept', hooks: 'installed' });
	} finally { await fs.rm(root, { recursive: true, force: true }); }
});
