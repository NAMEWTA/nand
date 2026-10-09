import type { MaterialInput } from '../core/materials';
export interface WebListSelectors { item: string; link: string; title: string; date?: string; preserveFragment?: boolean; }
export interface WebListResult { items: MaterialInput[]; error?: 'no_matches' | 'invalid_selector'; }
const tagOf = (selector: string): string => selector.match(/^[a-z][\w-]*/i)?.[0] ?? '';
const queryAll = (html: string, selector: string): string[] => { const tag = tagOf(selector); if (!tag) return []; return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map((match) => match[1]!.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); };
const attribute = (html: string, selector: string, name: string): string => { const tag = tagOf(selector); if (!tag) return ''; return html.match(new RegExp(`<${tag}\\b[^>]*\\b${name}=["']([^"']+)["']`, 'i'))?.[1] ?? ''; };
export function parseStaticList(html: string, sourceId: string, baseUrl: string, selectors: WebListSelectors): WebListResult {
	if (!selectors.item || !selectors.link || !selectors.title) return { items: [], error: 'invalid_selector' };
	const rawItems = [...html.replace(/<script[\s\S]*?<\/script>/gi, '').matchAll(new RegExp(`<${tagOf(selectors.item)}\\b[^>]*>([\\s\\S]*?)</${tagOf(selectors.item)}>`, 'gi'))].map((match) => match[1] ?? '');
	if (!tagOf(selectors.item)) return { items: [], error: 'invalid_selector' };
	if (!rawItems.length) return { items: [], error: 'no_matches' };
	return { items: rawItems.map((raw) => { const link = attribute(raw, selectors.link, 'href') || queryAll(raw, selectors.link)[0] || ''; const title = queryAll(raw, selectors.title)[0] || queryAll(raw, selectors.item)[0] || ''; let url = ''; try { url = new URL(link, baseUrl).toString(); } catch { url = link; } const parsed = selectors.date ? Date.parse(queryAll(raw, selectors.date)[0] ?? '') : Number.NaN; const body = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return { sourceId, url, title: title || body.slice(0, 180), body, ...(Number.isFinite(parsed) ? { publishedAt: parsed } : {}) }; }) };
}

