import type { AutomationDefinition } from '../../../shared/automation/types';
import { validContactsFolder, type ContactsSettings } from '../../../shared/contacts-settings';
import { WriteQueue } from '../../../shared/storage/write-queue';
import type { ContactsFile, ContactsFiles } from './files';
import { ContactsIndex } from './index-store';
import {
	ContactsError,
	cloneRecord,
	validateRecord,
	type ArchiveRecord,
	type EntityRef,
	type RecordKind,
} from './model';
import { createMarkdown, parseRecord, patchMarkdown, relativeLink } from './persist/markdown';
import { patchReminders } from './reminders';
import {
	archiveCategories,
	archiveEntryName,
	archiveLocation,
	folderFingerprint,
	safeArchiveName,
	type ArchiveDeletion,
	type ArchiveImport,
	type ArchiveImportResult,
	type ArchiveResource,
} from './resources';

/** Application rules; atomic storage and native draft protection are supplied by the host. */
export class ContactsApplication {
	private resourceCache = new Map<string, ArchiveResource[]>();
	private invalidateResources(path: string): void {
		for (const folder of this.resourceCache.keys()) if (path === folder || path.startsWith(folder + '/') || folder.startsWith(path + '/')) this.resourceCache.delete(folder);
	}
	constructor(
		private readonly files: ContactsFiles,
		private getSettings: () => ContactsSettings,
	) {}
	activate(): void {
		this.active = true;
	}
	dispose(): void {
		this.active = false;
		this.generation++;
		this.ready = null;
		this.resourceCache.clear();
		this.index.clear();
		this.emit();
		this.listeners.clear();
	}
	async ensureLoaded(): Promise<void> {
		if (!this.active) return;
		if (!this.ready) {
			const generation = ++this.generation;
			this.ready = (async () => {
				await this.files.ready();
				if (this.active && generation === this.generation) await this.rebuild(generation);
			})();
		}
		await this.ready;
	}
	fileChanged(file: ContactsFile): void {
		this.invalidateResources(file.path);
		if (!this.active) return;
		if (this.inside(file.path)) this.refreshFile(file);
		else if (file.path.startsWith(this.root + '/')) this.emit();
	}
	fileDeleted(path: string, folder: boolean): void {
		this.invalidateResources(path);
		this.versions.set(path, (this.versions.get(path) ?? 0) + 1);
		if (!folder) this.index.remove(path);
		else
			for (const existing of this.index.byPath.keys())
				if (existing.startsWith(path + '/')) this.index.remove(existing);
		this.emit();
	}
	fileRenamed(file: ContactsFile | null, oldPath: string, newPath = file?.path ?? ''): void {
		this.invalidateResources(oldPath);
		this.invalidateResources(newPath);
		if (!this.active) return;
		// Keep observers on one consistent index, including a folder rename in a split pane.
		this.batching++;
		const generation = this.generation;
		this.fileDeleted(oldPath, !file);
		const candidates = file
			? [file]
			: this.files.getMarkdownFiles().filter((candidate) => candidate.path.startsWith(newPath + '/'));
		void Promise.allSettled(
			candidates
				.filter((candidate) => this.inside(candidate.path))
				.map((candidate) => this.readFile(candidate, generation)),
		)
			.then((results) => {
				if (this.active && generation === this.generation && results.some((result) => result.status === 'rejected')) this.error = 'readFailed';
			})
			.finally(() => {
				this.batching--;
				this.emit();
			});
	}
	async saveReminder(definition: AutomationDefinition, remove = false): Promise<void> {
		const source = definition.source;
		if (!source) throw new ContactsError('missing');
		await this.ensureLoaded();
		await this.queue.run(source.id, async () => {
			this.guard();
			const record = this.index.get(source.id);
			if (!record) throw new ContactsError('missing');
			const base = await this.snapshot(record.path);
			const file = this.files.getFileByPath(base.path);
			if (!file) throw new ContactsError('missing');
			await this.files.process(file, (raw) => {
				this.files.checkEditor(file, raw);
				return patchReminders(raw, definition, remove);
			});
			await this.readFile(file, this.generation);
		});
	}
	readonly index = new ContactsIndex();
	readonly queue = new WriteQueue();
	private listeners = new Set<() => void>();
	private ready: Promise<void> | null = null;
	private generation = 0;
	private versions = new Map<string, number>();

	private active = true;
	private batching = 0;
	loading = false;
	error = '';
	get root(): string {
		return this.getSettings().rootFolder;
	}
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	private emit(): void {
		if (!this.active || this.batching) return;
		for (const listener of this.listeners) listener();
	}
	private inside(path: string): boolean {
		return !!archiveLocation(this.root, path);
	}
	async reload(): Promise<void> {
		this.ready = null;
		await this.ensureLoaded();
	}
	private async rebuild(generation: number): Promise<void> {
		this.loading = true;
		this.error = '';
		this.index.clear();
		this.emit();
		try {
			const files = this.files.getMarkdownFiles().filter((f) => this.inside(f.path));
			for (let i = 0; i < files.length; i += 20) {
				if (!this.active || generation !== this.generation) return;
				const results = await Promise.allSettled(
					files.slice(i, i + 20).map((file) => this.readFile(file, generation)),
				);
				if (!this.active || generation !== this.generation) return;
				if (results.some((result) => result.status === 'rejected')) this.error = 'readFailed';
			}
			// Resolve identifier-free manually authored rows after all target files are known.
			for (const record of [...this.index.byPath.values()]) {
				let changed = false;
				for (const [ref] of this.index.refs(record))
					if (!ref.id && ref.link) {
						const target = this.index.resolve(ref, record);
						if (target) {
							ref.id = target.id;
							changed = true;
						}
					}
				if (changed) this.index.set(record);
			}
		} catch {
			if (this.active && generation === this.generation) this.error = 'readFailed';
		} finally {
			if (generation === this.generation) {
				this.loading = false;
				this.emit();
			}
		}
	}
	private refreshFile(file: ContactsFile): void {
		if (!this.active || file.extension !== 'md' || !this.inside(file.path)) return;
		const generation = this.generation;
		void this.readFile(file, generation).catch(() => {
			if (!this.active || generation !== this.generation) return;
			this.error = 'readFailed';
			this.emit();
		});
	}
	private async readFile(file: ContactsFile, generation: number): Promise<void> {
		const path = file.path,
			version = (this.versions.get(path) ?? 0) + 1;
		this.versions.set(path, version);
		const raw = await this.files.cachedRead(file);
		if (
			!this.active ||
			generation !== this.generation ||
			this.versions.get(path) !== version ||
			file.path !== path ||
			this.files.getFileByPath(path) !== file ||
			!this.inside(path)
		)
			return;
		const record = parseRecord(raw, path, file.stat.mtime);
		if (record && record.kind !== archiveLocation(this.root, path)?.kind) record.errors.push('wrongCategory');
		if (record) {
			for (const [ref] of this.index.refs(record))
				if (!ref.id && ref.link) ref.id = this.index.resolve(ref, record)?.id ?? '';
			this.index.set(record);
			// Newly created targets can resolve manually authored rows without another vault scan.
			for (const owner of this.loading ? [] : [...this.index.byPath.values()]) {
				let changed = false;
				for (const [ref] of this.index.refs(owner))
					if (!ref.id && ref.link) {
						const target = this.index.resolve(ref, owner);
						if (target) {
							ref.id = target.id;
							changed = true;
						}
					}
				if (changed) this.index.set(owner);
			}
		} else this.index.remove(path);
		if (!this.loading) this.emit();
	}
	private guard(): void {
		if (!this.active) throw new ContactsError('disabled');
		if (!validContactsFolder(this.root)) throw new ContactsError('invalidFolder');
	}
	private prepare(record: ArchiveRecord): ArchiveRecord {
		const next = cloneRecord(record);
		for (const [ref, kind] of this.index.refs(next)) {
			const target = this.index.resolve(ref, record);
			if (target) {
				if (target.kind !== kind) throw new ContactsError('referenceConflict');
				ref.id = target.id;
				ref.link = relativeLink(next.path, target.path);
				ref.label = target.fields.name;
			}
		}
		return next;
	}
	async snapshot(path: string): Promise<ArchiveRecord> {
		this.guard();
		if (!this.inside(path)) throw new ContactsError('folderChanged');
		const file = this.files.getFileByPath(path);
		if (!file) throw new ContactsError('missing');
		const raw = await this.files.read(file);
		this.files.checkEditor(file, raw);
		const record = parseRecord(raw, path, file.stat.mtime);
		if (
			!record ||
			record.kind !== archiveLocation(this.root, path)?.kind ||
			record.errors.length ||
			this.index.issues(record).length
		)
			throw new ContactsError('invalidRecord');
		return record;
	}
	async save(base: ArchiveRecord, draft: ArchiveRecord): Promise<ArchiveRecord> {
		const root = this.root;
		if (!this.inside(base.path)) throw new ContactsError('folderChanged');
		return this.queue.run(base.id, async () => {
			this.guard();
			if (this.root !== root) throw new ContactsError('folderChanged');
			const indexed = this.index.get(base.id);
			if (!indexed || this.index.issues(indexed).length) throw new ContactsError('invalidRecord');
			const file = this.files.getFileByPath(indexed.path);
			if (!file) throw new ContactsError('missing');
			const next = this.prepare({ ...draft, path: file.path, folderPath: indexed.folderPath });
			this.index.validateRelations(next);
			if (this.index.issues(next).length) throw new ContactsError('referenceConflict');
			const current = await this.files.read(file);
			this.files.checkEditor(file, current);
			const written = await this.files.process(file, (latest) => {
				this.guard();
				if (this.root !== root) throw new ContactsError('folderChanged');
				this.files.checkEditor(file, latest);
				const patched = patchMarkdown(latest, { ...base, path: file.path }, next);
				if (parseRecord(patched, file.path)?.errors.length) throw new ContactsError('invalidRecord');
				return patched;
			});
			const saved = parseRecord(written, file.path, file.stat.mtime)!;
			try {
				await this.readFile(file, this.generation);
			} catch {
				this.error = 'readFailed';
			}
			this.emit();
			return saved;
		});
	}
	async create(draft: ArchiveRecord): Promise<ArchiveRecord> {
		const root = this.root;
		return this.queue.run('create', async () => {
			this.guard();
			if (root !== this.root) throw new ContactsError('folderChanged');
			validateRecord(draft);
			const category = `${root}/${archiveCategories[draft.kind]}`;
			const name = safeArchiveName(draft.fields.name);
			let folder = `${category}/${name}`;
			let suffix = 0;
			while (this.files.getAbstractFileByPath(folder))
				folder = `${category}/${name}-${draft.id.slice(0, 8)}${suffix++ ? '-' + suffix : ''}`;
			const path = `${folder}/${archiveEntryName}`;
			const next = this.prepare({ ...draft, path, folderPath: folder });
			this.index.validateRelations(next);
			this.guard();
			if (root !== this.root) throw new ContactsError('folderChanged');
			const content = createMarkdown(next);
			if (parseRecord(content, path)?.errors.length) throw new ContactsError('invalidRecord');
			await this.files.mkdir(category);
			// Exclusive creation: a racing external directory must never become ours.
			await this.files.createFolder(folder);
			this.guard();
			if (root !== this.root) throw new ContactsError('folderChanged');
			const file = await this.files.create(path, content);
			const created = parseRecord(content, path, file.stat.mtime)!;
			if (this.active) this.index.set(created);
			try {
				await this.readFile(file, this.generation);
			} catch {
				this.error = 'readFailed';
			}
			const guidePath = root + '/档案格式说明.md';
			if (!this.files.getAbstractFileByPath(guidePath)) {
				try {
					await this.files.create(guidePath, this.files.formatGuide);
				} catch {
					this.error = 'guideFailed';
				}
			}
			this.emit();
			return created;
		});
	}
	resources(id: string): ArchiveResource[] {
		const record = this.current(id);
		const cached = this.resourceCache.get(record.folderPath);
		if (cached) return cached.map(entry => ({ ...entry }));
		const entries = this.files
			.listFolder(record.folderPath)
			.filter((entry) => !entry.folder && entry.path !== record.path)
			.map((entry) => {
				const name = entry.path.split('/').pop()!;
				return {
					path: entry.path,
					relativePath: entry.path.slice(record.folderPath.length + 1),
					name,
					extension: name.includes('.') ? name.split('.').pop()!.toLowerCase() : '',
					size: entry.size,
					modified: entry.modified,
				};
			});
		this.resourceCache.set(record.folderPath, entries);
		return entries.map(entry => ({ ...entry }));
	}
	private current(id: string): ArchiveRecord {
		this.guard();
		const record = this.index.get(id);
		if (!record || !this.inside(record.path) || !this.files.getFileByPath(record.path))
			throw new ContactsError('missing');
		if (this.index.issues(record).length) throw new ContactsError('invalidRecord');
		return record;
	}
	private freeResourcePath(folder: string, requested: string): string {
		const name = safeArchiveName(requested);
		const dot = name.lastIndexOf('.');
		const stem = dot > 0 ? name.slice(0, dot) : name,
			extension = dot > 0 ? name.slice(dot) : '';
		let path = `${folder}/${name}`,
			suffix = 1;
		while (this.files.getAbstractFileByPath(path)) path = `${folder}/${stem} (${suffix++})${extension}`;
		return path;
	}
	async createNote(id: string, name: string): Promise<string> {
		const root = this.root;
		return this.queue.run(id, async () => {
			const record = this.current(id);
			if (root !== this.root) throw new ContactsError('folderChanged');
			const safe = safeArchiveName(name);
			const path = this.freeResourcePath(record.folderPath, /\.md$/i.test(safe) ? safe : safe + '.md');
			await this.files.create(path, '');
			this.emit();
			return path;
		});
	}
	async importResources(id: string, sources: ArchiveImport[]): Promise<ArchiveImportResult[]> {
		const root = this.root;
		return this.queue.run(id, async () => {
			const results: ArchiveImportResult[] = [];
			this.batching++;
			try {
				for (const source of sources) {
					try {
						const record = this.current(id),
							folder = record.folderPath;
						if (root !== this.root) throw new ContactsError('folderChanged');
						const bytes = await source.read();
						if (this.current(id).folderPath !== folder || root !== this.root)
							throw new ContactsError('folderChanged');
						const path = this.freeResourcePath(folder, source.name);
						await this.files.createBinary(path, bytes);
						results.push({ name: source.name, path });
					} catch (error) {
						results.push({
							name: source.name,
							error: error instanceof ContactsError ? error.code : 'importFailed',
						});
					}
				}
			} finally {
				this.batching--;
				this.emit();
			}
			return results;
		});
	}
	async deletion(id: string): Promise<ArchiveDeletion> {
		return this.queue.run(id, async () => {
			const latest = await this.snapshot(this.current(id).path);
			await this.files.checkFolderEditors(latest.folderPath);
			return {
				id,
				path: latest.path,
				folderPath: latest.folderPath,
				raw: latest.raw,
				fingerprint: folderFingerprint(this.files.listFolder(latest.folderPath)),
				resources: this.resources(id).length,
			};
		});
	}
	async remove(base: ArchiveDeletion): Promise<void> {
		await this.queue.run(base.id, async () => {
			this.guard();
			if (!this.inside(base.path)) throw new ContactsError('folderChanged');
			const latest = await this.snapshot(this.current(base.id).path);
			if (latest.raw !== base.raw) throw new ContactsError('conflict');
			await this.files.checkFolderEditors(latest.folderPath);
			this.guard();
			if (
				latest.path !== base.path ||
				this.current(base.id).path !== base.path ||
				folderFingerprint(this.files.listFolder(latest.folderPath)) !== base.fingerprint
			)
				throw new ContactsError('deleteChanged');
			await this.files.trashFolder(latest.folderPath);
			this.index.remove(latest.path);
			this.emit();
		});
	}
	ref(record: ArchiveRecord): EntityRef {
		return { id: record.id, label: record.fields.name, link: record.path };
	}
	choices(kind: RecordKind): ArchiveRecord[] {
		return [...this.index.byPath.values()]
			.filter((r) => r.kind === kind && !this.index.issues(r).length)
			.sort((a, b) => a.fields.name.localeCompare(b.fields.name));
	}
	async countFolder(root: string): Promise<number> {
		if (!validContactsFolder(root)) throw new ContactsError('invalidFolder');
		let count = 0;
		for (const file of this.files.getMarkdownFiles().filter((f) => archiveLocation(root, f.path)))
			if (parseRecord(await this.files.cachedRead(file), file.path)) count++;
		return count;
	}
}
