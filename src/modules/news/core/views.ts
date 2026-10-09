import type { NewsAnalysis, NewsMaterial, NewsView } from './model';
export function filterView(view: NewsView, materials: readonly NewsMaterial[], analyses: readonly NewsAnalysis[]): NewsMaterial[] {
	return materials.filter((material) => {
		const analysis = analyses.find((item) => item.materialId === material.id);
		if (view.sourceIds?.length && !view.sourceIds.includes(material.sourceId)) return false;
		if (view.minScore !== undefined && (analysis?.score ?? 0) < view.minScore) return false;
		if (view.tags?.length && !view.tags.some((tag) => material.labels?.includes(tag))) return false;
		if (view.query && !`${material.title} ${material.summary} ${material.body}`.toLocaleLowerCase().includes(view.query.toLocaleLowerCase())) return false;
		return !view.category || material.labels?.includes(view.category);
	});
}

