import { expect, test } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { createPrecheckRunner } from './precheck';

const win = { setTimeout, clearTimeout } as unknown as Window;
test.skipIf(process.platform === 'win32')(
	'real Bash precheck captures exit/output, uses vault cwd/HOME and kills a timed-out process tree',
	async () => {
		const vault = await mkdtemp(path.join(tmpdir(), 'nand-precheck-'));
		try {
			await mkdir(path.join(vault, 'notes'));
			const run = createPrecheckRunner(vault, 'device', win),
				signal = new AbortController().signal;
			const result = await run({
				precheck: { shell: 'bash', command: 'pwd; printf "%s" "$HOME"; exit 7' },
				cwd: 'notes',
				signal,
				timeoutMs: 1000,
			});
			expect(result.exitCode).toBe(7);
			expect(result.output).toContain(path.join(vault, 'notes'));
			expect(result.output).toContain(path.join(vault, '.nand/automation/device/precheck-home'));
			const timeout = await run({
				precheck: { shell: 'bash', command: '(sleep 2; echo survived > escaped.txt) & wait' },
				cwd: 'notes',
				signal,
				timeoutMs: 50,
			});
			expect(timeout).toMatchObject({ timedOut: true, exitCode: null });
			await new Promise((resolve) => setTimeout(resolve, 2100));
			await expect(readFile(path.join(vault, 'notes/escaped.txt'), 'utf8')).rejects.toThrow();
			await symlink(tmpdir(), path.join(vault, 'escape'));
			await expect(
				run({ precheck: { shell: 'bash', command: 'true' }, cwd: 'escape', signal, timeoutMs: 1000 }),
			).rejects.toMatchObject({ code: 'cwdInvalid' });
		} finally {
			await rm(vault, { recursive: true, force: true });
		}
	},
);

// These review reproductions retain identifiable descendants; deliberately orphaned processes are not guaranteed.
test.skipIf(process.platform !== 'linux').each([
	['normal', '(sleep 0.7; echo survived > survivor.txt) >/dev/null 2>&1 & exit 0'],
	['detached-normal', "setsid bash -c 'sleep 0.7; echo survived > survivor.txt' >/dev/null 2>&1 & exit 0"],
	['timeout', "setsid bash -c 'sleep 0.7; echo survived > survivor.txt' & wait"],
	['abort', "setsid bash -c 'sleep 0.7; echo survived > survivor.txt' & wait"],
	['error-exit', "setsid bash -c 'sleep 0.7; echo survived > survivor.txt' >/dev/null 2>&1 & exit 7"],
])('reaps the identifiable descendants after %s without waiting for inherited pipes', async (mode, command) => {
	const vault = await mkdtemp(path.join(tmpdir(), 'nand-precheck-tree-'));
	const controller = new AbortController();
	const timer = mode === 'abort' ? setTimeout(() => controller.abort(), 100) : undefined;
	try {
		const start = Date.now();
		const result = await createPrecheckRunner(
			vault,
			'device',
			win,
		)({
			precheck: { shell: 'bash', command },
			cwd: '.',
			signal: controller.signal,
			timeoutMs: mode === 'timeout' ? 100 : 2000,
		});
		expect(Date.now() - start).toBeLessThan(650);
		expect(result.timedOut).toBe(mode === 'timeout');
		expect(result.exitCode).toBe(mode === 'error-exit' ? 7 : mode.includes('normal') ? 0 : null);
		await new Promise((resolve) => setTimeout(resolve, 800));
		await expect(readFile(path.join(vault, 'survivor.txt'), 'utf8')).rejects.toThrow();
	} finally {
		clearTimeout(timer);
		await rm(vault, { recursive: true, force: true });
	}
});
