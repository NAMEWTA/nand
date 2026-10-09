import { locateAnchor, makeAnchor } from './anchor';
import type { CommentFileDoc, CommentIndex, CommentMessage, CommentThread, NewCommentInput } from './model';

const ROOT = '.nand/editor/comments';
const INDEX_PATH = `${ROOT}/index.json`;
const FILES_DIR = `${ROOT}/files`;
const PENDING_PATH = `${ROOT}/pending.json`;

interface CommentWrite {
	index: CommentIndex;
	files: Record<string, string>;
	remove: string[];
}

const DEFAULT_DEBOUNCE_MS = 300;

export interface CommentFs {
	read(path: string): Promise<string>;
	write(path: string, data: string): Promise<void>;
	remove(path: string): Promise<void>;
	exists(path: string): Promise<boolean>;
}

/** Minimal ChangeSet stand-in so the store does not import CodeMirror. */
export interface PosMapper {
	mapPos(pos: number, assoc?: number): number;
}

/** Debounce timers, injected so the host decides which window owns them. */
export interface CommentTimers {
	set(callback: () => void, ms: number): unknown;
	clear(handle: unknown): void;
}

export interface CommentStoreOptions {
	timers: CommentTimers;
	debounceMs?: number;
	onError?: (error: unknown) => void;
}

function filePath(hash: string): string {
	return `${FILES_DIR}/${hash}.json`;
}

function nowIso(): string {
	return new Date().toISOString();
}

function nid(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function sha16(path: string): Promise<string> {
	const data = new TextEncoder().encode(path);
	const buf = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(buf)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
		.slice(0, 16);
}

function emptyIndex(): CommentIndex {
	return { version: 1, files: {} };
}

function asRecord(raw: unknown): Record<string, unknown> | null {
	return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
}

function normalizeMessage(raw: unknown): CommentMessage | null {
	const rec = asRecord(raw);
	if (!rec) return null;
	if (typeof rec['id'] !== 'string' || typeof rec['text'] !== 'string' || typeof rec['ts'] !== 'string') return null;
	return { id: rec['id'], text: rec['text'], ts: rec['ts'] };
}

function normalizeThread(raw: unknown, path: string): CommentThread | null {
	const rec = asRecord(raw);
	if (!rec || typeof rec['id'] !== 'string') return null;
	const status = rec['status'];
	if (status !== 'open' && status !== 'resolved' && status !== 'orphaned') return null;
	const target = asRecord(rec['target']);
	const quote = target ? asRecord(target['quote']) : null;
	if (!target || !quote) return null;
	if (
		typeof quote['exact'] !== 'string' ||
		typeof quote['prefix'] !== 'string' ||
		typeof quote['suffix'] !== 'string'
	) {
		return null;
	}
	if (typeof target['start'] !== 'number' || typeof target['end'] !== 'number') return null;
	if (!Array.isArray(rec['thread'])) return null;
	const messages = rec['thread'].map(normalizeMessage);
	if (messages.some((message) => message === null)) return null;
	return {
		id: rec['id'],
		status,
		target: {
			path: typeof target['path'] === 'string' ? target['path'] : path,
			quote: { exact: quote['exact'], prefix: quote['prefix'], suffix: quote['suffix'] },
			start: target['start'],
			end: target['end'],
		},
		thread: messages as CommentMessage[],
		createdAt: typeof rec['createdAt'] === 'string' ? rec['createdAt'] : nowIso(),
		updatedAt: typeof rec['updatedAt'] === 'string' ? rec['updatedAt'] : nowIso(),
	};
}

function normalizeFile(raw: unknown, path: string): CommentThread[] {
	const rec = asRecord(raw);
	if (!rec || rec['version'] !== 1 || !Array.isArray(rec['comments'])) throw new Error('Invalid comment sidecar');
	const threads = rec['comments'].map((item) => normalizeThread(item, path));
	if (threads.some((thread) => thread === null)) throw new Error('Invalid comment thread');
	return threads as CommentThread[];
}

function normalizeIndex(raw: unknown): CommentIndex {
	const out = emptyIndex();
	const rec = asRecord(raw);
	const files = rec ? asRecord(rec['files']) : null;
	if (!files || rec?.['version'] !== 1) throw new Error('Invalid comment index');
	for (const [path, value] of Object.entries(files)) {
		const entry = asRecord(value);
		if (!entry || typeof entry['hash'] !== 'string' || !/^[a-f0-9]{16}$/.test(entry['hash']))
			throw new Error('Invalid comment index entry');
		out.files[path] = {
			hash: entry['hash'],
			open: typeof entry['open'] === 'number' ? entry['open'] : 0,
			total: typeof entry['total'] === 'number' ? entry['total'] : 0,
			updatedAt: typeof entry['updatedAt'] === 'string' ? entry['updatedAt'] : nowIso(),
		};
	}
	return out;
}

/**
 * Sidecar comment index under the vault `.nand/editor/` folder.
 * Mutations for one store are serialized. Disk writes are debounced.
 */
export class CommentStore {
	revision = 0;
	focusedId: string | null = null;

	private readonly debounceMs: number;
	private index: CommentIndex | null = null;
	private readonly cache = new Map<string, CommentThread[]>();
	/** Paths whose quotes have been checked against the current document. */
	private readonly reconciled = new Set<string>();
	private readonly dirty = new Map<string, number>();
	private change = 0;
	private readonly obsolete = new Set<string>();
	private transaction: { write: CommentWrite; versions: Map<string, number>; removals: string[] } | null = null;
	private readonly onError?: (error: unknown) => void;
	private indexDirty = false;
	private readonly timers: CommentTimers;
	private timer: unknown = null;
	private flushing = false;
	private chain: Promise<void> = Promise.resolve();
	private readonly listeners = new Set<() => void>();
	private closed = false;
	private closing: Promise<void> | null = null;

	constructor(
		private readonly fs: CommentFs,
		opts: CommentStoreOptions,
	) {
		this.timers = opts.timers;
		this.debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
		this.onError = opts.onError;
	}

	subscribe(cb: () => void): () => void {
		this.listeners.add(cb);
		return () => {
			this.listeners.delete(cb);
		};
	}

	/** Force open editors and the side panel to redraw (settings toggles). */
	notify(): void {
		this.emit();
	}

	focus(id: string | null): void {
		this.focusedId = id;
		this.emit();
	}

	/** Notes that have comments, with their open and total thread counts (from the sidecar index). */
	async listFiles(): Promise<Array<{ path: string; open: number; total: number; updatedAt: string }>> {
		const index = await this.enqueue(() => this.readIndex(), true);
		const rows = new Map(Object.entries(index.files).map(([path, entry]) => [path, { open: entry.open, total: entry.total, updatedAt: entry.updatedAt }]));
		// Loaded notes may have changes the debounced index write has not recorded yet.
		for (const [path, threads] of this.cache) {
			if (!threads.length) rows.delete(path);
			else rows.set(path, {
				open: threads.filter((thread) => thread.status === 'open').length,
				total: threads.length,
				updatedAt: threads.reduce((latest, thread) => (thread.updatedAt > latest ? thread.updatedAt : latest), ''),
			});
		}
		return [...rows].filter(([, row]) => row.total > 0).map(([path, row]) => ({ path, ...row }));
	}

	threadsFor(path: string): readonly CommentThread[] {
		return this.cache.get(path) ?? [];
	}

	/** True after this path has been read (including an empty sidecar). */
	isLoaded(path: string): boolean {
		return this.cache.has(path);
	}

	loadFile(path: string): Promise<CommentThread[]> {
		return this.enqueue(async () => {
			const threads = await this.readThreads(path);
			return threads.map((thread) => structuredClone(thread));
		});
	}

	add(path: string, input: NewCommentInput): Promise<CommentThread> {
		return this.enqueue(async () => {
			const threads = await this.readThreads(path);
			const now = nowIso();
			const thread: CommentThread = {
				id: nid('c'),
				status: 'open',
				target: {
					path,
					quote: input.quote,
					start: input.start,
					end: input.end,
				},
				thread: [{ id: nid('m'), ts: now, text: input.text }],
				createdAt: now,
				updatedAt: now,
			};
			threads.push(thread);
			this.reconciled.add(path);
			this.markDirty(path);
			this.emit();
			return thread;
		});
	}

	reply(id: string, text: string): Promise<CommentThread> {
		return this.enqueue(async () => {
			const found = await this.locate(id);
			if (!found) throw new Error(`Comment not found: ${id}`);
			const now = nowIso();
			found.thread.thread.push({ id: nid('m'), ts: now, text });
			found.thread.updatedAt = now;
			this.markDirty(found.path);
			this.emit();
			return found.thread;
		});
	}

	resolve(id: string): Promise<void> {
		return this.setStatus(id, 'resolved');
	}

	reopen(id: string): Promise<void> {
		return this.setStatus(id, 'open');
	}

	remove(id: string): Promise<void> {
		return this.enqueue(async () => {
			const found = await this.locate(id);
			if (!found) return;
			const idx = found.threads.findIndex((thread) => thread.id === id);
			if (idx >= 0) found.threads.splice(idx, 1);
			if (this.focusedId === id) this.focusedId = null;
			this.markDirty(found.path);
			this.emit();
		});
	}

	reanchor(id: string, next: { quote: NewCommentInput['quote']; start: number; end: number }): Promise<void> {
		return this.enqueue(async () => {
			const found = await this.locate(id);
			if (!found) return;
			found.thread.target = {
				path: found.thread.target.path,
				quote: next.quote,
				start: next.start,
				end: next.end,
			};
			found.thread.status = 'open';
			found.thread.updatedAt = nowIso();
			this.markDirty(found.path);
			this.emit();
		});
	}

	/**
	 * Follow an edit with ChangeSet.mapPos. Quote text is refreshed from the
	 * new document. Nothing is written until the debounce fires.
	 * No-ops until {@link reconcile} has run for this path, so a keystroke
	 * during the initial load cannot drag a stale offset.
	 */
	applyChanges(path: string | null, mapper: PosMapper, doc: string): void {
		if (this.closed || !path || !this.reconciled.has(path)) return;
		const threads = this.cache.get(path);
		if (!threads || threads.length === 0) return;
		let changed = false;
		for (const thread of threads) {
			if (thread.status === 'orphaned') continue;
			const start = mapper.mapPos(thread.target.start, 1);
			const end = mapper.mapPos(thread.target.end, -1);
			if (end <= start) {
				thread.status = 'orphaned';
				thread.updatedAt = nowIso();
				changed = true;
				continue;
			}
			const exact = doc.slice(start, end);
			if (!exact) {
				thread.status = 'orphaned';
				thread.updatedAt = nowIso();
				changed = true;
				continue;
			}
			if (start === thread.target.start && end === thread.target.end && exact === thread.target.quote.exact) {
				continue;
			}
			thread.target.start = start;
			thread.target.end = end;
			thread.target.quote = makeAnchor(doc, start, end);
			thread.updatedAt = nowIso();
			changed = true;
		}
		if (!changed) return;
		this.markDirty(path);
		this.emit();
	}

	/** Relocate open threads against `doc`. Failures become `orphaned` and are not guessed. */
	reconcile(path: string, doc: string): void {
		void this.enqueue(async () => {
			const threads = await this.readThreads(path);
			let changed = false;
			for (const thread of threads) {
				if (thread.status === 'orphaned') continue;
				const located = locateAnchor(doc, thread.target.quote, thread.target.start, thread.target.end);
				if (!located) {
					thread.status = 'orphaned';
					thread.updatedAt = nowIso();
					changed = true;
					continue;
				}
				if (thread.target.start !== located.start || thread.target.end !== located.end) {
					thread.target.start = located.start;
					thread.target.end = located.end;
					changed = true;
				}
			}
			this.reconciled.add(path);
			if (changed) {
				this.markDirty(path);
				this.emit();
			}
		});
	}

	renamePath(oldPath: string, newPath: string): Promise<void> {
		return this.enqueue(async () => {
			if (oldPath === newPath) return;
			const threads = await this.readThreads(oldPath);
			for (const thread of threads) thread.target.path = newPath;
			this.cache.delete(oldPath);
			this.cache.set(newPath, threads);
			if (this.reconciled.delete(oldPath)) this.reconciled.add(newPath);
			const index = await this.readIndex();
			const prev = index.files[oldPath];
			delete index.files[oldPath];
			if (prev) {
				const nextHash = await sha16(newPath);
				if (prev.hash !== nextHash) {
					this.obsolete.add(filePath(prev.hash));
				}
			}
			this.dirty.delete(oldPath);
			this.markDirty(newPath);
			await this.writeDirty();
		});
	}

	deletePath(path: string): Promise<void> {
		return this.enqueue(async () => {
			const index = await this.readIndex();
			const prev = index.files[path];
			delete index.files[path];
			this.cache.delete(path);
			this.reconciled.delete(path);
			this.dirty.delete(path);
			if (prev) this.obsolete.add(filePath(prev.hash));
			this.indexDirty = true;
			await this.writeDirty();
			this.emit();
		});
	}

	flush(): Promise<void> {
		if (this.timer != null) {
			this.timers.clear(this.timer);
			this.timer = null;
		}
		return this.enqueue(() => this.writeDirty(), true);
	}

	/** Seal synchronously, then drain accepted work. A failed drain remains retryable. */
	close(): Promise<void> {
		this.closed = true;
		this.dispose();
		if (this.closing) return this.closing;
		const run = this.flush();
		this.closing = run;
		void run.then(
			() => { if (this.closing === run) this.closing = null; },
			() => { if (this.closing === run) this.closing = null; },
		);
		return run;
	}

	dispose(): void {
		if (this.timer != null) this.timers.clear(this.timer);
		this.timer = null;
		this.listeners.clear();
	}

	private setStatus(id: string, status: 'open' | 'resolved'): Promise<void> {
		return this.enqueue(async () => {
			const found = await this.locate(id);
			if (!found || found.thread.status === 'orphaned') return;
			found.thread.status = status;
			found.thread.updatedAt = nowIso();
			this.markDirty(found.path);
			this.emit();
		});
	}

	private async locate(
		id: string,
	): Promise<{ path: string; thread: CommentThread; threads: CommentThread[] } | null> {
		for (const [path, threads] of this.cache) {
			const thread = threads.find((item) => item.id === id);
			if (thread) return { path, thread, threads };
		}
		const index = await this.readIndex();
		for (const path of Object.keys(index.files)) {
			if (this.cache.has(path)) continue;
			const threads = await this.readThreads(path);
			const thread = threads.find((item) => item.id === id);
			if (thread) return { path, thread, threads };
		}
		return null;
	}

	private async readThreads(path: string): Promise<CommentThread[]> {
		const cached = this.cache.get(path);
		if (cached) return cached;
		const meta = (await this.readIndex()).files[path];
		// A referenced but missing sidecar is a damaged store, not an empty note.
		const threads = meta ? normalizeFile(JSON.parse(await this.fs.read(filePath(meta.hash))), path) : [];
		this.cache.set(path, threads);
		return threads;
	}

	private async readIndex(): Promise<CommentIndex> {
		if (this.index) return this.index;
		if (await this.fs.exists(PENDING_PATH)) {
			const raw = JSON.parse(await this.fs.read(PENDING_PATH)) as CommentWrite;
			normalizeIndex(raw.index);
			if (
				!raw.files ||
				!Array.isArray(raw.remove) ||
				[...Object.keys(raw.files), ...raw.remove].some(
					(path) => !/^\.nand\/editor\/comments\/files\/[a-f0-9]{16}\.json$/.test(path),
				)
			)
				throw new Error('Invalid pending comment write');
			for (const body of Object.values(raw.files)) normalizeFile(JSON.parse(body), '');
			await this.persist(raw);
		}
		// exists failures and read/parse failures propagate; only confirmed absence is empty.
		this.index = (await this.fs.exists(INDEX_PATH))
			? normalizeIndex(JSON.parse(await this.fs.read(INDEX_PATH)))
			: emptyIndex();
		return this.index;
	}

	private markDirty(path: string): void {
		this.dirty.set(path, ++this.change);
		this.indexDirty = true;
		if (this.closed || this.flushing || this.timer != null) return;
		this.timer = this.timers.set(() => {
			this.timer = null;
			void this.enqueue(() => this.writeDirty());
		}, this.debounceMs);
	}

	private async persist(write: CommentWrite): Promise<void> {
		for (const [path, body] of Object.entries(write.files)) await this.fs.write(path, body);
		await this.fs.write(INDEX_PATH, JSON.stringify(write.index, null, 2));
		// The journal remains until cleanup succeeds, so interrupted renames replay safely.
		for (const path of write.remove) if (await this.fs.exists(path)) await this.fs.remove(path);
		await this.fs.remove(PENDING_PATH);
	}

	private async commitTransaction(): Promise<void> {
		const tx = this.transaction;
		if (!tx) return;
		await this.persist(tx.write);
		this.index = tx.write.index;
		for (const [path, version] of tx.versions) if (this.dirty.get(path) === version) this.dirty.delete(path);
		for (const path of tx.removals) this.obsolete.delete(path);
		this.indexDirty = this.dirty.size > 0;
		this.transaction = null;
	}

	private async writeDirty(): Promise<void> {
		this.flushing = true;
		try {
			await this.commitTransaction();
			while (this.dirty.size > 0 || this.indexDirty) {
				const index = structuredClone(await this.readIndex());
				const versions = new Map(this.dirty);
				const snapshots = [...versions.keys()].map((path) => ({
					path,
					threads: structuredClone(this.cache.get(path) ?? []),
				}));
				const files: Record<string, string> = {};
				const removals = new Set(this.obsolete);
				for (const { path, threads } of snapshots) {
					if (threads.length === 0) {
						if (index.files[path]) removals.add(filePath(index.files[path].hash));
						delete index.files[path];
						continue;
					}
					const hash = await sha16(path);
					index.files[path] = {
						hash,
						open: threads.filter((t) => t.status === 'open').length,
						total: threads.length,
						updatedAt: nowIso(),
					};
					const body: CommentFileDoc = { version: 1, path, comments: threads };
					files[filePath(hash)] = JSON.stringify(body, null, 2);
				}
				const referenced = new Set(Object.values(index.files).map((entry) => filePath(entry.hash)));
				const write: CommentWrite = {
					index,
					files,
					remove: [...removals].filter((path) => !referenced.has(path)),
				};
				// Save recoverable intent before replacing any existing data.
				await this.fs.write(PENDING_PATH, JSON.stringify(write));
				this.transaction = { write, versions, removals: [...removals] };
				await this.commitTransaction();
			}
		} finally {
			this.flushing = false;
		}
	}

	private emit(): void {
		this.revision += 1;
		for (const cb of this.listeners) cb();
	}

	private enqueue<T>(fn: () => Promise<T>, allowClosed = false): Promise<T> {
		if (this.closed && !allowClosed) {
			const rejected = Promise.reject<T>(new Error('Comment store is closed'));
			void rejected.catch(() => undefined);
			return rejected;
		}
		const execute = async () => {
			await this.commitTransaction();
			return fn();
		};
		const run = this.chain.then(execute, execute);
		// Report background failures and attach a rejection handler even for fire-and-forget callers.
		void run.catch((error: unknown) => this.onError?.(error));
		this.chain = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}
}
