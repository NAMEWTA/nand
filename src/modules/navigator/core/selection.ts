// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** Selection in the list pane: ordered paths, the anchor of a range, and the cursor (focused row). */
export interface Selection {
	paths: readonly string[];
	anchor: string | null;
	cursor: string | null;
}

export const EMPTY_SELECTION: Selection = { paths: [], anchor: null, cursor: null };

export function selectOnly(path: string): Selection {
	return { paths: [path], anchor: path, cursor: path };
}

export function isSelected(selection: Selection, path: string): boolean {
	return selection.paths.includes(path);
}

/** Cmd/Ctrl+click: add or remove one path; the clicked row becomes anchor and cursor. */
export function toggleSelected(selection: Selection, path: string): Selection {
	const has = selection.paths.includes(path);
	const paths = has ? selection.paths.filter((entry) => entry !== path) : [...selection.paths, path];
	return { paths, anchor: path, cursor: path };
}

/** Shift+click or Shift+arrow: select `order` from the anchor to `target`, replacing the previous range. */
export function selectRange(selection: Selection, order: readonly string[], target: string): Selection {
	const anchor = selection.anchor ?? selection.cursor ?? target;
	const from = order.indexOf(anchor);
	const to = order.indexOf(target);
	if (from < 0 || to < 0) return selectOnly(target);
	const [start, end] = from <= to ? [from, to] : [to, from];
	return { paths: order.slice(start, end + 1), anchor, cursor: target };
}

export function selectAll(order: readonly string[], cursor: string | null): Selection {
	return { paths: [...order], anchor: order[0] ?? null, cursor: cursor ?? order[0] ?? null };
}

/** Index to move to from `from`, clamped to the list; -1 start means "first row". */
export function clampIndex(from: number, delta: number, length: number): number {
	if (length === 0) return -1;
	if (from < 0) return delta >= 0 ? 0 : length - 1;
	return Math.max(0, Math.min(length - 1, from + delta));
}

/** After removing `removed` from `order`, the neighbour to select: the next row, else the previous. */
export function nextAfterRemoval(order: readonly string[], removed: readonly string[]): string | undefined {
	const gone = new Set(removed);
	const first = order.findIndex((path) => gone.has(path));
	if (first < 0) return undefined;
	for (let index = first + 1; index < order.length; index++) if (!gone.has(order[index]!)) return order[index];
	for (let index = first - 1; index >= 0; index--) if (!gone.has(order[index]!)) return order[index];
	return undefined;
}

/** Rewrite selection paths after files were renamed or moved (`mapping` is old path to new path). */
export function remapSelection(selection: Selection, mapping: ReadonlyMap<string, string>): Selection {
	const map = (path: string | null) => (path === null ? null : (mapping.get(path) ?? path));
	return { paths: selection.paths.map((path) => map(path)!), anchor: map(selection.anchor), cursor: map(selection.cursor) };
}
