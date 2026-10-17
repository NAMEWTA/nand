// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { addDays, addMonths, formatDate, parseDate, startOfDay, startOfWeek, usesIsoWeek, type FormatOptions, type WeekStart } from './moment-format';
import { joinPath, ROOT_FOLDER } from './types';

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';
export const PERIODS: readonly Period[] = ['day', 'week', 'month', 'quarter', 'year'];

/** Where the notes of one period live and how they are named and filled. */
export interface PeriodRule {
	enabled: boolean;
	/** Vault folder; empty means the vault root. */
	folder: string;
	/** Moment-style file name pattern without extension; it may contain `/` to sort notes into sub-folders. */
	format: string;
	/** Template note path; empty means none (the folder template of the target folder applies). */
	template: string;
}

export type PeriodRules = Record<Period, PeriodRule>;

export const DEFAULT_PERIOD_FORMATS: Record<Period, string> = {
	day: 'YYYY-MM-DD',
	week: 'gggg-[W]ww',
	month: 'YYYY-MM',
	quarter: 'YYYY-[Q]Q',
	year: 'YYYY',
};

export function defaultPeriodRules(): PeriodRules {
	const rule = (period: Period): PeriodRule => ({ enabled: period === 'day', folder: '', format: DEFAULT_PERIOD_FORMATS[period], template: '' });
	return { day: rule('day'), week: rule('week'), month: rule('month'), quarter: rule('quarter'), year: rule('year') };
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Fill gaps in saved rules with defaults and drop unusable values. */
export function normalizePeriodRules(value: unknown): PeriodRules {
	const rules = defaultPeriodRules();
	if (!isRecord(value)) return rules;
	for (const period of PERIODS) {
		const saved = value[period];
		if (!isRecord(saved)) continue;
		const format = typeof saved['format'] === 'string' && saved['format'].trim() ? saved['format'].trim().slice(0, 100) : rules[period].format;
		rules[period] = {
			enabled: typeof saved['enabled'] === 'boolean' ? saved['enabled'] : rules[period].enabled,
			folder: typeof saved['folder'] === 'string' ? cleanFolder(saved['folder']) : '',
			format,
			template: typeof saved['template'] === 'string' ? saved['template'].trim().slice(0, 300) : '',
		};
	}
	return rules;
}

export const cleanFolder = (folder: string): string => folder.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/').slice(0, 300);

/** The first day of the week a rule works with: patterns with ISO tokens use Monday-first ISO weeks whatever the setting says. */
export const effectiveWeekStart = (rule: PeriodRule, weekStart: WeekStart): WeekStart => (usesIsoWeek(rule.format) ? 1 : weekStart);

/** Format options for a rule; one rule decides the week start for the path, the template date and the week number. */
export function formatOptionsFor(rule: PeriodRule, weekStart: WeekStart, locale?: string): FormatOptions {
	return { locale, weekStart: effectiveWeekStart(rule, weekStart) };
}

/** False when the pattern writes the same name for two different periods (no date tokens, or too coarse), which would make every note the same file. */
export function formatDistinguishes(rule: PeriodRule, period: Period, weekStart: WeekStart, locale?: string): boolean {
	const options = formatOptionsFor(rule, weekStart, locale);
	const first = startOfPeriod(period, new Date(2026, 0, 15), options.weekStart ?? weekStart);
	const second = addPeriods(period, first, 1);
	return formatDate(first, rule.format, options) !== formatDate(second, rule.format, options);
}

/** First day of the period that contains `date`. */
export function startOfPeriod(period: Period, date: Date, weekStart: WeekStart): Date {
	switch (period) {
		case 'day': return startOfDay(date);
		case 'week': return startOfWeek(date, weekStart);
		case 'month': return new Date(date.getFullYear(), date.getMonth(), 1);
		case 'quarter': return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
		default: return new Date(date.getFullYear(), 0, 1);
	}
}

/** The same position `count` periods later (or earlier when negative); callers pass a period start. */
export function addPeriods(period: Period, date: Date, count: number): Date {
	switch (period) {
		case 'day': return addDays(date, count);
		case 'week': return addDays(date, count * 7);
		case 'month': return addMonths(date, count);
		case 'quarter': return addMonths(date, count * 3);
		default: return addMonths(date, count * 12);
	}
}

/** Vault path of the note of the period containing `date`. */
export function periodPath(rule: PeriodRule, period: Period, date: Date, weekStart: WeekStart, locale?: string): string {
	const start = startOfPeriod(period, date, effectiveWeekStart(rule, weekStart));
	const name = formatDate(start, rule.format, formatOptionsFor(rule, weekStart, locale));
	return joinPath(rule.folder === '' ? ROOT_FOLDER : rule.folder, `${name}.md`);
}

export interface PeriodRef { period: Period; start: Date }

/** Which enabled period a note path belongs to, and which one: the path must equal the exact path its rule generates. */
export function identifyPeriodNote(path: string, rules: PeriodRules, weekStart: WeekStart, locale?: string): PeriodRef | undefined {
	for (const period of PERIODS) {
		const rule = rules[period];
		if (!rule.enabled || !path.toLowerCase().endsWith('.md')) continue;
		const prefix = rule.folder === '' ? '' : `${rule.folder}/`;
		if (prefix && !path.startsWith(prefix)) continue;
		const text = path.slice(prefix.length, -3);
		const options = formatOptionsFor(rule, weekStart, locale);
		const parsed = parseDate(text, rule.format, options);
		if (!parsed) continue;
		const start = startOfPeriod(period, parsed, effectiveWeekStart(rule, weekStart));
		// A pattern that cannot tell periods apart (a month pattern read as a day) must round-trip through its own period.
		if (periodPath(rule, period, start, weekStart, locale) === path) return { period, start };
	}
	return undefined;
}

const PARENT: Record<Period, Period | undefined> = { day: 'week', week: 'month', month: 'quarter', quarter: 'year', year: undefined };

/** The period above `period` that has a rule: the weekly note of a day, the monthly of a week, ... skipping disabled ones. */
export function parentPeriod(period: Period, rules: PeriodRules): Period | undefined {
	for (let next = PARENT[period]; next; next = PARENT[next]) if (rules[next].enabled) return next;
	return undefined;
}

/** The note one period after (`delta` 1) or before (`delta` -1) a period note, as a period start. */
export function stepPeriod(ref: PeriodRef, delta: number): PeriodRef {
	return { period: ref.period, start: addPeriods(ref.period, ref.start, delta) };
}

/** The parent period note of `ref`; a week that spans two months belongs to the month of its first day. */
export function parentOf(ref: PeriodRef, rules: PeriodRules, weekStart: WeekStart): PeriodRef | undefined {
	const period = parentPeriod(ref.period, rules);
	return period ? { period, start: startOfPeriod(period, ref.start, effectiveWeekStart(rules[period], weekStart)) } : undefined;
}

/** The weeks (starting on `weekStart`) that cover the month containing `month`: four to six rows of seven days. */
export function monthGrid(month: Date, weekStart: WeekStart): Date[][] {
	const first = startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1), weekStart);
	const weeks = Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)));
	return weeks.filter((week) => week.some((date) => date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()));
}
