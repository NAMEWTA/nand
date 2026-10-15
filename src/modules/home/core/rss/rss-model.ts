// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/rss-store.ts
import type { RssItem } from './rss-xml';
export const MAX_ITEMS_PER_FEED = 50;
export interface RssFeedCacheEntry {
	title: string;
	/** Feed site home URL — the base for absolutizing relative article URLs. */
	link?: string;
	items: RssItem[];
	fetchedAt: number;
	/** Last fetch error message; presence makes the entry retry sooner. */
	error?: string;
}

export interface RssStoreFile {
	version: 1;
	feeds: Record<string, RssFeedCacheEntry>;
	/** guid -> marked-read timestamp (epoch ms). */
	readGuids: Record<string, number>;
	/** guid -> vault path of the saved note. */
	savedGuids: Record<string, string>;
	/** guid -> web-extracted markdown + fetch time. */
	webCache: Record<string, { markdown: string; fetchedAt: number }>;
}

export const emptyFile = (): RssStoreFile => ({ version: 1, feeds: {}, readGuids: {}, savedGuids: {}, webCache: {} });

/* ------------------------------ normalization ---------------------------- */

function normalizeItem(raw: unknown): RssItem | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;
	const guid = typeof r['guid'] === 'string' ? r['guid'] : '';
	if (!guid) return null;
	return {
		guid,
		title: typeof r['title'] === 'string' && r['title'] ? r['title'] : '(untitled)',
		link: typeof r['link'] === 'string' ? r['link'] : '',
		author: typeof r['author'] === 'string' && r['author'] ? r['author'] : undefined,
		pubDate:
			typeof r['pubDate'] === 'number' && Number.isFinite(r['pubDate']) && r['pubDate'] > 0
				? r['pubDate']
				: undefined,
		contentHtml: typeof r['contentHtml'] === 'string' && r['contentHtml'] ? r['contentHtml'] : undefined,
		summaryHtml: typeof r['summaryHtml'] === 'string' && r['summaryHtml'] ? r['summaryHtml'] : undefined,
	};
}

function normalizeFeedEntry(raw: unknown): RssFeedCacheEntry | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;
	const fetchedAt = typeof r['fetchedAt'] === 'number' && r['fetchedAt'] > 0 ? r['fetchedAt'] : 0;
	if (fetchedAt <= 0) return null;
	const items = (Array.isArray(r['items']) ? r['items'] : [])
		.map(normalizeItem)
		.filter((item): item is RssItem => item !== null)
		.slice(0, MAX_ITEMS_PER_FEED);
	return {
		title: typeof r['title'] === 'string' ? r['title'] : '',
		link: typeof r['link'] === 'string' ? r['link'] : undefined,
		items,
		fetchedAt,
		error: typeof r['error'] === 'string' && r['error'] ? r['error'] : undefined,
	};
}

/** Validate an unknown parsed file body; malformed pieces drop out silently. */
export function normalizeRssFile(raw: unknown): RssStoreFile {
	const out = emptyFile();
	if (typeof raw !== 'object' || raw === null) return out;
	const r = raw as Record<string, unknown>;
	if (typeof r['feeds'] === 'object' && r['feeds'] !== null) {
		for (const [url, value] of Object.entries(r['feeds'] as Record<string, unknown>)) {
			const entry = normalizeFeedEntry(value);
			if (entry) out.feeds[url] = entry;
		}
	}
	if (typeof r['readGuids'] === 'object' && r['readGuids'] !== null) {
		for (const [guid, ts] of Object.entries(r['readGuids'] as Record<string, unknown>)) {
			if (typeof ts === 'number' && ts > 0) out.readGuids[guid] = ts;
		}
	}
	if (typeof r['savedGuids'] === 'object' && r['savedGuids'] !== null) {
		for (const [guid, path] of Object.entries(r['savedGuids'] as Record<string, unknown>)) {
			if (typeof path === 'string' && path) out.savedGuids[guid] = path;
		}
	}
	if (typeof r['webCache'] === 'object' && r['webCache'] !== null) {
		for (const [guid, value] of Object.entries(r['webCache'] as Record<string, unknown>)) {
			if (typeof value !== 'object' || value === null) continue;
			const entry = value as Record<string, unknown>;
			const markdown = typeof entry['markdown'] === 'string' ? entry['markdown'] : '';
			const fetchedAt = typeof entry['fetchedAt'] === 'number' ? entry['fetchedAt'] : 0;
			if (markdown && fetchedAt > 0) out.webCache[guid] = { markdown, fetchedAt };
		}
	}
	return out;
}

/** Union/merge two file states: feeds & webCache by newest fetchedAt, guid
 *  maps by union (savedGuids: overlay wins a same-guid conflict). */
export function mergeRssFiles(base: RssStoreFile, overlay: RssStoreFile): RssStoreFile {
	const out = emptyFile();
	for (const [url, entry] of Object.entries(base.feeds)) out.feeds[url] = entry;
	for (const [url, entry] of Object.entries(overlay.feeds)) {
		const existing = out.feeds[url];
		if (!existing || entry.fetchedAt >= existing.fetchedAt) out.feeds[url] = entry;
	}
	for (const [guid, ts] of Object.entries(base.readGuids)) out.readGuids[guid] = ts;
	for (const [guid, ts] of Object.entries(overlay.readGuids)) {
		out.readGuids[guid] = Math.max(out.readGuids[guid] ?? 0, ts);
	}
	Object.assign(out.savedGuids, base.savedGuids, overlay.savedGuids);
	for (const [guid, entry] of Object.entries(base.webCache)) out.webCache[guid] = entry;
	for (const [guid, entry] of Object.entries(overlay.webCache)) {
		const existing = out.webCache[guid];
		if (!existing || entry.fetchedAt >= existing.fetchedAt) out.webCache[guid] = entry;
	}
	return out;
}
