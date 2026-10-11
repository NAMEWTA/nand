import { stringify } from 'yaml';
import { t } from '../../../shared/i18n';
import { parseDocumentValue } from '../../../shared/storage/document-repository';
import { patchFrontmatter, readMarkdownDocument } from '../../../shared/storage/markdown-document';
import { canonicalNewsUrl } from '../core/materials';
import type { NewsAnalysis, NewsEdition, NewsMaterial, NewsSource } from '../core/model';
import { DEFAULT_FAVORITE_FOLDER, DEFAULT_EDITION_FOLDER } from '../core/note-folders';

export const NEWS_NOTES_ROOT = 'NAND/新闻';
const opening = '<!-- nand:news -->';
const closing = '<!-- /nand:news -->';

// Detect reader edits to the generated region; this is not a security digest.
function fingerprint(value: string): string {
	let result = 2166136261;
	for (const char of value) result = Math.imul(result ^ (char.codePointAt(0) ?? 0), 16777619);
	return (result >>> 0).toString(16);
}
const escapeText = (text: string): string => text.replace(/[\\`*_{}[\]<>#]/g, '\\$&');
const frontmatter = (properties: Record<string, unknown>): string => `---\n${stringify(properties)}---\n`;

function document(properties: Record<string, unknown>, generated: string, notes: string): string {
	if (/<!-- \/?nand:/.test(generated)) throw new Error('Reserved NAND section marker');
	return `${frontmatter({ ...properties, 'nand-generated': fingerprint(generated) })}\n${opening}\n${generated}\n${closing}\n\n## ${t('news.note.annotations')}\n\n${notes.trim()}\n`;
}

/** Only replace an untouched generated region. All other Markdown and YAML belong to the reader. */
function refresh(existing: string, next: string): string {
	const before = parseDocumentValue(existing);
	const after = parseDocumentValue(next);
	const region = before.sections?.news;
	if (before.properties['nand-id'] !== after.properties['nand-id'] || before.properties['nand-type'] !== after.properties['nand-type']) throw new Error('news.note.identity');
	if (region === undefined || fingerprint(region) !== before.properties['nand-generated']) throw new Error('news.note.edited');
	const original = readMarkdownDocument(existing);
	const a = original.body.indexOf(opening), b = original.body.indexOf(closing);
	const body = original.body.slice(0, a) + `${opening}\n${after.sections!.news}\n${closing}` + original.body.slice(b + closing.length);
	const managed = Object.fromEntries(Object.keys(after.properties).map(key => [key, before.properties[key]]));
	return patchFrontmatter(existing, frontmatter(managed), frontmatter(after.properties) + body);
}

export function serializeMaterial(material: NewsMaterial, notes = '', analysis?: NewsAnalysis, event?: string): string {
	const summary = (analysis?.summaryZh || material.summary || material.bodyExcerpt).slice(0, 1500);
	const properties = {
		'nand-type': 'news', 'nand-id': material.id, title: material.title, url: material.originalUrl,
		source: material.sourceId, 'source-item': material.sourceItemId,
		published: material.publishedAt !== undefined ? new Date(material.publishedAt).toISOString() : null,
		discovered: new Date(material.discoveredAt).toISOString(), revision: material.revision,
		score: analysis?.score ?? null, tags: analysis?.tags ?? material.labels ?? [], event: event ?? null,
	};
	const body = [`# ${escapeText(analysis?.titleZh || material.title)}`, '', escapeText(summary), '',
		...(analysis?.reason ? [`## ${t('news.reason')}`, '', escapeText(analysis.reason), ''] : []),
		`[${t('news.openOriginal')}](<${material.originalUrl.replace(/[<>\s]/g, char => encodeURIComponent(char))}>)`].join('\n');
	return document(properties, body, notes);
}

export function parseMaterialNote(text: string): { id?: string; body: string; notes: string } {
	const value = parseDocumentValue(text);
	const body = readMarkdownDocument(text).body;
	const tail = body.slice(body.indexOf(closing) + closing.length).replace(/^\s*##[^\r\n]*\r?\n/, '');
	return { id: typeof value.properties['nand-id'] === 'string' ? value.properties['nand-id'] : undefined, body: value.sections?.news ?? '', notes: tail.trim() };
}

/** The visible note is the authority for favorite identity, even with no device cache. */
export function favoriteMaterial(text: string): NewsMaterial | undefined {
	const value = parseDocumentValue(text), p = value.properties;
	if (p['nand-type'] !== 'news' || typeof p['nand-id'] !== 'string' || typeof p.url !== 'string' || typeof p.title !== 'string' || typeof p.source !== 'string') return undefined;
	const published = typeof p.published === 'string' ? Date.parse(p.published) : NaN;
	const discovered = typeof p.discovered === 'string' ? Date.parse(p.discovered) : NaN;
	return { id: p['nand-id'], sourceId: p.source, sourceItemId: typeof p['source-item'] === 'string' ? p['source-item'] : p.url,
		originalUrl: p.url, canonicalKey: canonicalNewsUrl(p.url), title: p.title, bodyExcerpt: '',
		discoveredAt: Number.isFinite(discovered) ? discovered : 0, revision: typeof p.revision === 'number' ? p.revision : 1,
		contentHash: '', ...(Number.isFinite(published) ? { publishedAt: published } : {}),
		labels: Array.isArray(p.tags) ? p.tags.filter((tag): tag is string => typeof tag === 'string') : [] };
}

export function refreshFavoriteNote(existing: string, material: NewsMaterial, analysis?: NewsAnalysis, event?: string): string {
	return refresh(existing, serializeMaterial(material, '', analysis, event));
}

export function favoritePath(material: NewsMaterial, folder = DEFAULT_FAVORITE_FOLDER): string {
	const date = new Date(material.publishedAt ?? material.discoveredAt);
	const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	const title = [...material.title].map(char => char.codePointAt(0)! < 32 || /[<>:"/\\|?*]/.test(char) ? '-' : char).join('').slice(0, 80).replace(/[. ]+$/, '') || 'news';
	return `${folder}/${day}-${title}.md`;
}

export function editionPath(edition: NewsEdition, folder = DEFAULT_EDITION_FOLDER): string { return `${folder}/${edition.date}.md`; }
export function readEditionId(text: string): string | undefined {
	const { properties } = parseDocumentValue(text);
	return properties['nand-type'] === 'news-edition' && typeof properties['nand-id'] === 'string' ? properties['nand-id'] : undefined;
}
export function serializeEdition(edition: NewsEdition, materials: readonly NewsMaterial[], analyses: readonly NewsAnalysis[], sources: readonly NewsSource[]): string {
	const byId = new Map(materials.map(item => [item.id, item]));
	const byAnalysis = new Map(analyses.map(item => [item.materialId, item]));
	const citation = (id: string): string => {
		const item = byId.get(id); if (!item) return '';
		return `[${escapeText(byAnalysis.get(id)?.titleZh || item.title)}](<${item.originalUrl.replace(/[<>\s]/g, char => encodeURIComponent(char))}>) — ${escapeText(sources.find(source => source.id === item.sourceId)?.name ?? item.sourceId)}`;
	};
	const sections = [true, false].flatMap(full => {
		const entries = full ? edition.main : edition.flashes;
		if (!entries.length) return [];
		return [`## ${t(full ? 'news.edition.main' : 'news.edition.flashes')}`, '', ...entries.flatMap(entry => {
			const item = byId.get(entry.materialId), analysis = byAnalysis.get(entry.materialId);
			return [`${full ? '###' : '-'} ${citation(entry.materialId)}`, '',
				...(full ? [escapeText(analysis?.summaryZh || item?.summary || item?.bodyExcerpt || ''), ''] : []),
				...(entry.followUp ? [t('news.edition.followUp', { date: entry.followUp }), ''] : []),
				...entry.relatedIds.flatMap(id => [`- ${citation(id)}`, ''])];
		})];
	});
	return document({ 'nand-type': 'news-edition', 'nand-id': edition.id, date: edition.date, timezone: edition.timeZone,
		'window-start': new Date(edition.startAt).toISOString(), 'window-end': new Date(edition.endAt).toISOString(), 'offset-minutes': edition.offsetMinutes,
		events: edition.storyIds }, [`# ${t('news.edition')} ${edition.date}`, '', edition.timeZone, '', ...sections].join('\n'), '');
}
export function refreshEditionNote(existing: string, edition: NewsEdition, materials: readonly NewsMaterial[], analyses: readonly NewsAnalysis[], sources: readonly NewsSource[]): string {
	return refresh(existing, serializeEdition(edition, materials, analyses, sources));
}

export function briefPath(id: string): string {
	return `${NEWS_NOTES_ROOT}/简报/${encodeURIComponent(id)}.md`;
}
export function readBriefNote(text: string): { id: string; body: string } | undefined {
	const value = parseDocumentValue(text);
	return value.properties['nand-type'] === 'news-brief' && typeof value.properties['nand-id'] === 'string'
		? { id: value.properties['nand-id'], body: readMarkdownDocument(text).body.trim() } : undefined;
}
export function serializeBrief(id: string, title: string, body: string, notes = ''): string {
	return document({ 'nand-type': 'news-brief', 'nand-id': id }, `# ${escapeText(title)}\n\n${body.trim()}`, notes);
}
export function refreshBriefNote(existing: string, id: string, title: string, body: string): string {
	return refresh(existing, serializeBrief(id, title, body));
}

