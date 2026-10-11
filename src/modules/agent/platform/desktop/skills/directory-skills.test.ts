import { expect, test, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanDirectorySkills } from './directory-skills';

const home = vi.hoisted(() => ({ path: '', reads: 0 }));
vi.mock('node:os', async original => ({ ...await original<typeof import('node:os')>(), homedir: () => { home.reads++; return home.path; } }));

test('only configured absolute roots and explicit tilde paths are read, with partial errors retained', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-skill-directories-'));
	home.path = root; home.reads = 0;
	try {
		await mkdir(path.join(root, 'skills', 'folder'), { recursive: true });
		await writeFile(path.join(root, 'skills', 'folder', 'SKILL.md'), '---\nname: external-review\n---\nname: body-name\n');
		expect(await scanDirectorySkills([])).toEqual({ entries: [], unavailable: [] });expect(home.reads).toBe(0);
		const result = await scanDirectorySkills(['~/skills', 'not-absolute']);
		expect(result.entries).toEqual([{ name: 'external-review', sources: [{ kind: 'directory', path: path.join(root, 'skills', 'folder', 'SKILL.md') }] }]);
		expect(result.unavailable).toEqual(['not-absolute']);expect(home.reads).toBe(1);
	} finally { await rm(root, { recursive: true, force: true }); }
});
