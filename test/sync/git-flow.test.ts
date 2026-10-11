/**
 * Git sync against real git: a temporary bare remote and independent working copies. Checks file contents, git
 * status and the commit graph, not only that commands returned.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, describe, test, vi } from 'vitest';
import { commitAndSync, commitStep, pullStep, pushStep, squashUnpushed, succeeded, type StepResult, type SyncOptions } from '../../src/modules/sync/core/flow';
import { GitRepo } from '../../src/modules/sync/core/repo';
import { createGitRunner } from '../../src/modules/sync/platform/desktop/git-runner';
import { desktopGitHost } from '../../src/modules/sync/platform/desktop/host';
import { SyncService } from '../../src/modules/sync/services/sync-service';
import { syncSettings, type SyncSettings } from '../../src/modules/sync/settings';
import type { SettingsHandle } from '../../src/shared/settings/store';

// Each scenario starts many real git processes; Windows runners can exceed the unit-test default.
vi.setConfig({ testTimeout: 30_000 });

let base = '';
const saved: Record<string, string | undefined> = {};

beforeAll(() => {
	base = realpathSync(mkdtempSync(path.join(tmpdir(), 'nand-git-')));
	const globalConfig = path.join(base, 'gitconfig');
	writeFileSync(globalConfig, '[init]\n\tdefaultBranch = main\n[user]\n\tname = Tester\n\temail = tester@example.com\n[commit]\n\tgpgsign = false\n');
	// The tests never read the developer's own git configuration or credentials.
	for (const [key, value] of Object.entries({ GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_DATE: '', GIT_COMMITTER_DATE: '' })) {
		saved[key] = process.env[key];
		if (value) process.env[key] = value;
		else delete process.env[key];
	}
});
afterAll(() => {
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	rmSync(base, { recursive: true, force: true });
});

let counter = 0;
function sh(cwd: string, ...args: string[]): string {
	return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
}
function write(dir: string, file: string, text: string | Buffer): void {
	mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
	writeFileSync(path.join(dir, file), text);
}
// Git may convert working-copy line endings; these assertions check the merged text.
const read = (dir: string, file: string) => readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');

/** A bare remote and a first working copy `a` with `origin` but no commits. */
function world() {
	const root = path.join(base, `world-${++counter}`);
	const remote = path.join(root, 'remote.git');
	mkdirSync(remote, { recursive: true });
	sh(remote, 'init', '--bare', '-q');
	const a = path.join(root, 'a');
	mkdirSync(a);
	sh(a, 'init', '-q');
	sh(a, 'remote', 'add', 'origin', remote);
	const clone = (name: string) => {
		sh(root, 'clone', '-q', remote, name);
		return path.join(root, name);
	};
	return { root, remote, a, clone };
}
const repoAt = (dir: string) => new GitRepo(createGitRunner('git', dir));
const options = (over: Partial<SyncOptions> = {}): SyncOptions => ({
	mode: 'all',
	autoStageOnEmptyIndex: true,
	message: (files) => `sync ${files.length}`,
	pull: true,
	push: true,
	method: 'merge',
	squash: false,
	confirmUpstream: async () => true,
	...over,
});
const states = (steps: StepResult[]) => steps.map((step) => step.state);
const remoteCount = (remote: string) => {
	try {
		return Number(sh(remote, 'rev-list', '--count', 'main').trim());
	} catch {
		return 0; // no commits yet
	}
};

/** `a` with one published commit, and a clone `b`. */
async function published() {
	const w = world();
	write(w.a, 'note.md', 'line one\nline two\nline three\n');
	write(w.a, 'b.md', 'b\n');
	assert.equal(succeeded(await commitAndSync(repoAt(w.a), options())), true);
	return { ...w, b: w.clone('b') };
}

describe('commit and sync with real git', () => {
	test('first sync publishes a new repository and sets its upstream; repeated syncs add nothing', async () => {
		const w = world();
		write(w.a, 'note.md', 'hello\n');
		const repo = repoAt(w.a);
		const first = await commitAndSync(repo, options());
		assert.deepEqual(states(first), ['done', 'skipped', 'done']);
		assert.equal(first[1]?.reason, 'no-upstream');
		assert.equal(first[2]?.upstreamSet, true);
		assert.equal(remoteCount(w.remote), 1);
		assert.equal(sh(w.a, 'rev-parse', '--abbrev-ref', '@{u}').trim(), 'origin/main');
		const again = await commitAndSync(repo, options());
		assert.deepEqual(states(again), ['nothing', 'nothing', 'nothing']);
		assert.deepEqual(states(await commitAndSync(repo, options())), ['nothing', 'nothing', 'nothing']);
		assert.equal(remoteCount(w.remote), 1);
	});

	test('automatic runs never set an upstream or prompt; without a remote the push says so', async () => {
		const w = world();
		write(w.a, 'note.md', 'hello\n');
		const auto = await commitAndSync(repoAt(w.a), options({ confirmUpstream: undefined }));
		assert.deepEqual(states(auto), ['done', 'skipped', 'failed']);
		assert.equal(auto[2]?.error?.kind, 'no-upstream');
		assert.equal(remoteCount(w.remote), 0);
		sh(w.a, 'remote', 'remove', 'origin');
		write(w.a, 'note.md', 'hello again\n');
		const none = await commitAndSync(repoAt(w.a), options());
		assert.equal(none[2]?.error?.kind, 'no-remote');
		assert.equal(Number(sh(w.a, 'rev-list', '--count', 'HEAD').trim()), 2);
	});

	test('only-remote, only-local and both-sided changes to different files merge; both copies end equal', async () => {
		const w = await published();
		write(w.b, 'from-b.md', 'b side\n');
		assert.deepEqual(states(await commitAndSync(repoAt(w.b), options())), ['done', 'nothing', 'done']);
		const pulled = await commitAndSync(repoAt(w.a), options());
		assert.deepEqual(states(pulled), ['nothing', 'done', 'nothing']);
		assert.equal(pulled[1]?.count, 1);
		assert.equal(read(w.a, 'from-b.md'), 'b side\n');
		write(w.a, 'note.md', 'line one changed by a\nline two\nline three\n');
		write(w.b, 'b.md', 'b changed by b\n');
		assert.deepEqual(states(await commitAndSync(repoAt(w.a), options())), ['done', 'nothing', 'done']);
		const both = await commitAndSync(repoAt(w.b), options());
		assert.deepEqual(states(both), ['done', 'done', 'done']);
		assert.equal(both[2]?.count, 2);
		assert.equal(Number(sh(w.b, 'rev-list', '--merges', '--count', 'HEAD').trim()), 1);
		await commitAndSync(repoAt(w.a), options());
		assert.equal(sh(w.a, 'rev-parse', 'HEAD').trim(), sh(w.b, 'rev-parse', 'HEAD').trim());
		assert.equal(read(w.a, 'b.md'), 'b changed by b\n');
		assert.equal(read(w.b, 'note.md'), 'line one changed by a\nline two\nline three\n');
		assert.equal(sh(w.a, 'status', '--porcelain'), '');
	});

	test('rebase keeps history linear', async () => {
		const w = await published();
		write(w.a, 'a-only.md', 'a\n');
		write(w.b, 'b-only.md', 'b\n');
		await commitAndSync(repoAt(w.a), options({ method: 'rebase' }));
		assert.deepEqual(states(await commitAndSync(repoAt(w.b), options({ method: 'rebase' }))), ['done', 'done', 'done']);
		assert.equal(Number(sh(w.b, 'rev-list', '--merges', '--count', 'HEAD').trim()), 0);
		assert.equal(remoteCount(w.remote), 3);
		assert.equal(existsSync(path.join(w.b, 'a-only.md')), true);
	});

	test('commits that exist only locally are pushed even without working tree changes', async () => {
		const w = await published();
		write(w.b, 'local.md', 'x\n');
		sh(w.b, 'add', '.');
		sh(w.b, 'commit', '-q', '-m', 'local only');
		const steps = await commitAndSync(repoAt(w.b), options());
		assert.deepEqual(states(steps), ['nothing', 'nothing', 'done']);
		assert.equal(steps[2]?.count, 1);
		assert.equal(remoteCount(w.remote), 2);
	});

	test('staged-first, staged-only and all-changes commits include exactly what was chosen', async () => {
		const w = await published();
		const repo = repoAt(w.a);
		write(w.a, 'x.md', 'x\n');
		write(w.a, 'y.md', 'y\n');
		await repo.stage(['x.md']);
		const smart = await commitStep(repo, await repo.status(), { mode: 'smart', autoStageOnEmptyIndex: true, message: () => 'only x' });
		assert.deepEqual([smart.state, smart.count], ['done', 1]);
		assert.deepEqual(sh(w.a, 'show', '--name-only', '--format=', 'HEAD').trim().split('\n'), ['x.md']);
		const staged = await commitStep(repo, await repo.status(), { mode: 'staged', autoStageOnEmptyIndex: true, message: () => 'nothing' });
		assert.deepEqual([staged.state, staged.reason], ['skipped', 'nothing-staged']);
		const noAuto = await commitStep(repo, await repo.status(), { mode: 'smart', autoStageOnEmptyIndex: false, message: () => 'nothing' });
		assert.equal(noAuto.state, 'skipped');
		assert.deepEqual((await repo.status()).untracked, ['y.md']);
		const all = await commitStep(repo, await repo.status(), { mode: 'all', autoStageOnEmptyIndex: false, message: () => 'all' });
		assert.deepEqual([all.state, all.count], ['done', 1]);
	});

	test('commit staged and sync leaves unstaged edits in place while pulling and pushing', async () => {
		const w = await published();
		write(w.b, 'remote.md', 'from b\n');
		await commitAndSync(repoAt(w.b), options());
		const repo = repoAt(w.a);
		write(w.a, 'b.md', 'unstaged edit\n');
		write(w.a, 'staged.md', 'staged\n');
		await repo.stage(['staged.md']);
		const steps = await commitAndSync(repo, options({ mode: 'staged' }));
		assert.deepEqual(states(steps), ['done', 'done', 'done']);
		// The merge's first parent is the local commit: only the staged file.
		assert.deepEqual(sh(w.remote, 'show', '--name-only', '--format=', 'main^1').trim().split('\n'), ['staged.md']);
		assert.equal(read(w.a, 'b.md'), 'unstaged edit\n');
		assert.deepEqual((await repo.status()).unstaged.map((change) => change.path), ['b.md']);
	});
});

describe('conflicts and recovery', () => {
	async function conflicted(method: 'merge' | 'rebase') {
		const w = await published();
		write(w.a, 'note.md', 'line one from a\nline two\nline three\n');
		await commitAndSync(repoAt(w.a), options({ method }));
		write(w.b, 'note.md', 'line one from b\nline two\nline three\n');
		const repo = repoAt(w.b);
		const steps = await commitAndSync(repo, options({ method }));
		return { ...w, repo, steps };
	}

	test('a text conflict stops before pushing, blocks further syncs, and abort restores the local commit', async () => {
		const w = await conflicted('merge');
		assert.deepEqual(states(w.steps), ['done', 'conflict', 'skipped']);
		assert.equal(w.steps[2]?.reason, 'blocked');
		assert.equal(remoteCount(w.remote), 2);
		assert.equal((await w.repo.state()).operation, 'merge');
		assert.deepEqual((await w.repo.status()).conflicted.map((change) => change.path), ['note.md']);
		assert.match(read(w.b, 'note.md'), /<<<<<<<[\s\S]*line one from b[\s\S]*=======[\s\S]*line one from a[\s\S]*>>>>>>>/);
		const blocked = await commitAndSync(w.repo, options());
		assert.deepEqual([blocked.length, blocked[0]?.error?.kind], [1, 'conflict']);
		await w.repo.abortOperation('merge');
		assert.equal((await w.repo.state()).operation, null);
		assert.equal(read(w.b, 'note.md'), 'line one from b\nline two\nline three\n');
		assert.equal(sh(w.b, 'log', '-1', '--format=%s').trim(), 'sync 1');
		assert.equal(remoteCount(w.remote), 2);
	});

	test('resolving, staging and continuing a merge finishes it; the next sync pushes both sides', async () => {
		const w = await conflicted('merge');
		write(w.b, 'note.md', 'line one from a and b\nline two\nline three\n');
		await w.repo.stage(['note.md']);
		await w.repo.continueOperation('merge');
		assert.equal((await w.repo.state()).operation, null);
		assert.deepEqual(states(await commitAndSync(w.repo, options())), ['nothing', 'nothing', 'done']);
		await commitAndSync(repoAt(w.a), options());
		assert.equal(read(w.a, 'note.md'), 'line one from a and b\nline two\nline three\n');
		assert.equal(sh(w.a, 'rev-parse', 'HEAD').trim(), sh(w.b, 'rev-parse', 'HEAD').trim());
	});

	test('a rebase conflict continues to a linear history', async () => {
		const w = await conflicted('rebase');
		assert.deepEqual(states(w.steps), ['done', 'conflict', 'skipped']);
		assert.equal((await w.repo.state()).operation, 'rebase');
		write(w.b, 'note.md', 'line one rebased\nline two\nline three\n');
		await w.repo.stage(['note.md']);
		await w.repo.continueOperation('rebase');
		assert.equal((await w.repo.state()).operation, null);
		assert.equal((await w.repo.status()).branch, 'main');
		assert.deepEqual(states(await commitAndSync(w.repo, options({ method: 'rebase' }))), ['nothing', 'nothing', 'done']);
		assert.equal(Number(sh(w.b, 'rev-list', '--merges', '--count', 'HEAD').trim()), 0);
		assert.equal(sh(w.remote, 'show', 'main:note.md'), 'line one rebased\nline two\nline three\n');
	});

	test('delete against modify is a conflict; keeping the edit restores the file', async () => {
		const w = await published();
		unlinkSync(path.join(w.a, 'b.md'));
		await commitAndSync(repoAt(w.a), options());
		write(w.b, 'b.md', 'b edited\n');
		const repo = repoAt(w.b);
		assert.deepEqual(states(await commitAndSync(repo, options())), ['done', 'conflict', 'skipped']);
		const conflict = (await repo.status()).conflicted[0];
		assert.deepEqual([conflict?.path, conflict?.index, conflict?.worktree], ['b.md', 'U', 'D']);
		await repo.stage(['b.md']);
		await repo.continueOperation('merge');
		await commitAndSync(repo, options());
		assert.equal(sh(w.remote, 'show', 'main:b.md'), 'b edited\n');
	});

	test('a rename on one side and an edit on the other merge without a conflict', async () => {
		const w = await published();
		renameSync(path.join(w.a, 'note.md'), path.join(w.a, 'renamed.md'));
		await commitAndSync(repoAt(w.a), options());
		write(w.b, 'note.md', 'line one\nline two\nline three edited by b\n');
		assert.deepEqual(states(await commitAndSync(repoAt(w.b), options())), ['done', 'done', 'done']);
		assert.equal(existsSync(path.join(w.b, 'note.md')), false);
		assert.equal(read(w.b, 'renamed.md'), 'line one\nline two\nline three edited by b\n');
	});

	test('a binary conflict keeps both versions recoverable; abort returns the local bytes', async () => {
		const w = await published();
		write(w.a, 'image.bin', Buffer.from([0, 1, 2, 3, 255]));
		await commitAndSync(repoAt(w.a), options());
		await commitAndSync(repoAt(w.b), options());
		write(w.a, 'image.bin', Buffer.from([0, 9, 9, 9, 255]));
		await commitAndSync(repoAt(w.a), options());
		write(w.b, 'image.bin', Buffer.from([0, 7, 7, 7, 255]));
		const repo = repoAt(w.b);
		assert.deepEqual(states(await commitAndSync(repo, options())), ['done', 'conflict', 'skipped']);
		assert.deepEqual((await repo.status()).conflicted.map((change) => change.path), ['image.bin']);
		assert.deepEqual([...readFileSync(path.join(w.b, 'image.bin'))], [0, 7, 7, 7, 255]);
		await repo.abortOperation('merge');
		assert.deepEqual([...readFileSync(path.join(w.b, 'image.bin'))], [0, 7, 7, 7, 255]);
		assert.deepEqual([...Buffer.from(sh(w.remote, 'show', 'main:image.bin'), 'latin1')].length, 5);
	});
});

describe('failures keep local work', () => {
	test('a missing remote or an unreachable host fails the pull, skips the push and keeps the commit', async () => {
		const w = await published();
		const repo = repoAt(w.a);
		sh(w.a, 'remote', 'set-url', 'origin', path.join(w.root, 'missing.git'));
		write(w.a, 'note.md', 'kept locally\n');
		const missing = await commitAndSync(repo, options());
		assert.deepEqual(states(missing), ['done', 'failed', 'skipped']);
		assert.equal(missing[1]?.error?.kind, 'remote-missing');
		assert.equal(succeeded(missing), false);
		sh(w.a, 'remote', 'set-url', 'origin', 'http://127.0.0.1:9/vault.git');
		const offline = await commitAndSync(repo, options());
		assert.equal(offline[1]?.error?.kind, 'network');
		assert.equal(read(w.a, 'note.md'), 'kept locally\n');
		assert.equal(sh(w.a, 'log', '-1', '--format=%s').trim(), 'sync 1');
		sh(w.a, 'remote', 'set-url', 'origin', w.remote);
		assert.deepEqual(states(await commitAndSync(repo, options())), ['nothing', 'nothing', 'done']);
		assert.equal(sh(w.remote, 'show', 'main:note.md'), 'kept locally\n');
	});

	test('a push the remote rejects is reported as such; pulling first then succeeds', async () => {
		const w = await published();
		write(w.b, 'from-b.md', 'b\n');
		await commitAndSync(repoAt(w.b), options());
		const repo = repoAt(w.a);
		write(w.a, 'from-a.md', 'a\n');
		await commitStep(repo, await repo.status(), { mode: 'all', autoStageOnEmptyIndex: true, message: () => 'a' });
		sh(w.a, 'fetch', '-q');
		sh(w.a, 'update-ref', 'refs/remotes/origin/main', 'HEAD~1');
		const push = await pushStep(repo, { squash: false });
		assert.deepEqual([push.state, push.error?.kind], ['failed', 'rejected']);
		assert.deepEqual(states(await commitAndSync(repo, options())), ['nothing', 'done', 'done']);
		assert.equal(remoteCount(w.remote), 4);
	});

	test('a lock held by another git process fails the run without changes; the next run succeeds', async () => {
		const w = await published();
		const repo = repoAt(w.a);
		write(w.a, 'note.md', 'edited while locked\n');
		writeFileSync(path.join(w.a, '.git', 'index.lock'), '');
		assert.equal((await repo.state()).locked, true);
		const locked = await commitAndSync(repo, options());
		assert.deepEqual([states(locked), locked[0]?.error?.kind], [['failed'], 'locked']);
		assert.equal(read(w.a, 'note.md'), 'edited while locked\n');
		unlinkSync(path.join(w.a, '.git', 'index.lock'));
		assert.deepEqual(states(await commitAndSync(repo, options())), ['done', 'nothing', 'done']);
	});
});

describe('squashing unpushed commits', () => {
	async function threeUnpushed() {
		const w = await published();
		const repo = repoAt(w.a);
		for (const name of ['first', 'second', 'third']) {
			write(w.a, `${name}.md`, `${name}\n`);
			await commitStep(repo, await repo.status(), { mode: 'all', autoStageOnEmptyIndex: true, message: () => name });
		}
		return { ...w, repo };
	}

	test('only the unpushed commits become one, with the newest message', async () => {
		const w = await threeUnpushed();
		const push = await pushStep(w.repo, { squash: true });
		assert.deepEqual([push.state, push.squash, push.count], ['done', 'squashed', 1]);
		assert.equal(remoteCount(w.remote), 2);
		assert.equal(sh(w.remote, 'log', '-1', '--format=%s', 'main').trim(), 'third');
		assert.deepEqual(sh(w.remote, 'show', '--name-only', '--format=', 'main').trim().split('\n').sort(), ['first.md', 'second.md', 'third.md']);
	});

	test('squash is skipped when anything is staged, when a tag points into the range, or for a single commit', async () => {
		const staged = await threeUnpushed();
		write(staged.a, 'staged.md', 's\n');
		await staged.repo.stage(['staged.md']);
		assert.equal(await squashUnpushed(staged.repo, 'main'), 'staged');
		const tagged = await threeUnpushed();
		sh(tagged.a, 'tag', 'keep', 'HEAD~1');
		assert.equal(await squashUnpushed(tagged.repo, 'main'), 'referenced');
		const single = await published();
		write(single.a, 'one.md', '1\n');
		const repo = repoAt(single.a);
		await commitStep(repo, await repo.status(), { mode: 'all', autoStageOnEmptyIndex: true, message: () => 'one' });
		assert.equal(await squashUnpushed(repo, 'main'), 'single');
	});

	test('squash is skipped for merge commits and when the remote moved on', async () => {
		const merged = await threeUnpushed();
		sh(merged.a, 'checkout', '-q', '-b', 'side', 'HEAD~1');
		write(merged.a, 'side.md', 'side\n');
		sh(merged.a, 'add', '.');
		sh(merged.a, 'commit', '-q', '-m', 'side');
		sh(merged.a, 'checkout', '-q', 'main');
		sh(merged.a, 'merge', '-q', '--no-edit', '--no-ff', 'side');
		sh(merged.a, 'branch', '-q', '-D', 'side');
		assert.equal(await squashUnpushed(merged.repo, 'main'), 'merges');
		const moved = await threeUnpushed();
		write(moved.b, 'other.md', 'o\n');
		await commitAndSync(repoAt(moved.b), options());
		sh(moved.a, 'fetch', '-q');
		assert.equal(await squashUnpushed(moved.repo, 'main'), 'diverged');
		assert.equal(Number(sh(moved.a, 'rev-list', '--count', 'HEAD').trim()), 4);
	});

	test('remote and custom references protect published commits from squashing', async () => {
		for (const ref of ['refs/remotes/backup/main', 'refs/archive/keep']) {
			const w = await threeUnpushed();
			const head = sh(w.a, 'rev-parse', 'HEAD').trim();
			sh(w.a, 'update-ref', ref, 'HEAD~1');
			assert.equal(await squashUnpushed(w.repo, 'main'), 'referenced');
			assert.equal(sh(w.a, 'rev-parse', 'HEAD').trim(), head);
		}
	});

	test('a rejected push retains original history and reports its recovery reference', async () => {
		const w = await threeUnpushed();
		const head = sh(w.a, 'rev-parse', 'HEAD').trim();
		const base = sh(w.a, 'rev-parse', '@{u}').trim();
		write(w.remote, 'hooks/pre-receive', '#!/bin/sh\nexit 1\n');
		chmodSync(path.join(w.remote, 'hooks/pre-receive'), 0o755);
		write(w.a, 'note.md', 'unstaged edit stays\n');
		const result = await pushStep(w.repo, { squash: true });
		assert.equal(result.state, 'failed');
		assert.deepEqual(result.recovery, { head, base });
		assert.equal(sh(w.a, 'rev-parse', 'refs/nand/pre-squash').trim(), head);
		assert.equal(sh(w.remote, 'rev-parse', 'main').trim(), base);
		assert.equal(read(w.a, 'note.md'), 'unstaged edit stays\n');
		assert.equal(sh(w.a, 'diff', '--cached', '--name-only'), '');
	});

	test('a failed squash commit restores the original HEAD without changing edits or the index', async () => {
		const w = await threeUnpushed();
		const head = sh(w.a, 'rev-parse', 'HEAD').trim();
		write(w.a, '.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
		chmodSync(path.join(w.a, '.git/hooks/pre-commit'), 0o755);
		write(w.a, 'note.md', 'unsaved to git\n');
		const result = await pushStep(w.repo, { squash: true });
		assert.equal(result.state, 'failed');
		assert.equal(sh(w.a, 'rev-parse', 'HEAD').trim(), head);
		assert.equal(read(w.a, 'note.md'), 'unsaved to git\n');
		assert.equal(sh(w.a, 'diff', '--cached', '--name-only'), '');
	});
});

describe('paths, scale and the runner', () => {
	test('CJK, spaces and wildcard characters in paths are handled literally', async () => {
		const w = await published();
		const repo = repoAt(w.a);
		// Windows forbids '*' in filenames; a bracket expression is also a git pathspec wildcard.
		const wildcard = process.platform === 'win32' ? 'a[1].md' : 'a*.md';
		const decoy = process.platform === 'win32' ? 'a1.md' : 'ab.md';
		write(w.a, '中文 目录/笔记 [1].md', '内容\n');
		write(w.a, wildcard, 'wildcard\n');
		write(w.a, decoy, 'not staged\n');
		const status = await repo.status();
		assert.deepEqual(status.untracked.sort(), [wildcard, decoy, '中文 目录/笔记 [1].md'].sort());
		await repo.stage([wildcard, '中文 目录/笔记 [1].md']);
		assert.deepEqual((await repo.stagedPaths()).sort(), [wildcard, '中文 目录/笔记 [1].md']);
		await repo.unstage([wildcard]);
		assert.deepEqual(await repo.stagedPaths(), ['中文 目录/笔记 [1].md']);
		assert.match(await repo.diff('中文 目录/笔记 [1].md', { staged: true }), /\+内容/);
	});

	test('a thousand notes and a 20 MB attachment sync in one run', async () => {
		const w = await published();
		for (let i = 0; i < 1000; i++) write(w.a, `notes/${String(i).padStart(4, '0')} 笔记.md`, `# ${i}\n${'正文 '.repeat(50)}\n`);
		write(w.a, 'attachments/large.bin', Buffer.alloc(20 * 1024 * 1024, 7));
		const started = performance.now();
		const steps = await commitAndSync(repoAt(w.a), options());
		const ms = Math.round(performance.now() - started);
		console.info(JSON.stringify({ files: 1001, attachmentMB: 20, commitAndSyncMs: ms }));
		assert.deepEqual(states(steps), ['done', 'nothing', 'done']);
		assert.equal(steps[0]?.count, 1001);
		const clone = w.clone('large-clone');
		assert.equal(readFileSync(path.join(clone, 'attachments/large.bin')).length, 20 * 1024 * 1024);
	}, 180_000);

	test('a disposed runner refuses work, and a missing git binary is reported as such', async () => {
		const runner = createGitRunner('git', base);
		runner.dispose();
		await assert.rejects(runner.run(['status']), (error: Error & { kind?: string }) => error.kind === 'cancelled');
		await assert.rejects(createGitRunner(path.join(base, 'no-such-git'), base).run(['status']), (error: Error & { kind?: string }) => error.kind === 'missing-git');
	});

	test.each(['abort', 'timeout', 'dispose'] as const)('%s terminates the helper process spawned by Git', async (mode) => {
		const w = world();
		const helper = path.join(w.root, 'helper.cjs');
		const marker = path.join(w.root, 'helper.pid');
		writeFileSync(helper, "require('node:fs').writeFileSync(process.argv[2], String(process.pid)); setInterval(() => {}, 1000);\n");
		const quote = (value: string) => "'" + value.replaceAll('\\', '/').replaceAll("'", "'\\''") + "'";
		const runner = createGitRunner('git', w.a);
		const controller = new AbortController();
		const run = runner.run(['-c', `alias.nand-wait=!${quote(process.execPath)} ${quote(helper)} ${quote(marker)}`, 'nand-wait'], { signal: controller.signal, timeoutMs: mode === 'timeout' ? 5000 : undefined });
		const rejected = assert.rejects(run, (error: Error & { kind?: string }) => error.kind === (mode === 'timeout' ? 'timeout' : 'cancelled'));
		let pid: number | undefined;
		const alive = () => { if (!pid) return false; try { process.kill(pid, 0); return true; } catch { return false; } };
		try {
			const deadline = Date.now() + 5000;
			while (!existsSync(marker) && Date.now() < deadline) await delay(25);
			assert.ok(existsSync(marker), 'Git spawned the helper');
			pid = Number(readFileSync(marker, 'utf8'));
			assert.ok(pid > 0);
			if (mode === 'abort') controller.abort();
			if (mode === 'dispose') runner.dispose();
			await rejected;
			const stopped = Date.now() + 2000;
			while (alive() && Date.now() < stopped) await delay(25);
			assert.equal(alive(), false, 'the child helper must not survive cancelled Git');
		} finally {
			controller.abort(); runner.dispose();
			await run.catch(() => {});
			if (alive()) { process.kill(pid!); await delay(100); }
		}
	}, 15_000);

	test('pulling with no upstream is skipped, not an error', async () => {
		const w = world();
		write(w.a, 'x.md', 'x\n');
		const repo = repoAt(w.a);
		await commitStep(repo, await repo.status(), { mode: 'all', autoStageOnEmptyIndex: true, message: () => 'x' });
		const pull = await pullStep(repo, 'merge');
		assert.deepEqual([pull.state, pull.reason], ['skipped', 'no-upstream']);
	});
});

/** A settings handle over plain values, for the service. */
function settingsOf(values: Partial<SyncSettings> = {}): SettingsHandle<SyncSettings> {
	let value: SyncSettings = { ...syncSettings.defaults(), ...values };
	const listeners = new Set<() => void>();
	return {
		get: () => value,
		update: async (recipe: (draft: SyncSettings) => void | SyncSettings) => {
			const draft = structuredClone(value);
			value = (recipe(draft) as SyncSettings | undefined) ?? draft;
			for (const listener of listeners) listener();
		},
		select: () => () => {},
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		touch: async () => {},
	} as unknown as SettingsHandle<SyncSettings>;
}

describe('the sync service', () => {
	test('invalid repository settings remain recoverable and stop writing state to the previously connected repository', async () => {
		const w = await published();
		const settings = settingsOf();
		const service = new SyncService({ host: desktopGitHost(w.a), settings, dialogs: { confirmUpstream: async () => true }, notify() {}, describe: () => '' });
		try {
			await service.connect();
			await service.setPaused(true);
			const statePath = path.join(w.a, '.git', 'nand-sync.json');
			const state = readFileSync(statePath, 'utf8');
			await settings.update(draft => { draft.repoSubPath = '..'; });
			await service.connect();
			assert.equal(service.snapshot.phase, 'no-repo');
			assert.equal(service.snapshot.error?.kind, 'invalid-repo-folder');
			assert.equal(service.snapshot.place, undefined);
			await assert.rejects(service.init(), (error: Error & { kind?: string }) => error.kind === 'invalid-repo-folder');
			await service.setPaused(false);
			assert.equal(readFileSync(statePath, 'utf8'), state);
			await settings.update(draft => { draft.repoSubPath = ''; });
			await service.connect();
			assert.equal(service.snapshot.phase, 'ready');
			assert.equal(service.snapshot.device.paused, 'manual');
		} finally { await service.dispose(); }
	});

	test('clones through the production host while retaining the current vault connection', async () => {
		const w = await published();
		const host = desktopGitHost(w.a);
		const service = new SyncService({ host, settings: settingsOf(), dialogs: { confirmUpstream: async () => true }, notify() {}, describe: () => '' });
		await service.connect();
		const before = service.snapshot.status?.head;
		const target = path.join(w.root, 'new-vault');
		try {
			const result = await service.clone(target, w.remote);
			assert.equal(result.state, 'cloned');
			assert.equal(service.snapshot.clone?.state, 'cloned');
			assert.equal(service.snapshot.status?.head, before);
			assert.equal(sh(target, 'rev-parse', 'HEAD').trim(), before);
			assert.equal(service.snapshot.place?.cwd, w.a);
			const pending = service.clone(path.join(w.root, 'cancel-clone'), w.remote);
			service.cancelClone();
			assert.equal((await pending).state, 'cancelled');
		} finally { await service.dispose(); }
	});

	test('finds no repository, creates one, reports a missing remote, then publishes after a remote is added', async () => {
		const w = world();
		const vault = path.join(w.root, 'vault');
		mkdirSync(vault);
		const notices: Array<[string, boolean]> = [];
		const service = new SyncService({
			host: desktopGitHost(vault),
			settings: settingsOf(),
			dialogs: { confirmUpstream: async () => true },
			notify: (text, error) => notices.push([text, error]),
			describe: (report) => report.steps.map((step) => `${step.step}:${step.state}`).join(','),
		});
		await service.connect();
		assert.equal(service.snapshot.phase, 'no-repo');
		await service.init();
		assert.equal(service.snapshot.phase, 'ready');
		write(vault, 'note.md', 'hello\n');
		await service.refresh();
		assert.deepEqual(service.snapshot.status?.untracked, ['note.md']);
		const noRemote = await service.commitAndSync('all');
		assert.equal(noRemote.ok, false);
		assert.deepEqual(notices.at(-1), ['commit:done,pull:skipped,push:failed', true]);
		for (const url of ['https://user:secret@example.com/repo', 'https://example.com/repo?token=secret']) {
			await assert.rejects(service.addRemote('credential', url), (error: Error & { kind?: string }) => error.kind === 'invalid-remote-url');
			assert.doesNotMatch(readFileSync(path.join(vault, '.git', 'config'), 'utf8'), /secret|credential/);
		}
		await service.addRemote('origin', w.remote);
		const published = await service.commitAndSync('all');
		assert.equal(published.ok, true);
		assert.equal(remoteCount(w.remote), 1);
		assert.equal(service.snapshot.status?.upstream, 'origin/main');
		await service.dispose();
	});

	test('concurrent requests run one at a time; repeated automatic failures pause automatic sync until a manual success', async () => {
		const w = await published();
		const notices: string[] = [];
		const service = new SyncService({
			host: desktopGitHost(w.a),
			settings: settingsOf(),
			dialogs: { confirmUpstream: async () => true },
			notify: (text) => notices.push(text),
			describe: (report) => report.steps.map((step) => `${step.step}:${step.state}`).join(','),
		});
		await service.connect();
		write(w.a, 'one.md', '1\n');
		const runs = await Promise.all([service.commitAndSync('all'), service.commitAndSync('all'), service.pull()]);
		assert.equal(runs.every((run) => run.ok), true);
		assert.equal(remoteCount(w.remote), 2);
		sh(w.a, 'remote', 'set-url', 'origin', path.join(w.root, 'missing.git'));
		for (let i = 0; i < 3; i++) await service.pull({ auto: true });
		assert.equal(service.snapshot.device.paused, 'failures');
		assert.equal(service.snapshot.device.failures, 3);
		const state = JSON.parse(readFileSync(path.join(w.a, '.git', 'nand-sync.json'), 'utf8')) as { paused: string; lastPull: number };
		assert.equal(state.paused, 'failures');
		assert.ok(state.lastPull > 0);
		assert.equal(sh(w.a, 'status', '--porcelain'), '');
		sh(w.a, 'remote', 'set-url', 'origin', w.remote);
		assert.equal((await service.pull()).ok, true);
		assert.equal(service.snapshot.device.paused, '');
		await service.dispose();
		await assert.rejects(service.pull());
	});
});
