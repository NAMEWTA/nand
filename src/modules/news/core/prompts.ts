import type { NewsMaterial } from './model';
export const PROMPT_VERSION = 'news-2026-10-09-v1';
export function buildAnalysisPrompt(materials: readonly NewsMaterial[], interest = ''): string { return [`You are a news analyst. Return JSON only.`, `version: ${PROMPT_VERSION}`, interest && `Reader interests: ${interest}`, ...materials.map((item) => `id=${item.id}\ntitle=${item.title}\nbody=${(item.body ?? item.summary ?? '').slice(0, 1500)}`)].filter(Boolean).join('\n\n'); }
export interface BriefSource {
	id: string;
	title: string;
	url: string;
	summary: string;
	source: string;
}

/** One brief prompt. The runner's text is the document; this function does not invent it. */
export function buildBriefPrompt(title: string, sources: readonly BriefSource[], interest = ''): string {
	return [
		'Write a Chinese Markdown brief for this news event.',
		'Use these headings: 背景, 影响, 时间线.',
		'Cite every source with its markdown link and keep each source url.',
		interest && `Reader interests: ${interest}`,
		`Event: ${title}`,
		...sources.map((item) => `id=${item.id}\ntitle=${item.title}\nsource=${item.source}\nurl=${item.url}\nsummary=${item.summary}`),
	]
		.filter(Boolean)
		.join('\n\n');
}

/** A brief is the background, impact and timeline, each traceable to a source url. */
export function briefDocument(text: string, urls: readonly string[]): boolean {
	const body = text.trim();
	return body.includes('背景') && body.includes('影响') && body.includes('时间线') && urls.every((url) => body.includes(url));
}

export function parseAnalysisJson(text: string, ids: ReadonlySet<string>): Array<{ id: string; axes: Record<string, number>; target: string; reason?: string }> {
	const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/); if (!match) return [];
	try { const value = JSON.parse(match[0]) as unknown; const rows = Array.isArray(value) ? value : [value]; return rows.flatMap((row) => { if (!row || typeof row !== 'object') return []; const item = row as Record<string, unknown>; const id = typeof item.id === 'string' ? item.id : ''; if (!ids.has(id) || !item.axes || typeof item.axes !== 'object') return []; const axes = item.axes as Record<string, number>; const reason = typeof item.reason === 'string' ? item.reason : ''; return [{ id, axes, target: typeof item.target === 'string' ? item.target : 'ignore', ...(reason ? { reason } : {}) }]; }); } catch { return []; }
}

