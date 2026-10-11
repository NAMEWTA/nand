import { sanitizeHTMLToDom } from 'obsidian';
import type { MaterialInput } from '../core/materials';

export interface FeedEntry extends MaterialInput { sourceId: string; }

type XmlNode = Element;
const clean = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();
const nameOf = (node: Element): string => node.localName.split(':').pop()!.toLowerCase();
const BLOCKS = new Set(['p', 'div', 'br', 'li', 'ul', 'ol', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'tr', 'blockquote']);
const OMIT = new Set(['script', 'style', 'iframe', 'object', 'svg', 'noscript']);

export function plainText(node: Node): string {
	if (node.nodeType === 3 || node.nodeType === 4) return node.textContent ?? '';
	const name = node.nodeType === 1 ? nameOf(node as Element) : '';
	if (OMIT.has(name)) return '';
	const text = Array.from(node.childNodes, plainText).join('');
	return BLOCKS.has(name) ? ' ' + text + ' ' : text;
}

/** Read sanitized, detached HTML as text; never render feed markup. */
function htmlText(value: string): string {
	return clean(plainText(sanitizeHTMLToDom(value)));
}

function parseXml(source: string): XmlNode {
	const document = new DOMParser().parseFromString(source, 'text/xml');
	const root = document.documentElement;
	if (!root || document.querySelector('parsererror') || !['rss', 'rdf', 'feed'].includes(nameOf(root))) throw new Error('Invalid RSS or Atom feed');
	return root;
}

function named(root: XmlNode, name: string): XmlNode[] {
	return Array.from(root.querySelectorAll('*')).filter(node => nameOf(node) === name);
}

function first(root: XmlNode, names: readonly string[]): XmlNode | undefined {
	const children = Array.from(root.children);
	for (const name of names) {
		const node = children.find(child => nameOf(child) === name);
		if (node) return node;
	}
	return undefined;
}

function textOf(node: XmlNode | undefined): string {
	if (!node) return '';
	const type = node.getAttribute('type');
	if (type === 'html' || type === 'text/html' || ['description', 'encoded'].includes(nameOf(node))) return htmlText(node.textContent ?? '');
	return clean(plainText(node));
}

function baseFor(node: XmlNode, fallback: string): string {
	const ancestors: XmlNode[] = [];
	for (let current: XmlNode | null = node; current; current = current.parentElement) ancestors.unshift(current);
	let base = fallback;
	for (const ancestor of ancestors) {
		const value = ancestor.getAttribute('xml:base');
		if (value) { try { base = new URL(value, base).toString(); } catch { /* Keep the enclosing valid base. */ } }
	}
	return base;
}

function absolute(value: string, base: string): string {
	try {
		const url = new URL(value.trim(), base || undefined);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
	} catch { return ''; }
}

function date(value: string): number | undefined {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseJson(body: string, sourceId: string, baseUrl: string): FeedEntry[] {
	const raw: unknown = JSON.parse(body);
	const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : undefined;
	const version = typeof record?.version === 'string' ? record.version : '';
	if (!record || !/^https?:\/\/jsonfeed\.org\/version\/(?:1|1\.1)$/.test(version)) throw new Error('Unsupported JSON Feed version');
	const items = Array.isArray(record.items) ? record.items : [];
	return items.flatMap((item: unknown) => {
		if (!item || typeof item !== 'object') return [];
		const value = item as Record<string, unknown>;
		const sourceItemId = typeof value.id === 'string' ? value.id : '';
		const url = typeof value.url === 'string' ? absolute(value.url, baseUrl) : typeof value.external_url === 'string' ? absolute(value.external_url, baseUrl) : /^https?:\/\//i.test(sourceItemId) ? absolute(sourceItemId, baseUrl) : absolute(typeof record.home_page_url === 'string' ? record.home_page_url : baseUrl, baseUrl);
		const content = typeof value.content_text === 'string' ? clean(value.content_text) : typeof value.content_html === 'string' ? htmlText(value.content_html) : '';
		const title = (typeof value.title === 'string' ? clean(value.title) : content.slice(0, 160)) || sourceItemId;
		if (!sourceItemId || !url || !title || (typeof value.content_text !== 'string' && typeof value.content_html !== 'string')) return [];
		const authors = value.authors ?? value.author ?? record.authors ?? record.author;
		const author = (Array.isArray(authors) ? authors : [authors]).flatMap((item: unknown) => item && typeof item === 'object' && 'name' in item && typeof item.name === 'string' ? [clean(item.name)] : []).join(', ') || undefined;
		return [{
			sourceId,
			sourceItemId,
			url,
			title,
			summary: typeof value.summary === 'string' ? clean(value.summary) : content,
			body: content,
			language: typeof value.language === 'string' ? value.language : typeof record.language === 'string' ? record.language : undefined,
			author,
			publishedAt: typeof value.date_published === 'string' ? date(value.date_published) : undefined,
		}];
	});
}

export function parseFeed(body: string, sourceId: string, baseUrl = ''): FeedEntry[] {
	if (/^\s*\{/.test(body)) return parseJson(body, sourceId, baseUrl);
	const root = parseXml(body);
	const entries = named(root, 'item').filter((node) => node.parentElement === root || (node.parentElement && nameOf(node.parentElement) === 'channel'));
	const atomEntries = named(root, 'entry').filter((node) => node.parentElement === root);
	const rows = entries.length ? entries : atomEntries;
	return rows.flatMap((row) => {
		const rowBase = baseFor(row, baseUrl);
		const linkNode = Array.from(row.children).find((node) => nameOf(node) === 'link' && (!node.getAttribute('rel') || node.getAttribute('rel') === 'alternate'));
		const identity = first(row, ['guid', 'id']);
		const fallbackLink = identity?.getAttribute('isPermaLink') !== 'false' && /^https?:\/\//i.test(textOf(identity)) ? textOf(identity) : '';
		const link = linkNode?.getAttribute('href') || textOf(linkNode) || fallbackLink;
		const url = link ? absolute(link, linkNode ? baseFor(linkNode, rowBase) : rowBase) : '';
		const title = textOf(first(row, ['title']));
		if (!url || !title) return [];
		const sourceItemId = textOf(first(row, ['guid', 'id'])) || url;
		const summary = textOf(first(row, ['description', 'summary']));
		const content = textOf(first(row, ['encoded', 'content']));
		const authorNode = first(row, ['creator', 'author']);
		const author = textOf(authorNode && (first(authorNode, ['name']) ?? authorNode));
		const publishedAt = date(textOf(first(row, ['pubdate', 'published', 'updated', 'date'])));
		const language = row.getAttribute('xml:lang') || row.parentElement?.getAttribute('xml:lang') || root.getAttribute('xml:lang') || textOf(first(row.parentElement ?? root, ['language'])) || undefined;
		return [{ sourceId, sourceItemId, url, title, summary, body: content || summary, language, ...(author ? { author } : {}), ...(publishedAt === undefined ? {} : { publishedAt }) }];
	});
}
