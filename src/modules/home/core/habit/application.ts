import { DurableState } from '../../../../shared/storage/durable-state';
import type { TextStorage } from '../../../../shared/storage/ports';
import {
	DATA_FILE,
	DATE_RE,
	daysBetween,
	emptyData,
	formatDate,
	Habit,
	HabitData,
	makeHabitId,
	MAX_NAME_LENGTH,
	normalizeData,
	todayStr,
} from './model';

export class HabitApplication {
	constructor(
		storage: TextStorage,
		directory: string,
	) { this.repository = new DurableState(storage, `${directory}/${DATA_FILE}`, emptyData, normalizeData, () => this.notify()); }

	private readonly repository: DurableState<HabitData>;
	private get data(): HabitData { return this.repository.value; }
	private set data(value: HabitData) { this.repository.value = value; }
	private listeners = new Set<() => void>();
	get saveState() { return this.repository.state; }
	load(): Promise<void> { return this.repository.load(); }
	private save(): void { this.repository.save(); }
	flush(): Promise<void> { return this.repository.flush(); }
	retrySave(): Promise<void> { return this.repository.retry(); }
	shutdown(): Promise<void> { return this.repository.shutdown(); }
	syncFromDisk(): Promise<void> { return this.repository.sync(); }

	/** Register a data-changed listener; returns its unsubscribe function. */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	destroy(): void {
		this.listeners.clear();
	}

	protected notify(): void {
		for (const listener of [...this.listeners]) {
			listener();
		}
	}

	// ===== Habit CRUD =====

	getHabits(): Habit[] {
		return [...this.data.habits];
	}

	/** Add a habit; null when the name is empty, a duplicate (case-insensitive)
	 *  or over 50 chars — callers surface the reason as a Notice. */
	addHabit(name: string): Habit | null {
		const trimmed = name.trim();
		if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return null;
		if (this.data.habits.some((h) => h.name.toLowerCase() === trimmed.toLowerCase())) return null;
		const habit: Habit = { id: makeHabitId(), name: trimmed, createdAt: todayStr() };
		this.data = { ...this.data, habits: [...this.data.habits, habit] };
		this.save();
		this.notify();
		return habit;
	}

	/** Rename a habit; false when not found or the new name fails validation. */
	renameHabit(id: string, name: string): boolean {
		const trimmed = name.trim();
		if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false;
		if (this.data.habits.some((h) => h.id !== id && h.name.toLowerCase() === trimmed.toLowerCase())) return false;
		if (!this.data.habits.some((h) => h.id === id)) return false;
		this.data = {
			...this.data,
			habits: this.data.habits.map((h) => (h.id === id ? { ...h, name: trimmed } : h)),
		};
		this.save();
		this.notify();
		return true;
	}

	/** Remove a habit and sweep its ids out of every record day (no dangling
	 *  data; a banner referencing the dead id falls back to note activity). */
	removeHabit(id: string): void {
		if (!this.data.habits.some((h) => h.id === id)) return;
		const records: Record<string, string[]> = {};
		for (const [date, ids] of Object.entries(this.data.records)) {
			const kept = ids.filter((i) => i !== id);
			if (kept.length > 0) records[date] = kept;
		}
		this.data = {
			...this.data,
			habits: this.data.habits.filter((h) => h.id !== id),
			records,
		};
		this.save();
		this.notify();
	}

	/** Move the habit at index `from` to insert slot `to` (wireDrag convention:
	 *  both pre-removal indexes — dropping on the bottom half of a later card
	 *  passes that card's index + 1). The order drives the sidebar widget's
	 *  list and the stats overlay's cards alike. */
	moveHabit(from: number, to: number): void {
		const habits = this.data.habits;
		if (from < 0 || from >= habits.length || to < 0 || to > habits.length || from === to) return;
		const next = [...habits];
		const moved = next.splice(from, 1)[0];
		if (!moved) return;
		next.splice(to > from ? to - 1 : to, 0, moved);
		this.data = { ...this.data, habits: next };
		this.save();
		this.notify();
	}

	// ===== Check-in queries =====

	isDone(habitId: string, date?: string): boolean {
		const key = date ?? todayStr();
		return this.data.records[key]?.includes(habitId) === true;
	}

	/** Toggle a habit's completion for a date (default today) and notify. */
	toggle(habitId: string, date?: string): void {
		const key = date ?? todayStr();
		const ids = this.data.records[key] ?? [];
		const next = ids.includes(habitId) ? ids.filter((i) => i !== habitId) : [...ids, habitId];
		const records = { ...this.data.records };
		if (next.length > 0) {
			records[key] = next;
		} else {
			delete records[key];
		}
		this.data = { ...this.data, records };
		this.save();
		this.notify();
	}

	/** Habit ids completed on a date (feeds the "x/y today" sub-label). */
	getDoneOn(date: string): string[] {
		return [...(this.data.records[date] ?? [])];
	}

	/** Mark habits done on a date without toggling anything off (backfill
	 *  path: making up a missed day must never erase an existing record).
	 *  One immutable update, one save and one notify for the whole batch;
	 *  returns how many ids were actually added — 0 means nothing changed. */
	markDoneMany(habitIds: readonly string[], date: string): number {
		if (!DATE_RE.test(date)) return 0;
		const known = new Set(this.data.habits.map((h) => h.id));
		const merged = new Set(this.data.records[date] ?? []);
		let added = 0;
		for (const id of habitIds) {
			if (!known.has(id) || merged.has(id)) continue;
			merged.add(id);
			added++;
		}
		if (added === 0) return 0;
		this.data = {
			...this.data,
			records: { ...this.data.records, [date]: [...merged] },
		};
		this.save();
		this.notify();
		return added;
	}

	/** Consecutive completed days ending today (or yesterday when today is not
	 *  yet checked — the streak survives the day rollover either way). */
	getStreak(habitId: string): number {
		const doneDays = new Set(
			Object.keys(this.data.records).filter((date) => this.data.records[date]!.includes(habitId)),
		);
		if (doneDays.size === 0) return 0;

		let streak = 0;
		const cursor = new Date();
		if (!doneDays.has(formatDate(cursor))) {
			cursor.setDate(cursor.getDate() - 1);
			if (!doneDays.has(formatDate(cursor))) return 0;
		}
		while (doneDays.has(formatDate(cursor))) {
			streak++;
			cursor.setDate(cursor.getDate() - 1);
		}
		return streak;
	}

	/** Completion rate over the last 30 days as a 0-100 integer. The
	 *  denominator is min(30, days since the habit was created, inclusive) so
	 *  a brand-new habit shows 100% on its first check-in, not 3%. */
	getRate30(habitId: string): number {
		const habit = this.data.habits.find((h) => h.id === habitId);
		const today = todayStr();
		const start = habit ? habit.createdAt : today;
		const span = Math.min(30, daysBetween(start, today) + 1);
		if (!Number.isFinite(span) || span <= 0) return 0;

		let done = 0;
		const cursor = new Date();
		for (let i = 0; i < span; i++) {
			if (this.data.records[formatDate(cursor)]?.includes(habitId)) done++;
			cursor.setDate(cursor.getDate() - 1);
		}
		return Math.round((done / span) * 100);
	}

	/** Total days this habit has ever been checked (survives rate windows). */
	getTotal(habitId: string): number {
		return Object.values(this.data.records).filter((ids) => ids.includes(habitId)).length;
	}

	/** Daily completion series, oldest→today, `days` long. The target 'all'
	 *  counts completed habits per day; any other string is a habit id and
	 *  yields a 0/1 series. */
	getHeatmapDays(target: string, days: number): number[] {
		const series: number[] = [];
		const cursor = new Date();
		cursor.setDate(cursor.getDate() - (days - 1));
		for (let i = 0; i < days; i++) {
			const ids = this.data.records[formatDate(cursor)] ?? [];
			if (target === 'all') {
				series.push(ids.length);
			} else {
				series.push(ids.includes(target) ? 1 : 0);
			}
			cursor.setDate(cursor.getDate() + 1);
		}
		return series;
	}
}
