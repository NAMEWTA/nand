// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** Least-recently-used map with a fixed capacity; reads refresh recency. */
export class LruMap<K, V> {
	private readonly entries = new Map<K, V>();

	constructor(private readonly capacity: number) {}

	get size(): number {
		return this.entries.size;
	}
	get(key: K): V | undefined {
		const value = this.entries.get(key);
		if (value === undefined) return undefined;
		this.entries.delete(key);
		this.entries.set(key, value);
		return value;
	}
	/** Look at a value without refreshing its recency. */
	peek(key: K): V | undefined {
		return this.entries.get(key);
	}
	has(key: K): boolean {
		return this.entries.has(key);
	}
	set(key: K, value: V): void {
		this.entries.delete(key);
		this.entries.set(key, value);
		while (this.entries.size > this.capacity) {
			const oldest = this.entries.keys().next();
			if (oldest.done) break;
			this.entries.delete(oldest.value);
		}
	}
	delete(key: K): boolean {
		return this.entries.delete(key);
	}
	clear(): void {
		this.entries.clear();
	}
	keys(): IterableIterator<K> {
		return this.entries.keys();
	}
}
