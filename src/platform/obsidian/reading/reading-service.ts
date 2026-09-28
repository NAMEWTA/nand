import { Notice } from 'obsidian';
import { t } from '../../../shared/i18n/index';
import { playDing, unlockChime } from '../audio/chime';
import type { WidgetSettingsHost } from '../settings-host';

export type ReadingStatus = 'idle' | 'running' | 'paused';

export interface ReadingState {
	status: ReadingStatus;
	elapsedSeconds: number;
	currentBook: BookInfo | null;
}

export interface BookInfo {
	title: string;
	author: string;
	coverUrl: string;
	isbn: string;
	source: 'google' | 'manual';
	currentPage: number;
	totalPages: number;
	finished: boolean;
}

export interface ReadingRecord {
	timestamp: string;
	bookTitle: string;
	bookAuthor: string;
	coverUrl: string;
	durationSeconds: number;
	isbn: string;
	startPage: number;
	endPage: number;
	finished: boolean;
}

export interface ReadingDayRecord {
	date: string;
	records: ReadingRecord[];
}

interface ReadingData {
	activeBooks: BookInfo[];
	sessions: ReadingDayRecord[];
}

export const DATA_FILE = 'reading.json';
const MAX_SESSION_DAYS = 730;

/** Identity of an active book shelf entry. */
function bookKey(b: BookInfo): string {
	return `${b.title}\0${b.isbn}`;
}

/** Union of two datasets, `session` winning per-record conflicts: day
 *  records merge by date with entries deduped by timestamp, the active-book
 *  shelf by title+isbn. Used by the save-time merge and the focus-time
 *  re-sync so concurrent writers (another device through file sync, another
 *  view in-process) never silently drop each other's sessions. */
function mergeData(disk: ReadingData, session: ReadingData): ReadingData {
	const byDate = new Map(disk.sessions.map((s) => [s.date, s] as const));
	for (const s of session.sessions) {
		const existing = byDate.get(s.date);
		if (!existing) {
			byDate.set(s.date, s);
			continue;
		}
		const byTs = new Map(existing.records.map((r) => [r.timestamp, r] as const));
		for (const r of s.records) byTs.set(r.timestamp, r);
		byDate.set(s.date, {
			date: s.date,
			records: [...byTs.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
		});
	}
	const shelf = new Map(disk.activeBooks.map((b) => [bookKey(b), b] as const));
	for (const b of session.activeBooks) shelf.set(bookKey(b), b);
	return {
		activeBooks: [...shelf.values()],
		sessions: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
	};
}

export class ReadingService {
	private status: ReadingStatus = 'idle';
	private startedAt = 0;
	private pausedElapsed = 0;
	private currentBook: BookInfo | null = null;
	private tickInterval: number | null = null;
	private readonly tickListeners = new Set<() => void>();
	private activeBooks: BookInfo[] = [];
	private sessions: ReadingDayRecord[] = [];
	private loaded = false;
	private loadFailed = false;
	/** Raw file content of this instance's last successful write; a disk read
	 *  that differs means an external writer (sync / another view) intervened
	 *  and the next write must merge instead of clobber. */
	private lastWritten: string | null = null;
	private listeners = new Set<() => void>();
	private syncInFlight = false;

	private focusDoc: Document | null = null;
	private focusHandler = (): void => {
		if (this.focusDoc?.visibilityState === 'visible') void this.syncFromDisk();
	};

	constructor(private plugin: WidgetSettingsHost) {
		// Data files only ever load at startup; without re-reading, a session
		// open all day never sees another device's records and its next save
		// clobbers them. On focus (window switch / mobile foreground)
		// re-read and union. Listener is per-service (not plugin-lifetime):
		// pomodoro/reading instances live and die with their view.
		this.focusDoc = activeDocument;
		this.focusDoc.addEventListener('visibilitychange', this.focusHandler);
		// Audio needs a gesture unlock before chimes can play (mobile
		// WebViews suspend every non-gesture AudioContext).
		unlockChime(this.focusDoc);
	}

	getApp(): import('obsidian').App {
		return this.plugin.app;
	}

	async loadSessions(): Promise<void> {
		if (this.loaded) return;
		this.loaded = true;
		try {
			const adapter = this.plugin.app.vault.adapter;
			const path = `${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/${DATA_FILE}`;
			if (await adapter.exists(path)) {
				const raw = await adapter.read(path);
				const data = JSON.parse(raw) as ReadingData | ReadingDayRecord[];
				if (Array.isArray(data)) {
					this.sessions = data;
					this.activeBooks = [];
				} else {
					this.sessions = data.sessions ?? [];
					this.activeBooks = (data.activeBooks ?? []).map(normalizeBook);
				}
				this.lastWritten = raw;
			}
		} catch (error) {
			// Parse error = unusable file (start fresh); an adapter/IO error
			// (mobile file lock, iCloud file not yet downloaded) leaves the
			// on-disk file intact — flag it so the next save cannot overwrite
			// real history with the empty state (expense/habit pattern).
			this.sessions = [];
			this.activeBooks = [];
			this.loadFailed = !(error instanceof SyntaxError);
		}
		this.pruneOldSessions();
	}

	/** Serialized write queue — at most one write is ever in flight. */
	private saveQueue: Promise<void> = Promise.resolve();

	private save(): void {
		this.notify();
		this.saveQueue = this.saveQueue.then(() => this.persist());
	}

	private async persist(): Promise<void> {
		// A non-parse load failure must not brick persistence for the whole
		// session; re-attempt the read and merge before deciding to skip.
		if (this.loadFailed && !(await this.retryFailedLoad())) return;
		try {
			const adapter = this.plugin.app.vault.adapter;
			const dir = `${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}`;
			const path = `${dir}/${DATA_FILE}`;
			if (!(await adapter.exists(dir))) {
				await adapter.mkdir(dir);
			}
			// Merge the disk state first when someone else wrote since our
			// last write — blind full-file saves are what made records
			// "not sync" (last writer silently reverted the other device).
			try {
				if (await adapter.exists(path)) {
					const raw = await adapter.read(path);
					if (raw !== this.lastWritten) {
						const merged = mergeData(this.parseData(raw), {
							activeBooks: this.activeBooks,
							sessions: this.sessions,
						});
						this.activeBooks = merged.activeBooks;
						this.sessions = merged.sessions;
					}
				}
			} catch {
				// Disk unreadable at save time: write our state as before.
			}
			const json = JSON.stringify({ activeBooks: this.activeBooks, sessions: this.sessions });
			await adapter.write(path, json);
			this.lastWritten = json;
		} catch {
			// silent fail: an unwriteable reading.json must not break sessions in-session
		}
	}

	/** Parse reading.json of either shape (bare array v0 / wrapped) into the
	 *  in-memory layout (normalized books). */
	private parseData(raw: string): ReadingData {
		const data = JSON.parse(raw) as ReadingData | ReadingDayRecord[];
		if (Array.isArray(data)) return { activeBooks: [], sessions: data };
		return { activeBooks: (data.activeBooks ?? []).map(normalizeBook), sessions: data.sessions ?? [] };
	}

	/** Re-attempt the initial read after a non-parse load failure. On success
	 *  the disk state merges with the in-session state; while the file is
	 *  still unreadable saving stays skipped rather than clobbering a file we
	 *  cannot see. */
	private async retryFailedLoad(): Promise<boolean> {
		try {
			const adapter = this.plugin.app.vault.adapter;
			const path = `${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/${DATA_FILE}`;
			let disk: ReadingData = { activeBooks: [], sessions: [] };
			if (await adapter.exists(path)) {
				const raw = await adapter.read(path);
				disk = this.parseData(raw);
				this.lastWritten = raw;
			}
			const merged = mergeData(disk, { activeBooks: this.activeBooks, sessions: this.sessions });
			this.activeBooks = merged.activeBooks;
			this.sessions = merged.sessions;
			this.loadFailed = false;
			this.notify();
			return true;
		} catch (error) {
			this.loadFailed = !(error instanceof SyntaxError);
			return !this.loadFailed;
		}
	}

	/** Re-read the file and union external changes into memory (another
	 *  device's records arriving via sync, or another view's writes in the
	 *  same process). Notifies listeners when the merge changed anything, and
	 *  writes the union back so a lagging device heals on its next focus. */
	async syncFromDisk(): Promise<void> {
		if (!this.loaded || this.syncInFlight) return;
		this.syncInFlight = true;
		try {
			const adapter = this.plugin.app.vault.adapter;
			const path = `${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/${DATA_FILE}`;
			if (!(await adapter.exists(path))) return;
			const raw = await adapter.read(path);
			if (raw === this.lastWritten) return;
			const merged = mergeData(this.parseData(raw), {
				activeBooks: this.activeBooks,
				sessions: this.sessions,
			});
			this.activeBooks = merged.activeBooks;
			this.sessions = merged.sessions;
			this.pruneOldSessions();
			this.notify();
			this.save();
		} catch {
			// Transient read error (file mid-sync): the next focus retries.
		} finally {
			this.syncInFlight = false;
		}
	}

	/** Register a data-changed listener; returns its unsubscribe function. */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		for (const listener of [...this.listeners]) {
			listener();
		}
	}

	private pruneOldSessions(): void {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - MAX_SESSION_DAYS);
		const cutoffStr = formatDate(cutoff);
		this.sessions = this.sessions.filter((s) => s.date >= cutoffStr);
	}

	// --- Active books ---

	getActiveBooks(): BookInfo[] {
		return [...this.activeBooks];
	}

	async addActiveBook(book: BookInfo): Promise<void> {
		if (this.activeBooks.some((b) => b.title === book.title && b.isbn === book.isbn)) return;
		this.activeBooks = [...this.activeBooks, normalizeBook(book)];
		this.save();
	}

	async removeActiveBook(title: string): Promise<void> {
		if (this.currentBook?.title === title) {
			this.forceReset();
		}
		this.activeBooks = this.activeBooks.filter((b) => b.title !== title);
		this.save();
	}

	async updateBookInfo(
		originalTitle: string,
		updates: Partial<Pick<BookInfo, 'title' | 'author' | 'coverUrl' | 'isbn' | 'source' | 'totalPages'>>,
	): Promise<void> {
		const oldBook = this.activeBooks.find((b) => b.title === originalTitle);
		if (!oldBook) return;
		const newTitle = updates.title ?? originalTitle;
		const updated = { ...oldBook, ...updates, title: newTitle };
		this.activeBooks = this.activeBooks.map((b) => (b.title === originalTitle ? updated : b));
		if (this.currentBook?.title === originalTitle) {
			this.currentBook = updated;
		}
		this.save();
	}

	async deleteRecord(timestamp: string): Promise<void> {
		this.sessions = this.sessions
			.map((s) => ({
				...s,
				records: s.records.filter((r) => r.timestamp !== timestamp),
			}))
			.filter((s) => s.records.length > 0);
		this.save();
	}

	async deleteBookRecords(bookTitle: string): Promise<void> {
		this.sessions = this.sessions
			.map((s) => ({
				...s,
				records: s.records.filter((r) => r.bookTitle !== bookTitle),
			}))
			.filter((s) => s.records.length > 0);
		this.save();
	}

	async updateBookProgress(title: string, endPage: number, totalPages: number, finished: boolean): Promise<void> {
		this.activeBooks = this.activeBooks.map((b) => {
			if (b.title !== title) return b;
			return {
				...b,
				currentPage: finished ? totalPages || endPage : endPage,
				totalPages: totalPages || b.totalPages,
				finished,
			};
		});
		this.save();
	}

	// --- Timer ---

	getElapsedSeconds(): number {
		if (this.status === 'idle') return 0;
		if (this.status === 'paused') return Math.floor(this.pausedElapsed / 1000);
		return Math.floor((Date.now() - this.startedAt + this.pausedElapsed) / 1000);
	}

	getState(): ReadingState {
		return {
			status: this.status,
			elapsedSeconds: this.getElapsedSeconds(),
			currentBook: this.currentBook,
		};
	}

	startReading(book: BookInfo): void {
		if (this.status === 'running' && this.currentBook?.title === book.title) return;

		if (this.status !== 'idle' && this.currentBook?.title !== book.title) {
			this.forceReset();
		}

		this.currentBook = book;
		this.pausedElapsed = 0;
		this.startedAt = Date.now();
		this.status = 'running';
		this.ensureTickInterval();
		this.notifyTick();
	}

	pause(): void {
		if (this.status !== 'running') return;
		this.pausedElapsed += Date.now() - this.startedAt;
		this.status = 'paused';
		this.clearTickInterval();
		this.notifyTick();
	}

	resume(): void {
		if (this.status !== 'paused') return;
		this.startedAt = Date.now();
		this.status = 'running';
		this.ensureTickInterval();
		this.notifyTick();
	}

	private forceReset(): void {
		this.status = 'idle';
		this.startedAt = 0;
		this.pausedElapsed = 0;
		this.currentBook = null;
		this.clearTickInterval();
	}

	async finishSession(endPage: number, totalPages: number, finished: boolean): Promise<ReadingRecord | null> {
		if (this.status === 'idle') return null;

		const elapsedMs =
			this.status === 'running' ? this.pausedElapsed + (Date.now() - this.startedAt) : this.pausedElapsed;

		const durationSeconds = Math.floor(elapsedMs / 1000);
		if (durationSeconds < 1) {
			this.forceReset();
			this.notifyTick();
			return null;
		}

		const startPage = this.currentBook?.currentPage ?? 0;

		const record: ReadingRecord = {
			timestamp: new Date().toISOString(),
			bookTitle: this.currentBook?.title ?? t('reading.unnamedBook'),
			bookAuthor: this.currentBook?.author ?? '',
			coverUrl: this.currentBook?.coverUrl ?? '',
			durationSeconds,
			isbn: this.currentBook?.isbn ?? '',
			startPage,
			endPage,
			finished,
		};

		await this.recordSession(record);

		if (this.currentBook) {
			await this.updateBookProgress(this.currentBook.title, endPage, totalPages, finished);
		}

		this.playSound();
		new Notice(t('reading.sessionSaved', { minutes: Math.max(1, Math.round(durationSeconds / 60)) }));

		this.forceReset();
		this.notifyTick();
		return record;
	}

	discardSession(): void {
		this.forceReset();
		this.notifyTick();
	}

	subscribeTick(listener: () => void): () => void {
		this.tickListeners.add(listener);
		return () => this.tickListeners.delete(listener);
	}

	destroy(): void {
		this.clearTickInterval();
		this.tickListeners.clear();
		this.listeners.clear();
		this.focusDoc?.removeEventListener('visibilitychange', this.focusHandler);
		this.focusDoc = null;
	}

	private ensureTickInterval(): void {
		if (this.tickInterval) return;
		this.tickInterval = window.setInterval(() => this.tick(), 1000);
	}

	private clearTickInterval(): void {
		if (this.tickInterval) {
			window.clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}

	private tick(): void {
		if (this.status !== 'running') return;
		this.notifyTick();
	}

	private notifyTick(): void {
		for (const listener of [...this.tickListeners]) listener();
	}

	private async recordSession(record: ReadingRecord): Promise<void> {
		const today = formatDate(new Date());
		const existing = this.sessions.find((s) => s.date === today);
		if (existing) {
			this.sessions = this.sessions.map((s) =>
				s.date === today ? { ...s, records: [...s.records, record] } : s,
			);
		} else {
			this.sessions = [...this.sessions, { date: today, records: [record] }];
		}
		this.save();
	}

	private playSound(): void {
		if (!this.plugin.settings.readingSoundEnabled) return;
		playDing(880);
	}

	// --- Statistics ---

	getTodaySeconds(): number {
		const today = formatDate(new Date());
		const session = this.sessions.find((s) => s.date === today);
		if (!session) return 0;
		return session.records.reduce((sum, r) => sum + r.durationSeconds, 0);
	}

	getTodaySecondsForBook(bookTitle: string): number {
		const today = formatDate(new Date());
		const session = this.sessions.find((s) => s.date === today);
		if (!session) return 0;
		return session.records.filter((r) => r.bookTitle === bookTitle).reduce((sum, r) => sum + r.durationSeconds, 0);
	}

	getTotalSeconds(): number {
		return this.sessions.reduce((sum, s) => sum + s.records.reduce((rs, r) => rs + r.durationSeconds, 0), 0);
	}

	getBookCountInRange(days: number): number {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - days);
		const cutoffStr = formatDate(cutoff);
		const books = new Set<string>();
		for (const s of this.sessions) {
			if (s.date < cutoffStr) continue;
			for (const r of s.records) {
				books.add(r.bookTitle);
			}
		}
		return books.size;
	}

	getBookBreakdownInRange(
		days: number,
	): { title: string; author: string; coverUrl: string; totalSeconds: number; sessions: number }[] {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - days);
		const cutoffStr = formatDate(cutoff);
		const map = new Map<
			string,
			{ title: string; author: string; coverUrl: string; totalSeconds: number; sessions: number }
		>();
		for (const s of this.sessions) {
			if (s.date < cutoffStr) continue;
			for (const r of s.records) {
				const existing = map.get(r.bookTitle);
				if (existing) {
					map.set(r.bookTitle, {
						...existing,
						totalSeconds: existing.totalSeconds + r.durationSeconds,
						sessions: existing.sessions + 1,
					});
				} else {
					map.set(r.bookTitle, {
						title: r.bookTitle,
						author: r.bookAuthor,
						coverUrl: r.coverUrl,
						totalSeconds: r.durationSeconds,
						sessions: 1,
					});
				}
			}
		}
		return [...map.values()].sort((a, b) => b.totalSeconds - a.totalSeconds);
	}

	getRecentRecords(limit: number): ReadingRecord[] {
		const allRecords: ReadingRecord[] = [];
		for (const s of this.sessions) {
			allRecords.push(...s.records);
		}
		allRecords.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
		return allRecords.slice(0, limit);
	}

	getStreak(): number {
		const sorted = [...this.sessions]
			.filter((s) => s.records.length > 0)
			.sort((a, b) => b.date.localeCompare(a.date));
		if (sorted.length === 0) return 0;

		let streak = 0;
		let expected = formatDate(new Date());

		if (sorted.length > 0 && sorted[0]!.date !== expected) {
			const d = new Date();
			d.setDate(d.getDate() - 1);
			expected = formatDate(d);
		}

		for (const s of sorted) {
			if (s.date === expected) {
				streak++;
				const d = new Date(expected + 'T00:00:00');
				d.setDate(d.getDate() - 1);
				expected = formatDate(d);
			} else if (s.date < expected) {
				break;
			}
		}

		return streak;
	}
}

function normalizeBook(b: BookInfo): BookInfo {
	return {
		title: b.title ?? '',
		author: b.author ?? '',
		coverUrl: b.coverUrl ?? '',
		isbn: b.isbn ?? '',
		source: b.source ?? 'manual',
		currentPage: b.currentPage ?? 0,
		totalPages: b.totalPages ?? 0,
		finished: b.finished ?? false,
	};
}

function formatDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}
