import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import * as path from 'node:path';
import type { PrecheckRunner } from '../../core/precheck';
import { AutomationError } from '../../../../shared/automation/errors';
import { precheckEnvironment } from './precheck-environment';
import { ownedProcesses } from './precheck-processes';
import { windowsPrecheckCommand } from './precheck-windows';
import { precheckError } from './precheck-error';
import { preparePrecheckDirectories, checkPrecheckDirectories } from './precheck-directories';

/** Isolate precheck data paths and attempt to reclaim owned descendants; this is not a security sandbox. */
export function createPrecheckRunner(vault: string, deviceId: string, win: Window): PrecheckRunner {
	return async ({ precheck, cwd, signal, timeoutMs }) => {
		signal.throwIfAborted();
		const [root, target] = await Promise.all([realpath(vault), realpath(path.resolve(vault, cwd || '.'))]);
		const relative = path.relative(root, target);
		if (
			relative === '..' ||
			relative.startsWith(`..${path.sep}`) ||
			path.isAbsolute(relative) ||
			!(await stat(target)).isDirectory()
		)
			throw new AutomationError('cwdInvalid');
		const windows = process.platform === 'win32';
		const home = path.join(root, '.nand', 'automation', deviceId, 'precheck-home');
		const env = precheckEnvironment(home, process.env, windows);
		const directories = [
			...new Set(
				Object.values(precheckEnvironment(home, {}, windows)).filter(
					(value): value is string => !!value && value.startsWith(home),
				),
			),
		];
		await preparePrecheckDirectories(root, directories);
		await checkPrecheckDirectories(root, directories);
		signal.throwIfAborted();
		const owner = randomUUID();
		env.NAND_PRECHECK_OWNER = owner;
		const file = precheck.shell === 'bash' ? 'bash' : windows ? 'powershell.exe' : 'pwsh';
		const args =
			precheck.shell === 'bash'
				? ['--noprofile', '--norc', '-c', precheck.command]
				: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', precheck.command];
		return new Promise((resolve, reject) => {
			const child = spawn(
				windows ? 'powershell.exe' : file,
				windows ? windowsPrecheckCommand(file, args, target) : args,
				{
					cwd: target,
					detached: !windows,
					windowsHide: true,
					stdio: ['ignore', 'pipe', 'pipe'],
					env,
				},
			);
			const tree = child.pid && !windows ? ownedProcesses(child.pid, `NAND_PRECHECK_OWNER=${owner}`) : undefined;
			let output = '',
				timedOut = false,
				finishing = false;
			let timer: number | undefined, poll: number | undefined;
			let observation: Promise<unknown> = Promise.resolve();
			const append = (data: Buffer) => {
				output = (output + data.toString('utf8')).slice(-16_000);
			};
			child.stdout.on('data', append);
			child.stderr.on('data', append);
			const finish = async (exitCode: number | null, error?: unknown) => {
				if (finishing) return;
				finishing = true;
				if (timer !== undefined) win.clearTimeout(timer);
				if (poll !== undefined) win.clearTimeout(poll);
				signal.removeEventListener('abort', abort);
				try {
					await observation.catch(() => {});
					if (tree) await tree.terminate();
					else if (windows && child.pid && child.exitCode === null && child.signalCode === null) {
						await new Promise<void>((done, fail) => {
							execFile(
								'taskkill',
								['/pid', String(child.pid), '/T', '/F'],
								{ windowsHide: true, timeout: 1500 },
								(failure) =>
									failure && child.exitCode === null ? fail(precheckError(failure)) : done(),
							);
						});
					}
					if (error) reject(precheckError(error));
					else resolve({ exitCode, timedOut, output });
				} catch (failure) {
					reject(precheckError(failure));
				} finally {
					// Do not let inherited pipe handles extend a completed/failed cleanup indefinitely.
					child.stdout.destroy();
					child.stderr.destroy();
				}
			};
			const abort = () => {
				void finish(null);
			};
			const observe = () => {
				if (finishing || !tree) return;
				observation = tree.observe();
				void observation.then(
					() => {
						if (!finishing) poll = win.setTimeout(observe, 40);
					},
					(error: unknown) => {
						observation = Promise.resolve();
						void finish(null, error);
					},
				);
			};
			child.once('error', (error) => {
				void finish(null, error);
			});
			// 'exit', unlike 'close', is not held open by background descendants retaining stdout.
			child.once('exit', (code) => {
				void finish(code);
			});
			signal.addEventListener('abort', abort, { once: true });
			timer = win.setTimeout(() => {
				timedOut = true;
				void finish(null);
			}, timeoutMs);
			observe();
			if (signal.aborted) abort();
		});
	};
}
