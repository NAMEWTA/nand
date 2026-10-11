import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { prepareSessionDirectory, confirmSessionDirectory, retainLegacyDirectory } from './browser-session-migration';

const race = vi.hoisted(() => ({ source: '', before: undefined as (() => Promise<void>) | undefined, after: undefined as (() => Promise<void>) | undefined, copy: undefined as ((target: string) => Promise<void>) | undefined }));
vi.mock('node:fs/promises', async original => {
	const actual = await original<typeof import('node:fs/promises')>();
	return { ...actual, rename: async (from: string, to: string) => {
		if (from === race.source) await race.before?.();
		await actual.rename(from, to);
		if (from === race.source) await race.after?.();
	}, copyFile: async (from: string, to: string) => { await race.copy?.(to); await actual.copyFile(from, to); } };
});

test('a recipient interrupted by shared-source retirement recovers its verified backup or explicitly chooses fresh', async () => {
	for (const backupReady of [false, true]) {
		const root = await mkdtemp(path.join(tmpdir(), 'nand-session-interleave-')), source = path.join(root, 'source'), a = path.join(root, 'a'), b = path.join(root, 'b');
		await mkdir(source); await mkdir(a); await mkdir(b); await writeFile(path.join(source, 'Cookies'), 'original');
		const options = { source, relative: '.nand/browser/device/profiles/home-web', boot: 'one', active: () => false, ambiguous: true, choose: async () => 'copy' as const };
		try {
			for (const vault of [a,b]) await expect(prepareSessionDirectory({ ...options, vault })).rejects.toThrow('browser_session_restart');
			await prepareSessionDirectory({ ...options, vault: a, boot: 'two' }); await confirmSessionDirectory(a, options.relative, 'two');
			race.copy = async target => {
				if (!target.includes(backupReady ? 'session-copy' : 'legacy-original')) return;
				race.copy = undefined; await prepareSessionDirectory({ ...options, vault: a, boot: 'three' });
			};
			await expect(prepareSessionDirectory({ ...options, vault: b, boot: 'two' })).rejects.toMatchObject({ code: 'ENOENT' });
			let chosen = false;
			const target = await prepareSessionDirectory({ ...options, vault: b, boot: 'three', choose: async () => { chosen = true; return 'fresh'; } });
			expect(chosen).toBe(!backupReady);
			if (backupReady) expect(await readFile(path.join(target, 'Cookies'), 'utf8')).toBe('original');
			else expect(await readdir(target)).toEqual([]);
		} finally { race.copy = undefined; await rm(root, { recursive: true, force: true }); }
	}
}, 30000);

test('source changes at retirement keep the actual moved version and never delete a replacement source', async () => {
	for (const legacy of [false, true]) for (const replaced of [false, true]) {
		const root = await mkdtemp(path.join(tmpdir(), 'nand-session-race-')), vault = path.join(root, 'vault'), source = path.join(root, 'old');
		await mkdir(vault); await mkdir(source); await writeFile(path.join(source, 'Cookies'), 'original');
		const options = { vault, source, relative: '.nand/browser/device/profiles/default', boot: 'one', active: () => false };
		try {
			if (!legacy) {
				await expect(prepareSessionDirectory(options)).rejects.toThrow('browser_session_restart');
				await prepareSessionDirectory({ ...options, boot: 'two' });
				await confirmSessionDirectory(vault, options.relative, 'two');
			}
			race.source = source;
			const change = async () => { await mkdir(source, { recursive: true }); await writeFile(path.join(source, 'Cookies'), 'concurrent'); };
			if (replaced) race.after = change; else race.before = change;
			const run = () => legacy ? retainLegacyDirectory(vault, '.nand/browser/device/legacy-runtime', source) : prepareSessionDirectory({ ...options, boot: 'three' });
			await expect(run()).rejects.toThrow('browser_session_source_changed');
			if (replaced) expect(await readFile(path.join(source, 'Cookies'), 'utf8')).toBe('concurrent');
			race.before = undefined; race.after = undefined;
			if (replaced) expect(await readFile(path.join(source, 'Cookies'), 'utf8')).toBe('concurrent');
			else {
				const claimed = (await readdir(root)).find(name => name.startsWith('.nand-retired-'))!;
				expect(await readFile(path.join(root, claimed, 'Cookies'), 'utf8')).toBe('concurrent');
			}
			await expect(run()).rejects.toThrow('browser_session_source_changed');
		} finally { race.source = ''; race.before = undefined; race.after = undefined; await rm(root, { recursive: true, force: true }); }
	}
});
