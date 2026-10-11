import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { prepareSessionDirectory, confirmSessionDirectory, retainLegacyDirectory, clearSessionRecovery } from './browser-session-migration';

const fault = vi.hoisted(() => ({ enabled: false, at: 0, steps: 0, after: false }));
vi.mock('node:fs/promises', async original => {
	const actual = await original<Record<string, unknown>>();
	const wrapped = Object.fromEntries(['mkdir', 'writeFile', 'copyFile', 'rename', 'unlink', 'rmdir', 'chmod'].map(name => [name, async (...args: unknown[]) => {
		const step = fault.enabled ? ++fault.steps : 0;
		const fail = () => { if (step && step === fault.at) throw new Error('fixture-io-fault'); };
		if (!fault.after) fail();
		const result = await (actual[name] as (...values: unknown[]) => Promise<unknown>)(...args);
		if (fault.after) fail();
		return result;
	}]));
	return { ...actual, ...wrapped };
});
async function fixture(initialize = true) {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-session-recovery-')), vault = path.join(root, 'vault'), source = path.join(root, 'host', 'old');
	await mkdir(vault); await mkdir(path.join(source, 'IndexedDB'), { recursive: true });
	await writeFile(path.join(source, 'Cookies'), 'credential'); await writeFile(path.join(source, 'IndexedDB', 'data'), 'user-data');
	await writeFile(path.join(root, 'host', 'unrelated'), 'keep');
	const options = { vault, source, relative: '.nand/browser/device/profiles/default', boot: 'one', active: () => false };
	if (initialize) await expect(prepareSessionDirectory(options)).rejects.toThrow('browser_session_restart');
	return { root, options };
}
test('every persistent mutation can fail before or after it without losing source data or replaying a completed copy', async () => {
	const baseline = await fixture(); let steps = 0;
	try {
		fault.enabled = true; fault.steps = 0;
		await prepareSessionDirectory({ ...baseline.options, boot: 'two' });
		await confirmSessionDirectory(baseline.options.vault, baseline.options.relative, 'two');
		await prepareSessionDirectory({ ...baseline.options, boot: 'three' });
		steps = fault.steps;
	} finally { fault.enabled = false; await rm(baseline.root, { recursive: true, force: true }); }
	expect(steps).toBeGreaterThan(10);
	for (const after of [false, true]) for (let at = 1; at <= steps; at++) {
		const { root, options } = await fixture();
		try {
			Object.assign(fault, { enabled: true, at, after, steps: 0 });
			try { await prepareSessionDirectory({ ...options, boot: 'two' }); await confirmSessionDirectory(options.vault, options.relative, 'two'); await prepareSessionDirectory({ ...options, boot: 'three' }); }
			catch (error) { expect(String(error)).toContain('fixture-io-fault'); }
			fault.enabled = false;
			const target = await prepareSessionDirectory({ ...options, boot: 'four' });
			await confirmSessionDirectory(options.vault, options.relative, 'four');
			await prepareSessionDirectory({ ...options, boot: 'five' });
			expect(await readFile(path.join(target, 'Cookies'), 'utf8'), `${after}:${at}`).toBe('credential');
			expect(await readFile(path.join(target, 'IndexedDB', 'data'), 'utf8')).toBe('user-data');
			expect(await readFile(path.join(root, 'host', 'unrelated'), 'utf8')).toBe('keep');
			await expect(readdir(options.source)).rejects.toMatchObject({ code: 'ENOENT' });
			expect(await readFile(path.join(options.vault, options.relative, 'legacy-original', 'Cookies'), 'utf8')).toBe('credential');
			await writeFile(path.join(target, 'Cookies'), 'new-credential');
			await prepareSessionDirectory({ ...options, boot: 'six' });
			expect(await readFile(path.join(target, 'Cookies'), 'utf8')).toBe('new-credential');
		} finally { fault.enabled = false; await rm(root, { recursive: true, force: true }); }
	}
}, 120000);

test('interrupted account cleanup remains retryable without recreating the old credentials', async () => {
	const setup = async () => {
		const row = await fixture(); await prepareSessionDirectory({ ...row.options, boot: 'two' }); return row;
	};
	const baseline = await setup(); let steps = 0;
	try { Object.assign(fault, { enabled: true, steps: 0, at: 0 }); await clearSessionRecovery(baseline.options); steps = fault.steps; }
	finally { fault.enabled = false; await rm(baseline.root, { recursive: true, force: true }); }
	for (const after of [false, true]) for (let at = 1; at <= steps; at++) {
		const { root, options } = await setup();
		try {
			Object.assign(fault, { enabled: true, at, after, steps: 0 });
			try { await clearSessionRecovery(options); } catch (error) { expect(String(error)).toContain('fixture-io-fault'); }
			fault.enabled = false;
			await prepareSessionDirectory({ ...options, boot: 'three' });
			await clearSessionRecovery(options);
			await expect(readdir(options.source)).rejects.toMatchObject({ code: 'ENOENT' });
			await expect(readdir(path.join(options.vault, options.relative, 'legacy-original'))).rejects.toMatchObject({ code: 'ENOENT' });
			expect(await readFile(path.join(root, 'host', 'unrelated'), 'utf8')).toBe('keep');
		} finally { fault.enabled = false; await rm(root, { recursive: true, force: true }); }
	}
}, 120000);

test('every first-receipt mutation recovers, including a valid null backup without a primary', async () => {
	for (const legacy of [false, true]) {
		const start = async (options: Awaited<ReturnType<typeof fixture>>['options']) => {
			if (legacy) await retainLegacyDirectory(options.vault, '.nand/browser/device/legacy-runtime', options.source);
			else try { await prepareSessionDirectory(options); } catch (error) { if (String(error).includes('browser_session_restart')) return; throw error; }
		};
		const baseline = await fixture(false); let steps = 0;
		try { Object.assign(fault, { enabled: true, steps: 0, at: 0 }); await start(baseline.options); steps = fault.steps; }
		finally { fault.enabled = false; await rm(baseline.root, { recursive: true, force: true }); }
		for (const after of [false, true]) for (let at = 1; at <= steps; at++) {
			const { root, options } = await fixture(false);
			try {
				Object.assign(fault, { enabled: true, at, after, steps: 0 });
				try { await start(options); } catch (error) { expect(String(error)).toContain('fixture-io-fault'); }
				fault.enabled = false;
				await start(options);
				const target = legacy ? await retainLegacyDirectory(options.vault, '.nand/browser/device/legacy-runtime', options.source) : await prepareSessionDirectory({ ...options, boot: 'two' });
				expect(await readFile(path.join(target!, 'Cookies'), 'utf8'), `${legacy}:${after}:${at}`).toBe('credential');
			} finally { fault.enabled = false; await rm(root, { recursive: true, force: true }); }
		}
	}
}, 120000);
