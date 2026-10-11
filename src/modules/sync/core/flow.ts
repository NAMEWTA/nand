/**
 * Commit, pull and push as separate, reported steps. The order and modes follow obsidian-git's `commitAndSync`
 * (src/main.ts, MIT, Vinzent03 and Denis Olehov); unlike it, a failed or conflicted pull stops the push, conflicts
 * stop the whole run, nothing is ever force-pushed, and there is no `reset` sync method.
 */
import { GitError, type GitErrorKind } from './errors';
import { resolveCommitMode, type CommitMode } from './commit-mode';
import type { GitRepo, RepoOperation } from './repo';
import type { RepoStatus } from './status';

export type StepName = 'commit' | 'pull' | 'push';
export type SkipReason = 'disabled' | 'no-upstream' | 'upstream-gone' | 'blocked' | 'cancelled' | 'nothing-staged';

export interface StepResult {
	step: StepName;
	/**
	 * `done`: committed, pulled or pushed `count` files/commits. `nothing`: no changes, already up to date or no
	 * commits to push. `conflict`: the pull stopped on conflicts. `skipped` has a `reason`; `failed` an `error`.
	 */
	state: 'done' | 'nothing' | 'skipped' | 'failed' | 'conflict';
	count?: number;
	reason?: SkipReason;
	error?: { kind: GitErrorKind; detail: string };
	/** Push only: the branch got its upstream in this run. */
	upstreamSet?: boolean;
	/** Push only: why unpushed commits were not squashed, or that they were. */
	squash?: SquashOutcome;
	/** A durable refs/nand/pre-squash pointer keeps this original history available after a failed push. */
	recovery?: { head: string; base: string };
}

export type SquashOutcome = 'squashed' | 'diverged' | 'staged' | 'single' | 'merges' | 'referenced' | 'target-mismatch';

export interface SyncOptions {
	mode: CommitMode;
	autoStageOnEmptyIndex: boolean;
	/** The commit message for these staged files; '' aborts the commit. */
	message: (files: readonly string[]) => string;
	pull: boolean;
	push: boolean;
	method: 'merge' | 'rebase';
	squash: boolean;
	/** Asked before the first push sets an upstream. Absent for automatic runs: they never ask and never set one. */
	confirmUpstream?: (remote: string, branch: string) => Promise<boolean>;
	/** Squash rewrites history only when this is the unique push remote and ref git will use. Absent: read that target from git. */
	pushTarget?: { remote: string; ref: string };
}

/** Why the repository cannot be synced right now, or null. Checked before anything is changed. */
export function blocker(status: RepoStatus, operation: RepoOperation | null): GitErrorKind | null {
	if (operation || status.conflicted.length) return 'conflict';
	if (!status.branch && status.head) return 'detached';
	return null;
}

const failed = (step: StepName, error: unknown): StepResult => ({
	step,
	state: 'failed',
	error: error instanceof GitError ? { kind: error.kind, detail: error.detail } : { kind: 'unknown', detail: error instanceof Error ? error.message : String(error) },
});

/** Commit (by `mode`), then pull and push as configured. Each step reports separately; later steps run only when it is safe. */
export async function commitAndSync(repo: GitRepo, options: SyncOptions): Promise<StepResult[]> {
	const status = await repo.status();
	const { operation } = await repo.state();
	const stop = blocker(status, operation);
	if (stop) return [{ step: 'commit', state: 'failed', error: { kind: stop, detail: operation ?? '' } }];
	const steps: StepResult[] = [];
	const commit = await commitStep(repo, status, options);
	steps.push(commit);
	if (commit.state === 'failed') return steps;
	const pull = options.pull ? await pullStep(repo, options.method) : { step: 'pull' as const, state: 'skipped' as const, reason: 'disabled' as const };
	steps.push(pull);
	if (pull.state === 'failed' || pull.state === 'conflict') {
		steps.push({ step: 'push', state: 'skipped', reason: 'blocked' });
		return steps;
	}
	steps.push(options.push ? await pushStep(repo, options) : { step: 'push', state: 'skipped', reason: 'disabled' });
	return steps;
}

/** Commit only. A commit that would include unresolved conflicts is refused. */
export async function commitStep(repo: GitRepo, status: RepoStatus, options: Pick<SyncOptions, 'mode' | 'autoStageOnEmptyIndex' | 'message'>): Promise<StepResult> {
	try {
		if (status.conflicted.length) throw new GitError('conflict');
		await repo.assertIndexWithinScope();
		const resolved = resolveCommitMode(options.mode, status.staged.length > 0, options.autoStageOnEmptyIndex);
		if (resolved === 'nothing') {
			const pending = status.unstaged.length + status.untracked.length > 0;
			return pending ? { step: 'commit', state: 'skipped', reason: 'nothing-staged' } : { step: 'commit', state: 'nothing' };
		}
		if (resolved === 'all') await repo.stageAll();
		const files = await repo.stagedPaths();
		if (!files.length) return { step: 'commit', state: 'nothing' };
		const message = options.message(files);
		if (!message.trim()) throw new GitError('empty-message');
		await repo.commit(message);
		return { step: 'commit', state: 'done', count: files.length };
	} catch (error) {
		return failed('commit', error);
	}
}

/** Fetch and merge or rebase onto the upstream. */
export async function pullStep(repo: GitRepo, method: 'merge' | 'rebase'): Promise<StepResult> {
	try {
		const status = await repo.status();
		const { operation } = await repo.state();
		const stop = blocker(status, operation);
		if (stop) throw new GitError(stop);
		if (!status.branch || !status.upstream) return { step: 'pull', state: 'skipped', reason: 'no-upstream' };
		const upstream = await repo.upstream(status.branch);
		await repo.fetch(upstream?.remote);
		const counts = await repo.divergence('HEAD', '@{u}').catch(() => null);
		// Before the first commit HEAD does not resolve; everything on the upstream is incoming.
		const behind = counts ? counts[1] : status.head ? null : await repo.revCount('@{u}').catch(() => null);
		if (behind === null) return { step: 'pull', state: 'skipped', reason: 'upstream-gone' };
		if (behind === 0) return { step: 'pull', state: 'nothing' };
		const before = await repo.head();
		if (!(await repo.integrate(method))) return { step: 'pull', state: 'conflict', count: (await repo.status()).conflicted.length };
		const after = await repo.head();
		return { step: 'pull', state: 'done', count: after ? (await repo.changedBetween(before, after)).length : 0 };
	} catch (error) {
		return failed('pull', error);
	}
}

const sameTarget = (left: { remote: string; ref: string } | null | undefined, right: { remote: string; ref: string } | null | undefined): boolean =>
	!!left && !!right && left.remote === right.remote && left.ref === right.ref;

/** Push the current branch to the resolved push target. Without an upstream, push with `-u` after the caller agrees. */
export async function pushStep(repo: GitRepo, options: Pick<SyncOptions, 'squash' | 'confirmUpstream' | 'pushTarget'>): Promise<StepResult> {
	let recovery: StepResult['recovery'];
	let squash: SquashOutcome | undefined;
	try {
		const status = await repo.status();
		const { operation } = await repo.state();
		const stop = blocker(status, operation);
		if (stop) throw new GitError(stop);
		const branch = status.branch;
		if (!branch) throw new GitError('detached');
		if (!status.head) return { step: 'push', state: 'nothing' };
		const upstream = status.upstream ? await repo.upstream(branch) : null;
		if (!upstream) {
			const remotes = await repo.remotes();
			const remote = remotes.includes('origin') ? 'origin' : remotes[0];
			if (!remote) throw new GitError('no-remote');
			if (!options.confirmUpstream) throw new GitError('no-upstream', `${remote}/${branch}`);
			if (!(await options.confirmUpstream(remote, branch))) return { step: 'push', state: 'skipped', reason: 'cancelled' };
			const count = await repo.revCount('HEAD');
			await repo.push(remote, `HEAD:refs/heads/${branch}`, true);
			return { step: 'push', state: 'done', count, upstreamSet: true };
		}
		await repo.assertPushSafe(branch);
		const destination = await repo.pushTarget(branch);
		const tracksUpstream = sameTarget(destination, upstream);
		const aheadBase = tracksUpstream && !status.upstreamGone ? '@{u}' : destination ? await repo.remoteTip(destination.remote, destination.ref) : null;
		let ahead = aheadBase ? await repo.revCount(`${aheadBase}..HEAD`) : destination ? await repo.revCount('HEAD') : undefined;
		if (options.squash) {
			const declared = options.pushTarget ?? destination;
			if (!destination || !sameTarget(declared, destination)) squash = 'target-mismatch';
			else {
				const tip = await repo.fetchPushTip(destination.remote, destination.ref);
				if (tip) ahead = await repo.revCount(`${tip}..HEAD`);
				squash = tip ? await squashUnpushed(repo, branch, tip) : 'target-mismatch';
				if (squash === 'squashed' && tip) recovery = { head: status.head, base: tip };
			}
		}
		// Let Git enforce current/simple/upstream and all configured refspecs, even when the pull upstream is gone.
		const result = await repo.pushConfigured();
		const updates = result.stdout.split(/\r?\n/).filter(line => /^[ =*+!-]\t/.test(line));
		const unchanged = updates.length > 0 && updates.every(line => line.startsWith('=\t'));
		return { step: 'push', state: unchanged ? 'nothing' : 'done', count: unchanged ? 0 : squash === 'squashed' ? 1 : ahead, squash };
	} catch (error) {
		return { ...failed('push', error), squash, recovery };
	}
}

/**
 * Squash the commits that are not on `base` yet into one, keeping the newest commit's message. `base` is the
 * pinned push tip, or the upstream when the push target is that upstream. Only when that cannot lose or rewrite
 * anything else: `base` is an ancestor of HEAD, nothing is staged, there are at least two such commits, none is
 * a merge, and no other branch or tag contains them.
 */
export async function squashUnpushed(repo: GitRepo, branch: string, base = '@{u}'): Promise<SquashOutcome> {
	if (!(await repo.isAncestor(base, 'HEAD'))) return 'diverged';
	if ((await repo.stagedPaths()).length) return 'staged';
	const range = `${base}..HEAD`;
	const commits = await repo.listRange(range);
	if (commits.length < 2) return 'single';
	if ((await repo.listRange(range, true)).length) return 'merges';
	const oldest = commits[commits.length - 1]!;
	if ((await repo.otherRefsContaining(oldest, branch)).length) return 'referenced';
	const head = commits[0]!;
	await repo.saveSquashHead(head);
	await repo.resetSoft(base);
	try {
		await repo.commitReusing(head);
	} catch (error) {
		// Put the branch back exactly where it was; the index still holds the same tree.
		await repo.resetSoft(head);
		throw error;
	}
	return 'squashed';
}

/** Whether a whole run achieved what was asked: no step failed, stopped on conflicts or was blocked by one that did. */
export function succeeded(steps: readonly StepResult[]): boolean {
	return steps.every((step) => step.state !== 'failed' && step.state !== 'conflict' && step.reason !== 'blocked');
}
