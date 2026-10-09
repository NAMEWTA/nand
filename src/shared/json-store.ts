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
			try {
				if (!(await this.adapter.exists(this.path))) {
					if (await this.adapter.exists(this.path + '.backup'))
						throw new Error('Missing primary: ' + this.path);
					this.snapshot = JSON.stringify(fallback);
					this.observed = undefined;
					this.loadFailed = false;
					return fallback;
				}
				this.observed = await this.adapter.read(this.path);
				const value: unknown = JSON.parse(this.observed);
				if (!this.validate(value)) throw new Error('Invalid data: ' + this.path);
				this.snapshot = JSON.stringify(value);
				this.loadFailed = false;
				return value;
			} catch (error) {
				if (!(await this.adapter.exists(this.path + '.backup'))) throw error;
				const value: unknown = JSON.parse(await this.adapter.read(this.path + '.backup'));
				if (!this.validate(value)) throw error;
				// A read failure is not corruption: never replace data we could not inspect.
				if (await this.adapter.exists(this.path)) {
					const damaged = await this.adapter.read(this.path);
					await this.adapter.write(this.path + '.corrupt', damaged);
					this.observed = damaged;
				}
				this.snapshot = JSON.stringify(value);
				this.loadFailed = false;
				return value;
			}
		} catch (error) {
			this.loadFailed = true;
			throw error;
		}
	}
	save(value: T): Promise<void> {
		const requested = structuredClone(value);
		const operation = storageWriteQueue(this.adapter).run(this.path, async () => {
			if (this.loadFailed) throw new Error('Reload failed store before saving: ' + this.path);
			if (!this.validate(requested)) throw new Error('Invalid data: ' + this.path);
			const current = (await this.adapter.exists(this.path)) ? await this.adapter.read(this.path) : undefined;
			let next = requested;
			if (current !== this.observed) {
				if (this.snapshot === undefined) throw new Error('Load existing store before saving: ' + this.path);
				if (current === undefined) throw new Error('Store removed externally: ' + this.path);
				const remote: unknown = JSON.parse(current);
				if (!this.validate(remote)) throw new Error('Invalid concurrent data: ' + this.path);
				next = threeWayMerge(JSON.parse(this.snapshot) as T, requested, remote);
			}
			await ensureDirectory(this.adapter, this.path.split('/').slice(0, -1).join('/'));
			if (this.snapshot && this.validate(JSON.parse(this.snapshot)))
				await this.adapter.write(this.path + '.backup', this.snapshot);
			const text = JSON.stringify(next);
			await this.adapter.write(this.path, text);
			this.snapshot = text;
			this.observed = text;
			this.error = undefined;
		});
		this.tail = operation.catch((error) => {
			this.error = error instanceof Error ? error : new Error(String(error));
		});
		return operation;
	}
	async flush(): Promise<void> {
		await this.tail;
		if (this.error) throw this.error;
	}
}
