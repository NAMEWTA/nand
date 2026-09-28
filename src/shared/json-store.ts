import type { TextStorage } from './storage/ports';

/** Serialized writes with a durable previous snapshot for crash recovery. */
export class JsonStore<T> {
	private tail: Promise<void> = Promise.resolve();
	private snapshot?: string;
	constructor(
		private adapter: TextStorage,
		private path: string,
		private validate: (value: unknown) => value is T,
	) {}
	async load(fallback: T): Promise<T> {
		const adapter = this.adapter;
		try {
			if (!(await adapter.exists(this.path))) {
				if (!(await adapter.exists(`${this.path}.backup`))) return fallback;
				throw new Error(`Missing data: ${this.path}`);
			}
			const value: unknown = JSON.parse(await adapter.read(this.path));
			if (!this.validate(value)) throw new Error(`Invalid data: ${this.path}`);
			this.snapshot = JSON.stringify(value);
			return value;
		} catch (error) {
			if (!(await adapter.exists(`${this.path}.backup`))) throw error;
			const value: unknown = JSON.parse(await adapter.read(`${this.path}.backup`));
			if (!this.validate(value)) throw error;
			if (await adapter.exists(this.path))
				await adapter.write(`${this.path}.corrupt`, await adapter.read(this.path));
			this.snapshot = JSON.stringify(value);
			return value;
		}
	}
	save(value: T): Promise<void> {
		const text = JSON.stringify(value);
		const operation = this.tail.then(async () => {
			const adapter = this.adapter;
			const parts = this.path.split('/');
			parts.pop();
			let dir = '';
			for (const part of parts) {
				dir = dir ? `${dir}/${part}` : part;
				if (!(await adapter.exists(dir))) {
					try {
						await adapter.mkdir(dir);
					} catch (error) {
						if (!(await adapter.exists(dir))) throw error;
					}
				}
			}
			if (this.snapshot) await adapter.write(`${this.path}.backup`, this.snapshot);
			// FileSystemAdapter.rename rejects an existing destination. Keep the last
			// valid snapshot before writing; a torn primary is recovered by load().
			await adapter.write(this.path, text);
			this.snapshot = text;
		});
		this.tail = operation.catch(() => {});
		return operation;
	}
	flush(): Promise<void> {
		return this.tail;
	}
}
