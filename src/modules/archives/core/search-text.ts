import type { ArchiveRecord, EntityRef } from './model';

export const searchSources = ['fields', 'employment', 'traits', 'habits', 'notes', 'relation', 'body'] as const;
export type SearchSource = (typeof searchSources)[number];
export interface SearchFragment {
	source: SearchSource;
	/** Plain text, original case, whitespace collapsed. */
	text: string;
	/** `text` lowercased once at index time; queries only read this. */
	lower: string;
	/** Body only: plain text with newlines kept, for a line hint. */
	located?: string;
	/** Original 1-based line for a character index in `located`. */
	lineAt?: (index: number) => number;
}
export interface SearchDocument {
	/** Lowercased text matching today's field, title, and company-name search. */
	fields: string;
	/** Lowercased fragment text joined with spaces. Matching reads the fragments, so a term never spans two of them. */
	record: string;
	fieldsDisplay: string;
	fragments: SearchFragment[];
}
export interface SearchHit {
	source: SearchSource;
	snippet: string;
	line?: number;
}
export interface SearchNames {
	company(ref: EntityRef): string;
	person(ref: EntityRef): string;
}

const managed = /<!-- nand:([\w-]+) -->[\s\S]*?<!-- \/nand:\1 -->/g;
const frontmatter = /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

function collapse(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** Drop this record's identity and row markers. Other UUIDs in the note stay searchable. */
function stripIdentity(value: string, id: string): string {
	let text = value.replace(/<!--\s*nand:row\s+[\w-]+\s*-->/gi, ' ');
	if (id) text = text.replace(new RegExp(escapeRegExp(id), 'g'), ' ');
	return text;
}
function readable(value: string): string {
	return value
		.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, ' $1 ')
		.replace(/\[([^\]]*)\]\(([^)]*)\)/g, ' $1 ')
		.replace(/<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi, ' $1$2$3 ');
}
function plain(value: string, id = ''): string {
	return collapse(
		stripIdentity(readable(value), id)
			.replace(/<!--[\s\S]*?-->/g, ' ')
			.replace(/<[^>\n]*>/g, ' '),
	);
}
function skipRanges(raw: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	const front = frontmatter.exec(raw);
	if (front && front.index === 0) ranges.push([0, front[0].length]);
	managed.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = managed.exec(raw))) ranges.push([match.index, match.index + match[0].length]);
	ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const merged: Array<[number, number]> = [];
	for (const range of ranges) {
		const last = merged[merged.length - 1];
		if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
		else merged.push([range[0], range[1]]);
	}
	return merged;
}
function advance(raw: string, from: number, to: number, line: number): number {
	for (let i = from; i < to; i++) if (raw.charCodeAt(i) === 10) line++;
	return line;
}
function emit(
	chunk: string,
	line: number,
	out: string[],
	marks: number[],
	state: { len: number; line: number },
): number {
	let current = line;
	let start = 0;
	for (let i = 0; i <= chunk.length; i++) {
		if (i !== chunk.length && chunk.charCodeAt(i) !== 10) continue;
		const piece = chunk.slice(start, i).replace(/\r$/, '');
		if (piece) {
			if (marks.length === 0 || current !== state.line) {
				marks.push(state.len, current);
				state.line = current;
			}
			out.push(piece);
			state.len += piece.length;
		}
		if (i === chunk.length) break;
		out.push('\n');
		state.len += 1;
		current++;
		start = i + 1;
	}
	return current;
}
function lineNumber(marks: number[], index: number): number {
	if (marks.length < 2) return 1;
	let lo = 0;
	let hi = marks.length / 2 - 1;
	let line = marks[1]!;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (marks[mid * 2]! <= index) {
			line = marks[mid * 2 + 1]!;
			lo = mid + 1;
		} else hi = mid - 1;
	}
	return line;
}
interface LocatedBody {
	text: string;
	lineAt(index: number): number;
}
/** User prose outside YAML and managed `nand:` regions, still aligned to original file lines. */
function locateBody(raw: string, id: string): LocatedBody {
	const skips = skipRanges(raw);
	const out: string[] = [];
	const marks: number[] = [];
	const state = { len: 0, line: 0 };
	let line = 1;
	let i = 0;
	let skipAt = 0;
	const id0 = id ? id.charCodeAt(0) : -1;
	while (i < raw.length) {
		while (skipAt < skips.length && skips[skipAt]![1] <= i) skipAt++;
		const skip = skips[skipAt];
		if (skip && i >= skip[0] && i < skip[1]) {
			line = advance(raw, i, skip[1], line);
			i = skip[1];
			continue;
		}
		const limit = skip && skip[0] > i ? skip[0] : raw.length;
		if (raw.startsWith('<!--', i)) {
			const end = raw.indexOf('-->', i + 4);
			const stop = end < 0 || end + 3 > limit ? limit : end + 3;
			line = advance(raw, i, stop, line);
			i = stop;
			continue;
		}
		if (raw.charCodeAt(i) === 60) {
			const close = raw.indexOf('>', i + 1);
			if (close >= 0 && close < limit && !raw.slice(i, close).includes('\n')) {
				const tag = raw.slice(i, close + 1);
				const alt = /<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
				line = emit(alt ? alt[1] || alt[2] || alt[3] || ' ' : ' ', line, out, marks, state);
				i = close + 1;
				continue;
			}
		}
		if (raw.startsWith('![', i) || raw.charCodeAt(i) === 91) {
			const bang = raw.startsWith('![', i);
			const start = i + (bang ? 2 : 1);
			const endText = raw.indexOf(']', start);
			const endUrl = endText >= 0 && raw.charCodeAt(endText + 1) === 40 ? raw.indexOf(')', endText + 2) : -1;
			if (endText >= 0 && endUrl >= 0 && endUrl < limit) {
				line = emit(raw.slice(start, endText), line, out, marks, state);
				line = advance(raw, endText, endUrl + 1, line);
				i = endUrl + 1;
				continue;
			}
		}
		if (id && id0 === raw.charCodeAt(i) && raw.startsWith(id, i) && i + id.length <= limit) {
			line = emit(' ', line, out, marks, state);
			line = advance(raw, i, i + id.length, line);
			i += id.length;
			continue;
		}
		let j = i + 1;
		while (j < limit) {
			const code = raw.charCodeAt(j);
			if (
				code === 60 ||
				code === 91 ||
				(code === 33 && raw.charCodeAt(j + 1) === 91) ||
				(id && code === id0 && raw.startsWith(id, j))
			)
				break;
			j++;
		}
		line = emit(raw.slice(i, j), line, out, marks, state);
		i = j;
	}
	const text = out.join('');
	return { text, lineAt: (index) => lineNumber(marks, index) };
}
/** User prose outside YAML and the managed `nand:` regions. Markers and this record's id are not searchable. */
export function unmanagedBody(raw: string, id = ''): string {
	return locateBody(raw, id).text;
}
export function buildSearchDocument(record: ArchiveRecord, names: SearchNames): SearchDocument {
	const fieldParts = Object.values(record.fields).flat().map(String);
	const titles = record.employments.flatMap((job) => [job.title, names.company(job.company)]);
	const fieldsDisplay = plain([...fieldParts, ...titles].join(' '), record.id);
	const fragments: SearchFragment[] = [];
	const push = (source: SearchSource, value: string) => {
		const text = plain(value, record.id);
		if (text) fragments.push({ source, text, lower: text.toLocaleLowerCase() });
	};
	push('fields', fieldParts.join(' '));
	for (const job of record.employments)
		push('employment', [job.department, job.title, job.notes, names.company(job.company)].filter(Boolean).join(' '));
	push('traits', record.prose.traits);
	push('habits', record.prose.habits);
	push('notes', record.prose.notes);
	for (const relation of record.relations)
		push(
			'relation',
			[relation.notes, names.person(relation.person), names.company(relation.company)].filter(Boolean).join(' '),
		);
	const located = locateBody(record.raw, record.id);
	const body = plain(located.text, record.id);
	if (body)
		fragments.push({ source: 'body', text: body, lower: body.toLocaleLowerCase(), located: located.text, lineAt: (index) => located.lineAt(index) });
	return {
		fields: fieldsDisplay.toLocaleLowerCase(),
		record: plain(fragments.map((fragment) => fragment.text).join(' ')).toLocaleLowerCase(),
		fieldsDisplay,
		fragments,
	};
}
function window(text: string, needle: string): string {
	const points = Array.from(text);
	const lower = Array.from(text.toLocaleLowerCase());
	const aligned = lower.length === points.length;
	let at = -1;
	if (aligned && needle) {
		const hay = lower.join('');
		const unit = hay.indexOf(needle);
		if (unit >= 0) at = Array.from(hay.slice(0, unit)).length;
	}
	const needlePoints = Array.from(needle).length;
	const start = at < 0 ? 0 : Math.max(0, at - 24);
	const end = at < 0 ? Math.min(points.length, 72) : Math.min(points.length, at + needlePoints + 24);
	let snippet = points.slice(start, end).join('').replace(/\s+/g, ' ').trim();
	if (at >= 0 && start > 0) snippet = `…${snippet}`;
	if (at >= 0 && end < points.length) snippet = `${snippet}…`;
	return Array.from(snippet.replace(/[<>]/g, '')).slice(0, 80).join('');
}
/** Lowercased search terms. Whitespace (including the ideographic space) separates terms; every term must match. */
export function searchTerms(search: string): string[] {
	return search.toLocaleLowerCase().split(/\s+/).filter(Boolean);
}
/** Every term occurs in the document: anywhere in the basic fields, or each in some fragment of the entry note. */
export function documentMatches(doc: SearchDocument, terms: readonly string[], scope: 'record' | 'fields'): boolean {
	if (!terms.length) return false;
	if (scope === 'fields') return terms.every((term) => doc.fields.includes(term));
	return terms.every((term) => doc.fragments.some((fragment) => fragment.lower.includes(term)));
}
/** The term that occurs first in `lower`, so the snippet opens at the earliest match. */
function firstTerm(lower: string, terms: readonly string[]): string {
	let best = terms[0] ?? '';
	let at = Infinity;
	for (const term of terms) {
		const index = lower.indexOf(term);
		if (index >= 0 && index < at) {
			at = index;
			best = term;
		}
	}
	return best;
}
export function searchHit(doc: SearchDocument, search: string, scope: 'record' | 'fields'): SearchHit | undefined {
	const terms = searchTerms(search);
	if (!documentMatches(doc, terms, scope)) return undefined;
	if (scope === 'fields') {
		const fieldsOnly = doc.fragments.find((fragment) => fragment.source === 'fields' && terms.some((term) => fragment.lower.includes(term)));
		return { source: fieldsOnly ? 'fields' : 'employment', snippet: window(doc.fieldsDisplay, firstTerm(doc.fields, terms)) };
	}
	// The fragment holding the most terms explains the hit best; fragments are already in source order for ties.
	let fragment: SearchFragment | undefined;
	let count = 0;
	for (const item of doc.fragments) {
		const found = terms.filter((term) => item.lower.includes(term)).length;
		if (found > count) {
			fragment = item;
			count = found;
		}
	}
	if (!fragment) return undefined;
	const term = firstTerm(fragment.lower, terms);
	let line: number | undefined;
	if (fragment.source === 'body' && fragment.located && fragment.lineAt) {
		const lower = fragment.located.toLocaleLowerCase();
		const at = lower.indexOf(term);
		// A term found only after collapsing a line break is not a line in the original file.
		// Case folding can expand characters, so its offsets are reliable only at equal lengths.
		if (at >= 0 && lower.length === fragment.located.length) line = fragment.lineAt(at);
	}
	return { source: fragment.source, snippet: window(fragment.text, term), line };
}
