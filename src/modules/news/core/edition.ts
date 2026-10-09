import type { NewsAnalysis, NewsEdition, NewsMaterial, NewsStory } from './model';
export function buildDailyEdition(materials: readonly NewsMaterial[], analyses: readonly NewsAnalysis[], stories: readonly NewsStory[], now = Date.now()): NewsEdition {
	const day = new Date(now).toISOString().slice(0, 10);
	const selected = materials.filter((material) => analyses.find((analysis) => analysis.materialId === material.id)?.target === 'featured').sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 12);
	return { id: `edition-${day}`, date: day, materialIds: selected.map((item) => item.id), storyIds: stories.filter((story) => selected.some((item) => story.materialIds.includes(item.id))).map((story) => story.id), generatedAt: now };
}

