import type { ArchiveRecord, EntityRef } from './model';

export const searchSources = ['fields', 'employment', 'traits', 'habits', 'notes', 'relation', 'body'] as const;
export type SearchSource = (typeof searchSources)[number];
export interface SearchFragment {
	source: SearchSource;
	/** Plain text, original case, whitespace collapsed. */
	text: string;
	/** Body only: plain text with newlines kept, for a line hint. */
	located?: string;
}
export interface SearchDocument {
	/** Lowercased text matching today's field, title, and company-name search. */
	fields: string;
	/** Lowercased text of the whole entry note. */
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

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const managed = /<!-- nand:([\w-]+) -->[\s\S]*?<!-- \/nand:\1 -->/g;

function collapse(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}
function stripTokens(value: string, id: string): string {
	let text = value.replace(uuid, ' ');
	if (id) text = text.replace(new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
	return text;
}
function plain(value: string, id = ''): string {
	return collapse(
		stripTokens(value, id)
			.replace(/<!--[\s\S]*?-->/g, ' ')
			.replace(/<[^>\n]*>/g, ' '),
	);
}
/** User prose outside YAML and the managed `nand:` regions. Markers and bare ids are not searchable. */
export function unmanagedBody(raw: string, id = ''): string {
	const withoutFront = raw.replace(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
	const withoutSections = withoutFront.replace(managed, ' ');
	return stripTokens(withoutSections, id).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>\n]*>/g, ' ');
}
export function buildSearchDocument(record: ArchiveRecord, names: SearchNames): SearchDocument {
	const fieldParts = Object.values(record.fields).flat().map(String);
	const titles = record.employments.flatMap((job) => [job.title, names.company(job.company)]);
	const fieldsDisplay = plain([...fieldParts, ...titles].join(' '));
	const fragments: SearchFragment[] = [];
	const push = (source: SearchSource, value: string, located?: string) => {
		const text = plain(value);
		if (text) fragments.push({ source, text, located });
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
	const located = collapse(unmanagedBody(record.raw, record.id)) ? unmanagedBody(record.raw, record.id) : '';
	push('body', located, located || undefined);
	return {
		fields: fieldsDisplay.toLocaleLowerCase(),
		record: plain(fragments.map((fragment) => fragment.text).join(' ')).toLocaleLowerCase(),
		fieldsDisplay,
		fragments,
	};
}
function window(text: string, needle: string): string {
	const at = text.toLocaleLowerCase().indexOf(needle);
	const start = at < 0 ? 0 : Math.max(0, at - 24);
	const end = at < 0 ? Math.min(text.length, 72) : Math.min(text.length, at + needle.length + 24);
	let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
	if (start > 0) snippet = `…${snippet}`;
	if (end < text.length) snippet = `${snippet}…`;
	return snippet.replace(/[<>]/g, '').slice(0, 80);
}
export function searchHit(doc: SearchDocument, search: string, scope: 'record' | 'fields'): SearchHit | undefined {
	const needle = search.trim().toLocaleLowerCase();
	if (!needle || !(scope === 'fields' ? doc.fields : doc.record).includes(needle)) return undefined;
	if (scope === 'fields') {
		const fieldsOnly = doc.fragments.find((fragment) => fragment.source === 'fields' && fragment.text.toLocaleLowerCase().includes(needle));
		return { source: fieldsOnly ? 'fields' : 'employment', snippet: window(doc.fieldsDisplay, needle) };
	}
	const fragment = doc.fragments.find((item) => item.text.toLocaleLowerCase().includes(needle));
	if (!fragment) return { source: 'fields', snippet: window(doc.fieldsDisplay, needle) };
	const line =
		fragment.located && fragment.source === 'body'
			? fragment.located.toLocaleLowerCase().indexOf(needle)
			: -1;
	return {
		source: fragment.source,
		snippet: window(fragment.text, needle),
		line: line >= 0 ? fragment.located!.slice(0, line).split(/\n/).length : undefined,
	};
}
