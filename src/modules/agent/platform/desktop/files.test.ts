import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { expect, test, vi } from 'vitest';
vi.mock('electron', () => ({ shell: {}, webUtils: {} }));
import { resolveReference } from './files';

test('ordinary vault links remain available when another device migration receipt is corrupt', async () => {
	const vault = await mkdtemp(path.join(tmpdir(), 'nand-file-link-'));
	try {
		await mkdir(path.join(vault, '.nand/browser/other/legacy-runtime'), { recursive: true });
		await writeFile(path.join(vault, '.nand/browser/other/legacy-runtime/migration.json'), 'corrupt');
		await writeFile(path.join(vault, 'ordinary.md'), 'note');
		expect(await resolveReference('ordinary.md', vault, vault)).toEqual({ kind: 'vault', path: 'ordinary.md' });
	} finally { await rm(vault, { recursive: true, force: true }); }
});

test('home links follow the actual shell or agent session rather than the host user', async () => {
	const vault = await mkdtemp(path.join(tmpdir(), 'nand-home-link-'));
	try {
		for (const account of ['default', 'named', 'shell', 'restored']) {
			const home = path.join(vault, '.nand', account, 'home');
			await mkdir(home, { recursive: true }); await writeFile(path.join(home, 'file'), account);
			expect(await resolveReference('~/file', vault, vault, home)).toEqual({ kind: 'external', path: path.join(home, 'file') });
		}
		expect(await resolveReference('~/file', vault, vault)).toBeNull();
	} finally { await rm(vault, { recursive: true, force: true }); }
});
