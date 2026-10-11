import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, test } from 'vitest';
import { GitError } from '../../src/modules/sync/core/errors';
import { pushStep } from '../../src/modules/sync/core/flow';
import { GitRepo } from '../../src/modules/sync/core/repo';
import { createGitRunner } from '../../src/modules/sync/platform/desktop/git-runner';
import { desktopGitHost } from '../../src/modules/sync/platform/desktop/host';
import { locateRepo } from '../../src/modules/sync/platform/desktop/locate';

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

function pushFixture(name: string, upstream = 'main') {
	const remote = path.join(base, `${name}.git`);
	const work = path.join(base, name);
	mkdirSync(remote); mkdirSync(work);
	sh(remote, 'init', '--bare', '-q'); sh(work, 'init', '-q');
	write(work, 'note.md', 'one\n'); sh(work, 'add', '.'); sh(work, 'commit', '-qm', 'one');
	sh(work, 'remote', 'add', 'origin', remote); sh(work, 'push', '-qu', 'origin', `HEAD:${upstream}`);
	return { remote, work, repo: new GitRepo(createGitRunner('git', work)) };
}

describe('git vault boundary', () => {
	test('forced and mirror push configuration is refused before a squash changes HEAD', async () => {
		for (const mirror of [false, true]) {
			const { remote, work, repo } = pushFixture(mirror ? 'mirror' : 'forced');
			const tip = sh(remote, 'rev-parse', 'main');
			for (const text of ['two', 'three']) { write(work, 'note.md', text); sh(work, 'commit', '-aqm', text); }
			const head = sh(work, 'rev-parse', 'HEAD');
			sh(work, 'config', mirror ? 'remote.origin.mirror' : 'remote.origin.push', mirror ? 'true' : '+refs/heads/main:refs/heads/main');
			const step = await pushStep(repo, { squash: true });
			assert.equal(step.error?.kind, 'unsafe-push-config');
			assert.equal(sh(work, 'rev-parse', 'HEAD'), head);
			assert.equal(sh(remote, 'rev-parse', 'main'), tip);
		}
	}, 30_000); // Two real repositories and push subprocesses, matching the Git integration suite's timeout.
	test('push.default=current publishes the local branch name even with a differently named upstream', async () => {
		const { remote, work, repo } = pushFixture('current-name', 'trunk');
		const upstream = sh(remote, 'rev-parse', 'trunk');
		sh(work, 'config', 'push.default', 'current');
		write(work, 'note.md', 'two\n'); sh(work, 'commit', '-aqm', 'two');
		assert.equal((await pushStep(repo, { squash: false })).state, 'done');
		assert.equal(sh(remote, 'rev-parse', 'trunk'), upstream);
		assert.equal(sh(remote, 'rev-parse', 'main'), sh(work, 'rev-parse', 'HEAD'));
	});

	test('simple mode refuses differently named upstreams instead of overriding Git configuration', async () => {
		const { remote, work, repo } = pushFixture('simple-name', 'trunk');
		const upstream = sh(remote, 'rev-parse', 'trunk');
		sh(work, 'config', 'push.default', 'simple');
		write(work, 'note.md', 'two\n'); sh(work, 'commit', '-aqm', 'two');
		const head = sh(work, 'rev-parse', 'HEAD');
		assert.equal((await pushStep(repo, { squash: true })).state, 'failed');
		assert.equal(sh(remote, 'rev-parse', 'trunk'), upstream);
		assert.equal(sh(work, 'rev-parse', 'HEAD'), head);
	});

	test('squash refreshes the push tip instead of rewriting commits hidden by stale tracking refs', async () => {
		const { remote, work, repo } = pushFixture('stale-tip');
		const first = sh(work, 'rev-parse', 'HEAD').trim();
		write(work, 'note.md', 'two\n'); sh(work, 'commit', '-aqm', 'two'); sh(work, 'push', '-q');
		sh(work, 'update-ref', 'refs/remotes/origin/main', first);
		write(work, 'note.md', 'three\n'); sh(work, 'commit', '-aqm', 'three');
		const head = sh(work, 'rev-parse', 'HEAD');
		const step = await pushStep(repo, { squash: true });
		assert.equal(step.state, 'done');
		assert.equal(step.squash, 'single');
		assert.equal(sh(work, 'rev-parse', 'HEAD'), head);
		assert.equal(sh(remote, 'rev-parse', 'main'), head);
	});
	test('terminal parent segments cannot expand an index operation outside the vault', async () => {
		const root = path.join(base, 'traversal');
		mkdirSync(path.join(root, 'vault'), { recursive: true });
		sh(root, 'init', '-q');
		write(root, 'outside.txt', 'base\n');
		write(root, 'vault/note.md', 'base\n');
		sh(root, 'add', '.');
		sh(root, 'commit', '-qm', 'base');
		write(root, 'outside.txt', 'unstaged sentinel\n');
		const repo = new GitRepo(createGitRunner('git', root), 'vault');
		for (const run of [() => repo.stage(['vault/..']), () => repo.unstage(['vault/..']), () => repo.discard(['vault/..'])]) {
			await assert.rejects(run, (error: unknown) => error instanceof GitError && error.kind === 'outside-index');
		}
		assert.equal(sh(root, 'diff', '--cached', '--name-only'), '');
		assert.equal(readFileSync(path.join(root, 'outside.txt'), 'utf8'), 'unstaged sentinel\n');
	});

	test('a rename into the vault cannot hide its staged deletion outside the vault', async () => {
		const root = path.join(base, 'rename');
		mkdirSync(path.join(root, 'vault'), { recursive: true });
		sh(root, 'init', '-q');
		write(root, 'outside.txt', 'rename sentinel\n');
		sh(root, 'add', '.');
		sh(root, 'commit', '-qm', 'base');
		const head = sh(root, 'rev-parse', 'HEAD');
		sh(root, 'mv', 'outside.txt', 'vault/note.md');
		const repo = new GitRepo(createGitRunner('git', root), 'vault');
		assert.deepEqual(await repo.stagedOutside(), ['outside.txt']);
		await assert.rejects(repo.commit('refuse rename'), (error: unknown) => error instanceof GitError && error.kind === 'outside-index');
		assert.equal(sh(root, 'rev-parse', 'HEAD'), head);
		assert.equal(sh(root, 'show', ':vault/note.md'), 'rename sentinel\n');
	});

	test('continuing a merge checks outside staged files and keeps the stopped operation', async () => {
		const root = path.join(base, 'continue');
		mkdirSync(path.join(root, 'vault'), { recursive: true });
		sh(root, 'init', '-q');
		write(root, 'outside.txt', 'sentinel\n');
		write(root, 'vault/note.md', 'base\n');
		sh(root, 'add', '.');
		sh(root, 'commit', '-qm', 'base');
		sh(root, 'checkout', '-qb', 'incoming');
		write(root, 'vault/note.md', 'incoming\n');
		sh(root, 'commit', '-aqm', 'incoming');
		sh(root, 'checkout', '-q', 'main');
		sh(root, 'merge', '--no-commit', '--no-ff', 'incoming');
		write(root, 'outside.txt', 'staged sentinel\n');
		sh(root, 'add', 'outside.txt');
		const head = sh(root, 'rev-parse', 'HEAD');
		const repo = new GitRepo(createGitRunner('git', root), 'vault');
		await assert.rejects(repo.continueOperation('merge'), (error: unknown) => error instanceof GitError && error.kind === 'outside-index');
		assert.equal(sh(root, 'rev-parse', 'HEAD'), head);
		assert.equal(sh(root, 'show', ':outside.txt'), 'staged sentinel\n');
		assert.equal((await repo.state()).operation, 'merge');
	});

	test('a configured repository folder cannot escape the vault or silently select the entire parent repository', async () => {
		const root = path.join(base, 'configured-boundary');
		const vault = path.join(root, 'vault');
		mkdirSync(vault, { recursive: true });
		sh(root, 'init', '-q');
		for (const subPath of ['..', '../outside', root]) {
			await assert.rejects(locateRepo('git', vault, subPath), (error: unknown) => error instanceof GitError && error.kind === 'invalid-repo-folder');
		}
		const inside = path.join(vault, 'inside');
		mkdirSync(inside);
		assert.equal((await locateRepo('git', vault, 'inside')).scope, 'vault');
		const outside = path.join(root, 'outside');
		mkdirSync(outside);
		symlinkSync(outside, path.join(vault, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
		await assert.rejects(locateRepo('git', vault, 'linked'), (error: unknown) => error instanceof GitError && error.kind === 'invalid-repo-folder');
	});

	test('unstaging a rename restores both in-vault index paths without changing an outside entry', async () => {
		const root = path.join(base, 'unstage-rename');
		mkdirSync(root);
		sh(root, 'init', '-q');
		write(root, 'vault/before.md', 'note\n');
		write(root, 'outside.txt', 'initial\n');
		sh(root, 'add', '.'); sh(root, 'commit', '-qm', 'initial');
		write(root, 'outside.txt', 'staged sentinel\n'); sh(root, 'add', 'outside.txt');
		sh(root, 'mv', 'vault/before.md', 'vault/after.md');
		const repo = new GitRepo(createGitRunner('git', path.join(root, 'vault')), 'vault');
		await repo.unstage(['vault/after.md']);
		assert.equal(sh(root, 'diff', '--cached', '--name-only').trim(), 'outside.txt');
		assert.equal(sh(root, 'show', ':outside.txt'), 'staged sentinel\n');
		assert.equal(readFileSync(path.join(root, 'vault/after.md'), 'utf8'), 'note\n');
	});

	test('unstage-all before the first commit preserves the outside index blob', async () => {
		const root = path.join(base, 'unborn');
		mkdirSync(path.join(root, 'vault'), { recursive: true });
		sh(root, 'init', '-q');
		write(root, 'outside.txt', 'sentinel\n');
		write(root, 'vault/note.md', 'note\n');
		sh(root, 'add', '.');
		const before = sh(root, 'ls-files', '--stage', 'outside.txt');
		const repo = new GitRepo(createGitRunner('git', root), 'vault');
		await repo.unstageAll();
		assert.equal(sh(root, 'ls-files', '--stage', 'outside.txt'), before);
		assert.equal(sh(root, 'ls-files', '--stage', 'vault'), '');
		assert.equal(readFileSync(path.join(root, 'vault/note.md'), 'utf8'), 'note\n');
	});
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
		const host = desktopGitHost(seed);
		const options = { signal: new AbortController().signal };
		const cloned = await host.clone('git', empty, remote, options);
		assert.equal(cloned.state, 'cloned');
		assert.equal(existsSync(path.join(empty, 'README.md')), true);
		assert.equal(readFileSync(path.join(seed, 'README.md'), 'utf8'), 'seed\n');
		const busy = path.join(base, 'busy-clone');
		mkdirSync(busy);
		write(busy, 'keep.txt', 'keep\n');
		const refused = await host.clone('git', busy, remote, options);
		assert.equal(refused.state, 'refused');
		assert.equal(refused.error?.kind, 'clone-target-not-empty');
		assert.equal(readFileSync(path.join(busy, 'keep.txt'), 'utf8'), 'keep\n');
		const cancelled = await host.clone('git', path.join(base, 'cancelled'), remote, { signal: AbortSignal.abort() });
		assert.equal(cancelled.state, 'cancelled');
		assert.equal(existsSync(path.join(base, 'cancelled')), false);
		const nested = await host.clone('git', path.join(seed, 'nested'), remote, options);
		assert.equal(nested.error?.kind, 'invalid-clone-target');
		assert.equal(existsSync(path.join(seed, 'nested')), false);
		const credential = await host.clone('git', path.join(base, 'credential'), 'https://user:secret@example.com/repo.git', options);
		assert.equal(credential.error?.kind, 'invalid-clone-source');
		assert.doesNotMatch(JSON.stringify(credential), /secret/);
		assert.equal((await host.clone('git', path.join(base, 'token'), 'https://example.com/repo.git?token=secret', options)).error?.kind, 'invalid-clone-source');
		const failed = await host.clone('git', path.join(base, 'failed'), path.join(base, 'missing.git'), options);
		assert.equal(failed.state, 'failed');
		assert.equal(existsSync(path.join(base, 'failed')), false);
	});

	test('files added to the target during clone survive publication refusal and cancellation', async () => {
		const { remote, work } = pushFixture('clone-race');
		for (const cancel of [false, true]) {
			const target = path.join(base, `clone-race-${cancel}`);
			mkdirSync(target);
			const controller = new AbortController();
			let receivedProgress = false;
			const result = await desktopGitHost(work).clone('git', target, pathToFileURL(remote).href, {
				 signal: controller.signal,
				 onProgress() {
					 receivedProgress = true;
					 write(target, 'user.md', 'do not delete');
					 if (cancel) controller.abort();
				 },
			});
			assert.equal(receivedProgress, true);
			assert.equal(result.state, cancel ? 'cancelled' : 'failed');
			assert.equal(readFileSync(path.join(target, 'user.md'), 'utf8'), 'do not delete');
			assert.equal(existsSync(path.join(target, '.git')), false);
			if (!cancel) {
				assert.equal(result.error?.kind, 'clone-target-not-empty');
				assert.equal(readFileSync(path.join(result.recoveryPath!, 'note.md'), 'utf8'), 'one\n');
			}
		}
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
	}, 30_000); // Three real repositories and fetch/push subprocesses, like the other integration cases.
});
