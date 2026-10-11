import type { App } from 'obsidian';
import { MarkdownCollectionStorage } from '../../../host/obsidian/storage/document-collection';
import { DurableState, type SaveState } from '../../../shared/storage/durable-state';
import type { TextStorage } from '../../../shared/storage/ports';
import { BrowserError } from '../core/model';
import { emptyUserAdapters, userAdapterDocuments, validateUserAdapters, type UserAdapter, type UserAdapterData } from '../core/providers/user-adapter';
import { snapshotJson } from '../core/workspace/snapshot';
import { workspaceFolder } from '../core/workspace/location';

export class UserAdapterStore {
	private readonly repository: DurableState<UserAdapterData>;
	private edits: Promise<unknown> = Promise.resolve();
	private closed = false;
	private pending = false;
	readonly ready: Promise<void>;
	constructor(storage: TextStorage, key: string, changed: () => void, recovery: string, private readonly dispose: () => void = () => {}) {
		this.repository = new DurableState(storage, key, emptyUserAdapters, validateUserAdapters, changed, recovery);
		this.ready = this.repository.sync(true); void this.ready.catch(() => undefined);
	}
	data(): UserAdapterData { return structuredClone(this.repository.value); }
	state(): SaveState { return { ...this.repository.state }; }
	private edit<T>(work: () => Promise<T>): Promise<T> {
		const next = this.edits.then(async () => { if (this.closed) throw new BrowserError('browser_disabled'); await this.ready; return work(); });
		this.edits = next.catch(() => undefined); return next;
	}
	refresh(): Promise<void> { return this.edit(async () => { if (this.pending) throw new BrowserError('browser_workspace_save_pending'); await this.repository.sync(true); }); }
	put(rule: UserAdapter, expected?: UserAdapter): Promise<void> {
		const frozen = structuredClone(rule), baseline = expected && structuredClone(expected);
		validateUserAdapters({ version: 1, rules: [frozen] });
		return this.edit(async () => {
			if (this.pending) throw new BrowserError('browser_workspace_save_pending');
			await this.repository.sync(true);
			const data = this.data();
			if (snapshotJson(data.rules.find(row => row.id === frozen.id)) !== snapshotJson(baseline)) throw new BrowserError('browser_workspace_storage_changed');
			data.rules = [...data.rules.filter(row => row.id !== frozen.id), frozen];
			this.repository.value = validateUserAdapters(data); this.repository.save();
			try { await this.repository.flush(); } catch (error) { this.pending = true; throw error; }
		});
	}
	retrySave(): Promise<void> { return this.edit(async () => { if (this.pending) { await this.repository.retry(); this.pending = false; } }); }
	async shutdown(): Promise<void> { this.closed = true; this.dispose(); await this.edits; await this.repository.shutdown(); }
}

export function markdownUserAdapterStore(app: App, folder: string, recovery: string, changed: () => void): UserAdapterStore {
	if (workspaceFolder(folder) !== folder) throw new BrowserError('browser_workspace_folder');
	const key = 'browser/user-adapter-documents/' + encodeURIComponent(folder) + '.json';
	const storage = new MarkdownCollectionStorage(app, userAdapterDocuments(folder), key);
	let unsubscribe = () => {};
	const store = new UserAdapterStore(storage, key, changed, recovery, () => { unsubscribe(); storage.dispose(); });
	unsubscribe = storage.subscribeInvalidation(() => { void store.refresh().then(changed, changed); }); return store;
}
