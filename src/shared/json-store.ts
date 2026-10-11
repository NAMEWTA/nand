import type { TextStorage } from './storage/ports';
import { ensureDirectory } from './storage/durable-state';
import { threeWayMerge } from './storage/three-way-merge';
import { storageWriteQueue } from './storage/write-queue';

/** Serialized writes with validation, concurrent-edit detection and a previous valid snapshot. */
export class JsonStore<T> {
	private tail: Promise<void> = Promise.resolve();
	private snapshot?: string;
	private observed?: string;
	private error?: Error;
	private loadFailed = false;
	private needsRecovery = false;
	constructor(
		private adapter: TextStorage,
		private path: string,
		private validate: (value: unknown) => value is T,
	) {}
	load(fallback: T): Promise<T> {
		return storageWriteQueue(this.adapter).run(this.path, () => this.loadNow(fallback));
	}
	private async loadNow(fallback: T): Promise<T> {
		try {
			// Read failures must escape: unreadable data is not evidence of corruption.
			const current = await this.adapter.exists(this.path) ? await this.adapter.read(this.path) : undefined;
			let value = current === undefined ? undefined : this.decode(current);
			if (value === undefined) {
				if (await this.adapter.exists(this.path + '.backup')) {
					value = this.decode(await this.adapter.read(this.path + '.backup'));
					if (value === undefined) throw new Error('Invalid backup: ' + this.path);
					if (current !== undefined) {
						let recovery = this.path + '.corrupt';
						if (await this.adapter.exists(recovery) && await this.adapter.read(recovery) !== current)
							recovery += '-' + crypto.randomUUID();
						await this.writeVerified(recovery, current);
					}
				} else if (current === undefined) value = fallback;
				else throw new Error('Invalid data: ' + this.path);
			}
			this.snapshot = JSON.stringify(value);
			this.observed = current;
			this.loadFailed = false;
			this.error = undefined;
			return structuredClone(value);
		} catch (error) {
			this.loadFailed = true;
			throw error;
		}
	}
	/** Commit an edit against its immutable baseline; callers must adopt the returned merged value. */
	commit(edit: { base: T; value: T }): Promise<T> {
		const { base, value: requested } = structuredClone(edit);
		const operation = storageWriteQueue(this.adapter).run(this.path, async () => {
			if (this.needsRecovery) {
				await this.loadNow(base);
				this.needsRecovery = false;
			}
			if (this.loadFailed) throw new Error('Reload failed store before saving: ' + this.path);
			if (this.snapshot === undefined) throw new Error('Load store before saving: ' + this.path);
			if (!this.validate(requested)) throw new Error('Invalid data: ' + this.path);
			const current = (await this.adapter.exists(this.path)) ? await this.adapter.read(this.path) : undefined;
			if (current === undefined && this.observed !== undefined) throw new Error('Store removed externally: ' + this.path);
			const valid = current === undefined ? undefined : this.decode(current);
			if (valid === undefined && current !== this.observed) throw new Error('Invalid concurrent data: ' + this.path);
			const remote = valid === undefined ? JSON.parse(this.snapshot) as T : valid;
			const next = threeWayMerge(base, requested, remote);
			if (!this.validate(next)) throw new Error('Invalid merged data: ' + this.path);
			await ensureDirectory(this.adapter, this.path.split('/').slice(0, -1).join('/'));
			await this.writeVerified(this.path + '.backup', JSON.stringify(remote));
			const text = JSON.stringify(next);
			try { await this.writeVerified(this.path, text); }
			catch (error) { this.needsRecovery = true; throw error; }
			this.snapshot = text;
			this.observed = text;
			this.error = undefined;
			return structuredClone(next);
		});
		this.tail = operation.then(() => undefined).catch((error) => {
			this.error = error instanceof Error ? error : new Error(String(error));
		});
		return operation;
	}
	private decode(text: string): T | undefined {
		try { const value: unknown = JSON.parse(text); return this.validate(value) ? value : undefined; }
		catch { return undefined; }
	}
	private async writeVerified(path: string, text: string): Promise<void> {
		await this.adapter.write(path, text);
		if (await this.adapter.read(path) !== text) throw new Error('Write verification failed: ' + path);
	}
	async flush(): Promise<void> {
		await this.tail;
		if (this.error) throw this.error;
	}
}
