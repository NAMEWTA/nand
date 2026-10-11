import type { App } from 'obsidian';
import { MarkdownCollectionStorage } from '../../../host/obsidian/storage/document-collection';
import { DurableState, ensureDirectory, type SaveState } from '../../../shared/storage/durable-state';
import type { TextStorage } from '../../../shared/storage/ports';
import { assistantDocuments, validateAssistant } from '../core/assistant/documents';
import { emptyAssistant, type AssistantData, type AssistantTask } from '../core/assistant/model';
import { BrowserError } from '../core/model';
import { workspaceFolder } from '../core/workspace/location';
import { snapshotJson } from '../core/workspace/snapshot';
import { mergeAssistantRecovery, type AssistantRecoveryDraft } from '../core/assistant/recovery';

/** One serial document owner; an observed webpage effect can be saved again but never replayed here. */
export class AssistantStore {
	private readonly repository: DurableState<AssistantData>;
	private edits: Promise<unknown> = Promise.resolve();
	private pending = false;
	private closed = false;
	private closing?: Promise<void>;
	private readonly recoveryFiles = new Map<string, string>();
	readonly ready: Promise<void>;
	constructor(private readonly storage: TextStorage, readonly key: string, private readonly changed: () => void,
		private readonly recoveryDirectory: string, private readonly id: () => string, private readonly disposeStorage: () => void = () => {}) {
		this.repository = new DurableState(storage, key, emptyAssistant, validateAssistant, changed, `${recoveryDirectory}/${id()}.json`);
		this.ready = this.repository.sync(true); void this.ready.catch(() => undefined);
	}
	data(): AssistantData { return structuredClone(this.repository.value); }
	state(): SaveState { return { ...this.repository.state }; }
	hasPendingSave(): boolean { return this.pending; }
	private serialize<T>(work: () => Promise<T>): Promise<T> {
		const next = this.edits.then(async () => { if (this.closed) throw new BrowserError('browser_disabled'); await this.ready; return work(); });
		this.edits = next.catch(() => undefined); return next;
	}
	refresh(): Promise<void> { return this.serialize(async () => { if (!this.pending) await this.repository.sync(true); }); }
	put(record: AssistantTask, expected?: AssistantTask): Promise<void> {
		const frozen = structuredClone(record), baseline = expected && structuredClone(expected);
		validateAssistant({ version: 1, tasks: [frozen] });
		return this.serialize(async () => {
			if (this.pending) throw new BrowserError('browser_workspace_save_pending');
			await this.repository.sync(true);
			const draft = this.data(), existing = draft.tasks.find(task => task.id === frozen.id);
			if (snapshotJson(existing) !== snapshotJson(baseline)) throw new BrowserError('browser_workspace_storage_changed');
			draft.tasks = [...draft.tasks.filter(task => task.id !== frozen.id), frozen];
			this.repository.value = validateAssistant(draft); await this.save();
		});
	}
	private async save(): Promise<void> {
		this.repository.save();
		try { await this.repository.flush(); this.pending = false; }
		catch (error) { this.pending = true; throw error; }
		finally { this.changed(); }
	}
	/** Save exact late facts separately when Markdown was changed/deleted or the primary write failed. */
	preserve(record: AssistantTask, expected?: AssistantTask): Promise<string> {
		const frozen = structuredClone(record), original = expected && structuredClone(expected);
		validateAssistant({ version: 1, tasks: [frozen] });
		return this.serialize(async () => {
			const baseline = this.data(), draft = this.data();
			baseline.tasks = [...baseline.tasks.filter(task => task.id !== frozen.id), ...(original ? [original] : [])];
			draft.tasks = [...draft.tasks.filter(task => task.id !== frozen.id), frozen];
			const path = this.recoveryFiles.get(frozen.id) ?? `${this.recoveryDirectory}/${this.id()}.json`;
			this.recoveryFiles.set(frozen.id, path);
			await ensureDirectory(this.storage, this.recoveryDirectory);
			await this.storage.write(path, JSON.stringify({ path: this.key, at: new Date().toISOString(), baseline, draft }));
			return path;
		});
	}
	retrySave(): Promise<void> { return this.serialize(async () => { if (this.pending) await this.save(); }); }
	restore(record: AssistantRecoveryDraft, expected: AssistantData): Promise<void> {
		const frozen = structuredClone(record), baseline = structuredClone(expected);
		return this.serialize(async () => {
			if (this.pending) throw new BrowserError('browser_workspace_save_pending');
			if (frozen.path !== this.key) throw new BrowserError('browser_workspace_recovery_invalid');
			await this.repository.sync(true);
			if (snapshotJson(this.data()) !== snapshotJson(baseline)) throw new BrowserError('browser_workspace_preview_changed');
			this.repository.value = mergeAssistantRecovery(frozen, baseline); await this.save();
		});
	}
	shutdown(): Promise<void> {
		if (!this.closing) { this.closed = true; this.disposeStorage(); this.closing = this.edits.then(() => this.repository.shutdown()); }
		return this.closing;
	}
}

export const assistantDocumentKey = (folder: string): string => 'browser/assistant-documents/' + encodeURIComponent(folder) + '.json';
export function markdownAssistantStore(app: App, folder: string, recoveryDirectory: string, changed: () => void): AssistantStore {
	if (workspaceFolder(folder) !== folder) throw new BrowserError('browser_workspace_folder');
	const key = assistantDocumentKey(folder);
	const storage = new MarkdownCollectionStorage(app, assistantDocuments(folder), key);
	let unsubscribe = () => {};
	const store = new AssistantStore(storage, key, changed, recoveryDirectory, () => crypto.randomUUID(), () => { unsubscribe(); storage.dispose(); });
	unsubscribe = storage.subscribeInvalidation(() => { void store.refresh().catch(() => changed()); }); return store;
}
