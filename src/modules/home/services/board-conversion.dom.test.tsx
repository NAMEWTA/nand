import { afterEach, expect, test, vi } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { setLanguage } from '../../../shared/i18n';
import { DEFAULT_DASHBOARD_SETTINGS } from '../core/board/types/model';
import { parse } from '../core/board/parser/parse';
import { BoardStore } from './board-store';
import type { HomeHost } from './home-host';

vi.mock('obsidian', async (original) => ({
	...(await original<typeof import('obsidian')>()),
	Component: class {
		load() {}
		unload() {}
	},
}));
vi.mock('./instances', () => ({ homeServices: {} }));

const board = '.nand/content/board.md';
const oldImmersive =
	'---\nlayout: immersive\nwidgets: [{"memberId":"home:pomodoro:default","provider":"home","kind":"pomodoro","instanceId":"default"}]\nimmersive: [{"id":"widget:pomodoro","w":3,"cap":24,"x":0,"y":0}]\nbanner:\n  quote: "Preserve old banner"\n  author: "A"\n---\n\n## Notes\n\n### One\nid: one\ntype: generic\nBody one.\n';
const oldStacked =
	'---\nlayout: stacked\nbanner:\n  quote: "Stacked banner"\n  author: "B"\n---\n\n## Notes\n\n### One\nid: one\ntype: generic\nBody one.\n';
const stores: BoardStore[] = [];
afterEach(async () => {
	for (const store of stores.splice(0)) await store.dispose();
});
async function open(text: string, legacyWidgetMembers?: HomeHost['settings']['legacyWidgetMembers']) {
	setLanguage('en');
	const vault = memoryVault({ [board]: text }, window);
	await contentFiles(vault.app).refresh();
	const settings = { ...structuredClone(DEFAULT_DASHBOARD_SETTINGS), legacyWidgetMembers };
	const host = {
		app: vault.app,
		settings,
		subscribeSettings: () => () => {},
		workbenchRefresh: () => {},
	} as unknown as HomeHost;
	const store = new BoardStore(host, '.nand/content/board', window);
	stores.push(store);
	await store.init();
	return { vault, store };
}

test('opening an old immersive board converts it once through the real entry: the banner becomes a widget', async () => {
	const { vault, store } = await open(oldImmersive);
	const written = parse(vault.contents.get(board)!);
	expect(written.canvas).toBe(1);
	expect(written.widgets?.map((member) => member.kind)).toEqual(['banner', 'pomodoro']);
	expect(written.banner.quote).toBe('Preserve old banner');
	expect(written.immersive?.find((tile) => tile.id === 'widget:pomodoro')).toMatchObject({
		x: 0,
		y: 0,
		w: 3,
		cap: 24,
	});
	expect(store.state.getState().data?.widgets?.map((member) => member.kind)).toContain('banner');
});

test('a removed banner stays removed: reopening a converted board does not convert again', async () => {
	const { vault, store } = await open(oldImmersive);
	await store.sync.setBoardMembers(
		(store.state.getState().data!.widgets ?? []).filter((member) => member.kind !== 'banner'),
	);
	const removed = vault.contents.get(board)!;
	expect(parse(removed).widgets?.map((member) => member.kind)).toEqual(['pomodoro']);
	const reopened = await open(removed);
	expect(reopened.vault.contents.get(board)).toBe(removed);
	expect(reopened.store.state.getState().data?.widgets?.map((member) => member.kind)).toEqual(['pomodoro']);
});

test('an old stacked board converts with the sidebar widgets the old settings had enabled', async () => {
	const { vault } = await open(oldStacked, [
		{ memberId: 'home:calendar:default', provider: 'home', kind: 'calendar', instanceId: 'default' },
	]);
	const written = parse(vault.contents.get(board)!);
	expect(written.widgets?.map((member) => member.kind)).toEqual(['banner', 'calendar']);
	expect(written.legacyLayout).toBeUndefined();
	expect(vault.contents.get(board)).toContain('Body one.');
});
