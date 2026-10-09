import type { TrackerDataPoint } from '../../core/board/types/index';
import type { QueryResult, ResultRow } from '../../core/dql/types';
import { kindOf } from '../../core/dql/values';
import { ymdKey } from './value-model';

export function rowDateTs(row: ResultRow, result: QueryResult): number | null {
	if (result.calendarField && row.values.length > 1) {
		const v = row.values[1];
		if (v && kindOf(v) === 'date') return (v as { ts: number }).ts;
		return null;
	}
	const page = row.page;
	if (!page) return null;
	for (const key of ['file.day', 'file.cday', 'file.ctime']) {
		const v = page.fields[key];
		if (v && kindOf(v) === 'date') return (v as { ts: number }).ts;
	}
	return null;
}

export function monthStart(ts: number): number {
	const d = new Date(ts);
	return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function shiftMonth(ts: number, delta: number): number {
	const d = new Date(ts);
	return new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime();
}

export function dayKey(ts: number): string {
	const d = new Date(ts);
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function monthLabel(ts: number): string {
	const d = new Date(ts);
	const names = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	return `${names[d.getMonth()]} ${d.getFullYear()}`;
}

export function fillYearHeatmapData(totals: Map<string, number>, year: number): TrackerDataPoint[] {
	const points: TrackerDataPoint[] = [];
	const cursor = new Date(year, 0, 1);
	while (cursor.getFullYear() === year) {
		const date = ymdKey(cursor.getTime());
		points.push({ date, value: totals.get(date) ?? null });
		cursor.setDate(cursor.getDate() + 1);
	}
	return points;
}

export function buildDataviewWeekColumns(data: TrackerDataPoint[]): Array<Array<TrackerDataPoint | null>> {
	const cols: Array<Array<TrackerDataPoint | null>> = [];
	if (data.length === 0) return cols;
	const first = new Date(data[0]!.date + 'T00:00:00');
	const firstDow = first.getDay();
	const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;
	let col: Array<TrackerDataPoint | null> = [];
	for (let i = 0; i < mondayOffset; i++) col.push(null);
	for (const p of data) {
		col.push(p);
		if (col.length === 7) {
			cols.push(col);
			col = [];
		}
	}
	if (col.length > 0) cols.push(col);
	return cols;
}
