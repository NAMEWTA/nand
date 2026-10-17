// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** First day of the week: 0 = Sunday ... 6 = Saturday. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface FormatOptions {
	/** Moment locale (e.g. `en`, `zh-cn`) for names and week rules; the current Moment locale when omitted. */
	locale?: string;
	/** First day of the week for the locale-based week tokens (`w`, `ww`, `gggg`, `e`); the locale's own when omitted. ISO tokens (`W`, `GGGG`) ignore it. */
	weekStart?: WeekStart;
}

/** The part of a Moment object this module uses. */
export interface MomentLike {
	format(format?: string): string;
	toDate(): Date;
	isValid(): boolean;
	locale(name: string): MomentLike;
}

/** The part of the `moment` function this module uses; Obsidian's own `moment` satisfies it. */
export interface MomentApi {
	(input: Date): MomentLike;
	(input: string, format: string, locale: string, strict: boolean): MomentLike;
	locale(): string;
	locale(name: string): string;
	locales(): string[];
	localeData(): { firstDayOfWeek(): number };
	defineLocale(name: string, config: Record<string, unknown>): unknown;
}

let registered: MomentApi | undefined;

/**
 * Formatting and parsing are done by Obsidian's own Moment, so every Moment format the user knows works the same
 * as in the core Daily notes plugin. The platform registers it when the module starts (tests register the real package).
 */
export function registerMoment(api: MomentApi): void {
	registered = api;
}

export function getMoment(): MomentApi {
	if (!registered) throw new Error('Moment is not registered');
	return registered;
}

const DAY = 86_400_000;

/** `date` at 00:00 local time. */
export function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** `date` moved by whole calendar days; the time of day is kept across daylight-saving changes. */
export function addDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

/** `date` moved by whole months; the day is clamped to the length of the target month. */
export function addMonths(date: Date, months: number): Date {
	const first = new Date(date.getFullYear(), date.getMonth() + months, 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
	const length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
	first.setDate(Math.min(date.getDate(), length));
	return first;
}

export const dayOfYear = (date: Date): number => Math.round((startOfDay(date).getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / DAY) + 1;

/** Start (00:00) of the week that contains `date`. */
export function startOfWeek(date: Date, weekStart: WeekStart): Date {
	return addDays(startOfDay(date), -((date.getDay() - weekStart + 7) % 7));
}

/** Days in the first week of a year for the rule: Monday-first weeks follow ISO 8601 (4), others count from 1 January (1). */
export const minDaysInFirstWeek = (weekStart: WeekStart): number => (weekStart === 1 ? 4 : 1);

/** Week number and week-year of `date`: week 1 is the first week with at least `minDays` days in the year. */
export function weekOfYear(date: Date, weekStart: WeekStart, minDays = minDaysInFirstWeek(weekStart)): { week: number; year: number } {
	const anchor = addDays(startOfWeek(date, weekStart), 7 - minDays);
	return { week: Math.floor((dayOfYear(anchor) - 1) / 7) + 1, year: anchor.getFullYear() };
}

/** Moment locale to use: the given or current one, with its week rules replaced when a week start is given. */
function localeFor(options: FormatOptions): string {
	const api = getMoment();
	const base = options.locale ?? api.locale();
	if (options.weekStart === undefined) return base;
	const dow = options.weekStart;
	const name = `${base}-nand-w${dow}`;
	if (!api.locales().includes(name)) {
		// defineLocale makes the new locale current for a moment; put Obsidian's own back at once.
		const current = api.locale();
		api.defineLocale(name, { parentLocale: base, week: { dow, doy: 7 + dow - minDaysInFirstWeek(dow) } });
		api.locale(current);
	}
	return name;
}

/** Format `date` with a Moment format string (`[text]` is copied as written). */
export function formatDate(date: Date, format: string, options: FormatOptions = {}): string {
	return getMoment()(date).locale(localeFor(options)).format(format);
}

/** True when the format uses a token that makes the week count follow ISO 8601 (`W`, `WW`, `GGGG`, `GG`). */
export const usesIsoWeek = (format: string): boolean => /W|GG/.test(format.replace(/\[[^\]]*\]/g, ''));

/**
 * Read a date back from text written with `format` (strict Moment parsing: the whole text must match). A week
 * format yields the first day of that week. The result must format back to exactly the same text, so look-alikes
 * ("2026-02-30") are never accepted.
 */
export function parseDate(text: string, format: string, options: FormatOptions = {}): Date | undefined {
	const locale = localeFor(options);
	const parsed = getMoment()(text, format, locale, true);
	if (!parsed.isValid()) return undefined;
	const date = parsed.toDate();
	return formatDate(date, format, options) === text ? date : undefined;
}
