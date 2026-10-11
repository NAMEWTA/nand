import { isMap, isSeq, parseDocument, type Document, type Node } from 'yaml';

export interface MarkdownDocument {
	prefix: string;
	yaml: string | null;
	body: string;
	newline: string;
}

/** Only a delimiter occupying a whole line can end frontmatter. */
export function readMarkdownDocument(text: string): MarkdownDocument {
	const newline = text.includes('\r\n') ? '\r\n' : '\n';
	const opening = /^(\uFEFF?[\t \r\n]*)---[\t ]*\r?\n/.exec(text);
	if (!opening) return { prefix: '', yaml: null, body: text, newline };
	const rest = text.slice(opening[0].length);
	const closing = /^---[\t ]*(?:\r?\n|$)/m.exec(rest);
	if (!closing) throw new Error('Unclosed Markdown frontmatter');
	return {
		prefix: opening[1] ?? '',
		yaml: rest.slice(0, closing.index),
		body: rest.slice(closing.index + closing[0].length),
		newline,
	};
}

export function readYaml(yaml: string | null): Document {
	const document = parseDocument(yaml ?? '{}', { keepSourceTokens: true });
	if (document.errors.length) throw document.errors[0]!;
	if (document.contents !== null && !isMap(document.contents)) throw new Error('Frontmatter must be a mapping');
	return document;
}

const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const record = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);

/** Apply only changes between two owned projections; leave unknown YAML nodes alone. */
function patchNode(doc: Document, node: Node | null, base: unknown, next: unknown): Node | null {
	if (equal(base, next)) return node;
	if (isMap(node) && record(base) && record(next)) {
		for (const key of new Set([...Object.keys(base), ...Object.keys(next)])) {
			if (equal(base[key], next[key])) continue;
			if (!(key in next)) node.delete(key);
			else node.set(key, patchNode(doc, node.get(key, true) as Node | null, base[key], next[key]));
		}
		return node;
	}
	if (isSeq(node) && Array.isArray(base) && Array.isArray(next)) {
		// Named/identified entries keep their unknown attributes when moved.
		const key = (v: unknown): unknown => (record(v) ? (v.id ?? v.memberId ?? v.target ?? v.name) : v);
		const used = new Set<number>();
		node.items = next.map((value, index) => {
			let old = base.findIndex((v, i) => !used.has(i) && equal(key(v), key(value)));
			if (old < 0 && base.length === next.length && !used.has(index)) old = index;
			if (old < 0) return doc.createNode(value);
			used.add(old);
			return patchNode(doc, node.items[old] as Node | null, base[old], value);
		});
		return node;
	}
	const replacement = doc.createNode(next);
	if (node) {
		replacement.comment = node.comment;
		replacement.commentBefore = node.commentBefore;
	}
	return replacement;
}

export function patchFrontmatter(original: string, baseline: string, next: string): string {
	const source = readMarkdownDocument(original);
	const before = readMarkdownDocument(baseline);
	const after = readMarkdownDocument(next);
	const doc = readYaml(source.yaml);
	const base = readYaml(before.yaml).toJSON() as unknown;
	const value = readYaml(after.yaml).toJSON() as unknown;
	if (equal(base, value)) return original.slice(0, original.length - source.body.length) + after.body;
	doc.contents = patchNode(doc, doc.contents, base, value);
	const yaml = doc.toString({ lineWidth: 0 }).replace(/\r?\n/g, source.newline);
	return `${source.prefix}---${source.newline}${yaml}---${source.newline}${after.body}`;
}
