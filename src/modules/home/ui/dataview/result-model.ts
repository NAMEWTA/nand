import { nextWindow, renderWindow } from '../../core/board/board-experience';
import type { QueryResult, ResultRow } from '../../core/dql/types';
import { dqlCompare, formatValue } from '../../core/dql/values';
import { sourceInfoOf } from './table-model';

/** The rows a dataview panel draws: 50, then 50 more, capped at 500. */
export function visibleRowWindow(total: number, shown: number): { count: number; total: number; truncated: boolean; next: number } {
	const windowed = renderWindow(total, shown);
	return { ...windowed, next: nextWindow(windowed.count, total) };
}

export const MAX_ROWS = 500;

export const DEFAULT_PAGE_SIZE = 50;

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const PAGINATED_TYPES = new Set<QueryResult['queryType']>(['TABLE', 'LIST', 'TASK']);

export function rowSearchText(row: ResultRow): string {
	const parts = row.values.map((v) => formatValue(v));
	if (row.task) parts.push(row.task.text);
	const src = sourceInfoOf(row);
	if (src) parts.push(src.title, src.path, src.created);
	return parts.join(' ').toLowerCase();
}

export function compareRowsForSort(a: ResultRow, b: ResultRow, col: number, dir: 'asc' | 'desc'): number {
	const va = a.values[col] ?? null;
	const vb = b.values[col] ?? null;
	const aNull = va === null || va === undefined;
	const bNull = vb === null || vb === undefined;
	if (aNull && bNull) return 0;
	if (aNull) return 1; // nulls last, both directions
	if (bNull) return -1;
	const cmp = dqlCompare(va, vb) ?? 0;
	return dir === 'asc' ? cmp : -cmp;
}
