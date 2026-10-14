import { expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { BrowserStore } from './store';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
vi.mock('../../../host/obsidian/storage/device-id', () => ({
	deviceId: () => 'device',
	vaultIdentity: () => ({ vaultId: 'vault' }),
}));
vi.mock('../../../host/obsidian/storage/private-storage', () => ({ privateVaultStorage: vi.fn() }));
it('does not write another visit for a guest recreated in a different Document', async () => {
	const files = new Map<string, string>();
	const write = vi.fn(async (path: string, value: string) => {
		files.set(path, value);
	});
	vi.mocked(privateVaultStorage).mockReturnValue({
		exists: async (path) => files.has(path),
		read: async (path) => files.get(path)!,
		write,
		mkdir: async () => {},
	});
	const store = new BrowserStore({} as App);
	await store.ready;
	store.record('https://example.com/one', 'First');
	store.record('https://example.com/two', 'Second');
	expect(store.history.map((item) => item.title)).toEqual(['Second', 'First']);
	await store.ready;
	await new Promise((resolve) => setTimeout(resolve, 0));
	const before = files.get('.nand/browser/device/state.json');
	const writes = write.mock.calls.length;
	expect(writes).toBeGreaterThan(0);
	store.record('about:blank', '');
	store.record('https://example.com/two', '');
	store.record('https://example.com/two', 'Second');
	await store.shutdown();
	expect(write).toHaveBeenCalledTimes(writes);
	expect(files.get('.nand/browser/device/state.json')).toBe(before);
	const saved = JSON.parse(files.get('.nand/browser/device/state.json')!);
	expect(saved.history.map((item: { title: string }) => item.title)).toEqual(['Second', 'First']);
});
