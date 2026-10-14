// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/reading/reading-highlights.ts
import { parser, Strikethrough } from '@lezer/markdown';
/** Where a needle falls inside one segment of a run of text. */
interface TextSlice {
	index: number;
	start: number;
	end: number;
}

interface SourcePosition {
	index: number;
	offset: number;
}

/**
 * Collapse whitespace, remembering where every surviving character came from.
 *
 * The rendered output is not the source: a soft-wrapped sentence arrives as one
 * run of text with the newline turned into a space, and an indented list item
 * loses its indent. Comparing the two literally fails on text that is plainly
 * the same, so both sides are normalised and the map is what turns a hit in the
 * normalised string back into a range in the real nodes.
 */
function normalise(segments: string[]): {
	text: string;
	starts: SourcePosition[];
	ends: SourcePosition[];
} {
	let text = "";
	const starts: SourcePosition[] = [];
	const ends: SourcePosition[] = [];
	let spaceStart: SourcePosition | null = null;
	let spaceEnd: SourcePosition | null = null;

	/**
	 * Emit the run of whitespace just walked past as the single space it collapses
	 * to. Leading whitespace is dropped rather than emitted: a match must not begin
	 * on space the renderer collapsed away.
	 */
	const flushSpace = (): void => {
		if (spaceStart === null) return;
		if (text.length > 0 && spaceEnd !== null) {
			text += " ";
			starts.push(spaceStart);
			ends.push(spaceEnd);
		}
		spaceStart = null;
		spaceEnd = null;
	};

	for (let index = 0; index < segments.length; index++) {
		const segment = segments[index]!;
		for (let offset = 0; offset < segment.length; offset++) {
			if (/\s/.test(segment[offset]!)) {
				if (spaceStart === null) spaceStart = { index, offset };
				spaceEnd = { index, offset: offset + 1 };
				continue;
			}
			flushSpace();
			text += segment[offset];
			starts.push({ index, offset });
			ends.push({ index, offset: offset + 1 });
		}
	}

	return { text, starts, ends };
}

/**
 * Where the `occurrence`-th appearance of `needle`, counted from 0, falls across
 * `segments`, or null if it is not there.
 *
 * The needle must already describe visible text; mapSourceRange handles Markdown.
 */
export function locateAcrossSegments(
	segments: string[],
	needle: string,
	occurrence = 0,
): TextSlice[] | null {
	const wanted = normalise([needle]).text;
	if (wanted === "") return null;

	const haystack = normalise(segments);
	let at = haystack.text.indexOf(wanted);
	// Fewer appearances here than in the source means the renderer consumed one,
	// and marking another would be a guess: the caller marks the block instead.
	for (let skipped = 0; skipped < occurrence && at !== -1; skipped++) {
		at = haystack.text.indexOf(wanted, at + 1);
	}
	if (at === -1) return null;

	const start = haystack.starts[at]!;
	const end = haystack.ends[at + wanted.length - 1]!;

	const slices: TextSlice[] = [];
	for (let index = start.index; index <= end.index; index++) {
		const from = index === start.index ? start.offset : 0;
		const to = index === end.index ? end.offset : segments[index]!.length;
		if (to > from) slices.push({ index, start: from, end: to });
	}
	return slices;
}

/** Project source offsets through inline Markdown before matching rendered nodes. */
export function mapSourceRange(segments: string[], source: string, from: number, to: number, decodeEntity: (value: string) => string): TextSlice[] | null {
	const visible = new Uint8Array(source.length).fill(1);
	const replacements = new Map<number, { end: number; text: string }>();
	const hide = (start: number, end: number) => visible.fill(0, start, end);
	parser.configure(Strikethrough).parse(source).iterate({ enter(node) {
		if (/^(InlineCode|FencedCode|CodeBlock|Image|LinkReference|HTMLTag|CommentBlock)$/.test(node.name)) { hide(node.from, node.to); return false; }
		if (/Mark$/.test(node.name) || node.name === 'LinkTitle' || node.name === 'LinkLabel') hide(node.from, node.to);
		if (node.name === 'Link') {
			for (let child = node.node.firstChild; child; child = child.nextSibling) if (child.name === 'LinkMark' && source.slice(child.from, child.to) === ']') { hide(child.from, node.to); break; }
		}
		if (node.name === 'Escape') hide(node.from, node.from + 1);
		if (node.name === 'Entity') replacements.set(node.from, { end: node.to, text: decodeEntity(source.slice(node.from, node.to)) });
		return undefined;
	} });
	// Obsidian wikilinks are not part of the CommonMark parser. Only their label
	// is visible; embedded resources have no text node to highlight.
	for (const match of source.matchAll(/!?\[\[([^\]\n]+)\]\]/g)) {
		const start = match.index, end = start + match[0].length;
		// Projection only removes characters: never revive a label inside code,
		// images or other regions already excluded by the Markdown syntax tree.
		if (match[0][0] === '!') hide(start, end);
		else { hide(start, start + 2 + (match[1]!.lastIndexOf('|') + 1)); hide(end - 2, end); }
	}
	let text = '';
	const offsets: number[] = [];
	for (let i = 0; i < source.length; i++) {
		if (!visible[i]) continue;
		const replacement = replacements.get(i);
		if (replacement) { text += replacement.text; offsets.push(...Array<number>(replacement.text.length).fill(i)); i = replacement.end - 1; }
		else { text += source[i]; offsets.push(i); }
	}
	const projected = normalise([text]);
	const start = projected.starts.findIndex(position => offsets[position.offset]! >= from && offsets[position.offset]! < to);
	if (start < 0) return null;
	let end = start + 1;
	while (end < projected.starts.length && offsets[projected.starts[end]!.offset]! < to) end++;
	const needle = projected.text.slice(start, end);
	let occurrence = 0;
	for (let at = projected.text.indexOf(needle); at >= 0 && at < start; at = projected.text.indexOf(needle, at + 1)) occurrence++;
	return locateAcrossSegments(segments, needle, occurrence);
}
