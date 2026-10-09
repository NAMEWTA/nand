import type { NewsAnalysis, NewsMaterial, NewsScoreAxes } from './model';
import { acceptScore } from './scoring';

export { analysisNeedsRefresh } from './analysis-run';

export function applyAnalysis(materials: readonly NewsMaterial[], rows: readonly { id: string; axes: NewsScoreAxes }[], version: string, now = Date.now()): NewsAnalysis[] {
	return rows.flatMap((row) => { const material = materials.find((item) => item.id === row.id); return material ? [{ ...acceptScore(material, row.axes), version, createdAt: now }] : []; });
}

