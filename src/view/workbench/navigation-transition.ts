import { targetKey } from './navigation-state';
import type { WorkbenchTarget } from '../contracts/workbench';

/** Instance-local latest-wins navigation; no window/view references are retained globally. */
export class NavigationTransition {
	private generation = 0;
	private controller?: AbortController;
	private current?: string;
	private pending?: { key: string; promise: Promise<boolean> };
	private disposed = false;

	navigate(target: WorkbenchTarget, prepare: (signal: AbortSignal) => Promise<void>, commit: () => void, live?: () => string | undefined): Promise<boolean> {
		if (this.disposed) return Promise.resolve(false);
		const key = targetKey(target);
		if (this.pending?.key === key) return this.pending.promise;
		// A -> B (pending) -> A must cancel B and run A's prepare again. Matching the
		// historical key is not enough while a different request is still in flight,
		// and a domain selection that moved without a new request is not "already here".
		const displaced = this.pending !== undefined;
		this.controller?.abort();
		const generation = ++this.generation;
		const actual = live?.() ?? this.current;
		if (!displaced && actual === key) {
			this.pending = undefined;
			this.current = key;
			return Promise.resolve(true);
		}
		const controller = new AbortController();
		this.controller = controller;
		const promise = Promise.resolve().then(() => prepare(controller.signal)).then(() => {
			if (this.disposed || controller.signal.aborted || generation !== this.generation) return false;
			commit();
			this.current = key;
			return true;
		}, (error: unknown) => {
			if (this.disposed || controller.signal.aborted || generation !== this.generation) return false;
			throw error;
		}).finally(() => {
			if (this.pending?.promise === promise) this.pending = undefined;
		});
		this.pending = { key, promise };
		return promise;
	}

	invalidate(): void {
		this.controller?.abort();
		this.generation++;
		this.current = undefined;
		this.pending = undefined;
	}

	dispose(): void {
		this.disposed = true;
		this.invalidate();
	}
}
