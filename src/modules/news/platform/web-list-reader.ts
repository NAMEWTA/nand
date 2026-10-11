import { sanitizeHTMLToDom } from 'obsidian';
import type { MaterialInput } from '../core/materials';
import { plainText } from './feed-reader';

export interface WebListSelectors { item: string; link: string; title: string; date?: string; preserveFragment?: boolean; }
export interface WebListResult { items: MaterialInput[]; error?: 'no_matches' | 'invalid_selector'; }
const clean = (node: Element | null): string => (node ? plainText(node) : '').replace(/\s+/g, ' ').trim();
const find = (node: Element, selector: string): Element | null => node.matches(selector) ? node : node.querySelector(selector);

export function parseStaticList(html: string, sourceId: string, baseUrl: string, selectors: WebListSelectors): WebListResult {
	if (!selectors.item || !selectors.link || !selectors.title) return { items: [], error: 'invalid_selector' };
	const root = sanitizeHTMLToDom(html);
	for (const unsafe of root.querySelectorAll('script,style,iframe,object,svg,noscript')) unsafe.remove();
	try {
		for (const selector of [selectors.item, selectors.link, selectors.title, selectors.date].filter((value): value is string => !!value)) root.querySelector(selector);
		const items = Array.from(root.querySelectorAll(selectors.item)).flatMap(node => {
			const link = find(node, selectors.link)?.getAttribute('href');
			const title = clean(find(node, selectors.title));
			if (!link || !title) return [];
			let url: URL;
			try { url = new URL(link, baseUrl); } catch { return []; }
			if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return [];
			const date = selectors.date ? find(node, selectors.date) : null;
			const parsed = Date.parse(date?.getAttribute('datetime') || clean(date));
			const body = clean(node);
			return [{ sourceId, sourceItemId: url.href, url: url.href, title, summary: body.slice(0, 1500), body, ...(Number.isFinite(parsed) ? { publishedAt: parsed } : {}) }];
		});
		return items.length ? { items } : { items: [], error: 'no_matches' };
	} catch { return { items: [], error: 'invalid_selector' }; }
}

