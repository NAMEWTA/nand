import type { AutomationDefinition } from '../../shared/automation/types';
import { validContactsFolder, type ContactsSettings } from '../../shared/contacts-settings';
import { WriteQueue } from '../../shared/storage/write-queue';
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

/** Application rules; atomic storage and native draft protection are supplied by the host. */
export class ContactsApplication {
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
		this.index.clear();
		this.emit();
		this.listeners.clear();
	}
	async ensureLoaded(): Promise<void> {
		if (!this.active) return;
		if (!this.ready)
			this.ready = (async () => {
				await this.files.ready();
				if (this.active) await this.rebuild();
			})();
		await this.ready;
	}
	fileChanged(file: ContactsFile): void {
		if (this.active) this.refreshFile(file);
	}
	fileDeleted(path: string, folder: boolean): void {
		this.versions.set(path, (this.versions.get(path) ?? 0) + 1);
		if (!folder) this.index.remove(path);
		else
			for (const existing of this.index.byPath.keys())
				if (existing.startsWith(path + '/')) this.index.remove(existing);
		this.emit();
	}
	fileRenamed(file: ContactsFile | null, oldPath: string): void {
		this.fileDeleted(oldPath, !file);
		if (file) this.refreshFile(file);
		else void this.reload();
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
		for (const listener of this.listeners) listener();
	}
	private inside(path: string): boolean {
		return path.startsWith(this.root + '/');
	}
	async reload(): Promise<void> {
		this.ready = null;
		await this.ensureLoaded();
	}
	private async rebuild(): Promise<void> {
		const generation = ++this.generation;
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
			this.error = 'readFailed';
		} finally {
			if (generation === this.generation) {
				this.loading = false;
				this.emit();
			}
		}
	}
	private refreshFile(file: ContactsFile): void {
		if (!this.active || file.extension !== 'md' || !this.inside(file.path)) return;
		void this.readFile(file, this.generation).catch(() => {
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
		if (!record || record.errors.length || this.index.issues(record).length)
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
			const next = this.prepare({ ...draft, path: file.path });
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
			const folder = `${root}/${draft.kind === 'person' ? '联系人' : '企业'}`;
			await this.files.mkdir(folder);
			const name =
				draft.fields.name
					.trim()
					.replace(/[\\/:*?"<>|#^[\]\r\n]/g, '-')
					.replace(/^[. ]+|[. ]+$/g, '') || draft.id;
			let path = `${folder}/${name}.md`;
			if (this.files.getAbstractFileByPath(path)) path = `${folder}/${name}-${draft.id.slice(0, 8)}.md`;
			const next = this.prepare({ ...draft, path });
			this.index.validateRelations(next);
			this.guard();
			if (root !== this.root) throw new ContactsError('folderChanged');
			const content = createMarkdown(next);
			if (parseRecord(content, path)?.errors.length) throw new ContactsError('invalidRecord');
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
	async remove(base: ArchiveRecord): Promise<void> {
		await this.queue.run(base.id, async () => {
			this.guard();
			if (!this.inside(base.path)) throw new ContactsError('folderChanged');
			const latest = await this.snapshot(this.index.get(base.id)?.path ?? base.path);
			if (latest.raw !== base.raw) throw new ContactsError('conflict');
			const file = this.files.getFileByPath(latest.path);
			if (!file) throw new ContactsError('missing');
			await this.files.trashFile(file);
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
		for (const file of this.files.getMarkdownFiles().filter((f) => f.path.startsWith(root + '/')))
			if (parseRecord(await this.files.cachedRead(file), file.path)) count++;
		return count;
	}
}
