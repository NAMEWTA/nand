// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/rss-store.ts
import type { App } from 'obsidian';
import { DurableState, ensureDirectory } from '../../../../shared/storage/durable-state';
import { privateVaultStorage } from '../../../../host/obsidian/storage/private-storage';
import type { TextStorage } from '../../../../shared/storage/ports';
import {
	emptyFile,
	normalizeRssFile,
	MAX_ITEMS_PER_FEED,
	type RssFeedCacheEntry,
	type RssStoreFile,
} from '../../core/rss/rss-model';
const ROOT = '.nand/cache/rss';
export const RSS_PATH = `${ROOT}/rss.json`;
export const FEED_TTL_MS = 30 * 60000;
export const FEED_ERROR_TTL_MS = 5 * 60000;
function decode(raw: unknown): RssStoreFile {
	if (
		!raw ||
		typeof raw !== 'object' ||
		!('version' in raw) ||
		raw.version !== 1 ||
		!('feeds' in raw) ||
		!('readGuids' in raw) ||
		!('savedGuids' in raw) ||
		!('webCache' in raw)
	)
		throw new Error('Invalid RSS store');
	return normalizeRssFile(raw);
}
export class RssStore {
	private readonly state: DurableState<RssStoreFile>;
	private readonly listeners = new Set<() => void>();
	private retention = 180;
	private closed = false;
	constructor(app: App) {
		const disk = privateVaultStorage(app);
		const port: TextStorage = {
			exists: (p) => disk.exists(p),
			read: (p) => disk.read(p),
			write: (p, s) => disk.write(p, s),
			mkdir: (p) => disk.mkdir(p),
			updateAtomically: async (path, update) => {
				await ensureDirectory(disk, ROOT);
				if (await disk.exists(path)) return app.vault.adapter.process(path, (text) => update(text));
				const text = update(null);
				await disk.write(path, text);
				return text;
			},
		};
		this.state = new DurableState(port, RSS_PATH, emptyFile, decode, () => {
			for (const cb of this.listeners) cb();
		});
	}
	get saveState() {
		return this.state.state;
	}
	setRetention(days: number): void {
		this.retention = Math.max(0, days);
	}
	subscribe(cb: () => void): () => void {
		this.listeners.add(cb);
		return () => this.listeners.delete(cb);
	}
	async load(): Promise<void> {
		await this.state.load();
		if (this.state.state.error) throw new Error(this.state.state.error);
	}
	reloadFromDisk(): Promise<void> {
		return this.state.sync(true);
	}
	feedEntry(url: string): RssFeedCacheEntry | undefined {
		return this.state.value.feeds[url];
	}
	isStale(url: string, now = Date.now()): boolean {
		const e = this.feedEntry(url);
		return !e || now - e.fetchedAt >= (e.error ? FEED_ERROR_TTL_MS : FEED_TTL_MS);
	}
	private edit(change: (file: RssStoreFile) => void): void {
		if (this.closed) return;
		change(this.state.value);
		this.state.save();
	}
	setFeed(url: string, entry: RssFeedCacheEntry): void {
		this.edit((file) => {
			file.feeds[url] = { ...entry, items: entry.items.slice(0, MAX_ITEMS_PER_FEED) };
			for (const old of Object.keys(file.feeds)
				.sort((a, b) => file.feeds[b]!.fetchedAt - file.feeds[a]!.fetchedAt)
				.slice(100))
				delete file.feeds[old];
			for (const [guid, value] of Object.entries(file.webCache))
				if (Date.now() - value.fetchedAt > 30 * 86400000) delete file.webCache[guid];
			if (this.retention)
				for (const [guid, ts] of Object.entries(file.readGuids))
					if (Date.now() - ts > this.retention * 86400000) delete file.readGuids[guid];
		});
	}
	isRead(guid: string): boolean {
		return this.state.value.readGuids[guid] !== undefined;
	}
	markRead(guid: string): void {
		this.markAllRead([guid]);
	}
	markAllRead(guids: readonly string[]): void {
		this.edit((file) => {
			for (const guid of guids) file.readGuids[guid] ??= Date.now();
		});
	}
	savedPath(guid: string): string | undefined {
		return this.state.value.savedGuids[guid];
	}
	setSaved(guid: string, path: string): void {
		this.edit((file) => {
			file.savedGuids[guid] = path;
		});
	}
	clearSaved(guid: string): void {
		this.edit((file) => {
			delete file.savedGuids[guid];
		});
	}
	cachedWeb(guid: string): string | undefined {
		return this.state.value.webCache[guid]?.markdown;
	}
	setCachedWeb(guid: string, markdown: string): void {
		this.edit((file) => {
			file.webCache[guid] = { markdown, fetchedAt: Date.now() };
		});
	}
	flush(): Promise<void> {
		return this.state.flush();
	}
	retry(): void {
		this.state.save();
	}
	async destroy(): Promise<void> {
		this.closed = true;
		this.listeners.clear();
		await this.state.shutdown();
	}
}
const stores = new WeakMap<App, RssStore>();
export function getRssStore(app: App): RssStore {
	let store = stores.get(app);
	if (!store) {
		store = new RssStore(app);
		stores.set(app, store);
	}
	return store;
}
export async function closeRssStore(app: App): Promise<void> {
	const store = stores.get(app);
	stores.delete(app);
	await store?.destroy();
}
