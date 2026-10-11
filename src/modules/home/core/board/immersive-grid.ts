/** Canonical immersive board geometry: 12 columns, 10px row pitch, 10px visual gaps. Pure; no DOM.
 * Placement behavior references apex-dashboard (MIT), src/immersive-grid.ts at
 * db9d2892032c27f5f8899a72c0dca61d72572a9a, copyright (c) 2025 PandoraReads.
 * NAND uses obstacle-boundary search, finite validation and effective-column bounds.
 */
export const CANONICAL_COLUMNS = 12;
export const GRID_ROW_PX = 10;
export const GRID_GAP_PX = 10;

export interface GridTile {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	cap?: number;
	explicit?: boolean;
	fixed?: boolean;
	minW?: number;
	minH?: number;
	provider?: string;
	kind?: string;
}

export interface LayoutGesture {
	start: GridTile[];
	preview: GridTile[];
	writes: number;
}

const bounded = (value: number | undefined, min: number, max: number, fallback: number): number => Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value! : fallback)));
const gridColumns = (value: number) => bounded(value, 1, CANONICAL_COLUMNS, CANONICAL_COLUMNS);

export function effectiveColumns(widthPx: number): 3 | 6 | 12 {
	if (widthPx >= 960) return CANONICAL_COLUMNS;
	if (widthPx >= 600) return 6;
	return 3;
}

function intersects(a: Pick<GridTile, 'x' | 'y' | 'w' | 'h'>, b: Pick<GridTile, 'x' | 'y' | 'w' | 'h'>): boolean {
	return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function normalize(tile: GridTile, columns: number): GridTile {
	const minW = bounded(tile.minW, 1, columns, 1);
	const minH = bounded(tile.minH, 3, 240, 3);
	const cap = bounded(tile.cap, minH, 240, bounded(tile.h, minH, 240, 40));
	const w = bounded(tile.w, minW, columns, 3);
	return { ...tile, minW, minH, cap, w, h: tile.fixed ? cap : bounded(tile.h, minH, cap, cap),
		x: bounded(tile.x, 0, columns - w, 0), y: bounded(tile.y, 0, Number.MAX_SAFE_INTEGER - 240, 0),
		explicit: !!tile.explicit && Number.isFinite(tile.x) && Number.isFinite(tile.y) && tile.x >= 0 && tile.y >= 0 };
}

function fits(tile: GridTile, placed: readonly GridTile[], columns: number): boolean {
	return tile.w >= 1 && tile.h >= 3 && tile.x >= 0 && tile.y >= 0 && tile.x + tile.w <= columns && !placed.some(other => intersects(tile, other));
}

/** Only obstacle boundaries can improve the closest free row; huge saved y values never cause a row-by-row scan. */
function freeSpot(tile: GridTile, placed: readonly GridTile[], columns: number, nearest: boolean): { x: number; y: number } {
	const rows = new Set([0, ...(nearest ? [tile.y] : [])]);
	for (const other of placed) {
		rows.add(other.y + other.h);
		if (nearest && other.y >= tile.h) rows.add(other.y - tile.h);
	}
	let best: { x: number; y: number; distance: number } | undefined;
	for (const y of [...rows].sort((a, b) => a - b)) for (let x = 0; x + tile.w <= columns; x++) {
		if (!fits({ ...tile, x, y }, placed, columns)) continue;
		const distance = nearest ? Math.abs(x - tile.x) + Math.abs(y - tile.y) : y;
		if (!best || distance < best.distance) best = { x, y, distance };
	}
	return { x: best?.x ?? 0, y: best?.y ?? 0 };
}

const copy = (tile: GridTile): GridTile => ({ ...tile });

/** Zero-based coordinates. Explicit tiles reserve their positions first; output retains member order. */
export function placeTiles(input: readonly GridTile[], columns = CANONICAL_COLUMNS, preserveExplicit = false): GridTile[] {
	columns = gridColumns(columns);
	const seen = new Set<string>();
	const normalized = input.filter(tile => !seen.has(tile.id) && !!seen.add(tile.id)).map(tile => normalize(tile, columns));
	const placed: GridTile[] = [];
	for (const tile of [...normalized.filter(item => item.explicit), ...normalized.filter(item => !item.explicit)]) {
		placed.push(tile.explicit && (preserveExplicit || fits(tile, placed, columns)) ? tile : { ...tile, ...freeSpot(tile, placed, columns, !!tile.explicit) });
	}
	const byId = new Map(placed.map(tile => [tile.id, tile]));
	return normalized.map(tile => byId.get(tile.id)!);
}

/** Narrow panes project a copy. Neither invalid source values nor automatic reflow are persisted. */
export function projectLayout(canonical: readonly GridTile[], widthPx: number): { columns: number; display: GridTile[]; writes: 0 } {
	const columns = effectiveColumns(widthPx);
	const valid = placeTiles(canonical);
	const display = columns === CANONICAL_COLUMNS ? valid : placeTiles([...valid].sort((a, b) => a.y - b.y || a.x - b.x).map(tile => ({ ...tile, explicit: false })), columns);
	return { columns, display, writes: 0 };
}

export function tilesOverlap(tiles: readonly GridTile[]): boolean {
	return tiles.some((tile, index) => tiles.slice(index + 1).some(other => intersects(tile, other)));
}

/** A major overlap covers at least half the smaller tile; a grazing overlap never swaps it. */
export function dropTile(tiles: readonly GridTile[], id: string, x: number, y: number, columns = CANONICAL_COLUMNS): GridTile[] {
	columns = gridColumns(columns);
	const current = tiles.find(tile => tile.id === id);
	if (!current) return tiles.map(copy);
	const moved = { ...normalize({ ...current, x, y, explicit: true }, columns), explicit: true };
	const others = tiles.filter(tile => tile.id !== id);
	const hits = others.filter(tile => intersects(moved, tile));
	if (hits.length === 1) {
		const other = hits[0]!;
		const overlap = Math.min(moved.x + moved.w, other.x + other.w) - Math.max(moved.x, other.x);
		const overlapY = Math.min(moved.y + moved.h, other.y + other.h) - Math.max(moved.y, other.y);
		if (overlap * overlapY >= Math.min(moved.w * moved.h, other.w * other.h) / 2) {
			const a = { ...moved, x: other.x, y: other.y }, b = { ...other, x: current.x, y: current.y, explicit: true };
			const rest = others.filter(tile => tile.id !== other.id);
			if (fits(a, [...rest, b], columns) && fits(b, [...rest, a], columns)) return tiles.map(tile => tile.id === id ? a : tile.id === other.id ? b : copy(tile));
		}
	}
	const placed = fits(moved, others, columns) ? moved : { ...moved, ...freeSpot(moved, others, columns, true) };
	return tiles.map(tile => tile.id === id ? placed : copy(tile));
}

export function resizeTile(tiles: readonly GridTile[], id: string, w: number, h: number, columns = CANONICAL_COLUMNS): GridTile[] {
	columns = gridColumns(columns);
	const current = tiles.find(tile => tile.id === id);
	if (!current) return tiles.map(copy);
	const next = normalize({ ...current, w, h, cap: h, fixed: true, explicit: true }, columns);
	const others = tiles.filter(tile => tile.id !== id);
	const placed = fits(next, others, columns) ? next : { ...next, ...freeSpot(next, others, columns, true) };
	return tiles.map(tile => tile.id === id ? placed : copy(tile));
}

export function nudgeTile(tiles: readonly GridTile[], id: string, dx: number, dy: number, columns = CANONICAL_COLUMNS): GridTile[] {
	const current = tiles.find((tile) => tile.id === id);
	if (!current) return tiles.map(copy);
	return dropTile(tiles, id, current.x + dx, current.y + dy, columns);
}

export function beginGesture(tiles: readonly GridTile[]): LayoutGesture {
	return { start: tiles.map(copy), preview: tiles.map(copy), writes: 0 };
}

export function previewGesture(gesture: LayoutGesture, preview: readonly GridTile[]): LayoutGesture {
	return { start: gesture.start.map(copy), preview: preview.map(copy), writes: 0 };
}

/** Esc, pointer-cancel, or leaving the page: restore the gesture start and write nothing. */
export function cancelGesture(gesture: LayoutGesture): { tiles: GridTile[]; writes: 0 } {
	return { tiles: gesture.start.map(copy), writes: 0 };
}

/** One drop is one semantic write. */
export function commitGesture(gesture: LayoutGesture): { tiles: GridTile[]; writes: 1 } {
	return { tiles: gesture.preview.map(copy), writes: 1 };
}

/** Only an explicit layout edit may persist the first packing. Opening a board never calls this writer. */
export function migrateImmersive(tiles: readonly GridTile[], migrated: boolean): { tiles: GridTile[]; write: boolean } {
	if (migrated) return { tiles: tiles.map(copy), write: false };
	return { tiles: placeTiles(tiles), write: true };
}

/** Pointer motion snaps to 8px, then to the 10px row and gap. */
export const SNAP_PX = 8;

/** A pointer inside this band of the scrollport keeps the board moving. */
export const EDGE_PX = 32;
export const EDGE_STEP_PX = 16;

/** One scroll step while the pointer rests on an edge. Zero in the middle, or when that side cannot move. */
export function edgeScrollStep(pointer: number, edgeStart: number, viewSize: number, scroll: number, maxScroll: number): number {
	if (viewSize <= EDGE_PX * 2 || maxScroll <= 0) return 0;
	if (pointer <= edgeStart + EDGE_PX) {
		const step = Math.min(EDGE_STEP_PX, Math.max(0, scroll));
		return step === 0 ? 0 : -step;
	}
	if (pointer >= edgeStart + viewSize - EDGE_PX) return Math.min(EDGE_STEP_PX, Math.max(0, maxScroll - scroll));
	return 0;
}

export function dropAtPointer(
	tiles: readonly GridTile[],
	id: string,
	pointerX: number,
	pointerY: number,
	originX: number,
	originY: number,
	columns = CANONICAL_COLUMNS,
	columnPitchPx = GRID_ROW_PX,
): GridTile[] {
	const current = tiles.find((tile) => tile.id === id);
	if (!current) return tiles.map(copy);
	const dx = Math.round((pointerX - originX) / SNAP_PX) * SNAP_PX;
	const dy = Math.round((pointerY - originY) / SNAP_PX) * SNAP_PX;
	return dropTile(tiles, id, current.x + Math.round(dx / Math.max(1, columnPitchPx)), current.y + Math.round(dy / GRID_ROW_PX), columns);
}
