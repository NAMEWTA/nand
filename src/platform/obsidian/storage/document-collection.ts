import { MarkdownView, TFile, type App, type EventRef } from 'obsidian';
import { DocumentRepository, type DocumentValue } from '../../../shared/storage/document-repository';
import type { CollectionDocument, DocumentCollectionCodec } from '../../../shared/storage/document-collection';
import { ensureDirectory } from '../../../shared/storage/durable-state';
import type { TextStorage } from '../../../shared/storage/ports';

/** Incremental Vault index. No plugin-directory JSON or compatibility scans. */
export class MarkdownCollectionStorage<T> implements TextStorage {
	private readonly repository: DocumentRepository;
	private documents = new Map<string, CollectionDocument>();
	private dirty = new Map<string, number>();
	private revision = 0;
	private loaded = false;
	private refs: EventRef[] = [];
	constructor(
		private app: App,
		private codec: DocumentCollectionCodec<T>,
		private key: string,
	) {
		const vault = app.vault;
		this.repository = new DocumentRepository({
			read: async (path) => {
				const file = vault.getAbstractFileByPath(path);
				if (!(file instanceof TFile)) throw new Error(`Missing document: ${path}`);
				return vault.read(file);
			},
			process: async (path, update) => {
				const file = vault.getAbstractFileByPath(path);
				if (file instanceof TFile) {
					for (const leaf of app.workspace.getLeavesOfType('markdown')) {
						if (
							leaf.view instanceof MarkdownView &&
							leaf.view.file?.path === path &&
							leaf.view.editor.getValue() !== (await vault.read(file))
						)
							throw new Error(`Unsaved editor: ${path}`);
					}
					return vault.process(file, update);
				}
				if (file) throw new Error(`Not a document: ${path}`);
				await ensureDirectory(vault.adapter, path.split('/').slice(0, -1).join('/'));
				const text = update(null);
				await vault.create(path, text);
				return text;
			},
		});
		const changed = (file: { path: string }) => {
			if (this.owns(file.path)) this.dirty.set(file.path, ++this.revision);
		};
		this.refs.push(
			vault.on('create', changed),
			vault.on('modify', changed),
			vault.on('delete', changed),
			vault.on('rename', (file, old) => {
				changed(file);
				changed({ path: old });
			}),
		);
	}
	private owns(path: string): boolean {
		return path.startsWith(`${this.codec.root}/`) && path.endsWith('.md');
	}
	private async refresh(): Promise<void> {
		if (!this.loaded) {
			for (const file of this.app.vault.getMarkdownFiles())
				if (this.owns(file.path)) this.dirty.set(file.path, ++this.revision);
			this.loaded = true;
		}
		for (const [path, revision] of this.dirty) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				const snapshot = await this.repository.read(path);
				const id = snapshot.value.properties['nand-id'];
				if (typeof id === 'string') this.documents.set(path, { ...snapshot.value, id, path });
				else this.documents.delete(path);
			} else this.documents.delete(path);
			if (this.dirty.get(path) === revision) this.dirty.delete(path);
		}
	}
	async exists(path: string): Promise<boolean> {
		return path === this.key || this.app.vault.adapter.exists(path);
	}
	async mkdir(path: string): Promise<void> {
		if (this.key.startsWith(`${path}/`)) return;
		await this.app.vault.adapter.mkdir(path);
	}
	async read(path: string): Promise<string> {
		if (path !== this.key) return this.app.vault.adapter.read(path);
		await this.refresh();
		const ids = new Set<string>();
		for (const doc of this.documents.values()) {
			if (ids.has(doc.id)) throw new Error(`Duplicate NAND id: ${doc.id}`);
			ids.add(doc.id);
		}
		return JSON.stringify(
			this.codec.decode([...this.documents.values()].filter((d) => d.properties['nand-deleted'] !== true)),
		);
	}
	async write(path: string, text: string): Promise<void> {
		if (path !== this.key) {
			await this.app.vault.adapter.write(path, text);
			return;
		}
		const next = this.codec.encode(JSON.parse(text) as T);
		const existing = new Map<string, CollectionDocument>();
		for (const doc of this.documents.values()) {
			if (existing.has(doc.id)) throw new Error(`Duplicate NAND id: ${doc.id}`);
			existing.set(doc.id, doc);
		}
		const ids = new Set(next.map((doc) => doc.id));
		for (const doc of existing.values())
			if (!ids.has(doc.id) && doc.properties['nand-deleted'] !== true)
				next.push({ ...doc, properties: { ...doc.properties, 'nand-deleted': true } });
		for (const doc of next) {
			const old = existing.get(doc.id);
			const target = old?.path ?? doc.path;
			const value: DocumentValue = {
				properties: doc.properties,
				...(doc.rows ? { rows: doc.rows } : {}),
				...(doc.sections ? { sections: doc.sections } : {}),
			};
			const baseline: DocumentValue = old
				? {
						properties: old.properties,
						...(old.rows ? { rows: old.rows } : {}),
						...(old.sections ? { sections: old.sections } : {}),
					}
				: { properties: {} };
			// Unknown fields are owned by the author, not by the codec.
			if (old) value.properties = { ...old.properties, ...doc.properties };
			for (const key of ['nand-deleted', ...(this.codec.managedProperties ?? [])])
				if (!(key in doc.properties)) delete value.properties[key];
			if (JSON.stringify(baseline) === JSON.stringify(value)) continue;
			const saved = await this.repository.update(target, baseline, value);
			this.documents.set(target, { ...saved.value, id: doc.id, path: target });
		}
	}
	dispose(): void {
		for (const ref of this.refs.splice(0)) this.app.vault.offref(ref);
	}
}
