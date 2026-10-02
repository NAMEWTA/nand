// URL classification adapted from Orca d74388f (MIT, Copyright 2026 Lovecast Inc.).
import { BrowserError, type BrowserHistoryEntry, type SearchEngine } from './model';
export function normalizeBrowserUrl(input: string, search?: SearchEngine): string {
	const raw = input.trim();
	if (!raw || raw === 'about:blank') return 'about:blank';
	const local =
		/^(?:localhost|[\w.-]+\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[[0-9a-f:]+\])(?::\d+)?(?:[/?#].*)?$/i.test(
			raw,
		);
	const hostPort = /^[\w.-]+:\d+(?:[/?#].*)?$/.test(raw);
	let url: URL;
	try {
		if (local) url = new URL(`http://${raw}`);
		else if (hostPort) url = new URL(`https://${raw}`);
		else if (/^[a-z][a-z\d+.-]*:/i.test(raw)) url = new URL(raw);
		else if (/^[^\s/]+\.[^\s/]+(?:[/?#].*)?$/.test(raw)) url = new URL(`https://${raw}`);
		else if (search && !/^[\\/]|^[a-z]:[\\/]/i.test(raw)) {
			const prefix = {
				google: 'https://www.google.com/search?q=',
				bing: 'https://www.bing.com/search?q=',
				duckduckgo: 'https://duckduckgo.com/?q=',
			}[search];
			return prefix + encodeURIComponent(raw.replace(/^\?\s*/, ''));
		} else throw new Error();
	} catch {
		throw new BrowserError('browser_invalid_url');
	}
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
		throw new BrowserError('browser_invalid_url');
	return url.href;
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
