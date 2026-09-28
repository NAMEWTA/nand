/** One check-in habit owned by the user. */
export interface Habit {
	id: string;
	name: string;
	/** 'YYYY-MM-DD', local time. */
	createdAt: string;
}

/** v1 data layout, stored at .obsidian/plugins/<manifest.id>/habits.json. */
export interface HabitData {
	version: 1;
	habits: Habit[];
	/** Completed habit ids keyed by local date 'YYYY-MM-DD'. */
	records: Record<string, string[]>;
}

export const DATA_FILE = 'habits.json';

export const MAX_RECORD_DAYS = 730;

/** Shared with the widget so its validation Notice matches the service. */
export const HABIT_MAX_NAME_LENGTH = 50;

export const MAX_NAME_LENGTH = HABIT_MAX_NAME_LENGTH;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyData(): HabitData {
	return { version: 1, habits: [], records: {} };
}

/** Union of two datasets, `session` winning per-habit-id conflicts. Used when
 *  a load that failed at startup succeeds on a later retry: the disk copy and
 *  everything changed in-session are merged so neither side is lost. */
export function mergeData(disk: HabitData, session: HabitData): HabitData {
	const byId = new Map(disk.habits.map((h) => [h.id, h] as const));
	for (const h of session.habits) byId.set(h.id, h);
	const habits = [...byId.values()];
	const ids = new Set(habits.map((h) => h.id));
	const seen = new Map<string, Set<string>>();
	for (const source of [disk, session]) {
		for (const [date, idList] of Object.entries(source.records)) {
			if (!DATE_RE.test(date)) continue;
			const set = seen.get(date) ?? new Set<string>();
			seen.set(date, set);
			for (const id of idList) {
				if (ids.has(id)) set.add(id);
			}
		}
	}
	const records: Record<string, string[]> = {};
	for (const [date, set] of seen) {
		if (set.size > 0) records[date] = [...set];
	}
	return { version: 1, habits, records };
}

/** Normalize a parsed habits.json: keep only well-formed habits and record
 *  entries so a hand-edited or corrupted file degrades to partial data. */
export function normalizeData(raw: unknown): HabitData {
	if (!raw || typeof raw !== 'object') return emptyData();
	const obj = raw as Partial<HabitData>;
	const habits = Array.isArray(obj.habits)
		? obj.habits.filter(
				(h): h is Habit =>
					!!h &&
					typeof h === 'object' &&
					typeof h.id === 'string' &&
					h.id.length > 0 &&
					typeof h.name === 'string' &&
					h.name.length > 0 &&
					typeof h.createdAt === 'string' &&
					DATE_RE.test(h.createdAt),
			)
		: [];
	const habitIds = new Set(habits.map((h) => h.id));
	const records: Record<string, string[]> = {};
	if (obj.records && typeof obj.records === 'object') {
		for (const [date, ids] of Object.entries(obj.records)) {
			if (!DATE_RE.test(date) || !Array.isArray(ids)) continue;
			const valid = ids.filter((id): id is string => typeof id === 'string' && habitIds.has(id));
			if (valid.length > 0) records[date] = valid;
		}
	}
	return { version: 1, habits, records };
}

export function formatDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Local-time 'YYYY-MM-DD' (shared by the widget and stats modal). */
export function habitFormatDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Local-time 'YYYY-MM-DD' for today (shared by the widget and stats modal). */
export function habitToday(): string {
	return formatDate(new Date());
}

/** Local-time 'YYYY-MM-DD' for yesterday (the backfill modal's only target). */
export function habitYesterday(): string {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	return formatDate(d);
}

export function todayStr(): string {
	return formatDate(new Date());
}

/** Whole days between two 'YYYY-MM-DD' dates (b - a), both inclusive of day
 *  boundaries; used by the 30-day rate denominator. */
export function daysBetween(a: string, b: string): number {
	const da = new Date(a + 'T00:00:00');
	const db = new Date(b + 'T00:00:00');
	return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function makeHabitId(): string {
	return `hb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
