import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ScopedBrowserGrant, type ScopedBrowserGrantDefinition } from './scoped-grant';

const page = { pageId: 'page', profileId: 'account', generation: 'generation' };
const definition = (): ScopedBrowserGrantDefinition => ({ id: 'grant', taskId: 'task', targets: [{ ...page }], operations: ['snapshot', 'fill'], expiresAt: 100, maxOperations: 3 });

test('exact page, profile, generation and operation scopes cannot be widened by mutating a returned description', () => {
	const input = definition(), grant = new ScopedBrowserGrant(input, () => 1);
	input.targets[0] = { ...page, pageId: 'other' }; input.operations.push('click');
	const shown = grant.inspect(); shown.targets[0] = { ...page, profileId: 'other' }; shown.operations.push('click');
	grant.reserve('fill', page).admit();
	for (const target of [{ ...page, pageId: 'other' }, { ...page, profileId: 'other' }, { ...page, generation: 'replacement' }])
		assert.throws(() => grant.reserve('fill', target), /grant_scope/);
	for (const operation of ['click', 'tab.create', 'eval', 'shell']) assert.throws(() => grant.reserve(operation, page), /grant_scope/);
	assert.equal(grant.inspect().used, 1);
});

test('pause immediately stops queued admission and resume cannot revive an old permit', () => {
	const grant = new ScopedBrowserGrant(definition(), () => 1), queued = grant.reserve('fill', page);
	grant.pause(); assert.throws(() => queued.admit(), /grant_paused/); assert.throws(() => grant.reserve('snapshot', page), /grant_paused/);
	grant.resume(); assert.throws(() => queued.admit(), /grant_stale/); grant.reserve('snapshot', page).admit();
	grant.revoke(); assert.throws(() => grant.resume(), /grant_revoked/); assert.throws(() => grant.reserve('fill', page), /grant_revoked/);
});

test('time and operation budgets are enforced at request and final native admission without reset on resume', () => {
	let now = 1; const grant = new ScopedBrowserGrant(definition(), () => now);
	const first = grant.reserve('snapshot', page); first.admit(); first.admit(); assert.equal(grant.inspect().used, 1);
	grant.pause(); grant.resume(); assert.throws(() => grant.reserve('get', page), /grant_scope/);
	grant.reserve('snapshot', page).admit(); const final = grant.reserve('fill', page); final.admit();
	assert.throws(() => grant.reserve('snapshot', page), /grant_limit/); assert.equal(grant.inspect().used, 3);
	now = 100; assert.throws(() => final.admit(), /grant_expired/); grant.pause(); assert.throws(() => grant.resume(), /grant_expired/);
});

test('empty, ambiguous, expired and unbounded definitions are rejected', () => {
	for (const change of [{ targets: [] }, { targets: [page, { ...page, generation: 'different' }] }, { operations: [] },
		{ operations: ['snapshot', 'snapshot'] }, { maxOperations: 0 }, { maxOperations: Infinity }, { maxOperations: 201 }, { expiresAt: 1 }, { expiresAt: 1_800_002 }]) {
		assert.throws(() => new ScopedBrowserGrant({ ...definition(), ...change } as ScopedBrowserGrantDefinition, () => 1), /grant_invalid/);
	}
});
