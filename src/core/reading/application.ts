import { t } from '../../shared/i18n/index';
import { DurableState } from '../../shared/storage/durable-state';
import type { TextStorage } from '../../shared/storage/ports';
import type { ActivityHost } from '../activity/ports';

export type ReadingStatus = 'idle' | 'running' | 'paused';

export interface ReadingState {
	status: ReadingStatus;
	elapsedSeconds: number;
	currentBook: BookInfo | null;
}

export interface BookInfo {
	id?: string;
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

export interface ReadingData {
	activeBooks: BookInfo[];
	sessions: ReadingDayRecord[];
}

export const DATA_FILE = 'reading.json';

export class ReadingApplication {
	private status: ReadingStatus = 'idle';
	private startedAt = 0;
	private pausedElapsed = 0;
	private currentBook: BookInfo | null = null;
	private tickInterval: number | null = null;
	private readonly tickListeners = new Set<() => void>();
	private readonly repository: DurableState<ReadingData>;
	private get activeBooks(): BookInfo[] {
		return this.repository.value.activeBooks;
	}
	private set activeBooks(value: BookInfo[]) {
		this.repository.value = { ...this.repository.value, activeBooks: value };
	}
	private get sessions(): ReadingDayRecord[] {
		return this.repository.value.sessions;
	}
	private set sessions(value: ReadingDayRecord[]) {
		this.repository.value = { ...this.repository.value, sessions: value };
	}
	private listeners = new Set<() => void>();
	constructor(
		private plugin: ActivityHost,
		storage: TextStorage,
		path: string,
	) {
		this.repository = new DurableState<ReadingData>(
			storage,
			path,
			() => ({ activeBooks: [], sessions: [] }),
			(raw: unknown): ReadingData => {
				const data = raw as ReadingData;
				if (!data || !Array.isArray(data.activeBooks) || !Array.isArray(data.sessions))
					throw new Error('Invalid reading data');
				return { activeBooks: data.activeBooks.map(normalizeBook), sessions: data.sessions };
			},
			() => this.notify(),
		);
	}
	get saveState() {
		return this.repository.state;
	}
	async loadSessions(): Promise<void> {
		await this.repository.load();
	}
	private save(): void {
		this.repository.save();
		this.notify();
	}
	flush(): Promise<void> {
		return this.repository.flush();
	}
	retrySave(): Promise<void> {
		return this.repository.retry();
	}
	shutdown(): Promise<void> {
		this.clearTickInterval();
		this.tickListeners.clear();
		this.listeners.clear();
		return this.repository.shutdown();
	}
	syncFromDisk(): Promise<void> {
		return this.repository.sync();
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

		this.forceReset();
		this.notifyTick();
		await this.flush();
		this.playSound();
		this.plugin.notify(t('reading.sessionSaved', { minutes: Math.max(1, Math.round(durationSeconds / 60)) }));
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
	}

	private ensureTickInterval(): void {
		if (this.tickInterval) return;
		this.tickInterval = this.plugin.setInterval(() => this.tick(), 1000);
	}

	private clearTickInterval(): void {
		if (this.tickInterval) {
			this.plugin.clearInterval(this.tickInterval);
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
		this.plugin.chime(880);
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
		id: b.id ?? crypto.randomUUID(),
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
