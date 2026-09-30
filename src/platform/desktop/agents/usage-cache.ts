import type { UsageSnapshot } from '../../../core/agent-launch/types';

type ProviderSnapshot = Omit<UsageSnapshot, 'agentId' | 'failed'>;
export class ProviderUsageCache {
	private reads = new Map<string, { until: number; promise: Promise<{ snapshot: ProviderSnapshot; checkedAt: number }> }>();
	private now: () => number;
	constructor(now: () => number = Date.now) { this.now = now; }
	read(key: string, ttl: number, load: () => Promise<ProviderSnapshot>): Promise<{ snapshot: ProviderSnapshot; checkedAt: number }> {
		const previous = this.reads.get(key);
		if (previous && previous.until > this.now()) return previous.promise;
		const entry = { until: Number.POSITIVE_INFINITY, promise: Promise.resolve().then(load).then(snapshot => ({ snapshot, checkedAt: this.now() }), error => { throw new ProviderReadError(error instanceof Error ? error.message : 'Provider read failed', this.now()); }) };
		this.reads.set(key, entry);
		// Cache failures briefly as well: several open leaves must not retry the
		// same unavailable account endpoint in parallel or on every render.
		const complete = () => { entry.until = this.now() + ttl; };
		void entry.promise.then(complete, complete);
		if (this.reads.size > 64) {
			const oldest: unknown = this.reads.keys().next().value;
			if (typeof oldest === 'string') this.reads.delete(oldest);
		}
		return entry.promise;
	}
}
export class ProviderReadError extends Error {
	readonly checkedAt: number;
	constructor(message: string, checkedAt: number) { super(message); this.checkedAt = checkedAt; }
}
