/** Timing for automatic sync, independent of real timers so it can be tested. */

/** The longest delay `setTimeout` accepts (about 24.8 days). */
export const MAX_DELAY = 2 ** 31 - 1;

/**
 * Milliseconds until the next run of a routine that runs every `minutes` and last ran at `last` (epoch ms, 0 for
 * never). Runs left over from a closed session are due at once; 0 minutes means the routine is off (null).
 */
export function nextDelay(minutes: number, last: number, now: number): number | null {
	if (!(minutes > 0)) return null;
	const interval = minutes * 60_000;
	if (!last || last > now) return Math.min(interval, MAX_DELAY);
	return Math.min(Math.max(0, last + interval - now), MAX_DELAY);
}

/** Consecutive automatic failures after which automatic sync pauses itself until someone looks. */
export const FAILURE_LIMIT = 3;

/** Vault events within this long after a git operation came from that operation, not from editing. */
export const GIT_WRITE_GRACE = 2_000;
