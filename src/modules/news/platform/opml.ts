import { normalizeNewsSource, type NewsSource } from '../core/model';

export function feedId(url: string): string {
	let hash = 2166136261;
	for (const char of url) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619);
	return 'feed-' + (hash >>> 0).toString(16);
}
export function sourceUrlKey(url: string): string {
	try { const value = new URL(url); value.hash = ''; return value.href; } catch { return url.trim(); }
}
export interface OpmlImport { sources: NewsSource[]; added: number; skipped: number; invalid: number; }

/** OPML 2.0 outlines; NAND's namespaced configuration preserves supported source settings. */
export function importOpml(xml: string, existing: readonly NewsSource[] = []): OpmlImport {
	const document = new DOMParser().parseFromString(xml, 'text/xml');
	if (document.querySelector('parsererror') || document.documentElement?.localName !== 'opml' || !document.querySelector('body')) throw new Error('news.opml.invalid');
	const sources = existing.map(source => ({ ...source }));
	const seen = new Set(sources.map(source => sourceUrlKey(source.url)));
	let skipped = 0, invalid = 0;
	for (const outline of document.querySelectorAll('body outline')) {
		if (outline.closest('outline[isComment="true"]')) { skipped++; continue; }
		const type = outline.getAttribute('type')?.toLowerCase();
		const nandType = outline.getAttribute('nand:type');
		const url = (outline.getAttribute('xmlUrl') || (nandType === 'web-list' ? outline.getAttribute('url') : '') || '').trim();
		if (!url) { if (!outline.querySelector('outline')) invalid++; continue; }
		if (type && !['rss', 'atom', 'jsonfeed'].includes(type) && nandType !== 'web-list') { skipped++; continue; }
		if (seen.has(sourceUrlKey(url))) { skipped++; continue; }
		let config: Partial<NewsSource> = {};
		try { config = JSON.parse(outline.getAttribute('nand:config') ?? '{}') as Partial<NewsSource>; } catch { invalid++; continue; }
		if (!config || typeof config !== 'object' || Array.isArray(config)) { invalid++; continue; }
		const id = typeof config.id === 'string' ? config.id : feedId(sourceUrlKey(url));
		const source = normalizeNewsSource({
			...config, id, url, name: outline.getAttribute('text') || outline.getAttribute('title') || url,
			type: nandType || (type === 'atom' || type === 'jsonfeed' ? type : 'rss'), enabled: config.enabled ?? true,
		});
		if (!source) { invalid++; continue; }
		for (let suffix = 2; sources.some(item => item.id === source.id); suffix++) source.id = id.slice(0, 70) + '-' + suffix;
		seen.add(sourceUrlKey(url));
		sources.push(source);
	}
	return { sources, added: sources.length - existing.length, skipped, invalid };
}
export function exportOpml(sources: readonly NewsSource[]): string {
	const outlines = sources.map(source => {
		const config = normalizeNewsSource(source)!;
		return '<outline type="' + (source.type === 'web-list' ? 'link' : 'rss') + '" text="' + escape(source.name) + '" title="' + escape(source.name) + '" ' + (source.type === 'web-list' ? 'url' : 'xmlUrl') + '="' + escape(source.url) + '" nand:type="' + source.type + '" nand:config="' + escape(JSON.stringify(config)) + '" />';
	});
	return '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0" xmlns:nand="urn:nand:news"><head><title>NAND</title></head><body>\n' + outlines.join('\n') + '\n</body></opml>\n';
}
function escape(value: string): string { return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/\r/g, '&#13;').replace(/\n/g, '&#10;'); }

