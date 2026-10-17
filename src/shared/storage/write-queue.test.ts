import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { WriteQueue } from './write-queue';
import { useStorageTimers, type StorageTimers } from './timers';

beforeEach(() => { vi.useFakeTimers(); useStorageTimers(globalThis as unknown as StorageTimers); });
afterEach(() => { vi.useRealTimers(); useStorageTimers(undefined); });

test('tasks of one key run strictly in order and a failure does not block the next', async () => {
	const queue = new WriteQueue(), order: string[] = [];
	let release!: () => void;
	const first = queue.run('k', async () => { order.push('first'); await new Promise<void>(resolve => { release = resolve; }); throw new Error('boom'); });
	const second = queue.run('k', async () => { order.push('second'); return 2; });
	const other = queue.run('other', async () => 'free');
	await expect(other).resolves.toBe('free');
	expect(order).toEqual(['first']);
	release();
	await expect(first).rejects.toThrow('boom');
	await expect(second).resolves.toBe(2);
});

test('a follow-up queued from inside a task without awaiting it still runs in order afterwards', async () => {
	const queue = new WriteQueue(), order: string[] = [];
	let followup!: Promise<unknown>;
	await queue.run('k', async () => {
		order.push('outer');
		followup = queue.run('k', async () => { order.push('follow-up'); });
	});
	await followup;
	expect(order).toEqual(['outer', 'follow-up']);
});

test('a task holding its key too long is reported once, with its label, and is never released early', async () => {
	const warn = vi.fn(), queue = new WriteQueue({ holdWarnMs: 1000, warn });
	let finish!: () => void;
	const held = queue.run('nand-content:mutation', () => new Promise<void>(resolve => { finish = resolve; }), 'refresh');
	let waited = false;
	const next = queue.run('nand-content:mutation', async () => { waited = true; });
	await vi.advanceTimersByTimeAsync(5000);
	expect(warn).toHaveBeenCalledTimes(1);
	expect(warn.mock.calls[0]![1]).toMatchObject({ key: 'nand-content:mutation', label: 'refresh' });
	expect(warn.mock.calls[0]![1].heldMs).toBeGreaterThanOrEqual(1000);
	expect(waited).toBe(false);
	finish();
	await held; await next;
	expect(waited).toBe(true);
});

test('a task that finishes in time is not reported', async () => {
	const warn = vi.fn(), queue = new WriteQueue({ holdWarnMs: 1000, warn });
	await queue.run('k', async () => undefined);
	await vi.advanceTimersByTimeAsync(5000);
	expect(warn).not.toHaveBeenCalled();
});
