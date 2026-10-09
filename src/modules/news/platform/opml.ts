import { normalizeNewsSource, type NewsSource } from '../core/model';

function feedId(url: string): string {
	let hash = 2166136261;
	for (const char of url) {
		hash ^= char.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16777619);
	}
	return `feed-${(hash >>> 0).toString(16)}`;
}

/** Add new feed URLs. An existing URL keeps its grade and the rest of its record. */
export function importOpml(xml: string, existing: readonly NewsSource[] = []): { sources: NewsSource[]; skipped: number } {
	const sources = existing.map((source) => ({ ...source }));
	const seen = new Set(sources.map((source) => source.url.trim()));
	let skipped = 0;
	for (const match of xml.matchAll(/<outline\b([^>]*)\/?>(?:<\/outline>)?/gi)) {
		const attrs = Object.fromEntries([...match[1]!.matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map((item) => [item[1]!, item[2]!])) as Record<string, string>;
		const url = (attrs.xmlUrl || attrs.url || '').trim();
		if (!url || seen.has(url)) {
			skipped += 1;
			continue;
		}
		const source = normalizeNewsSource({
			id: feedId(url),
			name: attrs.title || attrs.text || url,
			url,
			type: attrs.type === 'atom' || attrs.type === 'jsonfeed' || attrs.type === 'web-list' ? attrs.type : 'rss',
			enabled: true,
			tier: 'other',
			participation: 'editorial',
			intervalMinutes: 30,
		});
		if (!source) {
			skipped += 1;
			continue;
		}
		seen.add(url);
		sources.push(source);
	}
	return { sources, skipped };
}
export function exportOpml(sources: readonly NewsSource[]): string { return `<?xml version="1.0" encoding="UTF-8"?><opml version="2.0"><head><title>NAND News</title></head><body>${sources.map((source) => `<outline type="${source.kind}" text="${escape(source.name)}" title="${escape(source.name)}" xmlUrl="${escape(source.url)}" />`).join('')}</body></opml>`; }
function escape(value: string): string { return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

