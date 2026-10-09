/** What the sync core needs from the host: a git process runner bound to one working directory. */
export interface GitResult {
	code: number;
	stdout: string;
	stderr: string;
}

export interface GitRunOptions {
	/** Written to the process's standard input (commit messages). */
	input?: string;
	/** Extra environment variables for this call. */
	env?: Readonly<Record<string, string>>;
	/** Kill the process after this many milliseconds (the runner has a default). */
	timeoutMs?: number;
	signal?: AbortSignal;
}

export interface GitRunner {
	/**
	 * Run `git <args>` in the working directory. Resolves with any exit code; rejects with a `GitError` only when
	 * the process could not run (git missing), timed out or was cancelled.
	 */
	run(args: readonly string[], options?: GitRunOptions): Promise<GitResult>;
	/** Whether a path (absolute, or relative to the working directory) exists. */
	exists(path: string): Promise<boolean>;
}

/** Where the repository is relative to the vault. */
export interface RepoPlace {
	/** Directory git runs in: the vault, or a folder inside it. */
	cwd: string;
	/** Repository root, or null when `cwd` is not inside a repository. */
	root: string | null;
	/** The vault path of a repository path, or null when the file is outside the vault. */
	toVault(repoPath: string): string | null;
	/** The repository path of a vault path, or null when it is outside the repository. */
	toRepo(vaultPath: string): string | null;
}

/** This device's automatic-sync bookkeeping. Kept inside the git directory, so it is never committed or synced. */
export interface DeviceSyncState {
	/** Epoch ms of the last automatic commit-and-sync, pull and push. */
	lastCommit: number;
	lastPull: number;
	lastPush: number;
	/** `manual`: paused by the user; `failures`: paused after repeated automatic failures. */
	paused: '' | 'manual' | 'failures';
	failures: number;
}

export const EMPTY_DEVICE_STATE: DeviceSyncState = { lastCommit: 0, lastPull: 0, lastPush: 0, paused: '', failures: 0 };

export function normalizeDeviceState(raw: unknown): DeviceSyncState {
	const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const time = (key: string) => {
		const entry = value[key];
		return typeof entry === 'number' && Number.isFinite(entry) ? entry : 0;
	};
	return {
		lastCommit: time('lastCommit'),
		lastPull: time('lastPull'),
		lastPush: time('lastPush'),
		paused: value.paused === 'manual' || value.paused === 'failures' ? value.paused : '',
		failures: Math.max(0, Math.floor(time('failures'))),
	};
}

/** The desktop facilities sync needs: finding git and the repository, running git, and this device's state file. */
export interface GitHost {
	locate(gitPath: string): Promise<{ binary: string; version: string } | null>;
	place(binary: string, subPath: string): Promise<RepoPlace>;
	runner(binary: string, cwd: string): GitRunner & { dispose(): void };
	hostname(): string;
	/** Read and write JSON at an absolute path (the state file inside the git directory). */
	readJson(path: string): Promise<unknown>;
	writeJson(path: string, value: unknown): Promise<void>;
	/** Absolute path of `relative` from `cwd`. */
	resolve(cwd: string, relative: string): string;
}
