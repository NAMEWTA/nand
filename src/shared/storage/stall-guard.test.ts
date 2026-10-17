import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { reissueIfStalled } from './stall-guard';
import { useStorageTimers, type StorageTimers } from './timers';

beforeEach(() => {
	vi.useFakeTimers();
	useStorageTimers(globalThis as unknown as StorageTimers);
	vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
	vi.useRealTimers();
	useStorageTimers(undefined);
	vi.restoreAllMocks();
});

test('a request that settles in time is issued once', async () => {
	const request = vi.fn(async () => 'value');
	await expect(reissueIfStalled('lstat', request, { stallMs: 100 })).resolves.toBe('value');
	await vi.advanceTimersByTimeAsync(1000);
	expect(request).toHaveBeenCalledTimes(1);
});

test('a dropped request is issued again and the first settlement wins', async () => {
	let calls = 0;
	const request = vi.fn(() => (++calls === 1 ? new Promise<string>(() => undefined) : Promise.resolve('second')));
	const result = reissueIfStalled('lstat', request, { stallMs: 100 });
	await vi.advanceTimersByTimeAsync(100);
	await expect(result).resolves.toBe('second');
	expect(request).toHaveBeenCalledTimes(2);
});

test('a late answer from an earlier attempt is ignored', async () => {
	const resolvers: Array<(value: string) => void> = [];
	const result = reissueIfStalled('read', () => new Promise<string>(resolve => { resolvers.push(resolve); }), { stallMs: 100 });
	await vi.advanceTimersByTimeAsync(100);
	resolvers[1]!('newer');
	resolvers[0]!('older');
	await expect(result).resolves.toBe('newer');
});

test('an error is passed through without another attempt', async () => {
	const request = vi.fn(() => Promise.reject(new Error('ENOENT')));
	await expect(reissueIfStalled('lstat', request, { stallMs: 100 })).rejects.toThrow('ENOENT');
	await vi.advanceTimersByTimeAsync(1000);
	expect(request).toHaveBeenCalledTimes(1);
});

test('a request dropped on every attempt fails instead of waiting forever', async () => {
	const request = vi.fn(() => new Promise<string>(() => undefined));
	const result = reissueIfStalled('stat', request, { stallMs: 100, attempts: 3 });
	const failure = expect(result).rejects.toThrow('nand-storage.fs-stalled: stat');
	await vi.advanceTimersByTimeAsync(300);
	await failure;
	expect(request).toHaveBeenCalledTimes(3);
});
