import { Component, MarkdownView, TFile, TFolder, normalizePath, type App } from 'obsidian';
import { type ContactsSettings, validContactsFolder } from '../shared/contacts-settings';
import {
	ContactsError,
	cloneRecord,
	type ArchiveRecord,
	type EntityRef,
	type RecordKind,
	validateRecord,
} from './model';
import { ContactsIndex } from './index-store';
import { createMarkdown, parseRecord, patchMarkdown, relativeLink } from './persist/markdown';
import guide from './persist/format-guide.md';

/** A failed write never poisons later saves. Keys are stable entity IDs, not mutable paths. */
export class WriteQueue {
	private tails = new Map<string, Promise<unknown>>();
	run<T>(key: string, task: () => Promise<T>): Promise<T> {
		const result = (this.tails.get(key) ?? Promise.resolve()).then(task, task);
		const tail = result.then(
			() => undefined,
			() => undefined,
		);
		this.tails.set(key, tail);
		void tail.then(() => {
			if (this.tails.get(key) === tail) this.tails.delete(key);
		});
		return result;
	}
	async settled(): Promise<void> {
		await Promise.all(this.tails.values());
	}
}
export class ContactsController extends Component {
	readonly index = new ContactsIndex();
	readonly queue = new WriteQueue();
	private listeners = new Set<() => void>();
	private ready: Promise<void> | null = null;
	private generation = 0;
	private versions = new Map<string, number>();
	private started = false;
	private active = true;
	loading = false;
	error = '';
	constructor(
		readonly app: App,
		private getSettings: () => ContactsSettings,
	) {
		super();
	}
	get root(): string {
		return this.getSettings().rootFolder;
	}
	onload(): void {
		this.active = true;
	}
	onunload(): void {
		this.active = false;
		this.generation++;
		this.ready = null;
		this.index.clear();
		this.emit();
		this.listeners.clear();
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
	async ensureLoaded(): Promise<void> {
		if (!this.active) return;
		if (!this.started) {
			this.started = true;
			this.registerEvent(
				this.app.vault.on('create', (file) => {
					if (file instanceof TFile) this.refreshFile(file);
				}),
			);
			this.registerEvent(
				this.app.vault.on('modify', (file) => {
					if (file instanceof TFile) this.refreshFile(file);
				}),
			);
			this.registerEvent(
				this.app.vault.on('delete', (file) => {
					this.versions.set(file.path, (this.versions.get(file.path) ?? 0) + 1);
					if (file instanceof TFile) this.index.remove(file.path);
					else
						for (const path of this.index.byPath.keys())
							if (path.startsWith(file.path + '/')) this.index.remove(path);
					this.emit();
				}),
			);
			this.registerEvent(
				this.app.vault.on('rename', (file, oldPath) => {
					this.versions.set(oldPath, (this.versions.get(oldPath) ?? 0) + 1);
					if (file instanceof TFile) {
						this.index.remove(oldPath);
						this.refreshFile(file);
					} else {
						for (const path of this.index.byPath.keys())
							if (path.startsWith(oldPath + '/')) this.index.remove(path);
						void this.reload();
					}
					this.emit();
				}),
			);
		}
		if (!this.ready)
			this.ready = (async () => {
				if (!this.app.workspace.layoutReady)
					await new Promise<void>((resolve) => this.app.workspace.onLayoutReady(resolve));
				if (this.active) await this.rebuild();
			})();
		await this.ready;
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
			const files = this.app.vault.getMarkdownFiles().filter((f) => this.inside(f.path));
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
	private refreshFile(file: TFile): void {
		if (!this.active || file.extension !== 'md' || !this.inside(file.path)) return;
		void this.readFile(file, this.generation).catch(() => {
			this.error = 'readFailed';
			this.emit();
		});
	}
	private async readFile(file: TFile, generation: number): Promise<void> {
		const path = file.path,
			version = (this.versions.get(path) ?? 0) + 1;
		this.versions.set(path, version);
		const raw = await this.app.vault.cachedRead(file);
		if (
			!this.active ||
			generation !== this.generation ||
			this.versions.get(path) !== version ||
			file.path !== path ||
			this.app.vault.getFileByPath(path) !== file ||
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
	private checkEditor(file: TFile, disk: string): void {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (
				leaf.view instanceof MarkdownView &&
				leaf.view.file === file &&
				leaf.view.getMode() === 'source' &&
				leaf.view.editor.getValue() !== disk
			)
				throw new ContactsError('editorConflict');
		}
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
		const file = this.app.vault.getFileByPath(path);
		if (!file) throw new ContactsError('missing');
		const raw = await this.app.vault.read(file);
		this.checkEditor(file, raw);
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
			const file = this.app.vault.getFileByPath(indexed.path);
			if (!file) throw new ContactsError('missing');
			const next = this.prepare({ ...draft, path: file.path });
			this.index.validateRelations(next);
			if (this.index.issues(next).length) throw new ContactsError('referenceConflict');
			const current = await this.app.vault.read(file);
			this.checkEditor(file, current);
			const written = await this.app.vault.process(file, (latest) => {
				this.guard();
				if (this.root !== root) throw new ContactsError('folderChanged');
				this.checkEditor(file, latest);
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
	private async mkdir(path: string): Promise<void> {
		let current = '';
		for (const segment of path.split('/')) {
			current = current ? current + '/' + segment : segment;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing && !(existing instanceof TFolder)) throw new ContactsError('invalidFolder');
			if (!existing) {
				try {
					await this.app.vault.createFolder(current);
				} catch (error) {
					if (!(this.app.vault.getAbstractFileByPath(current) instanceof TFolder)) throw error;
				}
			}
		}
	}
	async create(draft: ArchiveRecord): Promise<ArchiveRecord> {
		const root = this.root;
		return this.queue.run('create', async () => {
			this.guard();
			if (root !== this.root) throw new ContactsError('folderChanged');
			validateRecord(draft);
			const folder = normalizePath(`${root}/${draft.kind === 'person' ? '联系人' : '企业'}`);
			await this.mkdir(folder);
			const name =
				draft.fields.name
					.trim()
					.replace(/[\\/:*?"<>|#^[\]\r\n]/g, '-')
					.replace(/^[. ]+|[. ]+$/g, '') || draft.id;
			let path = `${folder}/${name}.md`;
			if (this.app.vault.getAbstractFileByPath(path)) path = `${folder}/${name}-${draft.id.slice(0, 8)}.md`;
			const next = this.prepare({ ...draft, path });
			this.index.validateRelations(next);
			this.guard();
			if (root !== this.root) throw new ContactsError('folderChanged');
			const content = createMarkdown(next);
			if (parseRecord(content, path)?.errors.length) throw new ContactsError('invalidRecord');
			const file = await this.app.vault.create(path, content);
			const created = parseRecord(content, path, file.stat.mtime)!;
			if (this.active) this.index.set(created);
			try {
				await this.readFile(file, this.generation);
			} catch {
				this.error = 'readFailed';
			}
			const guidePath = root + '/档案格式说明.md';
			if (!this.app.vault.getAbstractFileByPath(guidePath)) {
				try {
					await this.app.vault.create(guidePath, guide);
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
			const file = this.app.vault.getFileByPath(latest.path);
			if (!file) throw new ContactsError('missing');
			await this.app.fileManager.trashFile(file);
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
		for (const file of this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(root + '/')))
			if (parseRecord(await this.app.vault.cachedRead(file), file.path)) count++;
		return count;
	}
}
