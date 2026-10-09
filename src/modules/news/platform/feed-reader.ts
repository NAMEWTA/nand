import type { MaterialInput } from '../core/materials';

export interface FeedEntry extends MaterialInput { sourceId: string; }

interface XmlNode {
	name: string;
	attrs: Record<string, string>;
	text: string;
	children: XmlNode[];
	parent?: XmlNode;
}

const clean = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

function decode(value: string): string {
	return value
		.replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
		.replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 16)))
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

function localName(tag: string): string {
	const bare = tag.split(':').pop() ?? tag;
	return bare.toLowerCase();
}

function attributes(source: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	for (const match of source.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
		const key = localName(match[1] ?? '');
		if (!key || key === '/') continue;
		attrs[key] = decode(match[2] ?? match[3] ?? match[4] ?? '');
	}
	return attrs;
}

/** A feed-sized XML walk. NAND does not ship a second DOM implementation for RSS and Atom. */
function parseXml(source: string): XmlNode | undefined {
	const root: XmlNode = { name: '#root', attrs: {}, text: '', children: [] };
	const stack: XmlNode[] = [root];
	const pattern = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<([A-Za-z_:][\w:.-]*)([^>]*?)(\/)?>|<\/[A-Za-z_:][\w:.-]*>|([^<]+)/g;
	for (const match of source.matchAll(pattern)) {
		const current = stack[stack.length - 1];
		if (!current) break;
		if (match[1] !== undefined || (match[5] && !match[2])) {
			current.text += decode(match[1] ?? match[5] ?? '');
			continue;
		}
		if (match[2]) {
			const node: XmlNode = { name: localName(match[2]), attrs: attributes(match[3] ?? ''), text: '', children: [], parent: current };
			current.children.push(node);
			if (!match[4]) stack.push(node);
			continue;
		}
		if (stack.length > 1) stack.pop();
	}
	return root.children[0];
}

function descendants(root: XmlNode): XmlNode[] {
	const out: XmlNode[] = [];
	const visit = (node: XmlNode) => {
		for (const child of node.children) {
			out.push(child);
			visit(child);
		}
	};
	visit(root);
	return out;
}

function named(root: XmlNode, name: string): XmlNode[] {
	return descendants(root).filter((node) => node.name === name);
}

function first(root: XmlNode, names: readonly string[]): XmlNode | undefined {
	return descendants(root).find((node) => names.includes(node.name));
}

function textOf(node: XmlNode | undefined): string {
	if (!node) return '';
	const parts: string[] = [];
	const visit = (current: XmlNode) => {
		parts.push(current.text);
		for (const child of current.children) visit(child);
	};
	visit(node);
	return clean(parts.join(''));
}

function baseFor(node: XmlNode, fallback: string): string {
	let current: XmlNode | undefined = node;
	while (current) {
		const base = current.attrs['xml:base'] ?? current.attrs.base;
		if (base) {
			try { return new URL(base, fallback).toString(); } catch { return fallback; }
		}
		current = current.parent;
	}
	return fallback;
}

function absolute(value: string, base: string): string {
	try { return new URL(value.trim(), base).toString(); } catch { return value.trim(); }
}

function date(value: string): number | undefined {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseJson(body: string, sourceId: string, baseUrl: string): FeedEntry[] {
	const raw: unknown = JSON.parse(body);
	const record = raw && typeof raw === 'object' ? (raw as { version?: unknown; items?: unknown }) : undefined;
	const version = typeof record?.version === 'string' ? record.version : '';
	if (!record || !/^https?:\/\/jsonfeed\.org\/version\/(?:1|1\.1)$/.test(version)) throw new Error('Unsupported JSON Feed version');
	const items = Array.isArray(record.items) ? record.items : [];
	return items.flatMap((item: unknown) => {
		if (!item || typeof item !== 'object') return [];
		const value = item as Record<string, unknown>;
		const sourceItemId = typeof value.id === 'string' ? value.id : '';
		const url = typeof value.url === 'string' ? absolute(value.url, baseUrl) : typeof value.external_url === 'string' ? absolute(value.external_url, baseUrl) : '';
		const title = typeof value.title === 'string' ? value.title : '';
		if (!sourceItemId || !url || !title) return [];
		const authorRecord = value.author && typeof value.author === 'object' ? (value.author as Record<string, unknown>) : undefined;
		const author = typeof authorRecord?.name === 'string' ? authorRecord.name : undefined;
		return [{
			sourceId,
			sourceItemId,
			url,
			title,
			summary: typeof value.content_text === 'string' ? value.content_text : typeof value.summary === 'string' ? value.summary : '',
			body: typeof value.content_html === 'string' ? value.content_html.replace(/<[^>]*>/g, ' ') : typeof value.content_text === 'string' ? value.content_text : '',
			author,
			publishedAt: typeof value.date_published === 'string' ? date(value.date_published) : undefined,
		}];
	});
}

export function parseFeed(body: string, sourceId: string, baseUrl = ''): FeedEntry[] {
	if (/^\s*\{/.test(body)) return parseJson(body, sourceId, baseUrl);
	const root = parseXml(body);
	if (!root) throw new Error('Feed has no root element');
	const entries = named(root, 'item').filter((node) => node.parent === root || node.parent?.name === 'channel');
	const atomEntries = named(root, 'entry').filter((node) => node.parent === root);
	const rows = entries.length ? entries : atomEntries;
	return rows.flatMap((row) => {
		const rowBase = baseFor(row, baseUrl);
		const linkNode = named(row, 'link').find((node) => !node.attrs.rel || node.attrs.rel === 'alternate');
		const link = linkNode?.attrs.href || textOf(linkNode) || textOf(first(row, ['guid', 'id']));
		const url = link ? absolute(link, rowBase) : '';
		const title = textOf(first(row, ['title']));
		if (!url || !title) return [];
		const sourceItemId = textOf(first(row, ['guid', 'id'])) || url;
		const summary = textOf(first(row, ['description', 'summary']));
		const content = textOf(first(row, ['encoded', 'content']));
		const author = textOf(first(row, ['creator', 'author']));
		const publishedAt = date(textOf(first(row, ['pubdate', 'published', 'updated', 'date'])));
		return [{ sourceId, sourceItemId, url, title, summary, body: content || summary, ...(author ? { author } : {}), ...(publishedAt === undefined ? {} : { publishedAt }) }];
	});
}
