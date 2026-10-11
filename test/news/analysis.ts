import type { NewsAnalysisRow } from '../../src/modules/news/core/model';

/** A complete structured response, kept independent of production parsing/defaults. */
export function analysisRow(id = 'm0', overrides: Partial<NewsAnalysisRow> = {}): NewsAnalysisRow {
	return {
		id, relevance: 'PASS', itemType: 'product_launch', axes: { sig: 8, nov: 7, cred: 6, reson: 5, act: 9 },
		qualityFlags: [], scope: 'unknown', subject: null, frame: null, category: '产品更新', tags: ['产品更新'],
		titleZh: '产品上线', summaryZh: '材料说明了产品的更新。', reason: '来源清楚',
		relations: [], ...overrides,
	};
}
export function analysisAnswer(rows: readonly NewsAnalysisRow[] = [analysisRow()]): string {
	return `<nand-news-json>${JSON.stringify({ materials: rows })}</nand-news-json>`;
}
export function promptMaterialIds(prompt: string): string[] {
	const payload = JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n') + 2)) as { materials: { id: string }[] };
	return payload.materials.map(item => item.id);
}

/** A factual isolated release used by reader/brief tests; candidate decisions are explicit. */
export function factAnswer(prompt: string): string {
	const payload = JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n') + 2)) as { materials: { id: string; title: string; body: string; candidates: { id: string }[] }[] };
	return analysisAnswer(payload.materials.map(item => analysisRow(item.id, {
		scope: 'single', subject: 'Company', frame: { title: item.title.slice(0, 30), subject: 'Company', action: 'released', object: 'product', occurredAt: null, evidence: item.body || item.title, conditions: [] },
		relations: item.candidates.map(candidate => ({ kind: 'UNRELATED', targetId: candidate.id, confidence: 1 })),
	})));
}
