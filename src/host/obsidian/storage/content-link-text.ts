import { parser } from '@lezer/markdown';
import { decodeHTMLStrict } from 'entities';

export type LinkSyntax = 'wiki' | 'markdown';
interface Destination { from: number; to: number; link: string; syntax: LinkSyntax }
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
function destinations(text: string): Destination[] {
	const result: Destination[] = [];
	const frontmatterEnd = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text)?.[0].length ?? 0;
	markdown.parse(text).iterate({ enter(node) {
		if (node.to <= frontmatterEnd) return false;
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
	return destinations(text).map(({ link, syntax }) => ({ link, syntax }));
}

/** CommonMark nodes exclude inline, indented, nested and fenced code. */
export function rewriteContentLinks(text: string, destination: (link: string, syntax: LinkSyntax) => string | undefined): string {
	for (const item of destinations(text).reverse()) {
		const next = destination(item.link, item.syntax);
		if (next !== undefined) text = text.slice(0, item.from) + (item.syntax === 'wiki' ? next : '<' + next + '>') + text.slice(item.to);
	}
	return text;
}
