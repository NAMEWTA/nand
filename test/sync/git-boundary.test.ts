import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { cloneIntoEmpty } from '../../src/modules/sync/core/clone';
import { GitError } from '../../src/modules/sync/core/errors';
import { pushStep } from '../../src/modules/sync/core/flow';
import type { GitResult } from '../../src/modules/sync/core/ports';
import { GitRepo } from '../../src/modules/sync/core/repo';
import { createGitRunner } from '../../src/modules/sync/platform/desktop/git-runner';

let base = '';
const saved: Record<string, string | undefined> = {};

beforeAll(() => {
	base = mkdtempSync(path.join(tmpdir(), 'nand-git-boundary-'));
	const globalConfig = path.join(base, 'gitconfig');
	writeFileSync(globalConfig, '[init]\n\tdefaultBranch = main\n[user]\n\tname = Tester\n\temail = tester@example.com\n[commit]\n\tgpgsign = false\n');
	saved.GIT_CONFIG_GLOBAL = process.env.GIT_CONFIG_GLOBAL;
	saved.GIT_CONFIG_NOSYSTEM = process.env.GIT_CONFIG_NOSYSTEM;
	process.env.GIT_CONFIG_GLOBAL = globalConfig;
	process.env.GIT_CONFIG_NOSYSTEM = '1';
});
afterAll(() => {
	if (saved.GIT_CONFIG_GLOBAL === undefined) delete process.env.GIT_CONFIG_GLOBAL;
	else process.env.GIT_CONFIG_GLOBAL = saved.GIT_CONFIG_GLOBAL;
	if (saved.GIT_CONFIG_NOSYSTEM === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
	else process.env.GIT_CONFIG_NOSYSTEM = saved.GIT_CONFIG_NOSYSTEM;
	rmSync(base, { recursive: true, force: true });
});

function sh(cwd: string, ...args: string[]): string {
	return execFileSync('git', args, { cwd, encoding: 'utf8', env: process.env });
}
function write(dir: string, file: string, text: string): void {
	mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
	writeFileSync(path.join(dir, file), text);
}

describe('git vault boundary', () => {
	test('a parent index keeps outside staged paths, and stage-all stays inside the vault', async () => {
		const root = path.join(base, 'parent');
		mkdirSync(path.join(root, 'vault'), { recursive: true });
		sh(root, 'init', '-q');
		write(root, 'outside.txt', 'outside\n');
		write(root, 'vault/note.md', 'inside\n');
		sh(root, 'add', 'outside.txt', 'vault/note.md');
		sh(root, 'commit', '-q', '-m', 'base');
		write(root, 'outside.txt', 'outside changed\n');
		write(root, 'vault/note.md', 'inside changed\n');
		write(root, 'secret.txt', 'do not stage\n');
		sh(root, 'add', 'outside.txt', 'vault/note.md');
		const repo = new GitRepo(createGitRunner('git', root), 'vault');
		await assert.rejects(repo.commit('should not'), (error: unknown) => error instanceof GitError && error.kind === 'outside-index');
		assert.match(sh(root, 'diff', '--cached', '--name-only'), /outside\.txt/);
		assert.equal(sh(root, 'rev-list', '--count', 'HEAD').trim(), '1');
		await repo.unstageAll();
		const staged = sh(root, 'diff', '--cached', '--name-only');
		assert.match(staged, /outside\.txt/);
		assert.doesNotMatch(staged, /vault\/note\.md/);
		await repo.stageAll();
		assert.doesNotMatch(sh(root, 'diff', '--cached', '--name-only'), /secret\.txt/);
		await assert.rejects(repo.stage(['../outside.txt']), (error: unknown) => error instanceof GitError && error.kind === 'outside-index');
		assert.equal(readFileSync(path.join(root, 'outside.txt'), 'utf8'), 'outside changed\n');
	});

	test('clone into an empty directory succeeds and a non-empty target is left untouched', async () => {
		const remote = path.join(base, 'remote.git');
		const seed = path.join(base, 'seed');
		mkdirSync(remote, { recursive: true });
		sh(remote, 'init', '--bare', '-q');
		mkdirSync(seed);
		sh(seed, 'init', '-q');
		write(seed, 'README.md', 'seed\n');
		sh(seed, 'add', 'README.md');
		sh(seed, 'commit', '-q', '-m', 'seed');
		sh(seed, 'remote', 'add', 'origin', remote);
		sh(seed, 'push', '-q', '-u', 'origin', 'HEAD:main');
		const empty = path.join(base, 'empty-clone');
		mkdirSync(empty);
		const calls: string[][] = [];
		const run = async (args: readonly string[]): Promise<GitResult> => {
			calls.push([...args]);
			try {
				const stdout = execFileSync('git', args, { encoding: 'utf8', env: process.env });
				return { code: 0, stdout, stderr: '' };
			} catch (error) {
				const failure = error as { status?: number; stdout?: string; stderr?: string };
				return { code: failure.status ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
			}
		};
		const cloned = await cloneIntoEmpty(run, empty, remote, []);
		assert.equal(cloned.state, 'cloned');
		assert.equal(existsSync(path.join(empty, 'README.md')), true);
		assert.equal(readFileSync(path.join(seed, 'README.md'), 'utf8'), 'seed\n');
		const busy = path.join(base, 'busy-clone');
		mkdirSync(busy);
		write(busy, 'keep.txt', 'keep\n');
		const before = calls.length;
		const refused = await cloneIntoEmpty(run, busy, remote, ['keep.txt']);
		assert.equal(refused.state, 'refused');
		assert.equal(calls.length, before);
		assert.equal(readFileSync(path.join(busy, 'keep.txt'), 'utf8'), 'keep\n');
		const cancelled = await cloneIntoEmpty(run, path.join(base, 'cancelled'), remote, [], true);
		assert.equal(cancelled.state, 'cancelled');
		assert.equal(existsSync(path.join(base, 'cancelled')), false);
	});

	test('a push target that is not the upstream does not rewrite local history', async () => {
		const remote = path.join(base, 'push-remote.git');
		const work = path.join(base, 'push-work');
		mkdirSync(remote, { recursive: true });
		sh(remote, 'init', '--bare', '-q');
		mkdirSync(work);
		sh(work, 'init', '-q');
		write(work, 'note.md', 'one\n');
		sh(work, 'add', 'note.md');
		sh(work, 'commit', '-q', '-m', 'one');
		sh(work, 'remote', 'add', 'origin', remote);
		sh(work, 'push', '-q', '-u', 'origin', 'HEAD:main');
		write(work, 'note.md', 'two\n');
		sh(work, 'commit', '-aq', '-m', 'two');
		write(work, 'note.md', 'three\n');
		sh(work, 'commit', '-aq', '-m', 'three');
		const head = sh(work, 'rev-parse', 'HEAD').trim();
		assert.equal(sh(work, 'rev-list', '--count', 'HEAD').trim(), '3');
		const repo = new GitRepo(createGitRunner('git', work));
		const step = await pushStep(repo, { squash: true, pushTarget: { remote: 'other', ref: 'refs/heads/main' }, confirmUpstream: async () => false });
		assert.equal(step.state, 'done');
		assert.equal(step.squash, 'target-mismatch');
		assert.equal(sh(work, 'rev-parse', 'HEAD').trim(), head);
		assert.equal(sh(work, 'rev-list', '--count', 'HEAD').trim(), '3');
		assert.equal(sh(remote, 'rev-list', '--count', 'main').trim(), '3');
	});

	test('a configured push remote that is not the upstream does not rewrite local history', async () => {
		const remote = path.join(base, 'push-remote-upstream.git');
		const other = path.join(base, 'push-remote-other.git');
		const work = path.join(base, 'push-remote-work');
		mkdirSync(remote, { recursive: true });
		mkdirSync(other, { recursive: true });
		sh(remote, 'init', '--bare', '-q');
		sh(other, 'init', '--bare', '-q');
		mkdirSync(work);
		sh(work, 'init', '-q');
		write(work, 'note.md', 'one\n');
		sh(work, 'add', 'note.md');
		sh(work, 'commit', '-q', '-m', 'one');
		sh(work, 'remote', 'add', 'origin', remote);
		sh(work, 'remote', 'add', 'other', other);
		sh(work, 'push', '-q', '-u', 'origin', 'HEAD:main');
		sh(work, 'config', 'branch.main.pushRemote', 'other');
		write(work, 'note.md', 'two\n');
		sh(work, 'commit', '-aq', '-m', 'two');
		write(work, 'note.md', 'three\n');
		sh(work, 'commit', '-aq', '-m', 'three');
		const head = sh(work, 'rev-parse', 'HEAD').trim();
		const repo = new GitRepo(createGitRunner('git', work));
		const step = await pushStep(repo, { squash: true, confirmUpstream: async () => false });
		assert.equal(step.state, 'done');
		assert.equal(step.squash, 'target-mismatch');
		assert.equal(sh(work, 'rev-parse', 'HEAD').trim(), head);
		assert.equal(sh(work, 'rev-list', '--count', 'HEAD').trim(), '3');
		assert.equal(sh(remote, 'rev-list', '--count', 'main').trim(), '1');
		assert.equal(sh(other, 'rev-list', '--count', 'main').trim(), '3');
	});

	test('a fetched push remote that differs from upstream can squash that unpushed range', async () => {
		const remote = path.join(base, 'split-upstream.git');
		const other = path.join(base, 'split-push.git');
		const work = path.join(base, 'split-work');
		mkdirSync(remote, { recursive: true });
		mkdirSync(other, { recursive: true });
		sh(remote, 'init', '--bare', '-q');
		sh(other, 'init', '--bare', '-q');
		mkdirSync(work);
		sh(work, 'init', '-q');
		write(work, 'note.md', 'one\n');
		sh(work, 'add', 'note.md');
		sh(work, 'commit', '-q', '-m', 'one');
		sh(work, 'remote', 'add', 'origin', remote);
		sh(work, 'remote', 'add', 'other', other);
		sh(work, 'push', '-q', '-u', 'origin', 'HEAD:main');
		sh(work, 'push', '-q', 'other', 'HEAD:main');
		sh(work, 'fetch', '-q', 'other');
		sh(work, 'config', 'branch.main.pushRemote', 'other');
		write(work, 'note.md', 'two\n');
		sh(work, 'commit', '-aq', '-m', 'two');
		write(work, 'note.md', 'three\n');
		sh(work, 'commit', '-aq', '-m', 'three');
		const repo = new GitRepo(createGitRunner('git', work));
		const step = await pushStep(repo, { squash: true, confirmUpstream: async () => false });
		assert.equal(step.state, 'done');
		assert.equal(step.squash, 'squashed');
		assert.equal(sh(work, 'rev-list', '--count', 'HEAD').trim(), '2');
		assert.equal(sh(work, 'log', '-1', '--format=%s').trim(), 'three');
		assert.equal(sh(remote, 'rev-list', '--count', 'main').trim(), '1');
		assert.equal(sh(other, 'rev-list', '--count', 'main').trim(), '2');
		assert.equal(sh(other, 'log', '-1', '--format=%s', 'main').trim(), 'three');
	});
});
