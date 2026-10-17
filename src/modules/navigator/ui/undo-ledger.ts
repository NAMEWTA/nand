// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { TagEditRecord } from '../platform/tag-ops';

export interface LedgerTimers {
	set: (callback: () => void, ms: number) => unknown;
	clear: (handle: unknown) => void;
}

interface Entry {
	records: TagEditRecord[];
	timer: unknown;
	retired: () => void;
}

/**
 * The tag edits that can still be undone. Every edit has its own id, and retiring is idempotent: a stale undo
 * prompt can only ever act on (or remove) its own entry. Entries expire after `ttl` ms and the oldest are dropped
 * beyond `limit`, so the restore points (full text of the changed bodies) do not pile up.
 */
export class UndoLedger {
	private readonly entries = new Map<number, Entry>();
	private nextId = 1;

	constructor(private readonly timers: LedgerTimers, private readonly ttl = 30_000, private readonly limit = 20) {}

	/** Keep an edit; `retired` runs once when it expires, is dropped, is undone for good or the ledger is cleared. */
	add(records: TagEditRecord[], retired: () => void): number {
		const id = this.nextId++;
		this.entries.set(id, { records, timer: this.timers.set(() => this.retire(id), this.ttl), retired });
		while (this.entries.size > this.limit) this.retire(this.entries.keys().next().value as number);
		return id;
	}

	has(id: number): boolean { return this.entries.has(id); }
	records(id: number): TagEditRecord[] | undefined { return this.entries.get(id)?.records; }
	latest(): number | undefined { return [...this.entries.keys()].pop(); }
	get size(): number { return this.entries.size; }

	/** What is left to undo for an entry (parts that could not be written yet). */
	update(id: number, records: TagEditRecord[]): void {
		const entry = this.entries.get(id);
		if (entry) entry.records = records;
	}

	retire(id: number): void {
		const entry = this.entries.get(id);
		if (!entry) return;
		this.entries.delete(id);
		this.timers.clear(entry.timer);
		entry.records = [];
		entry.retired();
	}

	clear(): void {
		for (const id of [...this.entries.keys()]) this.retire(id);
	}
}
