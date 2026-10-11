import type { App } from 'obsidian';
import { contentFiles, type ContentFiles } from './content-files';
import { JsonStore } from '../../../shared/json-store';
import type { TextStorage } from '../../../shared/storage/ports';
import { nandPath } from '../../../shared/storage/nand-paths';
import { privateVaultStorage } from './private-storage';
import { deviceId } from './device-id';

interface SavedDraft { path: string; base: string; value: string }
const validDraft = (value: unknown): value is SavedDraft | null => value === null || !!value && typeof value === 'object'
	&& 'path' in value && typeof value.path === 'string' && 'base' in value && typeof value.base === 'string' && 'value' in value && typeof value.value === 'string';

/** Editor state is separate from the file index and never uses a native MarkdownView for hidden files. */
export class ContentDraft {
	value = '';
	private base = '';
	private claim?: ReturnType<ContentFiles['claimDraft']>;
	private readonly recovery: JsonStore<SavedDraft | null>;
	private persisted: SavedDraft | null = null;
	private tail: Promise<void> = Promise.resolve();
	private listeners = new Set<() => void>();
	error = '';
	constructor(private files: ContentFiles, readonly path: string, recovery: { storage: TextStorage; path: string }) { this.recovery = new JsonStore(recovery.storage, recovery.path, validDraft); }
	async load(): Promise<void> {
		this.base = this.value = await this.files.read(this.path);
		this.persisted = await this.recovery.load(null);
		if (this.persisted && this.persisted.path !== this.path) throw new Error('nand-content.invalid-draft');
		if (this.persisted && this.persisted.value !== this.persisted.base) { this.base = this.persisted.base; this.value = this.persisted.value; }
		this.claim = this.files.claimDraft(this.path, () => this.value);
	}
	subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
	private changed(): void { for (const listener of this.listeners) listener(); }
	private enqueue(work: () => Promise<void>): Promise<void> {
		const run = this.tail.then(work);
		this.tail = run.catch(error => { this.error = error instanceof Error ? error.message : String(error); this.changed(); });
		return run;
	}
	private async preserve(): Promise<void> {
		const value = { path: this.path, base: this.base, value: this.value };
		let base = this.persisted;
		if (base === null) {
			base = await this.recovery.load(value);
			if (JSON.stringify(base) !== JSON.stringify(value)) throw new Error('nand-content.draft-changed');
			// This baseline also owns the backup if the first primary write fails.
			this.persisted = base;
		}
		this.persisted = await this.recovery.commit({ base, value });
	}
	edit(value: string): Promise<void> { this.value = value; this.changed(); return this.enqueue(() => this.preserve()); }
	save(): Promise<void> {
		const next = this.value;
		return this.enqueue(async () => {
			await this.preserve();
			if (next !== this.base) {
				await this.files.process(this.path, current => { if (current !== this.base && current !== next) throw new Error('nand-content.conflict'); return next; }, this.claim?.owner);
				this.base = next;
				await this.preserve();
			}
			this.error = ''; this.changed();
		});
	}
	get dirty(): boolean { return this.value !== this.base; }
	refresh(): Promise<void> {
		return this.enqueue(async () => {
			if (this.dirty) return;
			const before = this.value, disk = await this.files.read(this.path);
			if (this.dirty || this.value !== before) return;
			this.base = this.value = disk; this.error = ''; this.changed();
		});
	}
	dispose(): void { this.claim?.release(); }
}

interface SharedEditor { ready: Promise<ContentDraft>; users: number }
const editors = new WeakMap<App, Map<string, SharedEditor>>();
export async function acquireContentDraft(app: App, path: string): Promise<{ draft: ContentDraft; release: () => Promise<void> }> {
	let cache = editors.get(app); if (!cache) { cache = new Map(); editors.set(app, cache); }
	let entry = cache.get(path);
	if (!entry) {
		const ready = (async () => {
			const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
			const draft = new ContentDraft(contentFiles(app), path, { storage: privateVaultStorage(app), path: nandPath('recovery/content', deviceId(app), hash + '.json') });
			await draft.load(); return draft;
		})();
		entry = { ready, users: 0 }; cache.set(path, entry);
		void ready.catch(() => { if (cache.get(path) === entry) cache.delete(path); });
	}
	entry.users++;
	const draft = await entry.ready;
	let released = false;
	return { draft, release: async () => {
		if (released) return; released = true;
		if (--entry.users === 0) { await draft.save(); if (!entry.users) { draft.dispose(); cache.delete(path); } }
	} };
}
