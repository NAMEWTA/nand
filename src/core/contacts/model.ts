export type RecordKind = 'person' | 'company';
export const scalarFields = ['name', 'birthday', 'birthplace', 'region', 'website'] as const;
export const listFields = ['aliases', 'mobiles', 'phones', 'wechat', 'emails', 'tags'] as const;
export type FieldKey = (typeof scalarFields)[number] | (typeof listFields)[number];
export type Fields = Record<(typeof scalarFields)[number], string> & Record<(typeof listFields)[number], string[]>;
export interface EntityRef {
	id: string;
	label: string;
	link: string;
}
export interface EmploymentRecord {
	id: string;
	company: EntityRef;
	department: string;
	title: string;
	start: string;
	end: string;
	status: 'current' | 'past';
	keyRole: '' | 'leader' | 'contact';
	notes: string;
}
export interface PersonRelation {
	id: string;
	person: EntityRef;
	kind: string;
	company: EntityRef;
	notes: string;
}
export const proseSections = ['traits', 'habits', 'notes'] as const;
export type ProseSection = (typeof proseSections)[number];
export interface ArchiveRecord {
	id: string;
	kind: RecordKind;
	path: string;
	fields: Fields;
	employments: EmploymentRecord[];
	relations: PersonRelation[];
	prose: Record<ProseSection, string>;
	raw: string;
	modified: number;
	errors: string[];
}
export type PersonRecord = ArchiveRecord & { kind: 'person' };
export type CompanyRecord = ArchiveRecord & { kind: 'company' };
export class ContactsError extends Error {
	constructor(
		public code: string,
		public detail = '',
	) {
		super(code);
	}
}
export function emptyRef(): EntityRef {
	return { id: '', label: '', link: '' };
}
export function newRecord(kind: RecordKind): ArchiveRecord {
	return {
		id: crypto.randomUUID(),
		kind,
		path: '',
		fields: {
			name: '',
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
		raw: '',
		modified: 0,
		errors: [],
	};
}
export function cloneRecord(record: ArchiveRecord): ArchiveRecord {
	return structuredClone(record);
}
export function same(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}
export function validDate(value: string, monthAllowed = true): boolean {
	if (!value) return true;
	if (monthAllowed && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return true;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateRecord(record: ArchiveRecord): void {
	if (!record.fields.name.trim()) throw new ContactsError('nameRequired');
	if (!validDate(record.fields.birthday, false)) throw new ContactsError('invalidDate', 'birthday');
	for (const job of record.employments) {
		if (!job.company.id && !job.company.link) throw new ContactsError('companyRequired');
		if (
			!validDate(job.start) ||
			!validDate(job.end) ||
			(job.start && job.end && job.start.slice(0, 7) > job.end.slice(0, 7)) ||
			(job.start.length === job.end.length && job.start > job.end && !!job.end)
		)
			throw new ContactsError('invalidDate');
		if (job.status === 'current' && job.end) throw new ContactsError('currentEnd');
	}
	for (const relation of record.relations) {
		if ((!relation.person.id && !relation.person.link) || !relation.kind.trim())
			throw new ContactsError('relationRequired');
		if (relation.person.id === record.id) throw new ContactsError('selfRelation');
	}
}
