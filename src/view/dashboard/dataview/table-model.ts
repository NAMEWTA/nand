import type { DataviewConfig } from '../../../core/dashboard/types/index';
import type { QueryResult, ResultRow } from '../../../core/dql/types';
import { formatDate, kindOf } from '../../../core/dql/values';
import { t } from '../../../shared/i18n/index';

export const HEATMAP_CELL_GAP = 3;

export const HEATMAP_MIN_CELL = 10;

export const HEATMAP_MAX_CELL = 20;

export interface ViewState {
	filter: string;
	/** Column index + direction for TABLE header sort; null = query order. */
	sortCol: number | null;
	sortDir: 'asc' | 'desc';
}

export interface DisplayColumns {
	/** Header labels for the value columns (projection, no source). */
	valueColumns: string[];
	/** True when the query has an implicit leading file-link column (TABLE
	 *  without WITHOUT ID) that should merge with the source "Note" column. */
	hasImplicitFileCol: boolean;
}

export function displayColumns(result: QueryResult): DisplayColumns {
	if (result.queryType === 'TABLE') {
		const valueColumns = result.columns.map((c) => c.alias);
		const hasImplicitFileCol = !valueColumns.includes('file') ? false : result.columns[0]?.alias === 'file';
		return { valueColumns, hasImplicitFileCol };
	}
	if (result.queryType === 'LIST') {
		// LIST with no projection: the evaluator's values[0] IS the file link,
		// so it doubles as the implicit note column. LIST with a projection:
		// values[0] is the projected value — label the value column with the
		// query's own alias/expression label (auto-adapts, like TABLE).
		const nonFile = result.columns.filter((c) => c.alias !== 'file');
		if (nonFile.length === 0) {
			return { valueColumns: ['file'], hasImplicitFileCol: true };
		}
		return { valueColumns: nonFile.map((c) => c.alias), hasImplicitFileCol: false };
	}
	// TASK: values[0] is the task text — the note column is always synthesized.
	return {
		valueColumns: [t('dataview.taskCol')],
		hasImplicitFileCol: false,
	};
}

export interface SourceInfo {
	readonly title: string;
	readonly path: string;
	readonly created: string;
}

export function sourceInfoOf(row: ResultRow): SourceInfo | null {
	const page = row.page;
	if (!page) return null;
	const path = page.file.path;
	const title = page.file.basename;
	const createdField = page.fields['file.cday'] ?? page.fields['file.ctime'];
	const created =
		createdField && kindOf(createdField) === 'date'
			? formatDate(createdField as import('../../../core/dql/types').DqlDate)
			: '';
	return { title, path, created };
}

export function nextSortState(current: ViewState, clickedCol: number): ViewState {
	if (current.sortCol !== clickedCol) return { ...current, sortCol: clickedCol, sortDir: 'asc' };
	if (current.sortDir === 'asc') return { ...current, sortDir: 'desc' };
	return { ...current, sortCol: null, sortDir: 'asc' };
}

export interface TableLayout {
	/** Header labels in render order (empty string = icon-only checkbox col). */
	readonly labels: string[];
	/** Header indices that are sortable, in order. */
	readonly sortableIdx: readonly number[];
	/** For each sortable header index, the row.values index it maps to. */
	readonly sortValueIdx: readonly number[];
	/** TASK queries: leading checkbox column. */
	readonly checkboxCol: boolean;
	/** Where the source "Note" cell content comes from. */
	readonly noteFrom: 'values0' | 'synth' | 'none';
	readonly showSource: boolean;
	/** Width hints per column, same length as `labels`. `undefined` = share the
	 *  remaining space; strings are CSS widths for <col>. Fixed table layout
	 *  keeps long content from squeezing other columns. */
	readonly colWidths: readonly (string | undefined)[];
}

export function tableLayout(
	result: QueryResult,
	config: DataviewConfig | undefined,
	showRowNumbers: boolean,
): TableLayout {
	const dc = displayColumns(result);
	const showSource = config?.showSource !== false;
	const isTask = result.queryType === 'TASK';
	const labels: string[] = [];
	const colWidths: (string | undefined)[] = [];
	const sortableIdx: number[] = [];
	const sortValueIdx: number[] = [];
	if (showRowNumbers) {
		labels.push('#');
		colWidths.push('34px');
	}
	if (isTask) {
		labels.push('');
		colWidths.push('30px');
	} // checkbox column

	const valueLabels = dc.hasImplicitFileCol ? dc.valueColumns.slice(1) : dc.valueColumns;
	let valueIdx = dc.hasImplicitFileCol ? 1 : 0;
	valueLabels.forEach((label, i) => {
		labels.push(label);
		// First value column (the task text / primary value) caps at 30% so it
		// cannot swallow the table; other value columns share the remainder.
		colWidths.push(i === 0 ? '30%' : undefined);
		sortableIdx.push(labels.length - 1);
		sortValueIdx.push(valueIdx++);
	});

	let noteFrom: TableLayout['noteFrom'] = 'none';
	if (showSource) {
		noteFrom = dc.hasImplicitFileCol ? 'values0' : 'synth';
		labels.push(t('dataview.colFile'));
		colWidths.push('22%');
		labels.push(t('dataview.colPath'));
		colWidths.push('28%');
		labels.push(t('dataview.colCreated'));
		colWidths.push('96px');
	} else if (dc.hasImplicitFileCol) {
		// Source hidden, but the query's own file column still deserves a spot.
		noteFrom = 'values0';
		labels.push(dc.valueColumns[0]!);
		colWidths.push(undefined);
	}
	return { labels, sortableIdx, sortValueIdx, checkboxCol: isTask, noteFrom, showSource, colWidths };
}
