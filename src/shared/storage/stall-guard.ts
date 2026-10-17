import { storageTimers } from './timers';

export interface StallGuardOptions {
	/** How long one attempt may stay pending before the same request is issued again. */
	stallMs?: number;
	attempts?: number;
}

export const FS_STALL_MS = 4000;
const FS_ATTEMPTS = 3;

/**
 * In one observed environment (Obsidian on Electron 43.3, a synthetic Escape followed by a window focus) the host's
 * asynchronous filesystem completion never arrived for requests issued right then: the promise stayed pending forever
 * while new requests succeeded. The native cause is not located. A serial queue holder awaiting such a request would
 * block every later operation, so read-only requests are issued again once they stall, as a compatibility guard.
 * The first attempt to settle wins; a stall on every attempt is reported as an error instead of an endless wait.
 * Never use this for writes. Attempts cannot be cancelled, and nested guards keep their own timers: when an outer
 * attempt wins, an inner guard may still issue a bounded number of late re-issues before it gives up.
 */
export function reissueIfStalled<T>(label: string, request: () => Promise<T>, options: StallGuardOptions = {}): Promise<T> {
	const failure = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));
	const timers = storageTimers();
	if (!timers) return request();
	const stallMs = options.stallMs ?? FS_STALL_MS, attempts = options.attempts ?? FS_ATTEMPTS;
	return new Promise<T>((resolve, reject) => {
		let settled = false, issued = 0, timer: number | undefined;
		const finish = (settle: () => void) => {
			if (settled) return;
			settled = true;
			if (timer !== undefined) timers.clearTimeout(timer);
			settle();
		};
		const attempt = () => {
			issued++;
			let pending: Promise<T>;
			try { pending = request(); } catch (error) { finish(() => reject(failure(error))); return; }
			pending.then(value => finish(() => resolve(value)), error => finish(() => reject(failure(error))));
			timer = timers.setTimeout(() => {
				if (settled) return;
				if (issued >= attempts) { finish(() => reject(new Error(`nand-storage.fs-stalled: ${label}`))); return; }
				console.warn('[NAND storage] filesystem request stalled; issuing it again', label, `attempt ${issued + 1}/${attempts}`);
				attempt();
			}, stallMs);
		};
		attempt();
	});
}
