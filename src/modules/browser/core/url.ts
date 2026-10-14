// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/shared/browser-url.ts
import { BrowserError, type BrowserHistoryEntry } from './model';
export const SEARCH_ENGINES = {
	google: 'https://www.google.com/search?q=%s',
	bing: 'https://www.bing.com/search?q=%s',
	baidu: 'https://www.baidu.com/s?wd=%s',
	duckduckgo: 'https://duckduckgo.com/?q=%s',
} as const;
export type SearchEngine = keyof typeof SEARCH_ENGINES | 'custom';
const LOCAL_ADDRESS_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[[0-9a-f:]+\])(?::\d+)?(?:[/?#].*)?$/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/].*$/;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\[^\s\\/]+[\\/][^\\/]+(?:[\\/].*)?$/;
export function validSearchTemplate(template: string): boolean {
	try {
		const u = new URL(template);
		return u.protocol === 'https:' && !u.username && !u.password && template.includes('%s');
	} catch {
		return false;
	}
}
export function buildSearchUrl(query: string, engine: SearchEngine = 'google', custom = ''): string {
	const template = engine === 'custom' ? custom : SEARCH_ENGINES[engine];
	if (!validSearchTemplate(template)) throw new BrowserError('browser_invalid_search');
	return template.replaceAll('%s', encodeURIComponent(query));
}
export function looksLikeSearchQuery(input: string): boolean {
	return /\s/.test(input) || !/[.:]/.test(input);
}
export function normalizeBrowserNavigationUrl(raw: string, search?: SearchEngine, custom = ''): string | null {
	const input = raw.trim();
	if (!input || input === 'about:blank') return 'about:blank';
	try {
		if (WINDOWS_UNC_PATH_PATTERN.test(input)) {
			const [host, ...parts] = input.replaceAll('\\', '/').replace(/^\/+/, '').split('/');
			return `file://${host}/${parts.map(encodeURIComponent).join('/')}`;
		}
		if (input.startsWith('/') || WINDOWS_ABSOLUTE_PATH_PATTERN.test(input)) {
			const path = input.replaceAll('\\', '/');
			return `${path.startsWith('/') ? 'file://' : 'file:///'}${path
				.split('/')
				.map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s)))
				.join('/')}`;
		}
		let candidate = input;
		if (LOCAL_ADDRESS_PATTERN.test(input)) candidate = `http://${input}`;
		else if (/^[^\s/\\:@?#]+:\d+(?:[/?#].*)?$/.test(input)) candidate = `https://${input}`;
		else if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) {
			if (looksLikeSearchQuery(input)) return search ? buildSearchUrl(input, search, custom) : null;
			candidate = `https://${input}`;
		}
		const url = new URL(candidate);
		return ['http:', 'https:', 'file:'].includes(url.protocol) && !url.username && !url.password
			? url.toString()
			: null;
	} catch {
		return null;
	}
}
export function normalizeBrowserUrl(input: string, search?: SearchEngine, custom = ''): string {
	const url = normalizeBrowserNavigationUrl(input, search, custom);
	if (url === null) throw new BrowserError('browser_invalid_url');
	return url;
}
export function recordHistory(history: BrowserHistoryEntry[], entry: BrowserHistoryEntry): BrowserHistoryEntry[] {
	if (entry.url === 'about:blank') return history;
	return [entry, ...history.filter((row) => row.url !== entry.url)].slice(0, 500);
}
export function historySuggestions(history: BrowserHistoryEntry[], input: string): BrowserHistoryEntry[] {
	const words = input.toLowerCase().trim().split(/\s+/).filter(Boolean);
	return history
		.filter((row) => words.every((word) => `${row.url} ${row.title}`.toLowerCase().includes(word)))
		.slice(0, 6);
}
