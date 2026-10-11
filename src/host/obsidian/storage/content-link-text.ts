import { parser } from '@lezer/markdown';
import { decodeHTMLStrict } from 'entities';
import { visit } from 'yaml';
import { readMarkdownDocument, readYaml } from '../../../shared/storage/markdown-document';

export type LinkSyntax = 'wiki' | 'markdown';
interface Destination { from: number; to: number; link: string; syntax: LinkSyntax }
interface Property { from: number; to: number; value: string; comment: string }

function properties(text: string): { bodyStart: number; values: Property[] } {
	const values: Property[] = [];
	let bodyStart = 0;
	try {
		const source = readMarkdownDocument(text);
		bodyStart = text.length - source.body.length;
		if (!source.yaml) return { bodyStart, values };
		const start = text.indexOf(source.yaml);
		visit(readYaml(source.yaml), { Scalar(key, node) {
			if (key === 'key' || typeof node.value !== 'string' || !node.range) return;
			const comment = node.srcToken?.type === 'block-scalar' ? node.srcToken.props.flatMap(token => token.type === 'comment' && 'source' in token ? [token.source] : []).join(' ') : '';
			values.push({ from: start + node.range[0], to: start + node.range[1], value: node.value, comment });
		} });
	} catch { /* Malformed properties are left intact; body links remain usable. */ }
	return { bodyStart, values };
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

/** Preserve source ranges so rewriting touches destinations only, never code or labels. */
function destinations(text: string, bodyStart = 0): Destination[] {
	const result: Destination[] = [];
	markdown.parse(text).iterate({ enter(node) {
		if (node.to <= bodyStart) return false;
		if (node.name === 'HTMLTag' || node.name === 'HTMLBlock') {
			const tag = text.slice(node.from, node.to);
			const match = /^(<img\b[^>]*?\bsrc\s*=\s*)(?:"([^"]*)"|'([^']*)')/i.exec(tag);
			if (match) {
				const link = match[2] ?? match[3]!;
				const from = node.from + match[1]!.length + 1;
				result.push({ from, to: from + link.length, link: decodeHTMLStrict(link), syntax: 'markdown' });
			}
			return false;
		}
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
	const { bodyStart, values } = properties(text);
	return [...destinations(text, bodyStart), ...values.flatMap(item => destinations(item.value))].map(({ link, syntax }) => ({ link, syntax }));
}

/** CommonMark nodes exclude inline, indented, nested and fenced code. */
export function rewriteContentLinks(text: string, destination: (link: string, syntax: LinkSyntax) => string | undefined): string {
	const { bodyStart, values } = properties(text);
	const edits: Array<{ from: number; to: number; text: string }> = [];
	for (const item of destinations(text, bodyStart)) {
		const next = destination(item.link, item.syntax);
		if (next !== undefined) edits.push({ ...item, text: replacement(text, item, next) });
	}
	for (const item of values) {
		const next = plainAttachment(item.value) ? destination(item.value, 'wiki') ?? item.value : rewriteInline(item.value, destination);
		if (next !== item.value) {
			const ending = /\r?\n$/.exec(text.slice(item.from, item.to))?.[0] ?? '';
			edits.push({ ...item, text: JSON.stringify(next) + (item.comment ? ' ' + item.comment : '') + ending });
		}
	}
	for (const edit of edits.sort((a, b) => b.from - a.from)) text = text.slice(0, edit.from) + edit.text + text.slice(edit.to);
	return text;
}

function rewriteInline(text: string, destination: (link: string, syntax: LinkSyntax) => string | undefined): string {
	for (const item of destinations(text).reverse()) {
		const next = destination(item.link, item.syntax);
		if (next !== undefined) text = text.slice(0, item.from) + replacement(text, item, next) + text.slice(item.to);
	}
	return text;
}

function replacement(text: string, item: Destination, next: string): string {
	// HTML attribute ranges exclude their quotes; Markdown URL ranges include angle brackets.
	return item.syntax === 'wiki' || /["']/.test(text[item.from - 1] ?? '') ? next : '<' + next + '>';
}
