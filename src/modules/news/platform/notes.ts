import type { NewsMaterial, NewsStory } from '../core/model';
export function serializeMaterial(material: NewsMaterial, notes = ''): string { return [`---`, `newsId: ${material.id}`, `source: ${material.sourceId}`, `url: ${material.originalUrl}`, `revision: ${material.revision}`, `---`, `# ${material.title}`, '', material.body || material.summary, notes ? `\n## Notes\n${notes}` : ''].join('\n').trimEnd() + '\n'; }
export function parseMaterialNote(text: string): { id?: string; body: string; notes: string } { const body = text.replace(/^---[\s\S]*?---\s*/, ''); const [main = '', notes = ''] = body.split(/\n## Notes\n/, 2); return { id: text.match(/^newsId:\s*(.+)$/m)?.[1]?.trim(), body: main.trim(), notes: notes.trim() }; }
export function serializeEdition(stories: readonly NewsStory[], materials: readonly NewsMaterial[]): string { return stories.map((story) => `## ${story.title}\n\n${materials.find((material) => material.id === story.representativeId)?.summary ?? ''}`).join('\n\n') + '\n'; }

/** Refresh the article body and keep the reader's `## Notes` annotation. */
export function refreshFavoriteNote(existing: string, material: NewsMaterial): string {
	return serializeMaterial(material, parseMaterialNote(existing).notes);
}

export function favoritePath(id: string): string {
	return `.nand/news/favorites/${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
}

const safeId = (id: string): string => id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);

/** Visible brief note. The Chinese folder name does not follow the interface language. */
export function briefPath(id: string): string {
	return `NAND/新闻/简报/${safeId(id)}.md`;
}

export function serializeBrief(id: string, title: string, body: string, notes = ''): string {
	return [`---`, `nand-type: news-brief`, `newsId: ${id}`, `---`, `# ${title}`, '', body.trim(), notes ? `\n## Notes\n${notes}` : '']
		.join('\n')
		.trimEnd() + '\n';
}

/** Replace the generated brief and keep the reader's `## Notes` annotation. */
export function refreshBriefNote(existing: string, id: string, title: string, body: string): string {
	return serializeBrief(id, title, body, parseMaterialNote(existing).notes);
}

