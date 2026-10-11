/** Keep a disappeared column's preference and append new fields as visible. */
export function reconcileColumns(order: readonly string[], hidden: readonly string[], available: readonly string[]): { order: string[]; hidden: string[] } {
	const nextOrder = [...new Set([...order, ...hidden, ...available])];
	const nextHidden = hidden.filter((field, index) => hidden.indexOf(field) === index);
	return { order: nextOrder, hidden: nextHidden };
}

const FIRST_WINDOW = 50;
const WINDOW_STEP = 50;
const WINDOW_CAP = 500;

/** First 50, then 50 more, and never more than 500 candidates. The total stays the real count. */
export function renderWindow(total: number, shown: number): { count: number; total: number; truncated: boolean } {
	const cap = Math.min(Math.max(0, total), WINDOW_CAP);
	const count = Math.min(cap, Math.max(total > 0 ? FIRST_WINDOW : 0, shown));
	return { count, total, truncated: total > count };
}

export function nextWindow(shown: number, total: number): number {
	return Math.min(WINDOW_CAP, Math.max(0, total), shown + WINDOW_STEP);
}

export interface FocalPoint {
	x: number;
	y: number;
}

function axis(value: unknown): number | undefined {
	const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
	if (!Number.isFinite(number)) return undefined;
	return Math.max(0, Math.min(100, Math.round(number)));
}

/** Missing or invalid focal data displays as the center and is not a reason to write. */
export function displayFocal(value: unknown): FocalPoint {
	if (!value || typeof value !== 'object') return { x: 50, y: 50 };
	const record = value as { x?: unknown; y?: unknown };
	return { x: axis(record.x) ?? 50, y: axis(record.y) ?? 50 };
}

/** Present only when the user edits a focal point. The stored value is clamped to 0–100. */
export function focalForWrite(value: unknown): FocalPoint | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const record = value as { x?: unknown; y?: unknown };
	const x = axis(record.x);
	const y = axis(record.y);
	if (x === undefined || y === undefined) return undefined;
	return { x, y };
}

/** The legacy single template still reads. An empty list is the blank note. Cancel chooses nothing. */
export function templateChoices(legacyPath: string | undefined, templates?: readonly string[]): string[] {
	return [...new Set((templates ?? (legacyPath ? [legacyPath] : [])).map(item => item.trim()).filter(Boolean))];
}

export function selectTemplate(templates: readonly string[], choice: number | null): string | null {
	if (choice === null) return null;
	if (!templates.length) return '';
	return templates[choice] ?? null;
}
