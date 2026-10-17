// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { addProfile, editProfile, removeProfile } from '../core/profiles';
import { makeShortcut } from '../core/shortcuts';
import { FakeVault, createTestService, note } from './test-support';

const vault = () => new FakeVault([note('Work/a.md', 5), note('Home/b.md', 4), note('Secret/c.md', 3)], ['/', 'Work', 'Home', 'Secret']);

test('switching profiles swaps hiding rules, shortcuts and the recent list', async () => {
	const { service, settings } = await createTestService(vault(), { settings: { hiddenFolders: ['Secret'], shortcuts: [makeShortcut('folder', 'Work')], recent: ['Work/a.md'] } });
	const added = addProfile(settings.get().profiles, 'Personal', 'Default');
	await settings.update((draft) => { draft.profiles = added.profiles; });
	expect(service.profiles().map((profile) => [profile.name, profile.active])).toEqual([['Default', true], ['Personal', false]]);
	expect(service.visibleFolders()).not.toContain('Secret');

	service.switchProfile(added.id);
	await new Promise((resolve) => setTimeout(resolve, 0));
	const s = settings.get();
	expect(s.activeProfile).toBe(added.id);
	expect(s.hiddenFolders).toEqual([]);
	expect(s.shortcuts).toEqual([]);
	expect(s.recent).toEqual([]);
	expect(service.visibleFolders()).toContain('Secret');
	expect(service.profiles().find((profile) => profile.active)?.name).toBe('Personal');

	service.hideEntry('folder', 'Home');
	service.toggleShortcut(makeShortcut('folder', 'Home'));
	service.recordRecent('Home/b.md');
	await new Promise((resolve) => setTimeout(resolve, 0));

	service.switchProfile('default');
	await new Promise((resolve) => setTimeout(resolve, 0));
	const back = settings.get();
	expect(back.hiddenFolders).toEqual(['Secret']);
	expect(back.shortcuts.map((shortcut) => shortcut.key)).toEqual(['Work']);
	expect(back.recent).toEqual(['Work/a.md']);
	expect(back.profiles.find((profile) => profile.id === added.id)?.hiddenFolders).toEqual(['/Home']);
	expect(back.profileRecent[added.id]).toEqual(['Home/b.md']);
});

test('the dashboard lists follow the active profile', async () => {
	const { service, settings } = await createTestService(vault(), { settings: { shortcuts: [makeShortcut('folder', 'Work')] } });
	const added = addProfile(settings.get().profiles, 'Other', 'Default');
	await settings.update((draft) => { draft.profiles = added.profiles; });
	expect(service.listsSnapshot().shortcuts).toHaveLength(1);
	service.switchProfile(added.id);
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(service.listsSnapshot().shortcuts).toEqual([]);
});

test('a profile switched on another device brings this device its own recent list', async () => {
	const { service, settings } = await createTestService(vault(), { settings: { recent: ['Work/a.md'] } });
	const added = addProfile(settings.get().profiles, 'Other', 'Default');
	await settings.update((draft) => { draft.profiles = added.profiles; draft.activeProfile = added.id; });
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(settings.get().recent).toEqual([]);
	expect(settings.get().recentOwner).toBe(added.id);
	expect(settings.get().profileRecent['default']).toEqual(['Work/a.md']);
	service.dispose();
});

test('profiles can be renamed and removed, but not the one in use', () => {
	const added = addProfile([], 'Work', 'Default');
	const renamed = editProfile(added.profiles, added.id, { name: ' Job ', banner: 'img.png' }, 'Default');
	expect(renamed.find((profile) => profile.id === added.id)).toMatchObject({ name: 'Job', banner: 'img.png' });
	expect(removeProfile(renamed, added.id, added.id, 'Default')).toHaveLength(2);
	expect(removeProfile(renamed, added.id, 'default', 'Default').map((profile) => profile.id)).toEqual(['default']);
	expect(removeProfile([], 'default', 'default', 'Default')).toEqual([]);
});
