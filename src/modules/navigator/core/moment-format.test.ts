// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import '../../../../scripts/navigator-test-moment';
import { expect, test } from 'vitest';
import { addMonths, formatDate, getMoment, parseDate, startOfWeek, usesIsoWeek, weekOfYear } from './moment-format';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

test('formats the common Moment tokens', () => {
	const date = new Date(2026, 9, 5, 14, 7, 9, 45);
	expect(formatDate(date, 'YYYY-MM-DD HH:mm:ss', { locale: 'en' })).toBe('2026-10-05 14:07:09');
	expect(formatDate(date, 'YY/M/D h:mm A', { locale: 'en' })).toBe('26/10/5 2:07 PM');
	expect(formatDate(date, 'dddd, MMMM D', { locale: 'en' })).toBe('Monday, October 5');
	expect(formatDate(date, 'ddd MMM DDD', { locale: 'en' })).toBe('Mon Oct 278');
	expect(formatDate(date, '[Week] w [of] gggg [Q]Q', { locale: 'en', weekStart: 1 })).toBe('Week 41 of 2026 Q4');
	expect(formatDate(date, 'SSS', { locale: 'en' })).toBe('045');
});

test('brackets escape token letters and unknown text passes through', () => {
	expect(formatDate(day(2026, 1, 2), '[YYYY] YYYY / MM · [DD]')).toBe('YYYY 2026 / 01 · DD');
});

test('ISO and locale weeks', () => {
	expect(weekOfYear(day(2026, 10, 15), 1)).toEqual({ week: 42, year: 2026 });
	expect(weekOfYear(day(2021, 1, 3), 1)).toEqual({ week: 53, year: 2020 });
	expect(weekOfYear(day(2024, 12, 30), 1)).toEqual({ week: 1, year: 2025 });
	// Sunday-first weeks: the week with 1 January is week 1
	expect(weekOfYear(day(2026, 1, 1), 0)).toEqual({ week: 1, year: 2026 });
	expect(weekOfYear(day(2025, 12, 28), 0)).toEqual({ week: 1, year: 2026 });
	expect(weekOfYear(day(2025, 12, 27), 0)).toEqual({ week: 52, year: 2025 });
	expect(formatDate(day(2021, 1, 3), 'GGGG-[W]WW')).toBe('2020-W53');
	expect(startOfWeek(day(2026, 10, 15), 1)).toEqual(day(2026, 10, 12));
	expect(startOfWeek(day(2026, 10, 18), 0)).toEqual(day(2026, 10, 18));
});

test('month arithmetic clamps the day', () => {
	expect(addMonths(day(2026, 1, 31), 1)).toEqual(day(2026, 2, 28));
	expect(addMonths(day(2026, 3, 31), -1)).toEqual(day(2026, 2, 28));
	expect(addMonths(day(2026, 11, 15), 3)).toEqual(day(2027, 2, 15));
});

test('parses dates back and rejects look-alikes', () => {
	expect(parseDate('2026-10-15', 'YYYY-MM-DD')).toEqual(day(2026, 10, 15));
	expect(parseDate('2026-13-45', 'YYYY-MM-DD')).toBeUndefined();
	expect(parseDate('2026-02-30', 'YYYY-MM-DD')).toBeUndefined();
	expect(parseDate('2026-10-15 Trip', 'YYYY-MM-DD')).toBeUndefined();
	expect(parseDate('Daily 2026-10-15', '[Daily] YYYY-MM-DD')).toEqual(day(2026, 10, 15));
	expect(parseDate('2026/10/2026-10-15', 'YYYY/MM/YYYY-MM-DD')).toEqual(day(2026, 10, 15));
	expect(parseDate('October 2026', 'MMMM YYYY', { locale: 'en' })).toEqual(day(2026, 10, 1));
	expect(parseDate('2026-Q4', 'YYYY-[Q]Q')).toEqual(day(2026, 10, 1));
	expect(parseDate('2026', 'YYYY')).toEqual(day(2026, 1, 1));
});

test('parses week patterns to the first day of the week', () => {
	expect(parseDate('2026-W42', 'gggg-[W]ww', { weekStart: 1 })).toEqual(day(2026, 10, 12));
	expect(parseDate('2026-W42', 'GGGG-[W]WW')).toEqual(day(2026, 10, 12));
	expect(parseDate('2026-W42', 'gggg-[W]ww', { weekStart: 0 })).toEqual(day(2026, 10, 11));
	expect(parseDate('2020-W53', 'GGGG-[W]WW')).toEqual(day(2020, 12, 28));
	expect(parseDate('2026-W54', 'GGGG-[W]WW')).toBeUndefined();
});

test('detects ISO week tokens outside literals', () => {
	expect(usesIsoWeek('GGGG-[W]WW')).toBe(true);
	expect(usesIsoWeek('gggg-[W]ww')).toBe(false);
	expect(usesIsoWeek('[WW] YYYY')).toBe(false);
});

test('the Moment formats Obsidian users know all work, as in the core Daily notes plugin', () => {
	const date = new Date(2026, 9, 15, 13, 5);
	expect(formatDate(date, 'Do MMMM YYYY', { locale: 'en' })).toBe('15th October 2026');
	expect(formatDate(date, 'LL', { locale: 'en' })).toBe('October 15, 2026');
	expect(formatDate(date, 'L', { locale: 'en' })).toBe('10/15/2026');
	expect(formatDate(date, 'ddd dd', { locale: 'en' })).toBe('Thu Th');
	expect(formatDate(date, 'dddd [at] LT', { locale: 'en' })).toBe('Thursday at 1:05 PM');
	expect(parseDate('October 15, 2026', 'LL', { locale: 'en' })).toEqual(day(2026, 10, 15));
	expect(parseDate('15th October 2026', 'Do MMMM YYYY', { locale: 'en' })).toEqual(day(2026, 10, 15));
});

test('a first-day-of-week override never changes the locale Obsidian is using', () => {
	const moment = getMoment();
	const before = moment.locale();
	formatDate(day(2026, 10, 15), 'gggg-ww', { weekStart: 0 });
	formatDate(day(2026, 10, 15), 'gggg-ww', { weekStart: 6 });
	expect(moment.locale()).toBe(before);
	expect(formatDate(day(2026, 10, 18), 'gggg-[W]ww', { weekStart: 0 })).toBe('2026-W43');
	expect(formatDate(day(2026, 10, 18), 'gggg-[W]ww', { weekStart: 1 })).toBe('2026-W42');
	expect(formatDate(day(2026, 10, 18), 'GGGG-[W]WW', { weekStart: 0 })).toBe('2026-W42');
	expect(formatDate(day(2026, 10, 17), 'e', { weekStart: 6 })).toBe('0');
});
