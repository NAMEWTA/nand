// Lexical recall adapted from KKKKhazix/AIHOT c547b669acc7f64720cd82024e502446ee1ef88d (MIT), events/recall.ts and relate.ts.
import type { NewsAnalysis, NewsEvents, NewsFactFrame, NewsMaterial } from './model';
import { confirmedMaterialIds } from './grouping';
import { DEFAULT_GROUPING_RULES } from './editorial-rules';

export interface NewsCandidate { id: string; title: string; summary: string; frame?: NewsFactFrame; root: boolean; score: number; }
export type NewsCandidates = ReadonlyMap<string, readonly NewsCandidate[]>;
export type CandidateIds = Record<string, Record<string, string>>;

export function lexicalSimilarity(left: string, right: string): number {
	const grams = (value: string): Set<string> => {
		const chars = [...value.replace(/\s+/g, '')];
		return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]!));
	};
	const a = grams(left), b = grams(right);
	if (!a.size || !b.size) return 0;
	return [...a].filter(value => b.has(value)).length / Math.min(a.size, b.size);
}
const reportText = (item: NewsMaterial, analysis?: NewsAnalysis): string => `${analysis?.titleZh || item.title}。${(analysis?.summaryZh || item.summary || item.bodyExcerpt).slice(0, 300)}`;

/** Each query sees the best report of each occurrence and earlier materials in this batch. */
export function recallCandidates(batch: readonly NewsMaterial[], materials: readonly NewsMaterial[], analyses: readonly NewsAnalysis[], events: NewsEvents, now = Date.now(), rules = DEFAULT_GROUPING_RULES): NewsCandidates {
	const result = new Map<string, NewsCandidate[]>();
	const byId = new Map(materials.map(item => [item.id, item]));
	const analyzed = new Map(analyses.map(item => [item.materialId, item]));
	const confirmed = confirmedMaterialIds(events);
	const records = new Map(events.records.map(item => [item.materialId, item]));
	for (let index = 0; index < batch.length; index++) {
		const query = batch[index]!, candidates: NewsCandidate[] = [];
		const consider = (reports: readonly NewsMaterial[], root: boolean): void => {
			const matching = reports.filter(item => item.id !== query.id && item.discoveredAt > now - rules.recallDays * 86_400_000 && item.discoveredAt <= now).map(item => ({ item, score: lexicalSimilarity(reportText(query), reportText(item, analyzed.get(item.id))) })).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
			const best = matching[0];
			if (!best || best.score < rules.similarityPercent / 100) return;
			const analysis = analyzed.get(best.item.id);
			candidates.push({ id: best.item.id, title: analysis?.titleZh || best.item.title, summary: (analysis?.summaryZh || best.item.summary || best.item.bodyExcerpt).slice(0, 300), ...(analysis?.frame ? { frame: analysis.frame } : {}), root, score: best.score });
		};
		for (const occurrence of events.occurrences) {
			const reports = occurrence.materialIds.flatMap(id => { const item = byId.get(id), record = records.get(id); return item && confirmed.has(id) && record?.revision === item.revision && record.contentHash === item.contentHash ? [item] : []; });
			consider(reports, events.stories.some(story => story.rootOccurrenceId === occurrence.id));
		}
		for (const earlier of batch.slice(0, index)) if (!events.occurrences.some(item => item.materialIds.includes(earlier.id))) consider([earlier], true);
		result.set(query.id, candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 10));
	}
	return result;
}

/** Per-query aliases hide storage IDs, source names and tiers from both scoring samples. */
export function candidateIds(batch: readonly NewsMaterial[], candidates?: NewsCandidates): CandidateIds {
	return Object.fromEntries(batch.map(item => [item.id, Object.fromEntries((candidates?.get(item.id) ?? []).map((candidate, index) => [`c${index}`, candidate.id]))]));
}
