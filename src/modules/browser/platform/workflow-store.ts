import type { App } from 'obsidian';
import { MarkdownCollectionStorage } from '../../../host/obsidian/storage/document-collection';
import { DurableState, ensureDirectory, type SaveState } from '../../../shared/storage/durable-state';
import type { TextStorage } from '../../../shared/storage/ports';
import { BrowserError } from '../core/model';
import { emptyWorkflows, type BrowserWorkflowSpec, type WorkflowData, type WorkflowExecution } from '../core/workflows/model';
import { validateWorkflows, workflowDocuments } from '../core/workflows/documents';
import { snapshotJson } from '../core/workspace/snapshot';
import { workspaceFolder } from '../core/workspace/location';

/** Markdown is the only definition/step store. The shared automations owner keeps the run receipt. */
export class WorkflowStore {
	private readonly repository: DurableState<WorkflowData>;
	private edits: Promise<unknown> = Promise.resolve();
	private closed = false;
	private pending = false;
	readonly ready: Promise<void>;
	constructor(private readonly storage: TextStorage, readonly key: string, changed: () => void, private readonly recovery: string, private readonly dispose: () => void = () => {}) {
		this.repository = new DurableState(storage, key, emptyWorkflows, validateWorkflows, changed, `${recovery}/pending.json`);
		this.ready = this.repository.sync(true); void this.ready.catch(() => undefined);
	}
	data(): WorkflowData { return structuredClone(this.repository.value); }
	state(): SaveState { return { ...this.repository.state }; }
	hasPendingSave(): boolean { return this.pending; }
	private edit<T>(work: () => Promise<T>): Promise<T> {
		const next = this.edits.then(async () => { if (this.closed) throw new BrowserError('browser_disabled'); await this.ready; return work(); });
		this.edits = next.catch(() => undefined); return next;
	}
	refresh(): Promise<void> { return this.edit(async () => { if (this.pending) throw new BrowserError('browser_workspace_save_pending'); await this.repository.sync(true); }); }
	putWorkflow(spec: BrowserWorkflowSpec, expected?: BrowserWorkflowSpec): Promise<void> {
		const frozen = structuredClone(spec), baseline = expected && structuredClone(expected);
		validateWorkflows({ ...emptyWorkflows(), workflows: [frozen] });
		return this.update(data => {
			if (snapshotJson(data.workflows.find(row => row.id === frozen.id)) !== snapshotJson(baseline)) throw new BrowserError('browser_workspace_storage_changed');
			data.workflows = [...data.workflows.filter(row => row.id !== frozen.id), frozen];
		});
	}
	putExecution(run: WorkflowExecution, expected?: WorkflowExecution): Promise<void> {
		const frozen = structuredClone(run), baseline = expected && structuredClone(expected);
		validateWorkflows({ ...emptyWorkflows(), executions: [frozen] });
		return this.update(data => {
			if (snapshotJson(data.executions.find(row => row.runId === frozen.runId)) !== snapshotJson(baseline)) throw new BrowserError('browser_workspace_storage_changed');
			data.executions = [...data.executions.filter(row => row.runId !== frozen.runId), frozen];
		});
	}
	private update(change: (data: WorkflowData) => void): Promise<void> {
		return this.edit(async () => {
			if (this.pending) throw new BrowserError('browser_workspace_save_pending');
			await this.repository.sync(true); const data = this.data(); change(data); this.repository.value = validateWorkflows(data); this.repository.save();
			try { await this.repository.flush(); } catch (error) { this.pending = true; throw error; }
		});
	}
	/** Preserve observed effects even if the user concurrently edited or removed their Markdown. */
	preserve(run: WorkflowExecution): Promise<string> {
		const frozen = structuredClone(run); validateWorkflows({ ...emptyWorkflows(), executions: [frozen] });
		return this.edit(async () => { await ensureDirectory(this.storage, this.recovery); const path = `${this.recovery}/${frozen.runId}.json`;
			await this.storage.write(path, JSON.stringify({ path: this.key, run: frozen })); return path;
		});
	}
	retrySave(): Promise<void> { return this.edit(async () => { if (this.pending) { await this.repository.retry(); this.pending = false; } }); }
	async shutdown(): Promise<void> { this.closed = true; this.dispose(); await this.edits; await this.repository.shutdown(); }
}

export function markdownWorkflowStore(app: App, folder: string, recovery: string, changed: () => void): WorkflowStore {
	if (workspaceFolder(folder) !== folder) throw new BrowserError('browser_workspace_folder');
	const key = 'browser/workflow-documents/' + encodeURIComponent(folder) + '.json';
	const storage = new MarkdownCollectionStorage(app, workflowDocuments(folder), key);
	let unsubscribe = () => {};
	const store = new WorkflowStore(storage, key, changed, recovery, () => { unsubscribe(); storage.dispose(); });
	unsubscribe = storage.subscribeInvalidation(() => { void store.refresh().then(changed, changed); }); return store;
}
