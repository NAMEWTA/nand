/** Canonical immersive board geometry: 12 columns, 10px rows, 10px gaps. Pure; no DOM. */
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));

export function effectiveColumns(widthPx: number): 3 | 6 | 12 {
	if (widthPx >= 960) return CANONICAL_COLUMNS;
	if (widthPx >= 600) return 6;
	return 3;
}

function intersects(a: Pick<GridTile, 'x' | 'y' | 'w' | 'h'>, b: Pick<GridTile, 'x' | 'y' | 'w' | 'h'>): boolean {
	return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function fits(tile: GridTile, placed: readonly GridTile[], columns: number): boolean {
	if (tile.w < 1 || tile.h < 1 || tile.x < 1 || tile.y < 1) return false;
	if (tile.x + tile.w - 1 > columns) return false;
	return !placed.some((other) => other.id !== tile.id && intersects(tile, other));
}

function skylineSpot(w: number, h: number, placed: readonly GridTile[], columns: number): { x: number; y: number } {
	const limit = placed.reduce((max, tile) => Math.max(max, tile.y + tile.h), 1);
	for (let y = 1; y <= limit; y++) {
		for (let x = 1; x <= columns - w + 1; x++) {
			const candidate = { x, y, w, h };
			if (!placed.some((other) => intersects(candidate, other))) return { x, y };
		}
	}
	return { x: 1, y: limit };
}

function copy(tile: GridTile): GridTile {
	return { ...tile };
}

/** Place explicit tiles where they fit and pack the rest with a skyline. Result does not overlap. */
export function placeTiles(input: readonly GridTile[], columns = CANONICAL_COLUMNS): GridTile[] {
	const placed: GridTile[] = [];
	for (const tile of input.filter((item) => item.explicit)) {
		const w = clamp(tile.w, tile.minW ?? 1, columns);
		const h = Math.max(tile.minH ?? 1, tile.h);
		const next = { ...tile, w, h };
		placed.push(fits(next, placed, columns) ? next : { ...next, ...skylineSpot(w, h, placed, columns) });
	}
	for (const tile of input.filter((item) => !item.explicit)) {
		const width = tile.fixed ? tile.w : Math.min(tile.w, tile.cap ?? tile.w);
		const height = tile.fixed ? tile.h : Math.min(tile.h, tile.cap ?? tile.h);
		const w = clamp(width, tile.minW ?? 1, columns);
		const h = Math.max(tile.minH ?? 1, height);
		placed.push({ ...tile, w, h, ...skylineSpot(w, h, placed, columns) });
	}
	return placed;
}

/**
 * Display projection. Narrow widths reflow a copy; the canonical tiles' coordinates stay as given.
 * Resize and reflow do not imply a write.
 */
export function projectLayout(canonical: readonly GridTile[], widthPx: number): { columns: number; display: GridTile[]; writes: 0 } {
	const columns = effectiveColumns(widthPx);
	if (columns === CANONICAL_COLUMNS) return { columns, display: canonical.map(copy), writes: 0 };
	const ordered = [...canonical]
		.map(copy)
		.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
		.map((tile) => ({ ...tile, explicit: false, w: Math.min(tile.w, columns) }));
	return { columns, display: placeTiles(ordered, columns), writes: 0 };
}

export function tilesOverlap(tiles: readonly GridTile[]): boolean {
	return tiles.some((tile, index) => tiles.slice(index + 1).some((other) => intersects(tile, other)));
}

/** Drop a tile. One major overlap swaps the two origins when that still fits; otherwise the nearest free cell. */
export function dropTile(tiles: readonly GridTile[], id: string, x: number, y: number, columns = CANONICAL_COLUMNS): GridTile[] {
	const current = tiles.find((tile) => tile.id === id);
	if (!current) return tiles.map(copy);
	const moved = { ...current, x: clamp(x, 1, columns), y: Math.max(1, Math.round(y)), explicit: true };
	const others = tiles.filter((tile) => tile.id !== id);
	const hits = others.filter((tile) => intersects(moved, tile));
	if (hits.length === 1) {
		const other = hits[0]!;
		const swapped = tiles.map((tile) => {
			if (tile.id === id) return { ...moved, x: other.x, y: other.y };
			if (tile.id === other.id) return { ...other, x: current.x, y: current.y, explicit: true };
			return copy(tile);
		});
		if (!tilesOverlap(swapped) && swapped.every((tile) => tile.x + tile.w - 1 <= columns)) return swapped;
	}
	if (fits(moved, others, columns)) return tiles.map((tile) => (tile.id === id ? moved : copy(tile)));
	return tiles.map((tile) => (tile.id === id ? { ...moved, ...skylineSpot(moved.w, moved.h, others, columns) } : copy(tile)));
}

export function resizeTile(tiles: readonly GridTile[], id: string, w: number, h: number, columns = CANONICAL_COLUMNS): GridTile[] {
	const current = tiles.find((tile) => tile.id === id);
	if (!current) return tiles.map(copy);
	const next = { ...current, w: clamp(w, current.minW ?? 1, columns - current.x + 1), h: Math.max(current.minH ?? 1, Math.round(h)), fixed: true, explicit: true };
	const others = tiles.filter((tile) => tile.id !== id);
	if (fits(next, others, columns)) return tiles.map((tile) => (tile.id === id ? next : copy(tile)));
	return tiles.map((tile) => (tile.id === id ? { ...next, ...skylineSpot(next.w, next.h, others, columns) } : copy(tile)));
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

/** The first immersive open may persist packed coordinates. Later opens do not. */
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
): GridTile[] {
	const current = tiles.find((tile) => tile.id === id);
	if (!current) return tiles.map(copy);
	const pitch = GRID_ROW_PX + GRID_GAP_PX;
	const dx = Math.round((pointerX - originX) / SNAP_PX) * SNAP_PX;
	const dy = Math.round((pointerY - originY) / SNAP_PX) * SNAP_PX;
	return dropTile(tiles, id, current.x + Math.round(dx / pitch), current.y + Math.round(dy / pitch), columns);
}
