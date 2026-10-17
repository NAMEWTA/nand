// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { CACHE_VERSION, isFresh, staleProcessors, type CacheRecord } from '../core/cache';
import { LruMap } from '../core/lru';
import { cleanPreview, firstImageLink, isImageExtension } from '../core/preview';
import type { CacheStore } from './cache-store';

/** What the store needs to know about the vault; the Obsidian adapter implements it. */
export interface PreviewSource {
	/** Current mtime, or undefined when the file no longer exists. */
	mtime(path: string): number | undefined;
	isMarkdown(path: string): boolean;
	/** Note text, or null if it cannot be read. */
	readText(path: string): Promise<string | null>;
	/** The first frontmatter image link among `properties`, if the note has one. */
	propertyImage(path: string, properties: readonly string[]): string | undefined;
	/** Vault path of the image a link points to, or null. */
	resolveImage(link: string, fromPath: string): string | null;
	/** Display title used to drop a duplicated first heading. */
	title(path: string): string;
	/** True once Obsidian has parsed the note's metadata; frontmatter-based answers are only final then. */
	metadataReady: (path: string) => boolean;
}

export interface Scheduler {
	now(): number;
	/** Give the UI a turn: resolves on the next idle moment or timer tick. */
	yield(): Promise<void>;
	/** Run `callback` after `ms`; returns a cancel function. */
	later(callback: () => void, ms: number): () => void;
}

export interface PreviewStoreOptions {
	cache: CacheStore;
	source: PreviewSource;
	scheduler: Scheduler;
	imageProperties: () => readonly string[];
	/** Most records kept in memory. */
	capacity?: number;
	/** Longest stretch of work before yielding to the UI, in ms. */
	slice?: number;
	onError?: (error: unknown) => void;
}

const SCAN_LIMIT = 60_000;
const WRITE_BATCH = 120;

/** `imageMtime` of a record whose image was found before the note's metadata was parsed: always stale. */
const IMAGE_UNRESOLVED = -1;

/**
 * Previews and feature images for notes. Records live in an in-memory LRU backed by one persistent store;
 * rows ask for what they show (`request`), and a background pass fills in the rest. A record is reused
 * as long as the file's mtime and the image settings it was built with are unchanged. A note that changes
 * while it is being read is processed again, and an image found before the metadata cache knew the note
 * stays stale until `enqueue` runs for it again (the runtime does that when the metadata arrives).
 */
export class PreviewStore {
	private readonly lru: LruMap<string, CacheRecord>;
	private readonly urgent: string[] = [];
	private readonly background: string[] = [];
	private readonly queued = new Set<string>();
	private readonly redo = new Set<string>();
	private readonly dirty = new Map<string, CacheRecord>();
	private readonly listeners = new Set<() => void>();
	private inflight: string | undefined;
	private running = false;
	private disposed = false;
	private cancelNotify: (() => void) | undefined;
	private cancelFlush: (() => void) | undefined;
	private generation = 0;
	private versionValue = 0;

	constructor(private readonly options: PreviewStoreOptions) {
		this.lru = new LruMap(options.capacity ?? 20_000);
	}

	get version(): number {
		return this.versionValue;
	}

	/** Read the persistent records into memory; call once before requesting anything. */
	async load(): Promise<void> {
		try {
			for (const record of await this.options.cache.all()) if (record.version === CACHE_VERSION && !this.lru.has(record.path)) this.lru.set(record.path, record);
		} catch (error) {
			this.options.onError?.(error);
		}
		this.bump();
	}

	/** The cached record (possibly stale while a refresh is queued). */
	get(path: string): CacheRecord | undefined {
		return this.lru.peek(path);
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** A visible row needs `path`: process it ahead of the background pass if it is missing or stale. */
	request(path: string): void {
		if (this.disposed) return;
		const mtime = this.options.source.mtime(path);
		if (mtime === undefined || isFresh(this.lru.peek(path), mtime, this.signature())) return;
		if (path === this.inflight) {
			this.redo.add(path);
			return;
		}
		if (this.queued.has(path)) {
			const index = this.background.indexOf(path);
			if (index < 0) return;
			this.background.splice(index, 1);
		} else this.queued.add(path);
		this.urgent.push(path);
		void this.pump();
	}

	/** Queue every path that is not fresh for the idle pass. */
	enqueue(paths: Iterable<string>): void {
		if (this.disposed) return;
		const signature = this.signature();
		for (const path of paths) {
			const mtime = this.options.source.mtime(path);
			if (mtime === undefined || isFresh(this.lru.peek(path), mtime, signature)) continue;
			if (path === this.inflight) this.redo.add(path);
			else if (!this.queued.has(path)) {
				this.queued.add(path);
				this.background.push(path);
			}
		}
		void this.pump();
	}

	/** Files left to process (background, visible and the one being read). */
	get pending(): number {
		return this.queued.size + (this.inflight === undefined ? 0 : 1);
	}

	remove(path: string): void {
		this.lru.delete(path);
		this.dirty.delete(path);
		this.redo.delete(path);
		void this.options.cache.deleteMany([path]).catch((error: unknown) => this.options.onError?.(error));
		this.bump();
	}

	rename(oldPath: string, newPath: string): void {
		const record = this.lru.peek(oldPath);
		this.remove(oldPath);
		if (record) {
			const moved = { ...record, path: newPath };
			this.lru.set(newPath, moved);
			this.dirty.set(newPath, moved);
			this.scheduleFlush();
		}
	}

	/** Empty the memory and the persistent store (which stays open and usable) so previews are rebuilt from the notes. */
	async clear(): Promise<void> {
		this.generation++;
		this.urgent.length = 0;
		this.background.length = 0;
		this.queued.clear();
		this.redo.clear();
		this.dirty.clear();
		this.lru.clear();
		await this.options.cache.clear();
		this.bump();
	}

	/** Stop work and cancel timers; resolves once the last records are written. */
	async dispose(): Promise<void> {
		this.disposed = true;
		this.generation++;
		this.cancelNotify?.();
		this.cancelFlush?.();
		this.cancelNotify = this.cancelFlush = undefined;
		this.listeners.clear();
		this.urgent.length = 0;
		this.background.length = 0;
		this.queued.clear();
		this.redo.clear();
		await this.flush();
	}

	private signature(): string {
		return this.options.imageProperties().join('\u0001');
	}

	private async pump(): Promise<void> {
		if (this.running || this.disposed) return;
		this.running = true;
		const generation = this.generation;
		const { scheduler, source } = this.options;
		let sliceStart = scheduler.now();
		try {
			while (!this.disposed && generation === this.generation) {
				const path = this.urgent.pop() ?? this.background.shift();
				if (path === undefined) break;
				this.queued.delete(path);
				this.inflight = path;
				let processed: number | undefined;
				try {
					processed = await this.process(path, generation);
				} catch (error) {
					this.options.onError?.(error);
				}
				if (generation !== this.generation) break;
				this.inflight = undefined;
				const current = source.mtime(path);
				if (this.redo.delete(path) || (processed !== undefined && current !== undefined && current !== processed)) {
					this.queued.add(path);
					this.urgent.push(path);
				}
				if (this.dirty.size >= WRITE_BATCH) void this.flush();
				if (scheduler.now() - sliceStart >= (this.options.slice ?? 10)) {
					this.scheduleNotify();
					await scheduler.yield();
					sliceStart = scheduler.now();
				}
			}
		} finally {
			this.running = false;
			if (generation !== this.generation) {
				this.inflight = undefined;
				// A refresh asked for the path this worker was reading belongs to the new generation.
				for (const path of this.redo) {
					if (this.queued.has(path)) continue;
					this.queued.add(path);
					this.background.push(path);
				}
				this.redo.clear();
			}
		}
		if (this.disposed) return;
		if (generation === this.generation) {
			this.scheduleNotify();
			void this.flush();
		}
		// Work queued for a newer generation while this worker was winding down needs its own worker.
		if (this.urgent.length || this.background.length) void this.pump();
	}

	/** Returns the mtime the record was built for, or undefined when nothing was stored. */
	private async process(path: string, generation: number): Promise<number | undefined> {
		const { source } = this.options;
		const mtime = source.mtime(path);
		if (mtime === undefined) return undefined;
		const signature = this.signature();
		const old = this.lru.peek(path);
		const stale = staleProcessors(old, mtime, signature);
		if (!stale.content && !stale.image) return mtime;
		let preview = old?.version === CACHE_VERSION ? old.preview : '';
		let image = old?.version === CACHE_VERSION ? old.image : null;
		let imageMtime = mtime;
		if (source.isMarkdown(path)) {
			const text = (await source.readText(path))?.slice(0, SCAN_LIMIT);
			if (generation !== this.generation || source.mtime(path) === undefined || text === undefined) return undefined;
			if (stale.content) preview = cleanPreview(text, source.title(path));
			if (stale.image) {
				const ready = source.metadataReady(path);
				const link = (ready ? source.propertyImage(path, this.options.imageProperties()) : undefined) ?? firstImageLink(text)?.link;
				image = link ? source.resolveImage(link, path) : null;
				if (!ready) imageMtime = IMAGE_UNRESOLVED;
			}
		} else if (isImageExtension(path.slice(path.lastIndexOf('.') + 1))) {
			image = path;
			preview = '';
		}
		if (generation !== this.generation) return undefined;
		const record: CacheRecord = { path, version: CACHE_VERSION, contentMtime: mtime, imageMtime, imageSig: signature, preview, image };
		this.lru.set(path, record);
		this.dirty.set(path, record);
		return mtime;
	}

	private async flush(): Promise<void> {
		if (!this.dirty.size) return;
		const batch = [...this.dirty.values()];
		this.dirty.clear();
		try {
			await this.options.cache.putMany(batch);
		} catch (error) {
			this.options.onError?.(error);
		}
	}

	private scheduleFlush(): void {
		if (this.cancelFlush || this.disposed) return;
		this.cancelFlush = this.options.scheduler.later(() => {
			this.cancelFlush = undefined;
			void this.flush();
		}, 400);
	}

	private scheduleNotify(): void {
		if (this.cancelNotify || this.disposed) return;
		this.cancelNotify = this.options.scheduler.later(() => {
			this.cancelNotify = undefined;
			this.bump();
		}, 50);
	}

	private bump(): void {
		this.versionValue++;
		for (const listener of [...this.listeners]) listener();
	}
}
