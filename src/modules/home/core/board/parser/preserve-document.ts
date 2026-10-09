import { patchFrontmatter, readMarkdownDocument } from '../../../../../shared/storage/markdown-document';
import { patchManagedLines } from '../../../../../shared/storage/managed-lines';

interface Block { key: string; heading: string; body: string }
function split(text: string, depth: number): { preamble: string; blocks: Block[] } {
	const blocks: Block[] = [];
	let preamble = '', fence = '';
	const pattern = new RegExp(`^#{${depth}}[ \\t]+(.+?)\\s*$`);
	for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
		const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
		const heading = !fence && pattern.exec(line.trimEnd());
		if (heading) blocks.push({ key: heading[1]!, heading: line, body: '' });
		else if (blocks.length) blocks[blocks.length - 1]!.body += line;
		else preamble += line;
		if (marker && (!fence || marker[0] === fence[0] && marker.length >= fence.length)) fence = fence ? '' : marker;
	}
	if (depth === 3) for (const block of blocks) block.key = /^id:\s*(.+)$/m.exec(block.body)?.[1]?.trim() ?? block.key;
	return { preamble, blocks };
}
const whole = (b: Block): string => b.heading + b.body;

/** Preserve free introductions and untouched card text, including comments/spacing. */
export function preserveDashboardDocument(original: string, baseline: string, generated: string): string {
	if (baseline === generated) return original;
	const before = split(readMarkdownDocument(baseline).body, 2);
	const source = split(readMarkdownDocument(original).body, 2);
	const after = split(readMarkdownDocument(generated).body, 2);
	const baseCards = new Map(before.blocks.flatMap(b => split(b.body, 3).blocks.map(c => [c.key, c] as const)));
	const sourceCards = new Map(source.blocks.flatMap(b => split(b.body, 3).blocks.map(c => [c.key, c] as const)));
	const body = source.preamble + after.blocks.map((block, index) => {
		let oldIndex = before.blocks.findIndex(b => b.key === block.key);
		// A renamed column has no stable id in the existing Markdown grammar.
		if (oldIndex < 0 && before.blocks.length === after.blocks.length &&
			!after.blocks.some(b => b.key === before.blocks[index]?.key)) oldIndex = index;
		const base = before.blocks[oldIndex];
		const raw = source.blocks.find(b => b.key === base?.key);
		if (base && raw && whole(base) === whole(block)) return whole(raw);
		const cards = split(block.body, 3);
		const intro = raw ? split(raw.body, 3).preamble : cards.preamble;
		return block.heading + intro + cards.blocks.map(card => {
			const previous = baseCards.get(card.key), rawCard = sourceCards.get(card.key);
			return previous && rawCard ? patchManagedLines(whole(rawCard), whole(previous), whole(card)) : whole(card);
		}).join('');
	}).join('');
	const next = generated.slice(0, generated.length - readMarkdownDocument(generated).body.length) + body;
	return patchFrontmatter(original, baseline, next);
}
