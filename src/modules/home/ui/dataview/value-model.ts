import { App, TFile } from 'obsidian';
import type { TrackerDataPoint } from '../../core/board/types/index';
import { getLanguage } from '../../../../shared/i18n/index';
import { HEATMAP_CELL_GAP, HEATMAP_MAX_CELL, HEATMAP_MIN_CELL } from './table-model';

export function chooseDataviewCellSize(containerWidth: number, weekCount: number): number {
	if (weekCount <= 0 || containerWidth <= 0) return HEATMAP_MIN_CELL;
	const available = containerWidth - (weekCount - 1) * HEATMAP_CELL_GAP;
	const ideal = Math.floor(available / weekCount);
	return Math.max(HEATMAP_MIN_CELL, Math.min(HEATMAP_MAX_CELL, ideal));
}

export function computeDataviewMonthLabels(weekCols: Array<Array<TrackerDataPoint | null>>): Array<string | null> {
	const labels: Array<string | null> = [];
	let lastMonth = '';
	const locale = getLanguage() === 'zh' ? 'zh-CN' : 'en-US';
	for (const col of weekCols) {
		const firstPoint = col.find((p): p is TrackerDataPoint => p !== null);
		const monthKey = firstPoint ? firstPoint.date.slice(0, 7) : '';
		if (monthKey && monthKey !== lastMonth) {
			const d = new Date(`${monthKey}-01T00:00:00`);
			labels.push(Number.isNaN(d.getTime()) ? monthKey : d.toLocaleDateString(locale, { month: 'short' }));
			lastMonth = monthKey;
		} else {
			labels.push(null);
		}
	}
	return labels;
}

export function ymdKey(ts: number): string {
	const d = new Date(ts);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export const INLINE_TOKEN_RE =
	/(\[\[[^\]]+?\]\]|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*?\*|`[^`]+`|==[^=]+==|~~[^~]+~~)/g;

export function resolveDvFile(appRef: App, path: string): TFile | null {
	const cleaned = path.replace(/\.md$/i, '');
	// Direct path lookup first.
	const direct = appRef.vault.getAbstractFileByPath(path) ?? appRef.vault.getAbstractFileByPath(cleaned + '.md');
	if (direct instanceof TFile) return direct;
	// Fall back to a basename match across markdown files (O(n) but rare).
	const files = appRef.vault.getMarkdownFiles();
	for (const f of files) {
		if (f.basename.toLowerCase() === cleaned.split('/').pop()!.toLowerCase()) return f;
	}
	return null;
}
