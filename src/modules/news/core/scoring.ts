import type { NewsAnalysis, NewsMaterial, NewsScoreAxes } from './model';
export const DEFAULT_WEIGHTS: NewsScoreAxes = { relevance: 25, novelty: 20, quality: 20, impact: 20, clarity: 15 };
const SCORE_KEYS = ['relevance', 'novelty', 'quality', 'impact', 'clarity'] as const;
export function weightedScore(axes: NewsScoreAxes, weights: NewsScoreAxes = DEFAULT_WEIGHTS): number {
	const total = SCORE_KEYS.reduce((sum, key) => sum + weights[key], 0) || 1;
	const weighted = SCORE_KEYS.reduce((sum, key) => sum + axes[key] * weights[key], 0);
	return Math.round(weighted / total);
}
export function qualityCap(material: NewsMaterial): number { const length = (material.body ?? material.bodyExcerpt).length; return length >= 280 ? 100 : length >= 120 ? 80 : length >= 40 ? 60 : 35; }
export function acceptScore(material: NewsMaterial, axes: NewsScoreAxes, weights = DEFAULT_WEIGHTS): NewsAnalysis { const score = Math.min(weightedScore(axes, weights), qualityCap(material)); return { materialId: material.id, version: `material-${material.revision}`, accepted: score > 50, axes, score, target: score > 65 ? 'featured' : score > 50 ? 'brief' : 'ignore', createdAt: Date.now() }; }

