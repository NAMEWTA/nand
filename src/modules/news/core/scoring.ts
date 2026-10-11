// Adapted from KKKKhazix/AIHOT c547b669acc7f64720cd82024e502446ee1ef88d (MIT): industry/selection.ts and
// industry/prompts/selection-score.md. NAND computes the returned axes locally.
import type { NewsAnalysis, NewsAnalysisRow, NewsItemType, NewsMaterial, NewsQualityFlag, NewsScoreAxes, NewsScoreSample, NewsTier } from './model';

export const SCORE_KEYS = ['sig', 'nov', 'cred', 'reson', 'act'] as const;
export const ITEM_TYPES: readonly NewsItemType[] = ['model_release', 'product_launch', 'tool_or_prompt', 'research_paper', 'industry_event', 'opinion_analysis', 'tutorial_explainer'];
export const QUALITY_FLAGS: readonly NewsQualityFlag[] = ['routine_update', 'marketing', 'preview', 'weak_experience', 'roundup', 'vendor_howto', 'narrow_research', 'pr_without_data', 'title_conflict', 'insufficient_event'];
export type NewsWeights = Record<NewsItemType, NewsScoreAxes>;
export type NewsThresholds = Record<Exclude<NewsTier, 'unlisted'>, number>;
export const DEFAULT_WEIGHTS: NewsWeights = {
	model_release: { sig: 3, nov: 2, cred: 2, reson: 2, act: 1 },
	product_launch: { sig: 2, nov: 2, cred: 1, reson: 2, act: 3 },
	tool_or_prompt: { sig: 1, nov: 2, cred: 1, reson: 2, act: 4 },
	research_paper: { sig: 5, nov: 3, cred: 1, reson: 0, act: 1 },
	industry_event: { sig: 3, nov: 1, cred: 2, reson: 4, act: 0 },
	opinion_analysis: { sig: 1, nov: 3, cred: 1, reson: 4, act: 1 },
	tutorial_explainer: { sig: 1, nov: 1, cred: 1, reson: 3, act: 4 },
};
export const DEFAULT_THRESHOLDS: NewsThresholds = { T1: 60, T1_5: 65, T2: 76 };

export function validAxes(value: unknown): value is NewsScoreAxes {
	if (!value || typeof value !== 'object') return false;
	const axes = value as Record<string, unknown>;
	return SCORE_KEYS.every(key => typeof axes[key] === 'number' && Number.isInteger(axes[key]) && axes[key] >= 0 && axes[key] <= 10);
}
export function validWeights(value: unknown): value is NewsWeights {
	if (!value || typeof value !== 'object') return false;
	const weights = value as Record<string, unknown>;
	return ITEM_TYPES.every(type => validAxes(weights[type]) && SCORE_KEYS.reduce((sum, key) => sum + (weights[type] as NewsScoreAxes)[key], 0) === 10);
}

/** Caps constrain evidence, independently of the reader's adjustable weights. */
export function qualityAxes(sample: NewsScoreSample): NewsScoreAxes {
	const axes = { ...sample.axes };
	for (const flag of sample.qualityFlags) {
		switch (flag) {
			case 'routine_update': case 'roundup': case 'vendor_howto': axes.sig = Math.min(axes.sig, 3); break;
			case 'marketing': axes.sig = Math.min(axes.sig, 2); break;
			case 'preview': axes.nov = Math.min(axes.nov, 3); axes.cred = Math.min(axes.cred, 4); break;
			case 'weak_experience': axes.nov = Math.min(axes.nov, 3); axes.sig = Math.min(axes.sig, 4); break;
			case 'narrow_research': axes.sig = Math.min(axes.sig, 4); axes.reson = Math.min(axes.reson, 3); break;
			case 'pr_without_data': axes.sig = Math.min(axes.sig, 4); break;
		}
	}
	return axes;
}
export function weightedScore(axes: NewsScoreAxes, weights: NewsScoreAxes): number {
	return SCORE_KEYS.reduce((sum, key) => sum + axes[key] * weights[key], 0);
}
export function sampleScore(sample: NewsScoreSample, weights = DEFAULT_WEIGHTS): number {
	const cap = sample.qualityFlags.some(flag => flag === 'title_conflict' || flag === 'insufficient_event') ? 30 : 100;
	return Math.min(cap, weightedScore(qualityAxes(sample), weights[sample.itemType]));
}
export function scoreSelection(samples: readonly NewsScoreSample[], tier: NewsTier, weights = DEFAULT_WEIGHTS, thresholds = DEFAULT_THRESHOLDS, understandFloor = 50): { score: number; eligible: boolean; understand: boolean } {
	if (!samples.length) return { score: 0, eligible: false, understand: false };
	const sum = samples.reduce((total, sample) => total + sampleScore(sample, weights), 0);
	const eligible = tier !== 'unlisted' && sum >= samples.length * thresholds[tier];
	return { score: Math.floor(sum / samples.length), eligible, understand: eligible || sum > understandFloor * samples.length };
}
export function recomputeAnalysis(analysis: NewsAnalysis, tier: NewsTier, weights = DEFAULT_WEIGHTS, thresholds = DEFAULT_THRESHOLDS, understandFloor = 50): NewsAnalysis {
	const selection = scoreSelection(analysis.samples, tier, weights, thresholds, understandFloor);
	const accepted = analysis.relevance === 'PASS' && !!analysis.titleZh.trim() && !!analysis.summaryZh.trim();
	return { ...analysis, score: selection.score, sampleScores: analysis.samples.map(sample => sampleScore(sample, weights)), accepted, target: accepted && analysis.groupConfirmed && selection.eligible ? 'featured' : accepted && selection.understand ? 'brief' : 'ignore' };
}
export function acceptScore(material: NewsMaterial, row: NewsAnalysisRow, options: { version: string; tier?: NewsTier; samples?: NewsScoreSample[]; groupConfirmed?: boolean; now?: number; weights?: NewsWeights; thresholds?: NewsThresholds; understandFloor?: number; groupingConfidence?: number }): NewsAnalysis {
	const { id: _id, ...fields } = row;
	return recomputeAnalysis({ ...fields, materialId: material.id, revision: material.revision, contentHash: material.contentHash, version: options.version,
		groupingConfidence: options.groupingConfidence,
		samples: options.samples ?? [{ itemType: row.itemType, axes: { ...row.axes }, qualityFlags: [...row.qualityFlags] }],
		sampleScores: [],
		groupConfirmed: options.groupConfirmed === true, accepted: false, score: 0, target: 'ignore', createdAt: options.now ?? Date.now(),
	}, options.tier ?? 'unlisted', options.weights, options.thresholds, options.understandFloor);
}

