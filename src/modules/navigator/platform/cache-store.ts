// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { CacheRecord } from '../core/cache';

/** Persistent storage for note previews; one database per vault, rebuildable at any time. */
export interface CacheStore {
	/** Every stored record (read once at start to learn what is fresh). */
	all(): Promise<CacheRecord[]>;
	putMany(records: readonly CacheRecord[]): Promise<void>;
	deleteMany(paths: readonly string[]): Promise<void>;
	clear(): Promise<void>;
	close(): void;
}

const STORE = 'previews';

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
	});
}
function done(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
		tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
	});
}

/** Open (or create) the cache database `name`. */
export async function openIndexedDbCache(factory: IDBFactory, name: string): Promise<CacheStore> {
	const open = factory.open(name, 1);
	open.onupgradeneeded = () => {
		if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'path' });
	};
	const db = await request(open);
	// Another tab or an upgrade asking to replace the database must not be blocked by this connection.
	db.onversionchange = () => db.close();
	return {
		async all() {
			return (await request(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())) as CacheRecord[];
		},
		async putMany(records) {
			if (!records.length) return;
			const tx = db.transaction(STORE, 'readwrite');
			const store = tx.objectStore(STORE);
			for (const record of records) store.put(record);
			await done(tx);
		},
		async deleteMany(paths) {
			if (!paths.length) return;
			const tx = db.transaction(STORE, 'readwrite');
			const store = tx.objectStore(STORE);
			for (const path of paths) store.delete(path);
			await done(tx);
		},
		async clear() {
			const tx = db.transaction(STORE, 'readwrite');
			tx.objectStore(STORE).clear();
			await done(tx);
		},
		close() {
			db.close();
		},
	};
}

/** Cache that lives only as long as the session (used when IndexedDB is unavailable, and in tests). */
export function createMemoryCache(): CacheStore {
	const records = new Map<string, CacheRecord>();
	return {
		all: () => Promise.resolve([...records.values()]),
		putMany(batch) {
			for (const record of batch) records.set(record.path, record);
			return Promise.resolve();
		},
		deleteMany(paths) {
			for (const path of paths) records.delete(path);
			return Promise.resolve();
		},
		clear() {
			records.clear();
			return Promise.resolve();
		},
		close() {
			records.clear();
		},
	};
}
