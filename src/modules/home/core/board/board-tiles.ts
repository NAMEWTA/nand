import { GRID_GAP_PX, GRID_ROW_PX, placeTiles, type GridTile } from './immersive-grid';
import type { BoardTile, BoardWidgetMember, DashboardCard, DashboardColumn, DashboardData } from './types/model';

export type BoardTileSource =
	| { id: string; type: 'widget'; member: BoardWidgetMember }
	| { id: string; type: 'section'; column: DashboardColumn }
	| { id: string; type: 'card'; card: DashboardCard; column: DashboardColumn }
	| { id: string; type: 'missing' };

export interface TileDefaults { w: number; h: number; minW?: number; minH?: number; }
export type WidgetTileDefaults = (member: BoardWidgetMember) => TileDefaults | undefined;

export const pixelsToRows = (pixels: number): number => Math.max(3, Math.min(240, Math.ceil((Math.max(0, Number.isFinite(pixels) ? pixels : 0) + GRID_GAP_PX) / GRID_ROW_PX)));
export const rowsToPixels = (rows: number): number => Math.max(0, rows * GRID_ROW_PX - GRID_GAP_PX);

/** Stable saved IDs win. Read-only legacy section IDs are never written by this projection. */
export function boardTileSources(data: DashboardData, members: readonly BoardWidgetMember[]): BoardTileSource[] {
	const saved = new Set(data.immersive?.map(tile => tile.id) ?? []);
	const sources: BoardTileSource[] = members.map(member => ({ id: member.memberId, type: 'widget', member }));
	for (const [index, column] of data.columns.entries()) {
		const id = column.id ?? `section:${column.name}${data.columns.filter(other => other.name === column.name).length > 1 ? `:${index}` : ''}`;
		const standalone = column.cards.filter(card => saved.has(card.id) || (data.gridPacked && card.gridCol > 0 && card.gridRow > 0));
		const ids = new Set(standalone.map(card => card.id));
		const grouped = column.cards.filter(card => !ids.has(card.id));
		if (grouped.length || !column.cards.length || saved.has(id)) sources.push({ id, type: 'section', column: { ...column, cards: grouped } });
		for (const card of standalone) sources.push({ id: card.id, type: 'card', card, column });
	}
	const present = new Set(sources.map(source => source.id));
	for (const tile of data.immersive ?? []) if (!present.has(tile.id)) { present.add(tile.id); sources.push({ id: tile.id, type: 'missing' }); }
	return sources;
}

/** The same tile list drives display and explicit persistence. Provider absence cannot drop a tile. */
export function boardTiles(data: DashboardData, sources: readonly BoardTileSource[], widgetDefaults: WidgetTileDefaults = () => undefined): GridTile[] {
	const saved = new Map(data.immersive?.map(tile => [tile.id, tile]) ?? []);
	const defaults = (source: BoardTileSource): TileDefaults => {
		if (source.type === 'widget') return widgetDefaults(source.member) ?? { w: 3, h: 40 };
		if (source.type === 'section') return { w: source.column.half ? 6 : 12, h: source.column.height ? pixelsToRows(source.column.height) : 60, minW: 3, minH: 6 };
		if (source.type === 'card') return { w: source.card.gridCols || 4, h: source.card.gridRows || 30, minW: 2, minH: 6 };
		return { w: 3, h: 40 };
	};
	return sources.map(source => {
		const tile = saved.get(source.id);
		const fallback = defaults(source);
		const legacy = !tile && source.type === 'card' && source.card.gridCol > 0 && source.card.gridRow > 0 ? { x: source.card.gridCol - 1, y: source.card.gridRow - 1 } : undefined;
		return { id: source.id, w: tile?.w ?? fallback.w, h: tile?.cap ?? fallback.h, cap: tile?.cap ?? fallback.h,
			minW: Math.max(2, fallback.minW ?? 1), minH: Math.max(6, fallback.minH ?? 3), fixed: tile?.fixed,
			x: tile?.x ?? legacy?.x ?? 0, y: tile?.y ?? legacy?.y ?? 0,
			explicit: tile?.x !== undefined && tile.y !== undefined || !!legacy };
	});
}

/** Called only by explicit user edits; the stored height remains the cap, never a content measurement. */
export function persistedBoardTiles(tiles: readonly GridTile[], preserveExistingPositions = false): BoardTile[] {
	return placeTiles(tiles, 12, preserveExistingPositions).map(tile => ({ id: tile.id, w: tile.w, cap: tile.cap ?? tile.h, ...(tile.fixed ? { fixed: true } : {}), x: tile.x, y: tile.y }));
}
