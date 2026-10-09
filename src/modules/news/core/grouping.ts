import type { NewsMaterial, NewsOccurrence, NewsStory } from './model';

function tokens(value: string): Set<string> { return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2)); }
function similarity(a: string, b: string): number { const left = tokens(a), right = tokens(b); if (!left.size || !right.size) return 0; let common = 0; for (const token of left) if (right.has(token)) common++; return common / Math.max(left.size, right.size); }
export function groupMaterials(materials: readonly NewsMaterial[], existing: readonly NewsStory[] = []): { stories: NewsStory[]; occurrences: NewsOccurrence[] } {
	const stories = existing.map((story) => ({ ...story, materialIds: [...story.materialIds], occurrenceIds: [...story.occurrenceIds] }));
	const occurrences: NewsOccurrence[] = [];
	for (const material of materials) {
		const story = stories.find((candidate) => candidate.materialIds.some((id) => id === material.id) || similarity(candidate.title, material.title) >= 0.62);
		const seen = material.firstSeenAt ?? material.discoveredAt;
		const updated = material.updatedAt ?? seen;
		if (!story) { const created: NewsStory = { id: `story-${material.id}`, title: material.title, materialIds: [material.id], occurrenceIds: [], firstSeenAt: seen, latestAt: updated }; stories.push(created); }
		const owner = story ?? stories[stories.length - 1]!;
		if (!owner.materialIds.includes(material.id)) owner.materialIds.push(material.id);
		owner.latestAt = Math.max(owner.latestAt, updated); owner.representativeId ??= material.id;
		const occurrence: NewsOccurrence = { id: `occ-${material.id}`, storyId: owner.id, materialIds: [material.id], firstSeenAt: seen, latestAt: updated, kind: owner.materialIds.length > 1 ? 'follow-up' : 'report' };
		occurrences.push(occurrence); if (!owner.occurrenceIds.includes(occurrence.id)) owner.occurrenceIds.push(occurrence.id);
	}
	return { stories, occurrences };
}

