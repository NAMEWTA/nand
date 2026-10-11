import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PageOwnership } from './page-ownership';

const target = { pageId: 'page', profileId: 'default', generation: 'first' };
test('task and external control share exclusive page admission, including queued work on the same generation', () => {
	const ownership = new PageOwnership(), signal = new AbortController(), owner = { kind: 'workspace' as const, id: 'task' };
	const lease = ownership.claim(target, owner, signal.signal); lease.admit();
	assert.throws(() => ownership.claim(target, { kind: 'control', id: 'bridge' }, signal.signal), /workspace_busy/);
	assert.throws(() => ownership.claim({ ...target, generation: 'second' }, owner, signal.signal), /workspace_busy/);
	owner.id = 'caller-edit'; assert.equal(ownership.owner(target)!.id, 'task');
	lease.release(); assert.equal(lease.signal.aborted, true); assert.throws(() => lease.admit(), /workspace_paused/);
	const next = ownership.claim(target, { kind: 'control', id: 'external' }, signal.signal);
	lease.release(); next.admit(); next.release();
});
test('pause and human takeover revoke old admissions without releasing a later owner or another profile', () => {
	const ownership = new PageOwnership(), signal = new AbortController(); let revoked = 0;
	const lease = ownership.claim(target, { kind: 'workspace', id: 'task' }, signal.signal, () => { revoked++; });
	const separate = ownership.claim({ ...target, profileId: 'other' }, { kind: 'workspace', id: 'other-task' }, signal.signal);
	ownership.revoke({ ...target, generation: 'stale' }); lease.admit();
	ownership.revoke(target); assert.equal(revoked, 1); assert.throws(() => lease.admit(), /workspace_paused/); separate.admit();
	const next = ownership.claim(target, { kind: 'control', id: 'new' }, signal.signal);
	signal.abort(); assert.equal(next.signal.aborted, true); assert.equal(separate.signal.aborted, true); assert.equal(revoked, 1);
	assert.equal(ownership.owner(target), undefined); assert.throws(() => ownership.claim(target, { kind: 'control', id: 'late' }, signal.signal), /workspace_paused/);
});
test('ordinary control operations can queue together but exclude task input until every admission settles', () => {
	const ownership = new PageOwnership(), signal = new AbortController().signal;
	const first = ownership.claim(target, { kind: 'control', id: 'first' }, signal);
	const queued = ownership.claim(target, { kind: 'control', id: 'queued' }, signal);
	first.release(); queued.admit();
	assert.throws(() => ownership.claim(target, { kind: 'workspace', id: 'task' }, signal), /workspace_busy/);
	ownership.revoke(target); assert.throws(() => queued.admit(), /workspace_paused/);
	const task = ownership.claim(target, { kind: 'workspace', id: 'task' }, signal);
	queued.release(); task.admit(); task.release();
});
