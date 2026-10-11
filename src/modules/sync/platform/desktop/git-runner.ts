import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { setTimeout as setProcessTimeout, clearTimeout as clearProcessTimeout } from 'node:timers';
import { GitError } from '../../core/errors';
import type { GitResult, GitRunner, GitRunOptions } from '../../core/ports';

const DEFAULT_TIMEOUT = 2 * 60_000;
const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * The environment every git call gets. Prompts are off, so a missing credential fails at once instead of
 * waiting for a terminal that does not exist; messages are in English so failures can be classified.
 */
function gitEnv(extra?: Readonly<Record<string, string>>): Record<string, string | undefined> {
	return {
		...process.env,
		GIT_TERMINAL_PROMPT: '0',
		GCM_INTERACTIVE: 'never',
		LC_ALL: 'C',
		LANGUAGE: 'C',
		GIT_PAGER: 'cat',
		PAGER: 'cat',
		// Never open an editor: messages come from NAND, and continuing a rebase keeps git's own message.
		GIT_EDITOR: 'true',
		...extra,
	};
}

export interface DesktopGitRunner extends GitRunner {
	/** Kill running git processes and refuse new ones. */
	dispose(): void;
}

/** Runs the system git in `cwd`. Each call is its own process; `dispose` kills whatever is still running. */
export function createGitRunner(binary: string, cwd: string): DesktopGitRunner {
	const lifetime = new AbortController();
	return {
		run(args: readonly string[], options: GitRunOptions = {}): Promise<GitResult> {
			if (lifetime.signal.aborted) return Promise.reject(new GitError('cancelled'));
			const { signal, release } = combine(lifetime.signal, options.signal);
			if (signal.aborted) { release(); return Promise.reject(new GitError('cancelled')); }
			return new Promise((resolve, reject) => {
				let child: ReturnType<typeof spawn>;
				try {
					child = spawn(binary, ['-c', 'core.quotepath=off', '-c', 'color.ui=false', ...args], {
						cwd, env: gitEnv(options.env), windowsHide: true, detached: process.platform !== 'win32', stdio: 'pipe',
					});
				} catch (error) { release(); reject(error instanceof Error ? error : new Error(String(error))); return; }
				const stdout: string[] = [], stderr: string[] = [];
				let bytes = 0;
				let failure: GitError | undefined;
				let termination: Promise<void> | undefined;
				const stop = (reason: GitError) => {
					if (termination) return;
					failure = reason;
					termination = terminateTree(child).catch(() => {
						child.kill();
						failure = new GitError('unknown', 'Could not terminate the Git process tree');
					});
				};
				const abort = () => stop(new GitError('cancelled'));
				const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT;
				const timer = timeout > 0 ? setProcessTimeout(() => stop(new GitError('timeout', args[0] ?? '')), timeout) : undefined;
				const collect = (output: string[], text: string) => {
					bytes += Buffer.byteLength(text);
					if (bytes > MAX_BUFFER) stop(new GitError('unknown', 'output too large'));
					else output.push(text);
				};
				child.stdout?.setEncoding('utf8').on('data', (text: string) => collect(stdout, text));
				child.stderr?.setEncoding('utf8').on('data', (text: string) => { collect(stderr, text); options.onProgress?.(text); });
				child.once('error', (error: NodeJS.ErrnoException) => { failure = new GitError(error.code === 'ENOENT' ? 'missing-git' : 'unknown', error.code ?? ''); });
				child.once('close', (code) => {
					clearProcessTimeout(timer);
					signal.removeEventListener('abort', abort);
					release();
					void (termination ?? Promise.resolve()).then(() => {
						if (failure) reject(failure);
						else resolve({ code: code ?? 1, stdout: stdout.join(''), stderr: stderr.join('') });
					});
				});
				// A command can finish before consuming stdin; its exit status determines the result.
				child.stdin?.on('error', () => {});
				if (options.input !== undefined) child.stdin?.end(options.input);
				else child.stdin?.end();
				signal.addEventListener('abort', abort, { once: true });
				if (signal.aborted) abort();
			});
		},
		async exists(target: string): Promise<boolean> {
			try {
				await access(path.resolve(cwd, target));
				return true;
			} catch {
				return false;
			}
		},
		dispose() {
			lifetime.abort();
		},
	};
}

/** Keep the root alive until Windows has enumerated its descendants; on POSIX, own one process group. */
async function terminateTree(child: ChildProcess): Promise<void> {
	const pid = child.pid;
	if (!pid) return;
	if (process.platform === 'win32') {
		await new Promise<void>((resolve, reject) => {
			execFile(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'), ['/pid', String(pid), '/t', '/f'], { windowsHide: true }, error => {
				if (error && child.exitCode === null && child.signalCode === null) reject(new Error('Could not terminate the Git process tree'));
				else resolve();
			});
		});
		return;
	}
	const kill = (signal: NodeJS.Signals): boolean => {
		try { process.kill(-pid, signal); return true; }
		catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
	};
	if (!kill('SIGTERM')) return;
	await delay(250);
	kill('SIGKILL');
}

/** Aborts when either signal does (`AbortSignal.any` is missing from older Electron builds). */
function combine(first: AbortSignal, second?: AbortSignal): { signal: AbortSignal; release: () => void } {
	if (!second) return { signal: first, release() {} };
	const controller = new AbortController();
	const abort = () => controller.abort();
	if (first.aborted || second.aborted) abort();
	first.addEventListener('abort', abort, { once: true });
	second.addEventListener('abort', abort, { once: true });
	return { signal: controller.signal, release() {
		first.removeEventListener('abort', abort);
		second.removeEventListener('abort', abort);
	} };
}

/** This computer's name, for `{{hostname}}` in commit messages. */
export function machineName(): string {
	try {
		return hostname();
	} catch {
		return '';
	}
}
