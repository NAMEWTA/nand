// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** A half-open time span `[start, end)` in epoch milliseconds; open ends use ±Infinity. */
export interface DateRange {
	start: number;
	end: number;
}

/** How an ambiguous all-numeric date such as `07022026` is read. */
export type DateOrder = 'dmy' | 'mdy';

export interface DateContext {
	now: number;
	/** First day of the week: 1 is Monday (the default), 0 is Sunday. */
	weekStart?: 0 | 1;
	dateOrder?: DateOrder;
}

const startOfDay = (time: number): Date => {
	const date = new Date(time);
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const addDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const span = (start: Date, end: Date): DateRange => ({ start: start.getTime(), end: end.getTime() });

/** A real calendar day: `new Date(2026, 1, 30)` would silently roll over, so check the round trip. */
function validDay(year: number, month: number, day: number): Date | undefined {
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

function isoWeeksIn(year: number): number {
	const jan1 = new Date(year, 0, 1).getDay();
	const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	return jan1 === 4 || (leap && jan1 === 3) ? 53 : 52;
}

/** Monday of ISO week `week` of `year` (week 1 is the one holding January 4th). */
function isoWeekStart(year: number, week: number): Date {
	const jan4 = new Date(year, 0, 4);
	const monday = addDays(jan4, -((jan4.getDay() + 6) % 7));
	return addDays(monday, (week - 1) * 7);
}

function dayRange(date: Date): DateRange {
	return span(date, addDays(date, 1));
}

function relative(word: string, context: DateContext): DateRange | undefined {
	const today = startOfDay(context.now);
	switch (word) {
		case 'today': return dayRange(today);
		case 'yesterday': return dayRange(addDays(today, -1));
		case 'last7d': return span(addDays(today, -6), addDays(today, 1));
		case 'last30d': return span(addDays(today, -29), addDays(today, 1));
		case 'thisweek': {
			const first = context.weekStart ?? 1;
			const back = (today.getDay() - first + 7) % 7;
			const start = addDays(today, -back);
			return span(start, addDays(start, 7));
		}
		case 'thismonth': return span(new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 1));
		default: return undefined;
	}
}

/** Day, month, year, week or quarter named by `text`, as a span; undefined when it is not a date. */
function parseSingle(text: string, context: DateContext): DateRange | undefined {
	const lower = text.toLowerCase();
	const word = relative(lower, context);
	if (word) return word;
	const order = context.dateOrder ?? 'dmy';

	let match = /^(\d{4})-?w(\d{2})$/.exec(lower);
	if (match) {
		const year = Number(match[1]);
		const week = Number(match[2]);
		if (week < 1 || week > isoWeeksIn(year)) return undefined;
		const start = isoWeekStart(year, week);
		return span(start, addDays(start, 7));
	}
	match = /^(\d{4})-?q([1-4])$/.exec(lower);
	if (match) {
		const year = Number(match[1]);
		const first = (Number(match[2]) - 1) * 3;
		return span(new Date(year, first, 1), new Date(year, first + 3, 1));
	}
	match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lower);
	if (match) {
		const day = validDay(Number(match[1]), Number(match[2]), Number(match[3]));
		return day && dayRange(day);
	}
	match = /^(\d{8})$/.exec(lower);
	if (match) {
		const digits = match[1]!;
		const yearFirst = validDay(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8)));
		if (yearFirst && Number(digits.slice(0, 4)) >= 1000) return dayRange(yearFirst);
		const a = Number(digits.slice(0, 2));
		const b = Number(digits.slice(2, 4));
		const year = Number(digits.slice(4, 8));
		const day = order === 'mdy' ? validDay(year, a, b) : validDay(year, b, a);
		return day && dayRange(day);
	}
	match = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})$/.exec(lower);
	if (match) {
		const first = Number(match[1]);
		const second = Number(match[3]);
		const year = Number(match[4]);
		// A part above 12 can only be the day; otherwise the locale decides.
		const dayFirst = first > 12 ? true : second > 12 ? false : order === 'dmy';
		const day = dayFirst ? validDay(year, second, first) : validDay(year, first, second);
		return day && dayRange(day);
	}
	match = /^(\d{4})-?(\d{2})$/.exec(lower);
	if (match) {
		const year = Number(match[1]);
		const month = Number(match[2]);
		if (month < 1 || month > 12) return undefined;
		return span(new Date(year, month - 1, 1), new Date(year, month, 1));
	}
	match = /^(\d{4})$/.exec(lower);
	if (match) {
		const year = Number(match[1]);
		return span(new Date(year, 0, 1), new Date(year + 1, 0, 1));
	}
	return undefined;
}

/**
 * The span a date expression (the part after `@` and any `c:`/`m:` prefix) selects. A range `A..B` runs from the
 * start of A to the end of B inclusive; either side may be empty for an open end.
 */
export function parseDateExpression(text: string, context: DateContext): DateRange | undefined {
	const dots = text.indexOf('..');
	if (dots < 0) return parseSingle(text, context);
	const left = text.slice(0, dots);
	const right = text.slice(dots + 2);
	if (!left && !right) return undefined;
	const from = left ? parseSingle(left, context) : undefined;
	const to = right ? parseSingle(right, context) : undefined;
	if ((left && !from) || (right && !to)) return undefined;
	const start = from ? from.start : -Infinity;
	const end = to ? to.end : Infinity;
	// A reversed range still means "between these two days".
	if (from && to && start >= end) return { start: to.start, end: from.end };
	return { start, end };
}

/** The date order of a locale (`dmy` or `mdy`); day-first unless the locale puts the month first. */
export function localeDateOrder(locale?: string): DateOrder {
	try {
		const parts = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date(2000, 10, 25));
		const kinds = parts.map((part) => part.type).filter((type) => type === 'day' || type === 'month');
		return kinds[0] === 'month' ? 'mdy' : 'dmy';
	} catch {
		return 'dmy';
	}
}
