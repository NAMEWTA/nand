import type { NewsReadService } from '../api';
import type { NewsWidgetConfig } from './home-widgets';
import { filterView } from './views';

export interface NewsWidgetRow { id: string; title: string; summary: string; heat?: number; }

/** Shared read service only; projecting a widget never enables or refreshes its provider. */
export function newsWidgetRows(service: Pick<NewsReadService, 'analyses' | 'materials' | 'isHidden' | 'hot' | 'story' | 'stories' | 'views'>, config: NewsWidgetConfig, now = Date.now()): NewsWidgetRow[] {
	const analyses = new Map(service.analyses().map(item => [item.materialId, item]));
	const visible = service.materials().filter(item => !item.withdrawn && !service.isHidden(item.id));
	const byId = new Map(visible.map(item => [item.id, item]));
	if (config.mode === 'hot') return service.hot(now).flatMap(rank => {
		const story = service.story(rank.eventId), material = story?.representativeId ? byId.get(story.representativeId) : undefined;
		if (!story || !material) return [];
		const analysis = analyses.get(material.id);
		return [{ id: story.id, title: analysis?.titleZh || material.title, summary: analysis?.summaryZh || material.summary || material.bodyExcerpt, heat: rank.index }];
	}).slice(0, config.count);
	const view = config.mode === 'view' ? service.views().find(item => item.id === config.viewId) : undefined;
	const materials = config.mode === 'featured' ? visible.filter(item => analyses.get(item.id)?.target === 'featured')
		: view ? filterView(view, visible, [...analyses.values()]) : [];
	const storyByMaterial = new Map(service.stories().flatMap(story => story.materialIds.map(id => [id, story] as const)));
	const filteredIds = new Set(materials.map(item => item.id)), emitted = new Set<string>();
	return materials.flatMap(material => {
		const story = storyByMaterial.get(material.id), key = story?.id ?? material.id;
		if (emitted.has(key)) return [];
		emitted.add(key);
		return story?.representativeId && filteredIds.has(story.representativeId) ? byId.get(story.representativeId)! : material;
	}).sort((a, b) => (b.publishedAt ?? b.discoveredAt) - (a.publishedAt ?? a.discoveredAt) || a.id.localeCompare(b.id))
		.slice(0, config.count).map(material => ({ id: material.id, title: analyses.get(material.id)?.titleZh || material.title, summary: analyses.get(material.id)?.summaryZh || material.summary || material.bodyExcerpt }));
}
