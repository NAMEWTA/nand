import { expect, test } from 'vitest';
import { boardTileSources, boardTiles, persistedBoardTiles, pixelsToRows, rowsToPixels } from './board-tiles';
import { parse } from './parser/parse';

test('mixed sources render standalone cards once and retain unavailable tile references', () => {
	const data = parse('## Notes\n\n### One\nid: one\ntype: generic\nBody one.\n\n### Two\nid: two\ntype: generic\nBody two.\n');
	data.widgets = [{ memberId: 'news', provider: 'news', kind: 'news-hot', instanceId: 'default' }];
	data.immersive = [{ id: 'one', w: 4, cap: 40 }, { id: 'deleted-reference', w: 3, cap: 30, x: 0, y: 100 }];
	const sources = boardTileSources(data, data.widgets);
	expect(sources.map(source => source.type)).toEqual(['widget', 'section', 'card', 'missing']);
	const section = sources.find(source => source.type === 'section');
	expect(section?.type === 'section' && section.column.cards.map(card => card.id)).toEqual(['two']);
	expect(data.columns[0]?.cards.map(card => card.id)).toEqual(['one', 'two']);
	const persisted = persistedBoardTiles(boardTiles(data, sources));
	expect(persisted.find(tile => tile.id === 'deleted-reference')).toMatchObject({ x: 0, y: 100 });
	expect(persisted.map(tile => tile.id)).toEqual(sources.map(source => source.id));
});

test('fine row caps preserve pixel height and user caps survive content-fit persistence', () => {
	expect(pixelsToRows(184)).toBe(20);
	expect(rowsToPixels(20)).toBe(190);
	expect(persistedBoardTiles([{ id: 'a', x: 0, y: 0, w: 4, h: 7, cap: 40, explicit: true }])[0]?.cap).toBe(40);
});

test('adding a member retains existing fit positions even when their height caps overlap', () => {
	const tiles = [{ id: 'a', x: 0, y: 0, w: 12, h: 40, cap: 40, explicit: true },
		{ id: 'b', x: 0, y: 7, w: 12, h: 40, cap: 40, explicit: true },
		{ id: 'new', x: 0, y: 0, w: 12, h: 20, cap: 20, explicit: false }];
	const saved = persistedBoardTiles(tiles, true);
	expect(saved.map(tile => tile.y)).toEqual([0, 7, 47]);
});
