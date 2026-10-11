import type { App } from 'obsidian';
import { MarkdownCollectionStorage } from '../../../host/obsidian/storage/document-collection';
import { DurableState, ensureDirectory, type SaveState } from '../../../shared/storage/durable-state';
import type { TextStorage } from '../../../shared/storage/ports';
import { BrowserError } from '../core/model';
import { validateWorkspace, workspaceDocuments } from '../core/workspace/documents';
import { emptyWorkspace, type WorkspaceData } from '../core/workspace/model';
import { workspaceFolder } from '../core/workspace/location';
import type { SynthesisRecord } from '../core/workspace/synthesis-model';

/** Failed document saves keep an explicit draft. No later send may silently replace it. */
export class WorkspaceStore {
	private readonly repository: DurableState<WorkspaceData>;
	private edits: Promise<unknown> = Promise.resolve();
	private pending = false;
	private closed = false;
	private closing?: Promise<void>;
	private readonly synthesisRecovery = new Map<string, string>();
	readonly ready: Promise<void>;
	constructor(private readonly storage: TextStorage, readonly key: string, private readonly changed: () => void, private readonly disposeStorage: () => void = () => {}, private readonly recoveryPath = `.nand/recovery/drafts/${crypto.randomUUID()}.json`) {
		this.repository = new DurableState(storage, key, emptyWorkspace, validateWorkspace, changed, recoveryPath);
		this.ready = this.repository.sync(true);
		void this.ready.catch(() => undefined);
	}
	data(): WorkspaceData { return structuredClone(this.repository.value); }
	state(): SaveState { return { ...this.repository.state }; }
	hasPendingSave(): boolean { return this.pending; }
	private serialize<T>(work: () => Promise<T>): Promise<T> {
		const next = this.edits.then(async () => {
			if (this.closed) throw new BrowserError('browser_disabled');
			await this.ready;
			return work();
		});
		this.edits = next.catch(() => undefined);
		return next;
	}
	refresh(): Promise<void> {
		return this.serialize(async () => { if (!this.pending) await this.repository.sync(true); });
	}
	edit(change: (draft: WorkspaceData) => void): Promise<void> {
		return this.serialize(async () => {
			if (this.pending) throw new BrowserError('browser_workspace_save_pending');
			await this.repository.sync(true);
			const draft = this.data(); change(draft); validateWorkspace(draft);
			this.repository.value = draft;
			await this.save();
		});
	}
	private async save(): Promise<void> {
		this.repository.save();
		try { await this.repository.flush(); this.pending = false; }
		catch (error) { this.pending = true; throw error; }
		finally { this.changed(); }
	}
	/** Newly observed receipts/answers still belong in the recovery draft while visible files are unwritable. */
	retainPending(change: (draft: WorkspaceData) => void): Promise<void> {
		return this.serialize(async () => {
			if (!this.pending) throw new BrowserError('browser_workspace_storage_changed');
			const draft = this.data(); change(draft); validateWorkspace(draft);
			this.repository.value = draft;
			try { await this.repository.preserveDraft(); } finally { this.changed(); }
		});
	}
	/** Preserve completed owner output when its visible intent was concurrently edited or deleted.
	 * A separate recovery file retains the old baseline, so explicit restoration still detects that conflict. */
	preserveSynthesis(record: SynthesisRecord, intent: SynthesisRecord): Promise<void> {
		const result = structuredClone(record), expected = structuredClone(intent);
		return this.serialize(async () => {
			const baseline = this.data(), draft = this.data();
			baseline.syntheses = [...baseline.syntheses.filter(row => row.id !== result.id), expected];
			draft.syntheses = [...draft.syntheses.filter(row => row.id !== result.id), result];
			validateWorkspace(baseline); validateWorkspace(draft);
			const path = this.synthesisRecovery.get(result.id) ?? this.recoveryPath.split('/').slice(0, -1).join('/') + `/${crypto.randomUUID()}.json`;
			this.synthesisRecovery.set(result.id, path);
			await ensureDirectory(this.storage, path.split('/').slice(0, -1).join('/'));
			await this.storage.write(path, JSON.stringify({ path: this.key, at: new Date().toISOString(), baseline, draft }));
		});
	}
	/** Retries only the document write. This class has no page/native-input capability. */
	retrySave(): Promise<void> { return this.serialize(async () => { if (this.pending) await this.save(); }); }
	shutdown(): Promise<void> {
		if (this.closing) return this.closing;
		this.closed = true;
		this.disposeStorage();
		this.closing = this.edits.then(() => this.repository.shutdown());
		return this.closing;
	}
}

export const workspaceDocumentKey = (root: string): string => 'browser/workspace-documents/' + encodeURIComponent(root) + '.json';

export function markdownWorkspaceStore(app: App, root: string, changed: () => void, recoveryPath?: string): WorkspaceStore {
	if (workspaceFolder(root) !== root) throw new BrowserError('browser_workspace_folder');
	const key = workspaceDocumentKey(root);
	const storage = new MarkdownCollectionStorage(app, workspaceDocuments(root), key);
	let unsubscribe = () => {};
	const store = new WorkspaceStore(storage, key, changed, () => { unsubscribe(); storage.dispose(); }, recoveryPath);
	unsubscribe = storage.subscribeInvalidation(() => { void store.refresh().catch(() => changed()); });
	return store;
}
