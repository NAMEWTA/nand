import { parser } from '@lezer/markdown';
import { decodeHTMLStrict } from 'entities';
import { isPair, isScalar, isSeq, visit, type Alias, type Document, type Scalar } from 'yaml';
import { readMarkdownDocument, readYaml } from '../../../shared/storage/markdown-document';

export type LinkSyntax = 'wiki' | 'markdown';
interface Destination { from: number; to: number; link: string; syntax: LinkSyntax; htmlQuote?: string }
interface Property { from: number; to: number; value: string; comment: string; cover: boolean; node: Scalar }
interface PropertyAlias { from: number; to: number; value: unknown; cover: boolean; node: Alias; replace(value: unknown): void }
type DestinationRewrite = (link: string, syntax: LinkSyntax) => string | undefined;
const coverKey = (key: unknown) => typeof key === 'string' && ['cover', '封面'].includes(key.toLowerCase());

function properties(text: string): { bodyStart: number; values: Property[]; aliases: PropertyAlias[]; document?: Document } {
	const values: Property[] = [];
	const aliases: PropertyAlias[] = [];
	let bodyStart = 0;
	try {
		const source = readMarkdownDocument(text);
		bodyStart = text.length - source.body.length;
		if (!source.yaml) return { bodyStart, values, aliases };
		const start = text.indexOf(source.yaml);
		const document = readYaml(source.yaml);
		// Cyclic YAML is valid but cannot be projected into JSON-backed consumers.
		// Keep that property block opaque while still indexing and moving body links.
		JSON.stringify(document.toJSON());
		visit(document, { Scalar(key, node, parents) {
			if (key === 'key' || typeof node.value !== 'string' || !node.range) return;
			const comment = node.srcToken?.type === 'block-scalar' ? node.srcToken.props.flatMap(token => token.type === 'comment' && 'source' in token ? [token.source] : []).join(' ') : '';
			const pair = [...parents].reverse().find(isPair), name = pair && isScalar(pair.key) ? String(pair.key.value).toLowerCase() : '';
			values.push({ from: start + node.range[0], to: start + node.range[1], value: node.value, comment, cover: coverKey(name), node });
		}, Alias(key, node, parents) {
			if (key === 'key' || !node.range) return;
			const pair = [...parents].reverse().find(isPair), parent = parents.at(-1);
			const cover = !!pair && isScalar(pair.key) && coverKey(pair.key.value);
			aliases.push({ from: start + node.range[0], to: start + node.range[1], value: node.toJS(document), cover, node, replace(value) {
				const replacement = document.createNode(value);
				if (isPair(parent)) parent.value = replacement;
				else if (isSeq(parent) && typeof key === 'number') parent.items[key] = replacement;
			} });
		} });
		return { bodyStart, values, aliases, document };
	} catch { /* Unresolvable properties are left intact; body links remain usable. */ }
	return { bodyStart, values: [], aliases: [] };
}

const plainAttachment = (text: string) => !/[\r\n<>[\]]/.test(text) && /\.(png|jpe?g|gif|webp|avif|bmp|svg|mp3|wav|ogg|m4a|mp4|webm|pdf)(?:#[^\r\n]*)?$/i.test(text);
const markdown = parser.configure({
	defineNodes: ['NandWikiLink', 'NandComment'],
	parseInline: [{ name: 'NandWikiLink', before: 'Link', parse(context, _next, position) {
		const rest = context.slice(position, context.end);
		const comment = /^%%[\s\S]*?%%/.exec(rest);
		if (comment) return context.addElement(context.elt('NandComment', position, position + comment[0].length));
		const wiki = /^!?\[\[[^\]\r\n]+\]\]/.exec(rest);
		return wiki ? context.addElement(context.elt('NandWikiLink', position, position + wiki[0].length)) : -1;
	} }],
});

function htmlDestinations(text: string, offset: number, state: { rawTag: string }): Destination[] {
	const result: Destination[] = [];
	// Consume whole quoted attributes/comments so an example containing "<img" is never a tag.
	const tokens = /<!--[\s\S]*?-->|<\/?[a-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
	for (const token of text.matchAll(tokens)) {
		const tag = /^<(\/?)([a-z][\w:-]*)\b/i.exec(token[0]);
		if (!tag) continue;
		const name = tag[2]!.toLowerCase();
		if (state.rawTag) { if (tag[1] && name === state.rawTag) state.rawTag = ''; continue; }
		if (!tag[1] && ['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext'].includes(name)) { state.rawTag = name; continue; }
		const opening = /^<img\b/i.exec(token[0]);
		if (!opening) continue;
		const attributes = token[0].slice(opening[0].length);
		const pattern = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
		for (const attribute of attributes.matchAll(pattern)) {
			if (attribute[1]!.toLowerCase() !== 'src') continue;
			const link = attribute[2] ?? attribute[3] ?? attribute[4];
			if (link === undefined) break;
			const valueStart = attribute[0].indexOf('=') + 1;
			const prefix = /^\s*(["']?)/.exec(attribute[0].slice(valueStart))!;
			const from = offset + token.index + opening[0].length + attribute.index + valueStart + prefix[0].length;
			result.push({ from, to: from + link.length, link: decodeHTMLStrict(link), syntax: 'markdown', htmlQuote: prefix[1] ?? '' });
			break;
		}
	}
	return result;
}

/** Preserve source ranges so rewriting touches destinations only, never code or labels. */
function destinations(text: string, bodyStart = 0): Destination[] {
	const result: Destination[] = [];
	const htmlState = { rawTag: '' };
	markdown.parse(text).iterate({ enter(node) {
		if (node.to <= bodyStart) return false;
		if (node.name === 'HTMLTag' || node.name === 'HTMLBlock') {
			result.push(...htmlDestinations(text.slice(node.from, node.to), node.from, htmlState));
			return false;
		}
		if (htmlState.rawTag) return undefined;
		if (node.name === 'NandWikiLink') {
			const from = node.from + (text[node.from] === '!' ? 3 : 2), end = node.to - 2;
			const alias = text.indexOf('|', from), to = alias >= from && alias < end ? alias : end;
			result.push({ from, to, link: text.slice(from, to), syntax: 'wiki' }); return false;
		}
		if (node.name === 'URL' && ['Link', 'Image', 'LinkReference'].includes(node.node.parent?.name ?? '')) {
			const raw = text.slice(node.from, node.to), link = raw.startsWith('<') ? raw.slice(1, -1) : raw;
			result.push({ from: node.from, to: node.to, link: decodeHTMLStrict(link.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1')), syntax: 'markdown' });
		}
		return undefined;
	} });
	return result;
}

export function contentLinkDestinations(text: string): Array<{ link: string; syntax: LinkSyntax }> {
	const { bodyStart, values, aliases } = properties(text);
	const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : [];
	return [...destinations(text, bodyStart), ...values.flatMap(item => destinations(item.value)), ...aliases.flatMap(item => strings(item.value).flatMap(value => destinations(value)))].map(({ link, syntax }) => ({ link, syntax }));
}

/** CommonMark nodes exclude inline, indented, nested and fenced code. */
export function rewriteContentLinks(text: string, destination: DestinationRewrite): string {
	const { bodyStart, values, aliases, document } = properties(text);
	const edits: Array<{ from: number; to: number; text: string }> = [];
	for (const item of destinations(text, bodyStart)) {
		const next = destination(item.link, item.syntax);
		if (next !== undefined) edits.push({ ...item, text: replacement(item, next) });
	}
	for (const item of values) {
		const next = item.cover && plainAttachment(item.value) ? destination(item.value, 'wiki') ?? item.value : rewriteInline(item.value, destination);
		if (next !== item.value) {
			item.node.value = next;
			const ending = /\r?\n$/.exec(text.slice(item.from, item.to))?.[0] ?? '';
			edits.push({ ...item, text: JSON.stringify(next) + (item.comment ? ' ' + item.comment : '') + ending });
		}
	}
	// Aliases are uses, not ownership declarations. Detach only uses whose intended value
	// differs from the rewritten anchor, in source order so chained structures stay coherent.
	for (const item of aliases) {
		const next = rewritePropertyValue(item.value, item.cover, destination);
		if (JSON.stringify(next) !== JSON.stringify(item.node.toJS(document!))) {
			edits.push({ from: item.from, to: item.to, text: JSON.stringify(next) });
			item.replace(next);
		}
	}
	for (const edit of edits.sort((a, b) => b.from - a.from)) text = text.slice(0, edit.from) + edit.text + text.slice(edit.to);
	return text;
}

function rewritePropertyValue(value: unknown, cover: boolean, destination: DestinationRewrite): unknown {
	if (typeof value === 'string') return cover && plainAttachment(value) ? destination(value, 'wiki') ?? value : rewriteInline(value, destination);
	if (Array.isArray(value)) return value.map(item => rewritePropertyValue(item, cover, destination));
	if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewritePropertyValue(item, coverKey(key), destination)]));
	return value;
}

function rewriteInline(text: string, destination: (link: string, syntax: LinkSyntax) => string | undefined): string {
	for (const item of destinations(text).reverse()) {
		const next = destination(item.link, item.syntax);
		if (next !== undefined) text = text.slice(0, item.from) + replacement(item, next) + text.slice(item.to);
	}
	return text;
}

function replacement(item: Destination, next: string): string {
	if (item.htmlQuote !== undefined) {
		const escaped = next.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
		return item.htmlQuote ? escaped : '"' + escaped + '"';
	}
	return item.syntax === 'wiki' ? next : '<' + next + '>';
}
