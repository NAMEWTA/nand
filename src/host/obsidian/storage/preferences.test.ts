import type { App } from 'obsidian';
import { expect, test } from 'vitest';
import { SettingsStore, type SettingsFile } from '../../../shared/settings/store';
import { getVaultPreference, initializeVaultPreferences, setVaultPreference } from './preferences';

test('preferences migrate once, persist only in device scope and do not delete the source after a failed save', async () => {
	const local = new Map<string, unknown>([['nand.dashboard.sidebar-pinned', 'true'], ['other-plugin', 'keep']]);
	const app = { loadLocalStorage: (key: string) => local.get(key), saveLocalStorage: (key: string, value: unknown) => { expect(value).toBe(null); local.delete(key); } } as App;
	const files = new Map<string, SettingsFile>(); let fail = true;
	const store = new SettingsStore({ load: async scope => files.get(scope) ?? null, save: async (scope, file) => { if (scope === 'device' && fail) throw new Error('disk'); files.set(scope, structuredClone(file)); return structuredClone(file); } }, { timers: { set: (work, ms) => setTimeout(work, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) } });
	await store.load();
	await expect(initializeVaultPreferences(app, store)).rejects.toThrow('disk');
	expect(local.get('nand.dashboard.sidebar-pinned')).toBe('true');
	fail = false;
	await initializeVaultPreferences(app, store);
	expect(local.get('other-plugin')).toBe('keep'); expect(local.has('nand.dashboard.sidebar-pinned')).toBe(false);
	expect(getVaultPreference(app, 'nand.dashboard.sidebar-pinned')).toBe('true');
	setVaultPreference(app, 'nand.dashboard.sidebar-pinned', 'false'); await store.flush();
	expect(files.get('vault')!.namespaces['local-ui']).toBeUndefined();
	expect(files.get('device')!.namespaces['local-ui']!.values).toEqual({ 'nand.dashboard.sidebar-pinned': 'false' });
	await store.dispose();
});
