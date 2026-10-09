/** `git status --porcelain=v2 --branch -z` as data. Paths are relative to the repository root. */

/** One side of a change: `.` unchanged, `M` modified, `A` added, `D` deleted, `R` renamed, `C` copied, `T` type changed, `U` unmerged. */
export type ChangeCode = '.' | 'M' | 'A' | 'D' | 'R' | 'C' | 'T' | 'U';

export interface FileChange {
	path: string;
	/** The previous path of a rename or copy. */
	from?: string;
	/** Index (staged) side. */
	index: ChangeCode;
	/** Working tree side. */
	worktree: ChangeCode;
}

export interface RepoStatus {
	/** HEAD commit, or null before the first commit. */
	head: string | null;
	/** Current branch, or null on a detached HEAD. */
	branch: string | null;
	/** `remote/branch`, or null without an upstream. */
	upstream: string | null;
	/** The upstream is configured but its remote branch no longer exists (or was never fetched). */
	upstreamGone: boolean;
	ahead: number;
	behind: number;
	staged: FileChange[];
	unstaged: FileChange[];
	untracked: string[];
	conflicted: FileChange[];
}

const code = (value: string | undefined): ChangeCode =>
	value && '.MADRCTU'.includes(value) ? (value as ChangeCode) : '.';

/** Split `count` space-separated fields off the front; the rest (which may contain spaces) is the path. */
function fields(entry: string, count: number): { parts: string[]; path: string } {
	const parts: string[] = [];
	let at = 0;
	for (let i = 0; i < count; i++) {
		const next = entry.indexOf(' ', at);
		if (next < 0) return { parts, path: '' };
		parts.push(entry.slice(at, next));
		at = next + 1;
	}
	return { parts, path: entry.slice(at) };
}

export function parseStatus(output: string): RepoStatus {
	const status: RepoStatus = {
		head: null,
		branch: null,
		upstream: null,
		upstreamGone: false,
		ahead: 0,
		behind: 0,
		staged: [],
		unstaged: [],
		untracked: [],
		conflicted: [],
	};
	let sawAheadBehind = false;
	const entries = output.split('\0');
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i]!;
		if (!entry) continue;
		if (entry.startsWith('# ')) {
			const [, key, ...rest] = entry.split(' ');
			const value = rest.join(' ');
			if (key === 'branch.oid') status.head = value === '(initial)' ? null : value;
			else if (key === 'branch.head') status.branch = value === '(detached)' ? null : value;
			else if (key === 'branch.upstream') status.upstream = value;
			else if (key === 'branch.ab') {
				sawAheadBehind = true;
				const match = /^\+(\d+) -(\d+)$/.exec(value);
				if (match) {
					status.ahead = Number(match[1]);
					status.behind = Number(match[2]);
				}
			}
			continue;
		}
		const type = entry[0];
		if (type === '?') {
			status.untracked.push(entry.slice(2));
			continue;
		}
		if (type === '1' || type === '2') {
			const { parts, path } = fields(entry, type === '1' ? 8 : 9);
			const xy = parts[1] ?? '..';
			const change: FileChange = { path, index: code(xy[0]), worktree: code(xy[1]) };
			// A rename or copy is followed by its original path as the next NUL-separated entry.
			if (type === '2') change.from = entries[++i];
			if (change.index !== '.') status.staged.push(change);
			if (change.worktree !== '.') status.unstaged.push(change);
			continue;
		}
		if (type === 'u') {
			const { parts, path } = fields(entry, 10);
			const xy = parts[1] ?? 'UU';
			status.conflicted.push({ path, index: code(xy[0]), worktree: code(xy[1]) });
		}
	}
	status.upstreamGone = !!status.upstream && !sawAheadBehind;
	return status;
}

/** Number of files with any change, conflicts included. */
export function changeCount(status: RepoStatus): number {
	const paths = new Set<string>();
	for (const change of [...status.staged, ...status.unstaged, ...status.conflicted]) paths.add(change.path);
	for (const path of status.untracked) paths.add(path);
	return paths.size;
}

/** NUL-separated path list (`--name-only -z`). */
export function parsePathList(output: string): string[] {
	return output.split('\0').filter(Boolean);
}
