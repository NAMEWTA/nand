import type { TextStorage } from './ports';
import { DocumentConflict, threeWayMerge } from './three-way-merge';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'conflict';
export interface SaveState {
	status: SaveStatus;
	error?: string;
}
const queues = new WeakMap<TextStorage, Map<string, Promise<void>>>();

export async function ensureDirectory(storage: TextStorage, directory: string): Promise<void> {
	let current = '';
	for (const part of directory.split('/').filter(Boolean)) {
		current = current ? `${current}/${part}` : part;
		if (!(await storage.exists(current))) {
			try {
				await storage.mkdir(current);
			} catch (error) {
				if (!(await storage.exists(current))) throw error;
			}
		}
	}
}

/** Optimistic local state with explicit failure, deletion-aware merge and a draining lifecycle. */
export class DurableState<T> {
	value: T;
	state: SaveState = { status: 'saved' };
	private baseline: T;
	private loading?: Promise<void>;
	private tail: Promise<void> = Promise.resolve();
	private error?: Error;
	private closed = false;
	private recoveryId = crypto.randomUUID();
	constructor(
		private storage: TextStorage,
		private path: string,
		private empty: () => T,
		private decode: (value: unknown) => T,
		private changed: () => void,
	) {
		this.value = empty();
		this.baseline = empty();
	}
	private async read(): Promise<T> {
		return (await this.storage.exists(this.path))
			? this.decode(JSON.parse(await this.storage.read(this.path)))
			: this.empty();
	}
	private failure(error: unknown): void {
		this.error = error instanceof Error ? error : new Error(String(error));
		this.state = { status: error instanceof DocumentConflict ? 'conflict' : 'unsaved', error: String(error) };
		this.changed();
	}
	private async recover(error: unknown): Promise<void> {
		this.failure(error);
		try {
			await ensureDirectory(this.storage, '.nand/recovery/drafts');
			await this.storage.write(
				`.nand/recovery/drafts/${this.recoveryId}.json`,
				JSON.stringify({
					path: this.path,
					at: new Date().toISOString(),
					baseline: this.baseline,
					draft: this.value,
					error: this.error?.message,
				}),
			);
		} catch (recoveryError) {
			this.state = { ...this.state, error: `${this.state.error}; recovery: ${String(recoveryError)}` };
			this.changed();
		}
	}
	load(): Promise<void> {
		if (!this.loading) this.loading = this.sync();
		return this.loading;
	}
	/** Reads and writes share the same queue; a refresh cannot reset a baseline during a save. */
	private enqueue(work: () => Promise<void>, onFailure: (error: unknown) => void | Promise<void>): Promise<void> {
		let queue = queues.get(this.storage);
		if (!queue) {
			queue = new Map();
			queues.set(this.storage, queue);
		}
		const settled = (queue.get(this.path) ?? Promise.resolve()).then(work).catch(onFailure);
		queue.set(this.path, settled);
		this.tail = settled;
		void settled.then(() => {
			if (queue.get(this.path) === settled) queue.delete(this.path);
		});
		return settled;
	}
	sync(): Promise<void> {
		if (this.closed) return Promise.resolve();
		return this.enqueue(async () => {
			const remote = await this.read();
			this.value = threeWayMerge(this.baseline, this.value, remote);
			this.baseline = structuredClone(remote);
			const saved = JSON.stringify(this.value) === JSON.stringify(remote);
			if (saved) this.error = undefined;
			this.state = { status: saved ? 'saved' : 'unsaved', ...(this.error ? { error: this.error.message } : {}) };
			this.changed();
		}, (error) => this.failure(error));
	}
	save(): void {
		if (this.closed) {
			this.failure(new Error('Repository is closed'));
			return;
		}
		this.state = { status: 'saving' };
		this.changed();
		void this.enqueue(async () => {
			const remote = await this.read(); // A failed read/parse can never reach write().
			const local = structuredClone(this.value);
			const merged = threeWayMerge(this.baseline, local, remote);
			await ensureDirectory(this.storage, this.path.split('/').slice(0, -1).join('/'));
			await this.storage.write(this.path, JSON.stringify(merged));
			this.baseline = structuredClone(merged);
			// Edits received while the write was in flight still belong to the next save.
			this.value = threeWayMerge(local, this.value, merged);
			this.error = undefined;
			this.state = { status: JSON.stringify(this.value) === JSON.stringify(merged) ? 'saved' : 'saving' };
			this.changed();
		}, (error) => this.recover(error));
	}
	async flush(): Promise<void> {
		let current: Promise<void>;
		do { current = this.tail; await current; } while (current !== this.tail);
		if (this.error) throw this.error;
	}
	async retry(): Promise<void> {
		this.save();
		await this.flush();
	}
	async shutdown(): Promise<void> {
		this.closed = true;
		await this.flush();
	}
}
