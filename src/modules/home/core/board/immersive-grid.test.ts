import { expect, test } from 'vitest';
import { dropTile, placeTiles, projectLayout, resizeTile, tilesOverlap } from './immersive-grid';

test('a height cap never narrows a tile and fixed tiles retain the requested cap', () => {
	const tiles = placeTiles([{ id: 'fit', x: 0, y: 0, w: 8, h: 9, cap: 3 }, { id: 'fixed', x: 0, y: 0, w: 4, h: 3, cap: 20, fixed: true }]);
	expect(tiles.map(tile => [tile.w, tile.h])).toEqual([[8, 3], [4, 20]]);
	expect(tilesOverlap(tiles)).toBe(false);
});

test('effective column bounds override provider minimums and invalid geometry stays finite', () => {
	for (const columns of [3, 6, 12]) {
		const tiles = placeTiles([{ id: 'bad', x: NaN, y: Infinity, w: Infinity, h: NaN, minW: 20, minH: Infinity, explicit: true }, { id: 'wide', x: 0, y: 0, w: 12, h: 40, minW: 10, explicit: true }], columns);
		expect(tiles.every(tile => Number.isFinite(tile.x + tile.y + tile.w + tile.h) && tile.x >= 0 && tile.y >= 0 && tile.x + tile.w <= columns)).toBe(true);
		expect(tilesOverlap(tiles)).toBe(false);
		const resized = resizeTile(tiles, 'wide', 100, -5, columns);
		expect(resized.find(tile => tile.id === 'wide')?.h).toBe(3);
		expect(tilesOverlap(resized)).toBe(false);
	}
});

test('grazing overlap resolves nearby while a major overlap swaps valid origins', () => {
	const tiles = [{ id: 'a', x: 0, y: 0, w: 3, h: 4, explicit: true }, { id: 'b', x: 5, y: 0, w: 3, h: 4, explicit: true }];
	const graze = dropTile(tiles, 'a', 3, 0);
	expect(graze.map(tile => [tile.x, tile.y])).toEqual([[2, 0], [5, 0]]);
	const swap = dropTile(tiles, 'a', 5, 0);
	expect(swap.map(tile => [tile.x, tile.y])).toEqual([[5, 0], [0, 0]]);
});

test('canonical collisions and narrow projections are repaired only in the display copy', () => {
	const source = [{ id: 'a', x: 0, y: 0, w: 8, h: 20, explicit: true }, { id: 'b', x: 0, y: 0, w: 8, h: 20, explicit: true }];
	const original = JSON.stringify(source);
	for (const width of [1100, 750, 288, 1100]) {
		const projection = projectLayout(source, width);
		expect(tilesOverlap(projection.display)).toBe(false);
		expect(projection.display.every(tile => tile.x + tile.w <= projection.columns)).toBe(true);
		expect(projection.writes).toBe(0);
	}
	expect(JSON.stringify(source)).toBe(original);
});

test('large saved rows resolve at obstacle boundaries without scanning every row', () => {
	const tiles = [{ id: 'a', x: 0, y: 0, w: 12, h: 10, explicit: true }, { id: 'b', x: 0, y: 100_000_000, w: 12, h: 100, explicit: true }];
	const moved = dropTile(tiles, 'a', 0, 100_000_098);
	expect(moved[0]?.y).toBe(100_000_100);
	expect(tilesOverlap(moved)).toBe(false);
});
