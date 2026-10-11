import type { NewsMaterial } from './model';
import { CATEGORIES, ENTITY_TAGS, TOPIC_TAGS } from './prompt-templates';

export interface NewsVocabulary { categories: string[]; topics: string[]; entities: string[]; }
export interface NewsPrefilter { blockedTerms: string[]; minCharacters: number; languages: string[]; }
export const DEFAULT_VOCABULARY: NewsVocabulary = { categories: [...CATEGORIES], topics: [...TOPIC_TAGS], entities: [...ENTITY_TAGS] };
export const DEFAULT_PREFILTER: NewsPrefilter = { blockedTerms: [], minCharacters: 0, languages: [] };

export function uniqueTerms(value: unknown): string[] {
	return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(item => item.length > 0 && item.length <= 100))].slice(0, 200) : [];
}
export function normalizeVocabulary(raw: unknown): NewsVocabulary {
	const value = raw && typeof raw === 'object' ? raw as Partial<NewsVocabulary> : {};
	const categories = uniqueTerms(value.categories);
	return { categories: categories.length ? categories : [...CATEGORIES], topics: value.topics === undefined ? [...TOPIC_TAGS] : uniqueTerms(value.topics), entities: value.entities === undefined ? [...ENTITY_TAGS] : uniqueTerms(value.entities) };
}
export function normalizeLanguage(raw: unknown): string | undefined {
	return typeof raw === 'string' && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(raw.trim()) ? raw.trim().toLowerCase() : undefined;
}
export function normalizePrefilter(raw: unknown): NewsPrefilter {
	const value = raw && typeof raw === 'object' ? raw as Partial<NewsPrefilter> : {};
	return {
		blockedTerms: uniqueTerms(value.blockedTerms),
		minCharacters: typeof value.minCharacters === 'number' && Number.isFinite(value.minCharacters) ? Math.round(Math.max(0, Math.min(10000, value.minCharacters))) : 0,
		languages: [...new Set(uniqueTerms(value.languages).flatMap(item => normalizeLanguage(item) ?? []))],
	};
}

/** Pure local filtering. Unknown feed languages remain eligible; raw material stays readable. */
export function prefilterReason(material: NewsMaterial, filter: NewsPrefilter = DEFAULT_PREFILTER): 'blocked-term' | 'short' | 'language' | undefined {
	const text = [material.title, material.body || material.summary || material.bodyExcerpt].join('\n').normalize('NFKC').replace(/\s+/g, ' ').trim();
	if (filter.blockedTerms.some(term => text.toLowerCase().includes(term.normalize('NFKC').toLowerCase()))) return 'blocked-term';
	if (Array.from(text).length < filter.minCharacters) return 'short';
	const language = normalizeLanguage(material.language);
	if (language && filter.languages.length && !filter.languages.some(allowed => language === allowed || language.startsWith(allowed + '-'))) return 'language';
	return undefined;
}
