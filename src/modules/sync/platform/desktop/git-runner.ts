import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
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
			const signal = combine(lifetime.signal, options.signal);
			return new Promise((resolve, reject) => {
				const child = execFile(
					binary,
					['-c', 'core.quotepath=off', '-c', 'color.ui=false', ...args],
					{ cwd, env: gitEnv(options.env), timeout: options.timeoutMs ?? DEFAULT_TIMEOUT, maxBuffer: MAX_BUFFER, windowsHide: true, signal, encoding: 'utf8' },
					(error, stdout, stderr) => {
						if (!error) return resolve({ code: 0, stdout, stderr });
						const failure = error as NodeJS.ErrnoException & { code?: string | number; killed?: boolean; signal?: string };
						if (failure.code === 'ENOENT') return reject(new GitError('missing-git', binary));
						if (failure.name === 'AbortError' || signal.aborted) return reject(new GitError('cancelled'));
						if (failure.killed || failure.signal === 'SIGTERM') return reject(new GitError('timeout', args[0] ?? ''));
						if (failure.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return reject(new GitError('unknown', 'output too large'));
						resolve({ code: typeof failure.code === 'number' ? failure.code : 1, stdout, stderr });
					},
				);
				if (options.input !== undefined) child.stdin?.end(options.input);
				else child.stdin?.end();
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

/** Aborts when either signal does (`AbortSignal.any` is missing from older Electron builds). */
function combine(first: AbortSignal, second?: AbortSignal): AbortSignal {
	if (!second) return first;
	const controller = new AbortController();
	const abort = () => controller.abort();
	if (first.aborted || second.aborted) abort();
	first.addEventListener('abort', abort, { once: true });
	second.addEventListener('abort', abort, { once: true });
	return controller.signal;
}

/** This computer's name, for `{{hostname}}` in commit messages. */
export function machineName(): string {
	try {
		return hostname();
	} catch {
		return '';
	}
}
