import { t } from '../../../../shared/i18n/index';
import type { AnniversaryConfig } from '../board/types/index';
import { lunarAnniversaryThisYear, type LunarLookup } from './lunar-map';
import { civilDate, validCivilDate } from './civil-date';

export function parseAnniversaryDate(raw: string): Date | null {
	const parts = /^(\d{4}-\d{2}-\d{2})(?:T([0-2]\d):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(?:Z|[+-][0-2]\d:[0-5]\d)?)?$/.exec(raw);
	if (!parts || !validCivilDate(parts[1]!) || (parts[2] && Number(parts[2]) > 23)) return null;
	const date = raw.includes('T') ? new Date(raw) : new Date(raw + 'T00:00:00');
	const time = date.getTime();
	if (Number.isNaN(time)) return null;
	return date;
}

/** Elapsed time from `start` to `now`, formatted per the precision setting:
 *  'ymd' calendar years/months/days, 'days' total days, 'hours' days+hours.
 *  Exported for the verify script. */
export function formatElapsed(start: Date, now: Date, precision: AnniversaryConfig['precision']): string {
	const diffMs = now.getTime() - start.getTime();
	if (diffMs < 0) return t('anniversary.notYet');
	const totalDays = Math.floor(diffMs / 86400000);
	if (precision === 'days') return t('anniversary.daysValue', { days: String(totalDays) });
	if (precision === 'hours') {
		const hours = Math.floor((diffMs - totalDays * 86400000) / 3600000);
		return t('anniversary.daysHoursValue', { days: String(totalDays), hours: String(hours) });
	}
	// Calendar walk: advance whole years, then months, then count leftover days.
	let years = now.getFullYear() - start.getFullYear();
	let months = now.getMonth() - start.getMonth();
	let days = now.getDate() - start.getDate();
	if (days < 0) {
		months -= 1;
		// Days in the month preceding `now` (0-indexed month + 1 = previous).
		days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
	}
	if (months < 0) {
		years -= 1;
		months += 12;
	}
	const parts: string[] = [];
	if (years > 0) parts.push(t('anniversary.yearsPart', { years: String(years) }));
	if (months > 0) parts.push(t('anniversary.monthsPart', { months: String(months) }));
	parts.push(t('anniversary.daysPart', { days: String(Math.max(0, days)) }));
	return parts.join(' ');
}

/** The date this year that carries the anniversary's month/day (Feb 29 rolls
 *  onto Mar 1 in common years — Date overflow does this naturally).
 *  A lunar anniversary uses the injected calendar and does not rewrite the stored solar start. */
export function anniversaryDateThisYear(start: Date, now: Date, calendar?: 'solar' | 'lunar', lookup?: LunarLookup): Date {
	return anniversaryOccurrence(start, now, calendar, lookup).date;
}

/** Current calendar year's occurrence, shared by the widget and notification source.
 * Before Lunar New Year, late lunar months still belong to the preceding lunar year. */
export function anniversaryOccurrence(start: Date, now: Date, calendar?: 'solar' | 'lunar', lookup?: LunarLookup): { date: Date; years: number } {
	if (calendar !== 'lunar') return {
		date: new Date(now.getFullYear(), start.getMonth(), start.getDate()),
		years: now.getFullYear() - start.getFullYear(),
	};
	if (!lookup) throw new Error('Lunar calendar is unavailable');
	const year = lookup.toLunar(civilDate(now)).year;
	const mapped = parseAnniversaryDate(lunarAnniversaryThisYear(civilDate(start), year, lookup).solar);
	if (!mapped) throw new RangeError('Invalid lunar anniversary');
	return { date: mapped, years: year - lookup.toLunar(civilDate(start)).year };
}
