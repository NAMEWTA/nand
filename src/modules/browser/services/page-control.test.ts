import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { BrowserPageInfo } from '../core/control';
import { BrowserOperationQueue } from '../core/operation-queue';
import { PageControl, type ControlledPage } from './page-control';

function fixture() {
	let enabled = true;
	let foreground = 'b';
	const calls: { page: string; method: string; params: Record<string, unknown> }[] = [];
	const pages = new Map<string, ControlledPage>();
	const add = (id: string, generation: string, profileId = 'default') => {
		const queue = new BrowserOperationQueue();
		const info: BrowserPageInfo = { target: { pageId: id, profileId, generation }, url: `https://example.org/${id}`, title: id, loading: false, error: null };
		pages.set(id, { info: () => info, execute: (method, params, admission) => queue.run(async () => {
			admission();
			calls.push({ page: id, method, params });
			if (method === 'screenshot') return { dataUrl: 'data:image/png;base64,AA==' };
			return { url: info.url, revision: generation + ':1', snapshot: id, refs: [] };
		}) });
		return { queue, target: { ...info.target } };
	};
	const a = add('a', 'original', 'work');
	add('b', 'other');
	const control = new PageControl({ enabled: () => enabled, pages: () => [...pages.values()],
		open: async () => 'b', activate: async id => { foreground = id; }, close: async id => { pages.delete(id); } });
	return { control, a, add, calls, pages, foreground: () => foreground, disable: () => { enabled = false; } };
}

test('background observations and actions freeze identity and parameters without changing foreground', async () => {
	const f = fixture();
	let release!: () => void;
	const blocked = f.a.queue.run(() => new Promise<void>(resolve => { release = resolve; }));
	await Promise.resolve();
	const target = { ...f.a.target }, action = { kind: 'fill' as const, ref: { revision: 'original:1', element: 'e1' }, value: 'first' };
	const pending = f.control.act(target, action);
	target.pageId = 'b'; action.value = 'second'; action.ref.element = 'e2';
	release(); await blocked;
	assert.deepEqual((await pending).target, f.a.target);
	assert.deepEqual(f.calls[0], { page: 'a', method: 'fill', params: { revision: 'original:1', element: 'e1', value: 'first' } });
	assert.equal((await f.control.observe(f.a.target)).snapshot, 'a');
	assert.match(await f.control.screenshot(f.a.target), /^data:image\/png/);
	assert.equal(f.foreground(), 'b');
	const listed = f.control.list(); listed[0]!.target = target;
	assert.equal(f.control.list()[0]!.target.pageId, 'a');
	await f.control.activate(f.a.target);
	assert.equal(f.foreground(), 'a');
	await assert.rejects(f.control.observe({ ...f.a.target, profileId: 'personal' }), /browser_stale_target/);
});

test('replacement rejects queued and late work; closure and module disable cannot retarget it', async () => {
	const f = fixture();
	let release!: () => void;
	const blocked = f.a.queue.run(() => new Promise<void>(resolve => { release = resolve; }));
	await Promise.resolve();
	const pending = f.control.act(f.a.target, { kind: 'reload' });
	const rejected = assert.rejects(pending, /browser_stale_target/);
	const replacement = f.add('a', 'replacement', 'work');
	release(); await blocked; await rejected;
	assert.equal(f.calls.length, 0);
	await assert.rejects(f.control.close(f.a.target), /browser_stale_target/);
	let complete!: (value: unknown) => void;
	const current = f.pages.get('a')!;
	f.pages.set('a', { info: current.info, execute: () => new Promise(resolve => { complete = resolve; }) });
	const late = f.control.observe(replacement.target);
	const lateRejected = assert.rejects(late, /browser_stale_target/);
	f.add('a', 'third', 'work');
	complete({ snapshot: 'old data' }); await lateRejected;
	await f.control.close(f.control.list()[0]!.target);
	await assert.rejects(f.control.observe(replacement.target), /browser_stale_target/);
	f.disable();
	assert.deepEqual(f.control.list(), []);
	await assert.rejects(f.control.observe(f.a.target), /browser_disabled/);
});
