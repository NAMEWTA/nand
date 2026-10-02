import { BrowserError } from './model';
/** A closed generation can never admit queued work or publish a late result. */
export class BrowserOperationQueue {
	private pending: Promise<unknown> = Promise.resolve();
	private closed = false;
	readonly abort = new AbortController();
	run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
		if (this.closed) return Promise.reject(new BrowserError('browser_page_closed'));
		const next = this.pending.then(async () => {
			if (this.closed) throw new BrowserError('browser_page_closed');
			// The caller must settle even when a native operation ignores abort.
			// Keep observing the native promise so late rejection is still handled.
			return new Promise<T>((resolve, reject) => {
				const cancelled = () => reject(new BrowserError('browser_page_closed'));
				this.abort.signal.addEventListener('abort', cancelled, { once: true });
				let operation: Promise<T>;
				try { operation = work(this.abort.signal); }
				catch (error) {
					this.abort.signal.removeEventListener('abort', cancelled);
					reject(error instanceof Error ? error : new Error(String(error)));
					return;
				}
				operation.then(
					value => this.closed ? cancelled() : resolve(value),
					reject,
				).finally(() => this.abort.signal.removeEventListener('abort', cancelled));
			});
		});
		this.pending = next.catch(() => undefined);
		return next;
	}
	close(): void {
		this.closed = true;
		this.abort.abort();
	}
}
