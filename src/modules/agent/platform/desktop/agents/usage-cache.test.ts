import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ProviderUsageCache } from './usage-cache.ts';

test('provider reads share account promises and timestamps, expire, and isolate accounts', async () => {
	let now = 100, calls = 0;
	const cache = new ProviderUsageCache(() => now);
	let release!: () => void;
	const wait = new Promise<void>(resolve => { release = resolve; });
	const read = async () => { calls++; await wait; return { provider: 'Fixture', account: 'a', status: '', windows: [] }; };
	const a = cache.read('codex:a', 60, read), b = cache.read('codex:a', 60, read);
	assert.equal(a, b);
	await Promise.resolve(); assert.equal(calls, 1);
	release(); const first = await a;
	now = 120; assert.equal(await cache.read('codex:a', 60, read), first);
	await cache.read('codex:b', 60, read); assert.equal(calls, 2);
	now = 161; assert.equal((await cache.read('codex:a', 60, read)).checkedAt, 161); assert.equal(calls, 3);
});

test('a failing endpoint is shared and retries only after expiry', async () => {
	let now = 0, calls = 0;
	const cache = new ProviderUsageCache(() => now);
	const load = async () => { calls++; throw new Error('synthetic provider unavailable'); };
	await assert.rejects(cache.read('account', 60, load));
	await assert.rejects(cache.read('account', 60, load)); assert.equal(calls, 1);
	now = 61; await assert.rejects(cache.read('account', 60, load)); assert.equal(calls, 2);
});
