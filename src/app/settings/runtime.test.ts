import type { App } from 'obsidian';
import { afterEach, expect, test, vi } from 'vitest';
import { loadSettingsRuntime } from './runtime';
import { defineSettings, f } from '../../shared/settings/schema';
import type { SettingsFile } from '../../shared/settings/store';

const vaultFile = '.nand/config/settings.json';
const deviceFile = '.nand/config/devices/00000000-0000-0000-0000-000000000000.json';
const schema = defineSettings({ a: f.number({ default: 1 }), b: f.number({ default: 1 }), device: f.number({ default: 1, scope: 'device' }) });
afterEach(() => vi.unstubAllGlobals());

async function fixture() {
	vi.stubGlobal('window', { setTimeout, clearTimeout });
	const files = new Map<string, string>([[vaultFile, JSON.stringify({ version: 1, namespaces: { sample: { a: 1, b: 1 }, future: { obsolete: true, kept: 1 } } })]]);
	const adapter = {
		exists: async (path: string) => files.has(path),
		read: async (path: string) => { const value = files.get(path); if (value === undefined) throw new Error('missing'); return value; },
		write: async (path: string, text: string) => { files.set(path, text); },
		mkdir: async () => {},
	};
	const app = { vault: { adapter }, loadLocalStorage: () => '00000000-0000-0000-0000-000000000000' } as unknown as App;
	const runtime = await loadSettingsRuntime(app);
	return { files, adapter, runtime, handle: runtime.store.bind('sample', schema), disk: () => JSON.parse(files.get(vaultFile)!) as SettingsFile };
}

test('real settings runtime adopts external updates and deletions across successive saves', async () => {
	const f = await fixture();
	const external = f.disk(); external.namespaces.sample!.b = 2;
	external.namespaces.future = { kept: 2, added: true };
	f.files.set(vaultFile, JSON.stringify(external));
	for (const a of [2, 3, 4]) await f.handle.update(value => { value.a = a; }, { persist: 'immediate' });
	expect(f.handle.get().b).toBe(2);
	expect(f.disk().namespaces.sample).toEqual({ a: 4, b: 2 });
	expect(f.disk().namespaces.future).toEqual({ kept: 2, added: true });
	await f.runtime.store.dispose();
});

test('edits queued during a save survive its callback and retain merged external fields', async () => {
	const f = await fixture();
	const external = f.disk(); external.namespaces.sample!.b = 2; f.files.set(vaultFile, JSON.stringify(external));
	let release!: () => void, entered!: () => void;
	const blocked = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
	const write = f.adapter.write;
	let block = true;
	f.adapter.write = async (path, text) => { if (path === vaultFile && block) { block = false; entered(); await gate; } await write(path, text); };
	const first = f.handle.update(value => { value.a = 2; }, { persist: 'immediate' });
	await blocked;
	const second = f.handle.update(value => { value.a = 3; value.device = 5; }, { persist: 'immediate' });
	release(); await Promise.all([first, second]);
	expect(f.handle.get()).toEqual({ a: 3, b: 2, device: 5 });
	expect(f.disk().namespaces.sample).toEqual({ a: 3, b: 2 });
	expect(JSON.parse(f.files.get(deviceFile)!).namespaces.sample).toEqual({ device: 5 });
	await f.runtime.store.dispose();
});

test('a device write failure retains edits and does not undo a successful vault merge on retry', async () => {
	const f = await fixture();
	const external = f.disk(); external.namespaces.sample!.b = 2; f.files.set(vaultFile, JSON.stringify(external));
	const write = f.adapter.write;
	let fail = true;
	f.adapter.write = async (path, text) => { if (path === deviceFile && fail) { fail = false; throw new Error('disk full'); } await write(path, text); };
	await expect(f.handle.update(value => { value.a = 2; value.device = 4; }, { persist: 'immediate' })).rejects.toThrow('disk full');
	expect(f.handle.get()).toEqual({ a: 2, b: 2, device: 4 });
	await f.runtime.store.flush();
	expect(f.disk().namespaces.sample).toEqual({ a: 2, b: 2 });
	expect(JSON.parse(f.files.get(deviceFile)!).namespaces.sample).toEqual({ device: 4 });
	await f.runtime.store.dispose();
});
