import { ContactsError, type ArchiveRecord, type EntityRef, type PersonRelation } from './model';
import { resolveRelative } from './persist/markdown';
import { buildSearchDocument, documentMatches, searchHit, searchTerms, type SearchDocument, type SearchHit } from './search-text';

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
	/** `record` searches the entry note. `fields` keeps the previous field, title, and company-name match. */
	scope: 'record' | 'fields';
}
export function emptyQuery(): ContactsQuery {
	return {
		kind: 'person',
		search: '',
		current: [],
		past: [],
		regions: [],
		tags: [],
		relations: [],
		sort: 'name',
		scope: 'record',
	};
}
export class ContactsIndex {
	readonly byPath = new Map<string, ArchiveRecord>();
	readonly byId = new Map<string, ArchiveRecord[]>();
	private memberships = new Map<string, Set<string>>();
	private relationships = new Map<string, RelationEntry[]>();
	private contributions = new Map<string, { companies: string[]; people: string[]; companyMentions: string[]; pathTargets: string[] }>();
	private companyMentions = new Map<string, Set<string>>();
	/** Records that cite this path with an empty id. Refreshed with the id index, not by scanning every record. */
	private pathDependents = new Map<string, Set<string>>();
	private docs = new Map<string, SearchDocument>();
	/** Name and id as last indexed. Callers may mutate the stored record before the next set. */
	private indexedIdentity = new Map<string, { id: string; name: string }>();
	/** Bumped by every change, so a repeated query can reuse its last result. */
	private revision = 0;
	private lastQuery?: { key: string; revision: number; result: ArchiveRecord[] };
	clear(): void {
		this.revision++;
		this.byPath.clear();
		this.byId.clear();
		this.memberships.clear();
		this.relationships.clear();
		this.contributions.clear();
		this.companyMentions.clear();
		this.pathDependents.clear();
		this.docs.clear();
		this.indexedIdentity.clear();
	}
	/** Paths whose search text copies this record's name. Collected before the record's own links are dropped. */
	private dependents(id: string): string[] {
		if (!id) return [];
		const paths = new Set<string>();
		for (const path of this.memberships.get(id) ?? []) paths.add(path);
		for (const entry of this.relationships.get(id) ?? []) paths.add(entry.owner.path);
		for (const path of this.companyMentions.get(id) ?? []) paths.add(path);
		return [...paths];
	}
	private writeDoc(record: ArchiveRecord): void {
		this.docs.set(
			record.path,
			buildSearchDocument(record, {
				company: (ref) => this.resolve(ref, record)?.fields.name || ref.label,
				person: (ref) => this.resolve(ref, record)?.fields.name || ref.label,
			}),
		);
	}
	private rebuild(paths: Iterable<string>): void {
		for (const path of paths) {
			const record = this.byPath.get(path);
			if (record) this.writeDoc(record);
		}
	}
	private detach(path: string): void {
		const previous = this.byPath.get(path);
		if (!previous) return;
		this.byPath.delete(path);
		const rest = (this.byId.get(previous.id) ?? []).filter((r) => r.path !== path);
		if (rest.length) this.byId.set(previous.id, rest);
		else this.byId.delete(previous.id);
		const contribution = this.contributions.get(path);
		for (const company of contribution?.companies ?? []) this.memberships.get(company)?.delete(path);
		for (const person of contribution?.people ?? [])
			this.relationships.set(
				person,
				(this.relationships.get(person) ?? []).filter((e) => e.owner.path !== path),
			);
		for (const id of contribution?.companyMentions ?? []) this.companyMentions.get(id)?.delete(path);
		for (const target of contribution?.pathTargets ?? []) {
			const owners = this.pathDependents.get(target);
			owners?.delete(path);
			if (owners && !owners.size) this.pathDependents.delete(target);
		}
		this.contributions.delete(path);
		this.docs.delete(path);
		this.indexedIdentity.delete(path);
	}
	/** Id dependents plus records that cite this path with an empty id. */
	private affected(path: string, ids: Array<string | undefined>): Set<string> {
		const refresh = new Set<string>();
		for (const id of ids) if (id) for (const owner of this.dependents(id)) refresh.add(owner);
		for (const owner of this.pathDependents.get(path) ?? []) refresh.add(owner);
		refresh.delete(path);
		return refresh;
	}
	private linkPaths(record: ArchiveRecord): string[] {
		const targets = new Set<string>();
		for (const [ref] of this.refs(record)) {
			if (ref.id || !ref.link) continue;
			const target = resolveRelative(record.path, ref.link);
			if (!target || target === record.path) continue;
			targets.add(target);
			const owners = this.pathDependents.get(target) ?? new Set<string>();
			owners.add(record.path);
			this.pathDependents.set(target, owners);
		}
		return [...targets];
	}
	remove(path: string): void {
		const previous = this.byPath.get(path);
		if (!previous) return;
		this.revision++;
		const refresh = this.affected(path, [previous.id]);
		this.detach(path);
		this.rebuild(refresh);
	}
	set(record: ArchiveRecord): void {
		this.revision++;
		const previous = this.indexedIdentity.get(record.path);
		const refresh =
			!previous || previous.name !== record.fields.name || previous.id !== record.id
				? this.affected(record.path, [previous?.id, record.id])
				: new Set<string>();
		this.detach(record.path);
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
		const companyMentions = [...new Set(record.relations.map((relation) => relation.company.id).filter(Boolean))];
		for (const id of companyMentions) {
			const mentions = this.companyMentions.get(id) ?? new Set<string>();
			mentions.add(record.path);
			this.companyMentions.set(id, mentions);
		}
		this.contributions.set(record.path, { companies, people, companyMentions, pathTargets: this.linkPaths(record) });
		this.indexedIdentity.set(record.path, { id: record.id, name: record.fields.name });
		this.writeDoc(record);
		this.rebuild(refresh);
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
	hit(record: ArchiveRecord, search: string, scope: ContactsQuery['scope'] = 'record'): SearchHit | undefined {
		const doc = this.docs.get(record.path);
		return doc ? searchHit(doc, search, scope === 'fields' ? 'fields' : 'record') : undefined;
	}
	/** Records matching `q`, in sort order. Render code calls this repeatedly; an unchanged index and query reuse the result. */
	query(q: ContactsQuery): ArchiveRecord[] {
		const key = JSON.stringify(q);
		if (this.lastQuery?.key === key && this.lastQuery.revision === this.revision) return this.lastQuery.result.slice();
		const result = this.runQuery(q);
		this.lastQuery = { key, revision: this.revision, result };
		return result.slice();
	}
	private runQuery(q: ContactsQuery): ArchiveRecord[] {
		const terms = searchTerms(q.search);
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
				const doc = this.docs.get(r.path);
				return !terms.length || (!!doc && documentMatches(doc, terms, q.scope === 'fields' ? 'fields' : 'record'));
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
