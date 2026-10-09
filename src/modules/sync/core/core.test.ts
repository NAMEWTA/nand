import assert from 'node:assert/strict';
import { test } from 'vitest';
import { formatCommitMessage, resolveCommitMode } from './commit-mode';
import { parseConflictBlocks, resolveBlock, hasConflictBlocks } from './conflict-blocks';
import { classifyGitOutput, detailOf, needsAttention, scrub } from './errors';
import { blocker, succeeded } from './flow';
import { normalizeDeviceState } from './ports';
import { CancelledError, OperationQueue } from './queue';
import { MAX_DELAY, nextDelay } from './schedule';
import { changeCount, parseStatus } from './status';

test('porcelain v2 status: branch header, renames, conflicts, untracked paths with spaces and CJK', () => {
	const output = [
		'# branch.oid 1234567890abcdef',
		'# branch.head main',
		'# branch.upstream origin/main',
		'# branch.ab +2 -1',
		'1 M. N... 100644 100644 100644 aaa bbb staged only.md',
		'1 .M N... 100644 100644 100644 aaa bbb 笔记/未暂存 文件.md',
		'1 MM N... 100644 100644 100644 aaa bbb both.md',
		'2 R. N... 100644 100644 100644 aaa bbb R100 新名字.md',
		'旧名字.md',
		'u UU N... 100644 100644 100644 100644 aaa bbb ccc 冲突 文件.md',
		'u DU N... 100644 000000 100644 100644 aaa bbb ccc deleted-by-us.md',
		'? 新 文件.md',
		'',
	].join('\0');
	const status = parseStatus(output);
	assert.equal(status.head, '1234567890abcdef');
	assert.equal(status.branch, 'main');
	assert.equal(status.upstream, 'origin/main');
	assert.equal(status.upstreamGone, false);
	assert.deepEqual([status.ahead, status.behind], [2, 1]);
	assert.deepEqual(status.staged.map((change) => change.path), ['staged only.md', 'both.md', '新名字.md']);
	assert.equal(status.staged[2]?.from, '旧名字.md');
	assert.equal(status.staged[2]?.index, 'R');
	assert.deepEqual(status.unstaged.map((change) => change.path), ['笔记/未暂存 文件.md', 'both.md']);
	assert.deepEqual(status.conflicted.map((change) => [change.path, change.index, change.worktree]), [['冲突 文件.md', 'U', 'U'], ['deleted-by-us.md', 'D', 'U']]);
	assert.deepEqual(status.untracked, ['新 文件.md']);
	assert.equal(changeCount(status), 7);
});

test('status before the first commit, on a detached HEAD, and with a vanished upstream', () => {
	const initial = parseStatus(['# branch.oid (initial)', '# branch.head main', ''].join('\0'));
	assert.equal(initial.head, null);
	assert.equal(initial.branch, 'main');
	assert.equal(initial.upstream, null);
	const detached = parseStatus(['# branch.oid abc', '# branch.head (detached)', ''].join('\0'));
	assert.equal(detached.branch, null);
	const gone = parseStatus(['# branch.oid abc', '# branch.head main', '# branch.upstream origin/main', ''].join('\0'));
	assert.equal(gone.upstreamGone, true);
	assert.equal(blocker(detached, null), 'detached');
	assert.equal(blocker(initial, null), null);
	assert.equal(blocker(initial, 'merge'), 'conflict');
});

test('git failures are classified from their English output, and credentials are scrubbed', () => {
	const cases: Array<[string, string]> = [
		["fatal: Unable to create '/v/.git/index.lock': File exists.", 'locked'],
		['fatal: not a git repository (or any of the parent directories): .git', 'not-repo'],
		['fatal: could not read Username for \'https://github.com\': terminal prompts disabled', 'auth'],
		['git@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository.', 'auth'],
		['remote: Permission to me/vault.git denied to other.\nfatal: unable to access', 'permission'],
		["fatal: '/tmp/missing.git' does not appear to be a git repository", 'remote-missing'],
		[' ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs', 'rejected'],
		['error: Your local changes to the following files would be overwritten by merge:', 'local-changes'],
		['CONFLICT (content): Merge conflict in a.md\nAutomatic merge failed', 'conflict'],
		['*** Please tell me who you are.', 'identity'],
		["ssh: Could not resolve hostname github.com: Name or service not known", 'network'],
		['fatal: unable to access \'https://127.0.0.1:1/x.git/\': Failed to connect to 127.0.0.1 port 1: Connection refused', 'network'],
		['something else entirely', 'unknown'],
	];
	for (const [output, kind] of cases) assert.equal(classifyGitOutput(output), kind, output);
	assert.equal(scrub('https://me:ghp_secret@github.com/me/vault.git'), 'https://***@github.com/me/vault.git');
	assert.equal(detailOf('', 'hint: try this\nfatal: https://u:p@host/x failed').includes('u:p'), false);
	assert.equal(needsAttention('network'), false);
	assert.equal(needsAttention('auth'), true);
});

test('commit modes follow obsidian-git: staged first, smart stages all only when allowed', () => {
	assert.equal(resolveCommitMode('smart', true, true), 'staged');
	assert.equal(resolveCommitMode('smart', false, true), 'all');
	assert.equal(resolveCommitMode('smart', false, false), 'nothing');
	assert.equal(resolveCommitMode('staged', false, true), 'nothing');
	assert.equal(resolveCommitMode('staged', true, false), 'staged');
	assert.equal(resolveCommitMode('all', true, false), 'all');
	const message = formatCommitMessage('backup {{date}} on {{hostname}}: {{numFiles}} ({{files}})', { date: '2026-10-08', hostname: 'pc', files: ['a.md', 'b.md'] }, true);
	assert.equal(message, 'backup 2026-10-08 on pc: 2 (a.md, b.md)\n\na.md\nb.md');
});

test('conflict blocks: two-way and diff3, choices, and malformed markers', () => {
	const text = 'start\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> origin/main\nmiddle\n<<<<<<< ours\na\n||||||| base\nb\n=======\nc\n>>>>>>> theirs\nend\n<<<<<<< broken\nno end\n';
	const blocks = parseConflictBlocks(text);
	assert.equal(blocks.length, 2);
	assert.deepEqual([blocks[0]?.ours, blocks[0]?.theirs, blocks[0]?.oursLabel, blocks[0]?.theirsLabel], ['mine\n', 'theirs\n', 'HEAD', 'origin/main']);
	assert.equal(blocks[1]?.base, 'b\n');
	assert.equal(text.slice(blocks[0]!.from, blocks[0]!.to), '<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> origin/main\n');
	assert.equal(resolveBlock(blocks[0]!, 'ours'), 'mine\n');
	assert.equal(resolveBlock(blocks[0]!, 'theirs'), 'theirs\n');
	assert.equal(resolveBlock(blocks[0]!, 'both'), 'mine\ntheirs\n');
	assert.equal(resolveBlock(blocks[1]!, 'base'), 'b\n');
	assert.equal(hasConflictBlocks('a <<<<<<< not at line start\n=======\n>>>>>>>'), false);
	assert.equal(hasConflictBlocks('<<<<<<<\nx\n=======\ny\n>>>>>>>'), true);
});

test('the queue runs one task at a time, keeps going after a failure, and coalesces waiting duplicates', async () => {
	const order: string[] = [];
	let release!: () => void;
	const gate = new Promise<void>((resolve) => { release = resolve; });
	const queue = new OperationQueue();
	const first = queue.enqueue('a', 'first', async () => { order.push('first:start'); await gate; order.push('first:end'); return 1; });
	const failing = queue.enqueue('b', 'failing', async () => { order.push('failing'); throw new Error('boom'); });
	const third = queue.enqueue('c', 'third', async () => { order.push('third'); return 3; });
	const duplicate = queue.enqueue('c', 'third again', async () => { order.push('duplicate'); return 4; });
	assert.equal(queue.running, 'first');
	release();
	assert.equal(await first, 1);
	await assert.rejects(failing, /boom/);
	assert.equal(await third, 3);
	assert.equal(await duplicate, 3);
	assert.deepEqual(order, ['first:start', 'first:end', 'failing', 'third']);
	assert.equal(queue.busy, false);
});

test('clearing the queue rejects waiting tasks; a closed queue refuses new ones', async () => {
	let release!: () => void;
	const queue = new OperationQueue();
	const running = queue.enqueue('a', 'a', () => new Promise<void>((resolve) => { release = resolve; }));
	const waiting = queue.enqueue('b', 'b', async () => 'never');
	const closing = queue.close();
	await assert.rejects(waiting, CancelledError);
	await assert.rejects(queue.enqueue('c', 'c', async () => 1), CancelledError);
	release();
	await running;
	await closing;
});

test('automatic sync clocks continue from the last run and are off at zero minutes', () => {
	const now = 10 * 60_000;
	assert.equal(nextDelay(0, 0, now), null);
	assert.equal(nextDelay(5, 0, now), 5 * 60_000);
	assert.equal(nextDelay(5, now - 2 * 60_000, now), 3 * 60_000);
	assert.equal(nextDelay(5, now - 20 * 60_000, now), 0);
	assert.equal(nextDelay(5, now + 60_000, now), 5 * 60_000);
	assert.equal(nextDelay(60 * 24 * 365, 0, now), MAX_DELAY);
	assert.deepEqual(normalizeDeviceState({ lastCommit: 5, paused: 'nope', failures: -2 }), { lastCommit: 5, lastPull: 0, lastPush: 0, paused: '', failures: 0 });
	assert.equal(succeeded([{ step: 'commit', state: 'nothing' }, { step: 'pull', state: 'skipped', reason: 'no-upstream' }, { step: 'push', state: 'done', count: 1, upstreamSet: true }]), true);
	assert.equal(succeeded([{ step: 'commit', state: 'done', count: 1 }, { step: 'pull', state: 'conflict', count: 1 }, { step: 'push', state: 'skipped', reason: 'blocked' }]), false);
});
