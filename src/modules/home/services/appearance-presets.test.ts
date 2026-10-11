import assert from 'node:assert/strict';
import { test } from 'vitest';
import { SettingsStore, type SettingsFile } from '../../../shared/settings/store';
import type { SettingsScope } from '../../../shared/settings/schema';
import { themeSettings } from '../../../theme/settings';
import { homeSettings } from '../settings';
import { homeDecor } from '../core/board/appearance-preset';
import { AppearancePresets } from './appearance-presets';

async function fixture() {
	const files = new Map<SettingsScope, SettingsFile>();
	let fail = false;
	const writes: SettingsFile[] = [];
	const persistence = {
		load: async (scope: SettingsScope) => files.get(scope) ?? null,
		save: async (scope: SettingsScope, file: SettingsFile) => {
			if (fail) throw new Error('disk full');
			files.set(scope, structuredClone(file));
			if (scope === 'vault') writes.push(structuredClone(file));
		},
	};
	const store = new SettingsStore(persistence, { debounceMs: 0, timers: { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) } });
	await store.load();
	const home = store.bind('home', homeSettings), theme = store.bind('theme', themeSettings);
	return { store, home, theme, files, writes, service: new AppearancePresets(store, home), fail: (value: boolean) => { fail = value; } };
}

test('named snapshots whitelist all theme/decor fields and apply both namespaces in one write', async () => {
	const f = await fixture();
	await Promise.all([
		f.theme.update(d => Object.assign(d, { preset: 'eye-care', headings: 'accented', emphasis: 'highlight', accentLight: '#123456', accentDark: '#abcdef', lineHeight: 1.8 })),
		f.home.update(d => Object.assign(d, { bgImage: 'Images/bg.png', bgFocal: { x: 12, y: 78 }, bgDim: 32, bgBlur: 4, bgSize: 'contain', surfaceOpacity: 72, glassBlur: 6, radiusScale: 19, fontScale: 'large', dashboardFile: 'Keep', workspaceFiles: ['Keep'], wereadApiKey: 'must-not-copy' })),
	]);
	const expectedTheme = structuredClone(f.theme.get()), expectedHome = homeDecor(f.home.get());
	await f.service.save('  Evening  ');
	const snapshot = f.service.presets[0]!;
	assert.equal(snapshot.name, 'Evening');
	assert.deepEqual(snapshot.theme, expectedTheme);
	assert.deepEqual(snapshot.home, expectedHome);
	assert.ok(!JSON.stringify(snapshot).includes('must-not-copy'));
	assert.ok(!JSON.stringify(snapshot).includes('Keep'));
	await Promise.all([f.theme.update(() => themeSettings.defaults()), f.home.update(d => Object.assign(d, homeDecor({})))]);
	f.writes.length = 0;
	await f.service.apply(snapshot.id);
	assert.deepEqual(f.theme.get(), expectedTheme);
	assert.deepEqual(homeDecor(f.home.get()), expectedHome);
	assert.equal(f.home.get().dashboardFile, 'Keep');
	assert.equal(f.home.get().wereadApiKey, 'must-not-copy');
	assert.equal(f.writes.length, 1);
	assert.deepEqual(f.writes[0]!.namespaces.theme, expectedTheme);
	assert.deepEqual(homeDecor(f.writes[0]!.namespaces.home), expectedHome);
	await f.store.dispose();
});

test('duplicate names reject without writes; deleting the active snapshot preserves current look', async () => {
	const f = await fixture();
	await f.service.save('Day');
	const before = f.writes.length;
	await assert.rejects(f.service.save(' day '));
	await assert.rejects(f.service.save(' '));
	assert.equal(f.writes.length, before);
	const decor = homeDecor(f.home.get()), theme = structuredClone(f.theme.get());
	await f.service.remove(f.service.activeId!);
	assert.equal(f.service.presets.length, 0);
	assert.equal(f.service.activeId, undefined);
	assert.deepEqual(f.theme.get(), theme);
	assert.deepEqual(homeDecor(f.home.get()), decor);
	await f.store.dispose();
});

test('asynchronous persistence failures reject apply and remain retryable through the existing store', async () => {
	const f = await fixture();
	await f.theme.update(d => { d.lineHeight = 2; });
	await f.service.save('Read');
	await f.theme.update(d => { d.lineHeight = 1; });
	const id = f.service.activeId!;
	f.fail(true);
	await assert.rejects(f.service.apply(id), /disk full/);
	assert.equal(f.service.status, 'error');
	assert.equal(f.theme.get().lineHeight, 2);
	assert.equal(f.files.get('vault')!.namespaces.theme!.lineHeight, 1);
	assert.equal(new AppearancePresets(f.store, f.home).status, 'error');
	f.fail(false);
	await f.service.retry();
	assert.equal(f.service.status, 'idle');
	assert.equal(f.files.get('vault')!.namespaces.theme!.lineHeight, 2);
	await f.store.dispose();
});

test('normalization uses the owner theme schema and removes malformed, duplicate and unrelated snapshot data', () => {
	const item = { id: 'one', name: ' A ', theme: { preset: 'missing', headings: 'sans', accentLight: '#ABCDEF', lineHeight: 100, credential: 'no' }, home: { bgBlur: -4, bgFocal: { x: 180, y: -2 }, fontScale: 'wrong', workspaceFiles: ['no'], wereadApiKey: 'no' } };
	const settings = homeSettings.normalize({ appearancePresets: [null, item, { ...item, id: 'two', name: 'a' }], activeAppearancePresetId: 'absent' });
	assert.equal(settings.appearancePresets.length, 1);
	assert.deepEqual(settings.appearancePresets[0]!.theme, { ...themeSettings.defaults(), accentLight: '#abcdef', lineHeight: 2.2 });
	assert.deepEqual(settings.appearancePresets[0]!.home, { ...homeDecor({}), bgFocal: { x: 100, y: 0 } });
	assert.equal(settings.activeAppearancePresetId, undefined);
});
