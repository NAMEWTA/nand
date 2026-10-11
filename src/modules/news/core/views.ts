import type { NewsAnalysis, NewsFilter, NewsMaterial, NewsView } from './model';

export function normalizeNewsFilter(raw: unknown): NewsFilter {
	const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
	const text = (key: string, max: number): string => typeof value[key] === 'string' ? (key === 'query' ? value[key] : value[key].trim()).slice(0, max) : '';
	const list = (key: string): string[] => Array.isArray(value[key]) ? [...new Set(value[key].filter((item): item is string => typeof item === 'string').map(item => item.trim().slice(0, 120)).filter(Boolean))].slice(0, 100) : [];
	return { category: text('category', 120), tags: list('tags'), sourceIds: list('sourceIds'), query: text('query', 500),
		...(typeof value.minScore === 'number' && Number.isFinite(value.minScore) ? { minScore: Math.round(Math.max(0, Math.min(100, value.minScore))) } : {}) };
}
export function normalizeNewsView(raw: unknown): NewsView | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const value = raw as Partial<NewsView>;
	if (typeof value.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(value.id) || typeof value.name !== 'string' || !value.name.trim()) return undefined;
	return { id: value.id, name: value.name.trim().slice(0, 120), ...normalizeNewsFilter(value) };
}
export function filterView(view: NewsFilter, materials: readonly NewsMaterial[], analyses: readonly NewsAnalysis[]): NewsMaterial[] {
	const byId = new Map(analyses.map(item => [item.materialId, item]));
	const query = view.query?.trim().normalize('NFKC').toLocaleLowerCase();
	return materials.filter((material) => {
		const candidate = byId.get(material.id);
		const analysis = candidate?.revision === material.revision && candidate.contentHash === material.contentHash ? candidate : undefined;
		if (view.sourceIds?.length && !view.sourceIds.includes(material.sourceId)) return false;
		if (view.minScore !== undefined && (analysis?.score ?? 0) < view.minScore) return false;
		if (view.tags?.length && !view.tags.some(tag => (analysis?.tags ?? material.labels)?.includes(tag))) return false;
		if (view.category && analysis?.category !== view.category) return false;
		return !query || [material.title, material.summary, material.bodyExcerpt, material.body, analysis?.titleZh, analysis?.summaryZh].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase().includes(query);
	});
}

