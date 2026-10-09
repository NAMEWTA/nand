/**
 * Runs git work one task at a time, like obsidian-git's PromiseQueue (src/promiseQueue.ts, MIT): a failing task
 * does not stop the queue. Unlike it, a task that is already waiting under the same key is not queued twice, so
 * repeated clicks and timers coalesce, and `clear()` rejects the waiting tasks instead of dropping their promises.
 */
export class CancelledError extends Error {
	constructor() {
		super('cancelled');
		this.name = 'CancelledError';
	}
}

interface Task {
	key: string;
	label: string;
	run: () => Promise<unknown>;
	promise: Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (error: unknown) => void;
}

export class OperationQueue {
	private waiting: Task[] = [];
	private current?: Task;
	private closed = false;
	constructor(private readonly changed: () => void = () => {}) {}

	/** The label of the task that is running now. */
	get running(): string | undefined {
		return this.current?.label;
	}
	get busy(): boolean {
		return !!this.current || this.waiting.length > 0;
	}

	/** Queue `run`. While a task with the same key is still waiting, its promise is returned instead. */
	enqueue<T>(key: string, label: string, run: () => Promise<T>): Promise<T> {
		if (this.closed) return Promise.reject(new CancelledError());
		const existing = this.waiting.find((task) => task.key === key);
		if (existing) return existing.promise as Promise<T>;
		let resolve!: (value: unknown) => void;
		let reject!: (error: unknown) => void;
		const promise = new Promise<unknown>((ok, fail) => {
			resolve = ok;
			reject = fail;
		});
		this.waiting.push({ key, label, run, promise, resolve, reject });
		this.changed();
		void this.next();
		return promise as Promise<T>;
	}

	private async next(): Promise<void> {
		if (this.current) return;
		const task = this.waiting.shift();
		if (!task) return;
		this.current = task;
		this.changed();
		try {
			task.resolve(await task.run());
		} catch (error) {
			task.reject(error);
		} finally {
			this.current = undefined;
			this.changed();
			void this.next();
		}
	}

	/** Reject the waiting tasks; the running one finishes (cancel it through its own signal). */
	clear(): void {
		for (const task of this.waiting.splice(0)) task.reject(new CancelledError());
		this.changed();
	}

	/** Stop accepting tasks and clear; resolves when the running task has finished. */
	async close(): Promise<void> {
		this.closed = true;
		const running = this.current?.promise;
		this.clear();
		await running?.catch(() => undefined);
	}
}
