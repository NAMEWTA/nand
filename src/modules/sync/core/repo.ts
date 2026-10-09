import { classifyGitOutput, detailOf, GitError } from './errors';
import { pathWithinScope, safeRepoPath, type GitResult, type GitRunner, type GitRunOptions } from './ports';
import { parsePathList, parseStatus, type RepoStatus } from './status';

/** A merge, rebase, cherry-pick or revert that stopped and waits for the user. */
export type RepoOperation = 'merge' | 'rebase' | 'cherry-pick' | 'revert';

export interface Upstream {
	remote: string;
	/** Full ref on the remote, e.g. `refs/heads/main`. */
	ref: string;
}

export interface Commit {
	hash: string;
	short: string;
	author: string;
	/** Unix seconds. */
	time: number;
	subject: string;
}

export interface CommitFile {
	status: string;
	path: string;
	from?: string;
}

/** The tree of an empty commit; diffs against it list every file. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
/** Network operations may move large attachments. */
export const NETWORK_TIMEOUT = 10 * 60_000;
const DIFF_LIMIT = 200_000;

/** Typed git commands for one repository. Every method runs git through the runner; nothing here touches the host. */
export class GitRepo {
	constructor(private readonly runner: GitRunner, private readonly scope = '.') {}

	/** Run git; a non-zero exit (other than `allow`) becomes a classified `GitError`. */
	async git(args: readonly string[], options: GitRunOptions & { allow?: readonly number[] } = {}): Promise<GitResult> {
		const result = await this.runner.run(args, options);
		if (result.code !== 0 && !options.allow?.includes(result.code))
			throw new GitError(classifyGitOutput(`${result.stderr}\n${result.stdout}`), detailOf(result.stdout, result.stderr));
		return result;
	}

	async status(): Promise<RepoStatus> {
		// Optional locks off: a status refresh never takes index.lock away from another git process.
		const result = await this.git(['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'], { env: { GIT_OPTIONAL_LOCKS: '0' } });
		return parseStatus(result.stdout);
	}

	/** The stopped operation, if any, and whether another git process holds the index lock. */
	async state(): Promise<{ operation: RepoOperation | null; locked: boolean }> {
		const names = ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'index.lock'];
		const result = await this.git(['rev-parse', ...names.flatMap((name) => ['--git-path', name])]);
		const paths = result.stdout.split(/\r?\n/).filter(Boolean);
		const exists = await Promise.all(paths.map((path) => this.runner.exists(path)));
		const [merge, rebaseMerge, rebaseApply, cherryPick, revert, lock] = exists;
		const operation: RepoOperation | null = rebaseMerge || rebaseApply ? 'rebase' : merge ? 'merge' : cherryPick ? 'cherry-pick' : revert ? 'revert' : null;
		return { operation, locked: !!lock };
	}

	async head(): Promise<string | null> {
		const result = await this.git(['rev-parse', '-q', '--verify', 'HEAD'], { allow: [1, 128] });
		return result.code === 0 ? result.stdout.trim() : null;
	}

	async upstream(branch: string): Promise<Upstream | null> {
		const remote = await this.config(`branch.${branch}.remote`);
		const ref = await this.config(`branch.${branch}.merge`);
		return remote && ref ? { remote, ref } : null;
	}

	/**
	 * The one remote and ref a plain `git push` updates for this branch.
	 * Null when pushRemote, push.default, or the remote's push refspec does not name exactly one destination.
	 */
	async pushTarget(branch: string): Promise<Upstream | null> {
		const pushRemote = await this.config(`branch.${branch}.pushRemote`);
		const pushDefault = pushRemote ? '' : await this.config('remote.pushDefault');
		const upstreamRemote = await this.config(`branch.${branch}.remote`);
		const merge = await this.config(`branch.${branch}.merge`);
		const remote = pushRemote || pushDefault || upstreamRemote;
		if (!remote || !merge.startsWith('refs/')) return null;
		const mode = await this.config('push.default');
		const listed = await this.git(['config', '--get-all', `remote.${remote}.push`], { allow: [1] });
		const refspecs = listed.code === 0 ? listed.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
		if (refspecs.length > 1) return null;
		if (refspecs.length === 1) {
			const ref = onePushRef(refspecs[0]!, branch);
			return ref ? { remote, ref } : null;
		}
		if (mode === 'matching' || mode === 'nothing') return null;
		return { remote, ref: merge };
	}

	/** The fetched commit a push of `ref` to `remote` would fast-forward, or null when that tip is not present. */
	async remoteTip(remote: string, ref: string): Promise<string | null> {
		const name = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
		if (!name || name.includes('..') || name.startsWith('/') || remote.includes('/')) return null;
		const result = await this.git(['rev-parse', '-q', '--verify', `refs/remotes/${remote}/${name}^{commit}`], { allow: [1, 128] });
		return result.code === 0 ? result.stdout.trim() : null;
	}

	async remotes(): Promise<string[]> {
		return (await this.git(['remote'])).stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	}

	async remoteUrl(name: string): Promise<string> {
		return this.config(`remote.${name}.url`);
	}

	/** A config value, or '' when unset. */
	async config(key: string): Promise<string> {
		const result = await this.git(['config', '--get', key], { allow: [1] });
		return result.code === 0 ? result.stdout.trim() : '';
	}

	async setConfig(key: string, value: string): Promise<void> {
		await this.git(['config', key, value]);
	}

	/** Paths with staged changes. */
	async stagedPaths(): Promise<string[]> {
		return parsePathList((await this.git(['diff', '--cached', '--name-only', '-z'])).stdout);
	}

	/** Stage every change under the working directory (the vault), including deletions and new files. */
	async stageAll(): Promise<void> {
		await this.git(['add', '-A', '--', this.scope === '.' ? '.' : top(this.scope)]);
	}

	/** Staged paths that are outside the vault. Empty when the repository is the vault. */
	async stagedOutside(): Promise<string[]> {
		if (!this.scope || this.scope === '.') return [];
		return (await this.stagedPaths()).filter((repoPath) => !pathWithinScope(repoPath, this.scope));
	}

	private vaultPaths(paths: readonly string[]): string[] {
		const safe = paths.map((repoPath) => {
			const normalized = safeRepoPath(repoPath);
			return normalized && pathWithinScope(normalized, this.scope) ? normalized : null;
		});
		if (safe.some((repoPath) => !repoPath)) throw new GitError('outside-index', paths.join(', '));
		return safe.filter((repoPath): repoPath is string => !!repoPath);
	}

	async stage(paths: readonly string[]): Promise<void> {
		const safe = this.vaultPaths(paths);
		if (safe.length) await this.git(['add', '-A', '--', ...safe.map(top)]);
	}

	async unstage(paths: readonly string[]): Promise<void> {
		const safe = this.vaultPaths(paths);
		if (!safe.length) return;
		if (await this.head()) await this.git(['restore', '--staged', '--', ...safe.map(top)]);
		// Before the first commit there is no HEAD to restore from; dropping the index entries is the same thing.
		else await this.git(['rm', '--cached', '-q', '-r', '--', ...safe.map(top)]);
	}

	async unstageAll(): Promise<void> {
		const scope = !this.scope || this.scope === '.' ? '.' : this.scope;
		if (await this.head()) await this.git(['restore', '--staged', '--', top(scope)]);
		else await this.git(['rm', '--cached', '-q', '-r', '--', top(scope)], { allow: [128] });
	}

	/** Restore tracked files in the working tree from the index (unstaged edits are lost). */
	async discard(paths: readonly string[]): Promise<void> {
		const safe = this.vaultPaths(paths);
		if (safe.length) await this.git(['restore', '--worktree', '--', ...safe.map(top)]);
	}

	async commit(message: string, options: { allowEmpty?: boolean } = {}): Promise<void> {
		const outside = await this.stagedOutside();
		if (outside.length) throw new GitError('outside-index', outside.join(', '));
		await this.git(['commit', '-q', ...(options.allowEmpty ? ['--allow-empty'] : []), '-F', '-'], { input: message });
	}

	async fetch(remote?: string): Promise<void> {
		await this.git(['fetch', '--quiet', ...(remote ? [remote] : [])], { timeoutMs: NETWORK_TIMEOUT });
	}

	/** Commits on each side of `left...right`: [only in left, only in right]. Null when a side does not resolve. */
	async divergence(left: string, right: string): Promise<[number, number] | null> {
		const result = await this.git(['rev-list', '--left-right', '--count', `${left}...${right}`], { allow: [128] });
		if (result.code !== 0) return null;
		const [a, b] = result.stdout.trim().split(/\s+/).map(Number);
		return [a ?? 0, b ?? 0];
	}

	async revCount(range: string): Promise<number> {
		return Number((await this.git(['rev-list', '--count', range])).stdout.trim()) || 0;
	}

	async isAncestor(ancestor: string, descendant: string): Promise<boolean> {
		return (await this.git(['merge-base', '--is-ancestor', ancestor, descendant], { allow: [1] })).code === 0;
	}

	/** Files that differ between two commits (`from` null: every file in `to`). */
	async changedBetween(from: string | null, to: string): Promise<string[]> {
		return parsePathList((await this.git(['diff', '--name-only', '-z', from ?? EMPTY_TREE, to])).stdout);
	}

	/**
	 * Integrate the upstream into the current branch. Local edits that are not committed are stashed around it
	 * (`--autostash`), so committing only the staged part still syncs. Resolves false when it stopped on conflicts.
	 */
	async integrate(method: 'merge' | 'rebase'): Promise<boolean> {
		const args = method === 'merge' ? ['merge', '--no-edit', '--no-stat', '--autostash', '@{u}'] : ['rebase', '--autostash', '@{u}'];
		const result = await this.runner.run(args);
		if (result.code === 0) return true;
		const { operation } = await this.state();
		if (operation || (await this.status()).conflicted.length) return false;
		throw new GitError(classifyGitOutput(`${result.stderr}\n${result.stdout}`), detailOf(result.stdout, result.stderr));
	}

	async push(remote: string, refspec: string, setUpstream = false): Promise<void> {
		await this.git(['push', '--porcelain', ...(setUpstream ? ['-u'] : []), remote, refspec], { timeoutMs: NETWORK_TIMEOUT });
	}

	/** `git push` with no remote or refspec, so git uses the configured push target. */
	async pushConfigured(): Promise<void> {
		await this.git(['push', '--porcelain'], { timeoutMs: NETWORK_TIMEOUT });
	}

	/** Finish a stopped operation after its conflicts were resolved and staged. */
	async continueOperation(operation: RepoOperation): Promise<void> {
		if (operation === 'merge') await this.git(['commit', '-q', '--no-edit']);
		else await this.git([operation, '--continue'], { env: { GIT_EDITOR: 'true' } });
	}

	async abortOperation(operation: RepoOperation): Promise<void> {
		await this.git([operation, '--abort']);
	}

	/** Commit history, newest first. Empty before the first commit. */
	async log(skip: number, count: number): Promise<Commit[]> {
		if (!(await this.head())) return [];
		const result = await this.git(['log', `-n${count}`, `--skip=${skip}`, '-z', '--format=%H%x1f%h%x1f%an%x1f%at%x1f%s']);
		return result.stdout
			.split('\0')
			.filter(Boolean)
			.map((record) => {
				const [hash = '', short = '', author = '', time = '0', subject = ''] = record.replace(/^\n/, '').split('\x1f');
				return { hash, short, author, time: Number(time), subject };
			});
	}

	async commitFiles(hash: string): Promise<CommitFile[]> {
		const parts = (await this.git(['show', '--name-status', '-z', '--format=', '--no-renames', hash])).stdout.split('\0').filter(Boolean);
		const files: CommitFile[] = [];
		for (let i = 0; i + 1 < parts.length; i += 2) files.push({ status: parts[i]!.trim(), path: parts[i + 1]! });
		return files;
	}

	/** Unified diff of one file: working tree against the index, the index against HEAD (`staged`), or one commit. */
	async diff(path: string, source: { staged?: boolean; commit?: string } = {}): Promise<string> {
		const args = source.commit
			? ['show', '--no-color', '--no-ext-diff', '--format=', source.commit, '--', top(path)]
			: ['diff', '--no-color', '--no-ext-diff', ...(source.staged ? ['--cached'] : []), '--', top(path)];
		const text = (await this.git(args)).stdout;
		return text.length > DIFF_LIMIT ? `${text.slice(0, DIFF_LIMIT)}\n…` : text;
	}

	/** Unix seconds of the last commit, or null before the first one. */
	async lastCommitTime(): Promise<number | null> {
		if (!(await this.head())) return null;
		return Number((await this.git(['log', '-1', '--format=%ct'])).stdout.trim()) || null;
	}

	/** Refs other than `branch` that point at or build on `commit` (squashing would leave them behind). */
	async otherRefsContaining(commit: string, branch: string): Promise<string[]> {
		const result = await this.git(['for-each-ref', '--format=%(refname)', '--contains', commit, 'refs/heads', 'refs/tags']);
		return result.stdout.split(/\r?\n/).filter((ref) => ref && ref !== `refs/heads/${branch}`);
	}

	async listRange(range: string, merges = false): Promise<string[]> {
		return (await this.git(['rev-list', ...(merges ? ['--merges'] : []), range])).stdout.split(/\r?\n/).filter(Boolean);
	}

	async resetSoft(target: string): Promise<void> {
		await this.git(['reset', '-q', '--soft', target]);
	}

	async commitReusing(message: string): Promise<void> {
		await this.git(['commit', '-q', '-C', message]);
	}
}

/**
 * Paths from status are relative to the repository root. `top` makes git read them that way from any working
 * directory, and `literal` keeps `*`, `?` and `[` in file names from acting as wildcards.
 */
function top(path: string): string {
	return `:(top,literal)${path}`;
}

/** Destination of one non-wildcard refspec that publishes `branch`, or null when it does not. */
function onePushRef(spec: string, branch: string): string | null {
	const body = spec.startsWith('+') ? spec.slice(1) : spec;
	if (!body || body.includes('*')) return null;
	const colon = body.indexOf(':');
	const src = colon === -1 ? body : body.slice(0, colon);
	const dst = colon === -1 ? body : body.slice(colon + 1);
	if (!src || !dst.startsWith('refs/')) return null;
	if (src !== 'HEAD' && src !== `refs/heads/${branch}`) return null;
	return dst;
}
