import { parseDocument, stringify } from 'yaml';
import { getLanguage, t } from '../../../../shared/i18n/index';
import { COLUMN_LABELS } from './column-labels';
import {
	ContactsError,
	listFields,
	proseSections,
	same,
	scalarFields,
	validateRecord,
	type ArchiveRecord,
	type EmploymentRecord,
	type EntityRef,
	type PersonRelation,
} from '../model';

const employmentColumns = ['company', 'department', 'title', 'start', 'end', 'status', 'key_role', 'notes'];
const relationColumns = ['person', 'kind', 'company', 'notes'];
const sections = ['employments', 'relations', ...proseSections] as const;
type Section = (typeof sections)[number];
function bounds(raw: string, key: Section): { start: number; end: number; text: string } | null {
	const opening = `<!-- nand:${key} -->`,
		closing = `<!-- /nand:${key} -->`;
	const start = raw.indexOf(opening),
		close = raw.indexOf(closing);
	if (start < 0 && close < 0) return null;
	if (start < 0 || close < start || raw.indexOf(opening, start + 1) >= 0 || raw.indexOf(closing, close + 1) >= 0)
		throw new ContactsError('invalidSection', key);
	return {
		start,
		end: close + closing.length,
		text: raw.slice(start + opening.length, close).replace(/^\r?\n|\r?\n$/g, ''),
	};
}
function front(raw: string): { yaml: string; end: number } {
	const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
	if (!match) throw new ContactsError('invalidYaml');
	return { yaml: match[1] ?? '', end: match[0].length };
}
function stringValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value !== 'string') throw new ContactsError('invalidField');
	return value;
}
function cell(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\\/g, '&#92;')
		.replace(/\|/g, '&#124;')
		.replace(/\r?\n/g, '<br>');
}
function uncell(value: string): string {
	return value
		.replace(/<br\s*\/?>/g, '\n')
		.replace(/&#124;/g, '|')
		.replace(/&#92;/g, '\\')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}
function splitRow(line: string): string[] {
	const cells: string[] = [];
	let part = '';
	let escaped = false;
	for (const c of line.trim().replace(/^\|/, '').replace(/\|$/, '')) {
		if (escaped) {
			part += c === '|' ? '|' : `\\${c}`;
			escaped = false;
		} else if (c === '\\') escaped = true;
		else if (c === '|') {
			cells.push(part.trim());
			part = '';
		} else part += c;
	}
	if (escaped) part += '\\';
	cells.push(part.trim());
	return cells;
}
function table(text: string, headers: string[]): string[][] {
	if (!text.trim()) return [];
	const lines = text.trim().split(/\r?\n/);
	if (
		![
			headers,
			...(['en', 'zh'] as const).map((lang) =>
				headers.map((key) => COLUMN_LABELS[lang][key] ?? key),
			),
		].some((labels) => same(splitRow(lines[0] ?? ''), labels)) ||
		!splitRow(lines[1] ?? '').every((c) => /^:?-{3,}:?$/.test(c)) ||
		splitRow(lines[1] ?? '').length !== headers.length
	)
		throw new ContactsError('invalidTable');
	return lines
		.slice(2)
		.filter((l) => l.trim())
		.map((line) => {
			const cells = splitRow(line);
			if (cells.length !== headers.length) throw new ContactsError('invalidTable');
			return cells;
		});
}
function rowId(value: string, index: number): string {
	return /<!-- nand:row ([\w-]+) -->/.exec(value)?.[1] ?? `manual-${index}`;
}
function readRef(value: string): EntityRef {
	const id = /<!-- nand:ref ([\w-]+) -->/.exec(value)?.[1] ?? '';
	const visible = value.replace(/<!--.*?-->/g, '').trim();
	if (!visible) return { id, label: '', link: '' };
	const match = /^\[((?:\\.|[^\]])*)\]\(([^\s]*)\)$/.exec(visible);
	if (!match) throw new ContactsError('invalidLink');
	let link: string;
	try {
		link = decodeURIComponent(match[2] ?? '');
	} catch {
		throw new ContactsError('invalidLink');
	}
	return { id, label: uncell((match[1] ?? '').replace(/\\([[\]\\])/g, '$1')), link };
}
function writeRef(ref: EntityRef): string {
	if (!ref.link && !ref.id) return '';
	const label = cell(ref.label).replace(/[[\]]/g, '\\$&');
	return `[${label}](${encodeURI(ref.link).replace(/[()#?]/g, (c) => '%' + c.charCodeAt(0).toString(16))})${ref.id ? ` <!-- nand:ref ${ref.id} -->` : ''}`;
}
function writeTable(headers: string[], rows: string[][]): string {
	return [headers.map((key) => COLUMN_LABELS[getLanguage()][key] ?? key), headers.map(() => '---'), ...rows]
		.map((row) => `| ${row.join(' | ')} |`)
		.join('\n');
}
function sectionText(record: ArchiveRecord, key: Section): string {
	if (key === 'employments')
		return writeTable(
			employmentColumns,
			record.employments.map((job) => [
				`${writeRef(job.company)} <!-- nand:row ${job.id.startsWith('manual-') ? crypto.randomUUID() : job.id} -->`,
				...[job.department, job.title, job.start, job.end, job.status, job.keyRole, job.notes].map(cell),
			]),
		);
	if (key === 'relations')
		return writeTable(
			relationColumns,
			record.relations.map((r) => [
				`${writeRef(r.person)} <!-- nand:row ${r.id.startsWith('manual-') ? crypto.randomUUID() : r.id} -->`,
				cell(r.kind),
				writeRef(r.company),
				cell(r.notes),
			]),
		);
	return record.prose[key];
}
function sectionValue(record: ArchiveRecord, key: Section): unknown {
	return key === 'employments' ? record.employments : key === 'relations' ? record.relations : record.prose[key];
}
export function parseRecord(raw: string, path: string, modified = 0): ArchiveRecord | null {
	// A non-archive Markdown note in the directory stays untouched.
	if (!/^["']?nand-type["']?:/m.test(raw)) return null;
	const record: ArchiveRecord = {
		id: '',
		kind: 'person',
		path,
		folderPath: path.slice(0, Math.max(0, path.lastIndexOf('/'))),
		fields: {
			name: path.split('/').pop()?.replace(/\.md$/, '') ?? '',
			birthday: '',
			birthplace: '',
			region: '',
			website: '',
			aliases: [],
			mobiles: [],
			phones: [],
			wechat: [],
			emails: [],
			tags: [],
		},
		employments: [],
		relations: [],
		prose: { traits: '', habits: '', notes: '' },
		raw,
		modified,
		errors: [],
	};
	try {
		const fm = front(raw);
		const doc = parseDocument(fm.yaml, { uniqueKeys: true });
		if (doc.errors.length) throw new ContactsError('invalidYaml');
		const value: unknown = doc.toJS();
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContactsError('invalidYaml');
		const values = value as Record<string, unknown>;
		if (values['nand-type'] !== 'person' && values['nand-type'] !== 'company') return null;
		record.kind = values['nand-type'];
		record.id = stringValue(values['nand-id']);
		if (!/^[\w-]+$/.test(record.id)) throw new ContactsError('invalidId');
		for (const key of scalarFields) record.fields[key] = stringValue(values[key]);
		for (const key of listFields) {
			const list = values[key];
			if (list == null) record.fields[key] = [];
			else if (typeof list === 'string') record.fields[key] = [list];
			else if (Array.isArray(list)) record.fields[key] = list.map(stringValue);
			else throw new ContactsError('invalidField', key);
		}
		for (const key of proseSections) record.prose[key] = bounds(raw, key)?.text ?? '';
		record.employments = table(bounds(raw, 'employments')?.text ?? '', employmentColumns).map(
			(r, i): EmploymentRecord => {
				if (!['current', 'past'].includes(r[5] ?? '') || !['', 'leader', 'contact'].includes(r[6] ?? ''))
					throw new ContactsError('invalidTable');
				return {
					id: rowId(r[0]!, i),
					company: readRef(r[0]!),
					department: uncell(r[1]!),
					title: uncell(r[2]!),
					start: r[3]!,
					end: r[4]!,
					status: r[5] as EmploymentRecord['status'],
					keyRole: r[6] as EmploymentRecord['keyRole'],
					notes: uncell(r[7]!),
				};
			},
		);
		record.relations = table(bounds(raw, 'relations')?.text ?? '', relationColumns).map((r, i): PersonRelation => ({
			id: rowId(r[0]!, i),
			person: readRef(r[0]!),
			kind: uncell(r[1]!),
			company: readRef(r[2]!),
			notes: uncell(r[3]!),
		}));
		for (const rows of [record.employments, record.relations])
			if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new ContactsError('invalidId');
		validateRecord(record);
	} catch (error) {
		record.errors.push(error instanceof ContactsError ? error.code : 'invalidYaml');
	}
	return record;
}
export function createMarkdown(record: ArchiveRecord): string {
	validateRecord(record);
	const fields = Object.fromEntries(
		Object.entries(record.fields).filter(([key]) =>
			record.kind === 'person'
				? key !== 'website'
				: ['name', 'aliases', 'region', 'website', 'tags', 'phones', 'emails'].includes(key),
		),
	);
	const values = { 'nand-type': record.kind, 'nand-id': record.id, ...fields };
	const used = record.kind === 'person' ? sections : (['notes'] as const);
	return (
		`---\n${stringify(values)}---\n\n# ${record.fields.name.replace(/\r?\n/g, ' ')}\n\n` +
		used
			.map(
				(key) =>
					`## ${t(`contacts.${key}`)}\n\n<!-- nand:${key} -->\n${sectionText(record, key)}\n<!-- /nand:${key} -->`,
			)
			.join('\n\n') +
		'\n'
	);
}
/** Three-way, field/section-level update: unrelated external edits survive byte-for-byte in the body. */
export function patchMarkdown(current: string, base: ArchiveRecord, next: ArchiveRecord): string {
	validateRecord(next);
	const latest = parseRecord(current, base.path);
	if (!latest || latest.errors.length || latest.id !== base.id || latest.kind !== base.kind)
		throw new ContactsError('invalidRecord');
	const fm = front(current);
	const doc = parseDocument(fm.yaml);
	let changedFields = false;
	for (const key of [...scalarFields, ...listFields]) {
		if (same(base.fields[key], next.fields[key])) continue;
		if (!same(latest.fields[key], base.fields[key]) && !same(latest.fields[key], next.fields[key]))
			throw new ContactsError('conflict', key);
		doc.set(key, next.fields[key]);
		changedFields = true;
	}
	let result = current;
	for (const key of sections) {
		if (same(sectionValue(base, key), sectionValue(next, key))) continue;
		if (
			!same(sectionValue(latest, key), sectionValue(base, key)) &&
			!same(sectionValue(latest, key), sectionValue(next, key))
		)
			throw new ContactsError('conflict', key);
		const section = bounds(result, key);
		const replacement = `<!-- nand:${key} -->\n${sectionText(next, key)}\n<!-- /nand:${key} -->`;
		result = section
			? result.slice(0, section.start) + replacement + result.slice(section.end)
			: result + `\n\n## ${t(`contacts.${key}`)}\n\n${replacement}\n`;
	}
	// Keep the generated title in sync, but preserve a user-customized heading.
	if (base.fields.name !== next.fields.name) {
		const body = result.slice(fm.end);
		const title = /^(\s*# )([^\r\n]*)(\r?\n|$)/.exec(body);
		if (title?.[2] === base.fields.name.replace(/\r?\n/g, ' ')) {
			result =
				result.slice(0, fm.end) +
				title[1] +
				next.fields.name.replace(/\r?\n/g, ' ') +
				title[3] +
				body.slice(title[0].length);
		}
	}
	return changedFields ? `---\n${doc.toString()}---\n` + result.slice(fm.end) : result;
}
export function relativeLink(from: string, to: string): string {
	const a = from.split('/').slice(0, -1),
		b = to.split('/');
	while (a.length && a[0] === b[0]) {
		a.shift();
		b.shift();
	}
	return [...a.map(() => '..'), ...b].join('/');
}
export function resolveRelative(from: string, link: string): string {
	const parts = from.split('/').slice(0, -1);
	for (const part of link.split('/')) {
		if (part === '..') parts.pop();
		else if (part && part !== '.') parts.push(part);
	}
	return parts.join('/');
}
