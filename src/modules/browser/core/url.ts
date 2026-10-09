import { normalizeWebUrl } from '../../../shared/web-url';
import { BrowserError, type BrowserHistoryEntry, type SearchEngine } from './model';

/** `normalizeWebUrl`, throwing `browser_invalid_url` for input that is not a web address. */
export function normalizeBrowserUrl(input: string, search?: SearchEngine): string {
	const url = normalizeWebUrl(input, search);
	if (url === undefined) throw new BrowserError('browser_invalid_url');
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
		.slice(0, 8);
}
