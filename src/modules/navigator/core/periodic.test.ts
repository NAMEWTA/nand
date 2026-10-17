// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import '../../../../scripts/navigator-test-moment';
import { expect, test } from 'vitest';
import { addPeriods, defaultPeriodRules, formatDistinguishes, identifyPeriodNote, monthGrid, normalizePeriodRules, parentOf, parentPeriod, periodPath, startOfPeriod, stepPeriod, type PeriodRules } from './periodic';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

function rules(overrides: Partial<Record<keyof PeriodRules, Partial<PeriodRules['day']>>> = {}): PeriodRules {
	const base = defaultPeriodRules();
	for (const period of ['day', 'week', 'month', 'quarter', 'year'] as const) base[period] = { ...base[period], enabled: true, ...overrides[period] };
	return base;
}

test('period starts', () => {
	const date = day(2026, 10, 15);
	expect(startOfPeriod('day', date, 1)).toEqual(day(2026, 10, 15));
	expect(startOfPeriod('week', date, 1)).toEqual(day(2026, 10, 12));
	expect(startOfPeriod('week', date, 0)).toEqual(day(2026, 10, 11));
	expect(startOfPeriod('month', date, 1)).toEqual(day(2026, 10, 1));
	expect(startOfPeriod('quarter', date, 1)).toEqual(day(2026, 10, 1));
	expect(startOfPeriod('quarter', day(2026, 8, 31), 1)).toEqual(day(2026, 7, 1));
	expect(startOfPeriod('year', date, 1)).toEqual(day(2026, 1, 1));
});

test('adding periods', () => {
	expect(addPeriods('day', day(2026, 12, 31), 1)).toEqual(day(2027, 1, 1));
	expect(addPeriods('week', day(2026, 10, 12), -1)).toEqual(day(2026, 10, 5));
	expect(addPeriods('month', day(2026, 1, 1), -1)).toEqual(day(2025, 12, 1));
	expect(addPeriods('quarter', day(2026, 10, 1), 1)).toEqual(day(2027, 1, 1));
	expect(addPeriods('year', day(2026, 1, 1), 2)).toEqual(day(2028, 1, 1));
});

test('paths follow the rule folder and pattern', () => {
	const set = rules({ day: { folder: 'Journal/Daily', format: 'YYYY/MM/YYYY-MM-DD' }, week: { folder: 'Journal', format: 'gggg-[W]ww' }, month: { format: 'YYYY-MM' } });
	expect(periodPath(set.day, 'day', day(2026, 10, 15), 1)).toBe('Journal/Daily/2026/10/2026-10-15.md');
	expect(periodPath(set.week, 'week', day(2026, 10, 15), 1)).toBe('Journal/2026-W42.md');
	expect(periodPath(set.month, 'month', day(2026, 10, 15), 1)).toBe('2026-10.md');
	expect(periodPath(set.quarter, 'quarter', day(2026, 10, 15), 1)).toBe('2026-Q4.md');
	expect(periodPath(set.year, 'year', day(2026, 10, 15), 1)).toBe('2026.md');
});

test('ISO week patterns are Monday-first whatever the week start setting is', () => {
	const set = rules({ week: { format: 'GGGG-[W]WW' } });
	expect(periodPath(set.week, 'week', day(2026, 10, 18), 0)).toBe('2026-W42.md');
});

test('identifies the period a note belongs to, from the exact path only', () => {
	const set = rules({ day: { folder: 'Daily' }, week: { folder: 'Weekly' }, month: { folder: 'Monthly' } });
	expect(identifyPeriodNote('Daily/2026-10-15.md', set, 1)).toEqual({ period: 'day', start: day(2026, 10, 15) });
	expect(identifyPeriodNote('Weekly/2026-W42.md', set, 1)).toEqual({ period: 'week', start: day(2026, 10, 12) });
	expect(identifyPeriodNote('Monthly/2026-10.md', set, 1)).toEqual({ period: 'month', start: day(2026, 10, 1) });
	expect(identifyPeriodNote('2026-Q4.md', set, 1)).toEqual({ period: 'quarter', start: day(2026, 10, 1) });
	expect(identifyPeriodNote('2026.md', set, 1)).toEqual({ period: 'year', start: day(2026, 1, 1) });
	expect(identifyPeriodNote('Daily/2026-10-15 Trip.md', set, 1)).toBeUndefined();
	expect(identifyPeriodNote('Other/2026-10-15.md', set, 1)).toBeUndefined();
	expect(identifyPeriodNote('Daily/2026-10-15.txt', set, 1)).toBeUndefined();
});

test('disabled periods are not identified', () => {
	const set = rules();
	set.week.enabled = false;
	expect(identifyPeriodNote('2026-W42.md', set, 1)).toBeUndefined();
});

test('next, previous and parent periods', () => {
	const set = rules();
	const ref = { period: 'day' as const, start: day(2026, 10, 15) };
	expect(stepPeriod(ref, 1).start).toEqual(day(2026, 10, 16));
	expect(stepPeriod(ref, -1).start).toEqual(day(2026, 10, 14));
	expect(parentOf(ref, set, 1)).toEqual({ period: 'week', start: day(2026, 10, 12) });
	expect(parentOf({ period: 'week', start: day(2026, 9, 28) }, set, 1)).toEqual({ period: 'month', start: day(2026, 9, 1) });
	expect(parentOf({ period: 'month', start: day(2026, 10, 1) }, set, 1)).toEqual({ period: 'quarter', start: day(2026, 10, 1) });
	expect(parentOf({ period: 'quarter', start: day(2026, 10, 1) }, set, 1)).toEqual({ period: 'year', start: day(2026, 1, 1) });
	expect(parentOf({ period: 'year', start: day(2026, 1, 1) }, set, 1)).toBeUndefined();
});

test('parent skips periods without a pattern', () => {
	const set = rules();
	set.week.enabled = false;
	set.month.enabled = false;
	expect(parentPeriod('day', set)).toBe('quarter');
	set.quarter.enabled = false;
	set.year.enabled = false;
	expect(parentPeriod('day', set)).toBeUndefined();
});

test('month grid covers the month in whole weeks starting on the week start', () => {
	const grid = monthGrid(day(2026, 10, 15), 1);
	expect(grid).toHaveLength(5);
	expect(grid[0]![0]).toEqual(day(2026, 9, 28));
	expect(grid[4]![6]).toEqual(day(2026, 11, 1));
	expect(monthGrid(day(2026, 10, 15), 0)[0]![0]).toEqual(day(2026, 9, 27));
	// August 2026 starts on a Saturday: six Monday-first weeks
	const long = monthGrid(day(2026, 8, 1), 1);
	expect(long).toHaveLength(6);
	expect(long[5]![6]).toEqual(day(2026, 9, 6));
	// February 2027 fits in four weeks exactly
	expect(monthGrid(day(2027, 2, 1), 1)).toHaveLength(4);
});

test('saved rules are repaired', () => {
	const set = normalizePeriodRules({ day: { enabled: true, folder: '/Daily/', format: '  ', template: ' T/day.md ' }, week: 5, year: { enabled: 'yes' } });
	expect(set.day).toEqual({ enabled: true, folder: 'Daily', format: 'YYYY-MM-DD', template: 'T/day.md' });
	expect(set.week).toEqual(defaultPeriodRules().week);
	expect(set.year.enabled).toBe(false);
	expect(normalizePeriodRules(undefined)).toEqual(defaultPeriodRules());
});

test('ISO week patterns get the Monday-first week whatever the first day of the week is', () => {
	const set = rules({ week: { format: 'GGGG-[W]WW' }, day: { folder: 'D' } });
	const sunday = day(2026, 10, 18);
	for (const weekStart of [0, 1, 6] as const) {
		expect(periodPath(set.week, 'week', day(2026, 10, 14), weekStart)).toBe('2026-W42.md');
		expect(periodPath(set.week, 'week', sunday, weekStart)).toBe('2026-W42.md');
		expect(parentOf({ period: 'day', start: day(2026, 10, 14) }, set, weekStart)).toEqual({ period: 'week', start: day(2026, 10, 12) });
		expect(identifyPeriodNote('2026-W42.md', set, weekStart)).toEqual({ period: 'week', start: day(2026, 10, 12) });
	}
	// locale-based week patterns follow the setting
	const local = rules({ week: { format: 'gggg-[W]ww' } });
	expect(parentOf({ period: 'day', start: day(2026, 10, 14) }, local, 0)).toEqual({ period: 'week', start: day(2026, 10, 11) });
	expect(parentOf({ period: 'day', start: day(2026, 10, 14) }, local, 6)).toEqual({ period: 'week', start: day(2026, 10, 10) });
});

test('a pattern that names every period the same is detected', () => {
	const set = rules({ day: { format: '[Daily]' }, week: { format: 'YYYY' }, month: { format: 'YYYY-MM' }, year: { format: 'YYYY' } });
	expect(formatDistinguishes(set.day, 'day', 1)).toBe(false);
	expect(formatDistinguishes(set.week, 'week', 1)).toBe(false);
	expect(formatDistinguishes(set.month, 'month', 1)).toBe(true);
	expect(formatDistinguishes(set.year, 'year', 1)).toBe(true);
	expect(formatDistinguishes(rules({ day: { format: 'LL' } }).day, 'day', 1, 'en')).toBe(true);
});
