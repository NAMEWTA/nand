/** Coalesces concurrent native initialization and drains admitted work before teardown. */
export class RuntimeStartup {
	private pending = new Map<string, Promise<unknown>>();
	private closed = false;
	open(): void {
		this.closed = false;
	}
	run<T>(key: string, create: () => Promise<T>): Promise<T> {
		if (this.closed) return Promise.reject(new Error('Terminal runtime is shutting down'));
		const existing = this.pending.get(key);
		if (existing) return existing as Promise<T>;
		const operation = Promise.resolve().then(create);
		this.pending.set(key, operation);
		void operation
			.finally(() => {
				if (this.pending.get(key) === operation) this.pending.delete(key);
			})
			.catch(() => undefined);
		return operation;
	}
	async shutdown(): Promise<void> {
		this.closed = true;
		await Promise.allSettled([...this.pending.values()]);
	}
}
