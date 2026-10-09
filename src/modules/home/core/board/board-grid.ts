import { dropTile, migrateImmersive, resizeTile, type GridTile } from './immersive-grid';

/** Card coordinates the board already persists. Zero means unset. */
export interface CardGrid {
	id: string;
	gridCol: number;
	gridRow: number;
	gridCols: number;
	gridRows: number;
}

const DEFAULT_W = 4;
const DEFAULT_H = 6;

/** Map persisted card fields onto the one grid engine. Unset coordinates are not explicit. */
export function cardTiles(cards: readonly CardGrid[]): GridTile[] {
	return cards.map((card) => ({
		id: card.id,
		x: card.gridCol > 0 ? card.gridCol : 1,
		y: card.gridRow > 0 ? card.gridRow : 1,
		w: card.gridCols > 0 ? card.gridCols : DEFAULT_W,
		h: card.gridRows > 0 ? card.gridRows : DEFAULT_H,
		explicit: card.gridCol > 0 && card.gridRow > 0,
	}));
}

export function paintCardGrid<T extends CardGrid>(cards: readonly T[], tiles: readonly GridTile[]): T[] {
	const byId = new Map(tiles.map((tile) => [tile.id, tile]));
	return cards.map((card) => {
		const tile = byId.get(card.id);
		if (!tile) return card;
		return { ...card, gridCol: tile.x, gridRow: tile.y, gridCols: tile.w, gridRows: tile.h };
	});
}

/** One user move goes through dropTile, including a swap or the nearest free cell. */
export function moveCardGrid<T extends CardGrid>(cards: readonly T[], id: string, x: number, y: number): T[] {
	return paintCardGrid(cards, dropTile(cardTiles(cards), id, x, y));
}

/** One user resize goes through resizeTile. */
export function resizeCardGrid<T extends CardGrid>(cards: readonly T[], id: string, w: number, h: number): T[] {
	return paintCardGrid(cards, resizeTile(cardTiles(cards), id, w, h));
}

/**
 * First explicit immersive choice packs unset cards once.
 * A board that is already packed is returned unchanged and must not be written again.
 */
export function packBoardOnce<T extends CardGrid>(cards: readonly T[], packed: boolean): { cards: T[]; write: boolean } {
	const result = migrateImmersive(cardTiles(cards), packed);
	return { cards: paintCardGrid(cards, result.tiles), write: result.write };
}
