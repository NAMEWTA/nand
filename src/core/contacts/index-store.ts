import { ContactsError, type ArchiveRecord, type EntityRef, type PersonRelation } from './model';
import { resolveRelative } from './persist/markdown';

export interface RelationEntry {
	owner: ArchiveRecord;
	relation: PersonRelation;
	other?: ArchiveRecord;
	inverse: boolean;
}
export interface ContactsQuery {
	kind: 'person' | 'company';
	search: string;
	current: string[];
	past: string[];
	regions: string[];
	tags: string[];
	relations: string[];
	sort: 'name' | 'modified';
}
export function emptyQuery(): ContactsQuery {
	return { kind: 'person', search: '', current: [], past: [], regions: [], tags: [], relations: [], sort: 'name' };
}
export class ContactsIndex {
	readonly byPath = new Map<string, ArchiveRecord>();
	readonly byId = new Map<string, ArchiveRecord[]>();
	private memberships = new Map<string, Set<string>>();
	private relationships = new Map<string, RelationEntry[]>();
	private contributions = new Map<string, { companies: string[]; people: string[] }>();
	clear(): void {
		this.byPath.clear();
		this.byId.clear();
		this.memberships.clear();
		this.relationships.clear();
		this.contributions.clear();
	}
	remove(path: string): void {
		const previous = this.byPath.get(path);
		if (!previous) return;
		this.byPath.delete(path);
		const rest = (this.byId.get(previous.id) ?? []).filter((r) => r.path !== path);
		if (rest.length) this.byId.set(previous.id, rest);
		else this.byId.delete(previous.id);
		const contribution = this.contributions.get(path);
		for (const company of contribution?.companies ?? []) {
			this.memberships.get(company)?.delete(path);
		}
		for (const person of contribution?.people ?? [])
			this.relationships.set(
				person,
				(this.relationships.get(person) ?? []).filter((e) => e.owner.path !== path),
			);
		this.contributions.delete(path);
	}
	set(record: ArchiveRecord): void {
		this.remove(record.path);
		this.byPath.set(record.path, record);
		this.byId.set(record.id, [...(this.byId.get(record.id) ?? []), record]);
		const companies = record.employments.map((e) => e.company.id).filter(Boolean);
		for (const company of companies) {
			const members = this.memberships.get(company) ?? new Set<string>();
			members.add(record.path);
			this.memberships.set(company, members);
		}
		const people: string[] = [];
		for (const relation of record.relations) {
			for (const [id, inverse] of [
				[record.id, false],
				[relation.person.id, true],
			] as const) {
				if (!id) continue;
				people.push(id);
				const list = this.relationships.get(id) ?? [];
				list.push({ owner: record, relation, inverse });
				this.relationships.set(id, list);
			}
		}
		this.contributions.set(record.path, { companies, people });
	}
	get(id: string): ArchiveRecord | undefined {
		const entries = this.byId.get(id);
		return entries?.length === 1 ? entries[0] : undefined;
	}
	issues(record: ArchiveRecord): string[] {
		const errors = [...record.errors];
		if (record.id && (this.byId.get(record.id)?.length ?? 0) > 1) errors.push('duplicateId');
		for (const [ref, kind] of this.refs(record)) {
			const linked = this.byPath.get(resolveRelative(record.path, ref.link));
			const target = ref.id ? this.get(ref.id) : linked;
			if ((target && target.kind !== kind) || (linked && ref.id && linked.id !== ref.id))
				errors.push('referenceConflict');
			if (ref.id && (this.byId.get(ref.id)?.length ?? 0) > 1) errors.push('duplicateId');
		}
		return [...new Set(errors)];
	}
	refs(record: ArchiveRecord): Array<[EntityRef, 'person' | 'company']> {
		return [
			...record.employments.map((j): [EntityRef, 'company'] => [j.company, 'company']),
			...record.relations.flatMap((r): Array<[EntityRef, 'person' | 'company']> => [
				[r.person, 'person'],
				[r.company, 'company'],
			]),
		];
	}
	resolve(ref: EntityRef, source: ArchiveRecord): ArchiveRecord | undefined {
		return ref.id ? this.get(ref.id) : this.byPath.get(resolveRelative(source.path, ref.link));
	}
	members(companyId: string, status: 'current' | 'past'): ArchiveRecord[] {
		const result = new Map<string, ArchiveRecord>();
		for (const path of this.memberships.get(companyId) ?? []) {
			const person = this.byPath.get(path);
			if (
				person &&
				!this.issues(person).length &&
				person.employments.some((j) => j.company.id === companyId && j.status === status)
			)
				result.set(person.id, person);
		}
		return [...result.values()];
	}
	relationsFor(id: string): RelationEntry[] {
		return (this.relationships.get(id) ?? []).map((e) => ({
			...e,
			other: e.inverse ? this.get(e.owner.id) : this.resolve(e.relation.person, e.owner),
		}));
	}
	validateRelations(record: ArchiveRecord): void {
		const seen = new Set<string>();
		for (const relation of record.relations) {
			const key = JSON.stringify([
				relation.person.id || relation.person.link,
				relation.kind,
				relation.company.id || relation.company.link,
			]);
			if (seen.has(key)) throw new ContactsError('duplicateRelation');
			seen.add(key);
			if (!['leader', 'report', 'friend', 'colleague'].includes(relation.kind)) continue;
			const duplicate = this.relationsFor(record.id).some(
				(entry) =>
					entry.owner.id !== record.id &&
					entry.inverse &&
					entry.owner.id === relation.person.id &&
					relationKind(entry.relation.kind, true) === relation.kind &&
					(entry.relation.company.id || entry.relation.company.link) ===
						(relation.company.id || relation.company.link),
			);
			if (duplicate) throw new ContactsError('duplicateRelation');
		}
	}
	query(q: ContactsQuery): ArchiveRecord[] {
		const needle = q.search.trim().toLocaleLowerCase();
		const matches = (selected: string[], values: string[]) =>
			!selected.length || selected.some((s) => values.includes(s));
		return [...this.byPath.values()]
			.filter((r) => {
				if (r.kind !== q.kind) return false;
				if (!matches(q.regions, [r.fields.region]) || !matches(q.tags, r.fields.tags)) return false;
				if (
					r.kind === 'person' &&
					(!matches(
						q.current,
						r.employments.filter((j) => j.status === 'current').map((j) => j.company.id),
					) ||
						!matches(
							q.past,
							r.employments.filter((j) => j.status === 'past').map((j) => j.company.id),
						) ||
						!matches(
							q.relations,
							this.relationsFor(r.id).map((e) => relationKind(e.relation.kind, e.inverse)),
						))
				)
					return false;
				const text = [
					...Object.values(r.fields).flat(),
					...r.employments.flatMap((j) => [
						j.title,
						this.resolve(j.company, r)?.fields.name ?? j.company.label,
					]),
				]
					.join(' ')
					.toLocaleLowerCase();
				return !needle || text.includes(needle);
			})
			.sort((a, b) =>
				q.sort === 'modified'
					? b.modified - a.modified || a.fields.name.localeCompare(b.fields.name)
					: a.fields.name.localeCompare(b.fields.name, 'zh', { numeric: true }),
			);
	}
}
export function relationKind(kind: string, inverse: boolean): string {
	if (!inverse) return kind;
	if (kind === 'leader') return 'report';
	if (kind === 'report') return 'leader';
	return kind;
}
