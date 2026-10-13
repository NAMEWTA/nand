import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { checkOwnedDirectory } from './owned-permissions';

const change = vi.hoisted(() => ({ parent: '', from: '', to: '', link: '', changed: false }));
vi.mock('node:fs/promises', async original => {
	const actual = await original<typeof import('node:fs/promises')>();
	return { ...actual, readdir: async (...args: unknown[]) => {
		const rows = await (actual.readdir as (...args: unknown[]) => Promise<unknown>)(...args);
		if (args[0] === change.parent && !change.changed) {
			change.changed = true;
			await actual.rename(change.from, change.to);
			if (change.link) await actual.symlink(change.link, path.join(change.parent, 'late-link'), process.platform === 'win32' ? 'junction' : 'dir');
		}
		return rows;
	} };
});

test.each([false, true])('account tree checks rescan renamed hook directories and reject new links (link=%s)', async linked => {
	const vault = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-owned-check-'))), parent = path.join(vault, '.nand/account');
	const pending = path.join(parent, 'hooks.nand-install'), published = path.join(parent, 'hooks.nand-backup');
	const outside = path.join(vault, 'ordinary-notes');
	await mkdir(pending, { recursive: true }); await writeFile(path.join(pending, 'original'), 'kept');
	await mkdir(outside); await writeFile(path.join(outside, 'note.md'), 'untouched');
	Object.assign(change, { parent, from: pending, to: published, link: linked ? outside : '', changed: false });
	try {
		const checked = checkOwnedDirectory(vault, '.nand/account');
		if (linked) await expect(checked).rejects.toThrow('private-storage.symlink');
		else await expect(checked).resolves.toBeUndefined();
		expect(change.changed).toBe(true);
		expect(await readFile(path.join(published, 'original'), 'utf8')).toBe('kept');
		expect(await readFile(path.join(outside, 'note.md'), 'utf8')).toBe('untouched');
	} finally { change.parent = ''; await rm(vault, { recursive: true, force: true }); }
});
