import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ScopedBrowserRuns } from './scoped-runs';
import type { ScopedBrowserConnection } from '../core/scoped-grant';

const definition = { id: 'grant', taskId: 'task', targets: [{ pageId: 'page', profileId: 'profile', generation: 'generation' }], operations: ['snapshot'] as const, expiresAt: 100, maxOperations: 10 };
const run = (id: string, signal = new AbortController().signal) => ({ runId: id, cwd: '/fixture', signal });
const scope = () => ({ ...definition, targets: [...definition.targets], operations: [...definition.operations] });

test('one handle cannot be redeemed twice or by another run and credentials exist only in the returned lease', async () => {
	let id = 0, issued = 0, revoked = 0;
	const contexts = new ScopedBrowserRuns({ id: () => `handle-${++id}`, now: () => 1, connect: async () => {
		issued++; return { environment: { NAND_BROWSER_TOKEN: 'runtime-only-token' }, dispose: () => { revoked++; } };
	} });
	const prepared = contexts.create(scope(), () => ({ execute: async () => 'data' }));
	assert.equal(JSON.stringify(prepared).includes('runtime-only-token'), false);
	const first = contexts.resolve(prepared.handle, run('first'));
	assert.equal(await contexts.resolve(prepared.handle, run('first')), undefined); assert.equal(await contexts.resolve(prepared.handle, run('other')), undefined);
	const lease = await first; assert.equal(lease?.env.NAND_BROWSER_TOKEN, 'runtime-only-token'); assert.equal(issued, 1);
	await lease!.dispose(); await lease!.dispose(); assert.equal(revoked, 1); assert.throws(() => prepared.grant.assertActive(), /revoked/); contexts.dispose();
});

test('cancellation or module shutdown during connection setup revokes a late connection instead of returning credentials', async () => {
	for (const shutdown of [false, true]) {
		let complete!: (connection: ScopedBrowserConnection) => void, revoked = 0;
		const contexts = new ScopedBrowserRuns({ id: () => 'handle', now: () => 1, connect: async () => new Promise(resolve => { complete = resolve; }) });
		const prepared = contexts.create(scope(), () => ({ execute: async () => null })), cancel = new AbortController();
		const resolving = contexts.resolve(prepared.handle, run('run', cancel.signal));
		if (shutdown) contexts.dispose(); else cancel.abort();
		complete({ environment: { NAND_BROWSER_TOKEN: 'late-secret' }, dispose: () => { revoked++; } });
		assert.equal(await resolving, undefined); assert.equal(revoked, 1); assert.throws(() => prepared.grant.assertActive(), /revoked/); contexts.dispose();
	}
});

test('expired handles cannot resolve and active run cancellation revokes the connection immediately', async () => {
	let now = 1, revoked = 0, serial = 0;
	const contexts = new ScopedBrowserRuns({ id: () => `handle-${++serial}`, now: () => now, connect: async () => ({ environment: {}, dispose: () => { revoked++; } }) });
	let prepared = contexts.create(scope(), () => ({ execute: async () => null })); now = 100;
	await assert.rejects(contexts.resolve(prepared.handle, run('expired')), /expired/); assert.equal(revoked, 0);
	now = 1; prepared = contexts.create(scope(), () => ({ execute: async () => null })); const cancel = new AbortController();
	await contexts.resolve(prepared.handle, run('active', cancel.signal)); cancel.abort(); assert.equal(revoked, 1);
	assert.equal(await contexts.resolve(prepared.handle, run('replay')), undefined); contexts.dispose();
});

test('disposed handles cannot be issued for a new authority even if an id source repeats', () => {
	const contexts = new ScopedBrowserRuns({ id: () => 'same-handle', now: () => 1, connect: async () => ({ environment: {}, dispose: () => {} }) });
	const prepared = contexts.create(scope(), () => ({ execute: async () => null })); prepared.dispose();
	assert.throws(() => contexts.create(scope(), () => ({ execute: async () => null })), /grant_invalid/);
	prepared.dispose(); contexts.dispose();
});

test('a connection that finishes after grant expiry is disposed before credentials can escape', async () => {
	let now = 1, revoked = 0;
	const contexts = new ScopedBrowserRuns({ id: () => 'handle', now: () => now, connect: async () => {
		now = 100; return { environment: { NAND_BROWSER_TOKEN: 'expired-secret' }, dispose: () => { revoked++; } };
	} });
	const prepared = contexts.create(scope(), () => ({ execute: async () => null }));
	await assert.rejects(contexts.resolve(prepared.handle, run('late')), /expired/); assert.equal(revoked, 1); contexts.dispose();
});
