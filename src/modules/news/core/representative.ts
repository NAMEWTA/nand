import type { NewsMaterial, NewsSource, NewsStory } from './model';
export function chooseRepresentative(story: NewsStory, materials: readonly NewsMaterial[], sources: readonly NewsSource[]): string | undefined {
	const rank = (id: string) => { const material = materials.find((item) => item.id === id); const source = sources.find((item) => item.id === material?.sourceId); return (source?.tier === 'primary' ? 30 : source?.tier === 'secondary' ? 20 : 10) + (material?.body?.length ?? 0) / 10000 + (material?.publishedAt ?? material?.firstSeenAt ?? 0) / 1e13; };
	return [...story.materialIds].sort((a, b) => rank(b) - rank(a))[0];
}

