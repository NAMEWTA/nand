import { expect, test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { prepareVaultContent, resolveContentCandidate } from '../../../host/obsidian/storage/content-migration';
import { SettingsStore } from '../../../shared/settings/store';
import { homeSettings, seedDashboardSettings } from '../settings';
import { BoardRegistry, type BoardRegistryHost } from './board-registry';

test('default settings saved by the real home schema never claim ordinary archive ownership', async () => {
	for (const explicitlyOrdinary of [false, true]) {
		const vault = memoryVault({ 'Archive/Done.md': 'ordinary archive' });
		await prepareVaultContent(vault.app);
		if (explicitlyOrdinary) await resolveContentCandidate(vault.app, 'Archive/Done.md', false);
		const store = new SettingsStore({ load: async () => null, save: async (scope, file) => { if (scope === 'vault') await vault.adapter.write('.nand/config/settings.json', JSON.stringify(file)); return file; } }, { timers: { set: (work, ms) => setTimeout(work, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) } });
		await store.load();
		await store.bind('home', homeSettings).update(draft => seedDashboardSettings(draft, { countdown: 'Countdown', anniversary: 'Anniversary' }), { persist: 'immediate' });
		await prepareVaultContent(vault.app);
		expect(vault.contents.get('Archive/Done.md')).toBe('ordinary archive');
		expect(vault.contents.has('.nand/content/Archive/Done.md')).toBe(false);
	}
});

test('the board registry follows completed moves during recovery and after a missed event at restart', async () => {
	for (const failure of ['copy', 'finish']) {
		const vault = memoryVault({ '.nand/content/Old.md': 'board', 'Ref.md': '[[Old]]' }), files = contentFiles(vault.app); await files.refresh();
		let state: ReturnType<BoardRegistryHost['read']> = { dashboardFile: '.nand/content/Old', workspaceFiles: ['.nand/content/Old'], workspaceNames: ['My board'] };
		const host: BoardRegistryHost = { app: vault.app, read: () => state, write: async next => { state = next; }, repointAll: async () => {}, refreshAll: () => {} };
		const registry = new BoardRegistry(host); registry.watch(() => {});
		let failed = false; const copy = vault.adapter.copy, write = vault.adapter.write;
		vault.adapter.copy = async (from, to) => { await copy(from, to); if (failure === 'copy' && !failed && to === '.nand/content/New.md') { failed = true; throw new Error('copy completed'); } };
		vault.adapter.write = async (path, text) => { if (failure === 'finish' && !failed && path === '.nand/content-moves/manifest.json' && !text.includes('"pending"')) { failed = true; throw new Error('finish denied'); } await write(path, text); };
		try { await files.rename(files.getFileByPath('.nand/content/Old.md')!, '.nand/content/New.md'); } catch { /* Commit can precede a failed acknowledgement. */ }
		await files.refresh(); await registry.prune();
		expect(state).toEqual({ dashboardFile: '.nand/content/New', workspaceFiles: ['.nand/content/New'], workspaceNames: ['My board'] });
		const restart = memoryVault(Object.fromEntries(vault.contents)); await contentFiles(restart.app).refresh();
		state = { dashboardFile: '.nand/content/Old', workspaceFiles: ['.nand/content/Old'], workspaceNames: ['My board'] };
		const reopened = new BoardRegistry({ ...host, app: restart.app }); await reopened.recoverMoves(); reopened.watch(() => {}); await reopened.prune();
		expect(state.dashboardFile).toBe('.nand/content/New');
	}
});
