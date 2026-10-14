import { expect, test } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { createPrecheckRunner } from './precheck';
import { checkPrecheckDirectories, preparePrecheckDirectories } from './precheck-directories';

const win = { setTimeout, clearTimeout } as unknown as Window;
const homeRelative = '.nand/automation/device/precheck-home';
async function fixture() {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-precheck-paths-')));
	const vault = path.join(root, 'vault'),
		outside = path.join(root, 'outside');
	await mkdir(vault);
	await mkdir(outside);
	const run = () =>
		createPrecheckRunner(
			vault,
			'device',
			win,
		)({
			precheck: {
				shell: 'bash',
				command: 'printf started > launched.txt; printf leaked > "$XDG_STATE_HOME/leaked.txt"',
			},
			cwd: '.',
			signal: new AbortController().signal,
			timeoutMs: 2000,
		});
	return { root, vault, outside, home: path.join(vault, homeRelative), run };
}
const targets = [
	'.nand',
	'.nand/automation',
	'.nand/automation/device',
	homeRelative,
	...[
		'.config',
		'.cache',
		'.local',
		'.local/share',
		'.local/state',
		'runtime',
		'AppData',
		'AppData/Roaming',
		'AppData/Local',
		'tmp',
		'tmp/claude',
		'.claude',
		'.codex',
		'.gemini',
		'.grok',
		'.pi',
		'.pi/sessions',
		'.config/opencode',
	].map((p) => `${homeRelative}/${p}`),
];
test.each(targets)('rejects a preexisting link at %s before any outside mkdir or command', async (relative) => {
	const f = await fixture();
	try {
		const link = path.join(f.vault, relative);
		await mkdir(path.dirname(link), { recursive: true });
		await symlink(f.outside, link, process.platform === 'win32' ? 'junction' : 'dir');
		await expect(f.run()).rejects.toMatchObject({ code: 'precheckDirectoryUnsafe' });
		expect(await readdir(f.outside)).toEqual([]);
		await expect(readFile(path.join(f.vault, 'launched.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
	} finally {
		await rm(f.root, { recursive: true, force: true });
	}
});
test.each(['inside', 'dangling', 'file'] as const)(
	'also rejects an %s HOME instead of following or replacing it',
	async (mode) => {
		const f = await fixture();
		try {
			await mkdir(path.dirname(f.home), { recursive: true });
			if (mode === 'file') await writeFile(f.home, 'keep');
			else {
				const target = path.join(f.vault, '.nand', mode);
				if (mode === 'inside') await mkdir(target);
				await symlink(target, f.home, process.platform === 'win32' ? 'junction' : 'dir');
			}
			await expect(f.run()).rejects.toMatchObject({ code: 'precheckDirectoryUnsafe' });
			expect(await readdir(f.outside)).toEqual([]);
			await expect(readFile(path.join(f.vault, 'launched.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
			if (mode === 'file') expect(await readFile(f.home, 'utf8')).toBe('keep');
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	},
);
test('rejects lexical escape before creating any directory and rechecks prepared paths before use', async () => {
	const f = await fixture();
	try {
		await expect(preparePrecheckDirectories(f.vault, [path.join(f.outside, 'new')])).rejects.toMatchObject({
			code: 'precheckDirectoryUnsafe',
		});
		expect(await readdir(f.outside)).toEqual([]);
		const state = path.join(f.home, '.local/state');
		await preparePrecheckDirectories(f.vault, [state]);
		await rm(state, { recursive: true });
		await symlink(f.outside, state, process.platform === 'win32' ? 'junction' : 'dir');
		await expect(checkPrecheckDirectories(f.vault, [state])).rejects.toMatchObject({
			code: 'precheckDirectoryUnsafe',
		});
		expect(await readdir(f.outside)).toEqual([]);
	} finally {
		await rm(f.root, { recursive: true, force: true });
	}
});
test.skipIf(process.platform === 'win32')(
	'checks existing directories on each run and permits retry after the link is removed',
	async () => {
		const f = await fixture();
		try {
			expect((await f.run()).exitCode).toBe(0);
			const state = path.join(f.home, '.local/state');
			expect(await readFile(path.join(state, 'leaked.txt'), 'utf8')).toBe('leaked');
			await rm(path.join(f.vault, 'launched.txt'));
			await rm(state, { recursive: true });
			await symlink(f.outside, state);
			await expect(f.run()).rejects.toMatchObject({ code: 'precheckDirectoryUnsafe' });
			expect(await readdir(f.outside)).toEqual([]);
			await expect(readFile(path.join(f.vault, 'launched.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
			await rm(state);
			expect((await f.run()).exitCode).toBe(0);
			expect(await readFile(path.join(state, 'leaked.txt'), 'utf8')).toBe('leaked');
			expect(await readdir(f.outside)).toEqual([]);
		} finally {
			await rm(f.root, { recursive: true, force: true });
		}
	},
);
