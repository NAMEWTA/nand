// Rule condition operators, ported from Iconic 1.1.10 (MIT-0, gfxholo) and arranged as tables.
// Behaviour matches the original exactly (see the 137-case oracle in iconic-port.test.ts), including its quirks.

type Timestamp = string | number;
type DatetimeOp = 'datetimeIs' | 'datetimeIsBefore' | 'datetimeIsAfter';
type TimeOp = 'timeIs' | 'timeIsBefore' | 'timeIsAfter';
type DateOp = 'dateIs' | 'dateIsBefore' | 'dateIsAfter';
type RelativeOp = 'isLessDaysAgo' | 'isLessDaysAway' | 'isMoreDaysAgo' | 'isMoreDaysAway';
type ItemsOp = 'are' | 'contain' | 'startWith' | 'endWith' | 'match';

/** Remove forward-slash delimiters from a regex if present. */
export function unwrapRegex(value: string): RegExp {
	return value.startsWith('/') && value.endsWith('/') ? new RegExp(value.slice(1, -1)) : new RegExp(value);
}

const ordered = (source: number, value: number, op: 'is' | 'before' | 'after') => (op === 'is' ? source === value : op === 'before' ? source < value : source > value);
const orderOf = (operator: string): 'is' | 'before' | 'after' => (operator.endsWith('Before') ? 'before' : operator.endsWith('After') ? 'after' : 'is');

/** Compare the date and time (to the minute) of two timestamps. */
export function compareDatetimes(source: Timestamp, operator: DatetimeOp, value: string | Date): boolean {
	if (value === '') return false;
	const srcDate = new Date(source);
	const valDate = new Date(value);
	srcDate.setSeconds(0, 0);
	valDate.setSeconds(0, 0);
	return ordered(srcDate.getTime(), valDate.getTime(), orderOf(operator));
}

/** Compare the times of day (to the minute) of two timestamps. */
export function compareTimes(source: Timestamp, operator: TimeOp, value: string | Date): boolean {
	if (value === '') return false;
	const srcDate = new Date(source);
	const valDate = typeof value === 'string' ? new Date('1970T' + value) : new Date(value);
	srcDate.setFullYear(1970, 0, 1);
	valDate.setFullYear(1970, 0, 1);
	srcDate.setSeconds(0, 0);
	valDate.setSeconds(0, 0);
	return ordered(srcDate.getTime(), valDate.getTime(), orderOf(operator));
}

/** Compare the calendar dates of two timestamps. */
export function compareDates(source: Timestamp, operator: DateOp, value: string | Date): boolean {
	if (value === '') return false;
	const srcDate = new Date(source);
	const valDate = new Date(value);
	srcDate.setHours(0, 0, 0, 0);
	valDate.setHours(0, 0, 0, 0);
	return ordered(srcDate.getTime(), valDate.getTime(), orderOf(operator));
}

/** Compare a timestamp with "N days ago / away" from `now`. */
export function compareRelativeDates(source: Timestamp, operator: RelativeOp, value: string, now: Date): boolean {
	if (value === '') return false;
	const srcDate = new Date(source);
	const valDate = new Date(now);
	srcDate.setHours(0, 0, 0, 0);
	valDate.setHours(0, 0, 0, 0);
	const ago = operator === 'isLessDaysAgo' || operator === 'isMoreDaysAgo';
	valDate.setDate(ago ? valDate.getDate() - Number(value) : valDate.getDate() + Number(value));
	return operator === 'isLessDaysAgo' || operator === 'isMoreDaysAway' ? srcDate > valDate : srcDate < valDate;
}

/** Compare a calendar part of a timestamp (ISO weekday 1–7, day of month, month 1–12, year) with a number. */
function comparePart(source: Timestamp, operator: string, value: string, part: (date: Date) => number): boolean {
	if (value === '') return false;
	return ordered(part(new Date(source)), Number(value), orderOf(operator));
}
const weekday = (date: Date) => (date.getDay() !== 0 ? date.getDay() : 7);
const monthday = (date: Date) => date.getDate();
const month = (date: Date) => date.getMonth() + 1;
const year = (date: Date) => date.getFullYear();

function eachItem(operator: ItemsOp, value: string): (item: string | null) => boolean {
	switch (operator) {
		case 'are':
			return (item) => item === value;
		case 'contain':
			return (item) => String(item).includes(value);
		case 'startWith':
			return (item) => String(item).startsWith(value);
		case 'endWith':
			return (item) => String(item).endsWith(value);
		case 'match': {
			const regex = unwrapRegex(value);
			return (item) => regex.test(String(item));
		}
	}
}

/** Whether all items match (false for no items or an empty value; an invalid regex counts as a match). */
export function all(items: (string | null)[], operator: ItemsOp, value: string): boolean {
	if (items.length === 0 || value === '') return false;
	try {
		return items.every(eachItem(operator, value));
	} catch {
		return true;
	}
}

/** Whether any item matches (false for an empty value or an invalid regex). */
export function any(items: (string | null)[], operator: ItemsOp, value: string): boolean {
	if (value === '') return false;
	try {
		return items.some(eachItem(operator, value));
	} catch {
		return false;
	}
}

/** Whether no item matches (false for an empty value; an invalid regex counts as no match). */
export function none(items: (string | null)[], operator: ItemsOp, value: string): boolean {
	if (value === '') return false;
	try {
		return !items.some(eachItem(operator, value));
	} catch {
		return true;
	}
}

interface Input<S> {
	source: S;
	value: string;
	now: Date;
	/** Lower-cased source (strings) and value, for case-insensitive comparisons. */
	sourceLower: string;
	sourceLowers: string[];
	valueLower: string;
}
type Check<S> = (input: Input<S>) => boolean;

const matches: Check<string> = ({ source, value }) => {
	try {
		return value !== '' && unwrapRegex(value).test(source);
	} catch {
		return false;
	}
};
const equalsIgnoringCase: Check<string> = ({ sourceLower, valueLower }) => sourceLower === valueLower;
const containsIgnoringCase: Check<string> = ({ sourceLower, valueLower }) => valueLower !== '' && sourceLower.includes(valueLower);
const startsIgnoringCase: Check<string> = ({ sourceLower, valueLower }) => valueLower !== '' && sourceLower.startsWith(valueLower);
const endsIgnoringCase: Check<string> = ({ sourceLower, valueLower }) => valueLower !== '' && sourceLower.endsWith(valueLower);

/** Date and time operators shared by text and number sources. `isBeforeNow`/`isAfterNow` compare with the value, as in Iconic. */
const TIMESTAMP: Record<string, Check<Timestamp>> = {
	datetimeIs: ({ source, value }) => compareDatetimes(source, 'datetimeIs', value),
	datetimeIsBefore: ({ source, value }) => compareDatetimes(source, 'datetimeIsBefore', value),
	datetimeIsAfter: ({ source, value }) => compareDatetimes(source, 'datetimeIsAfter', value),
	isNow: ({ source, now }) => compareDatetimes(source, 'datetimeIs', now),
	isBeforeNow: ({ source, value }) => compareDatetimes(source, 'datetimeIsBefore', value),
	isAfterNow: ({ source, value }) => compareDatetimes(source, 'datetimeIsAfter', value),
	timeIs: ({ source, value }) => compareTimes(source, 'timeIs', value),
	timeIsBefore: ({ source, value }) => compareTimes(source, 'timeIsBefore', value),
	timeIsAfter: ({ source, value }) => compareTimes(source, 'timeIsAfter', value),
	dateIs: ({ source, value }) => compareDates(source, 'dateIs', value),
	dateIsBefore: ({ source, value }) => compareDates(source, 'dateIsBefore', value),
	dateIsAfter: ({ source, value }) => compareDates(source, 'dateIsAfter', value),
	isToday: ({ source, now }) => compareDates(source, 'dateIs', now),
	isBeforeToday: ({ source, now }) => compareDates(source, 'dateIsBefore', now),
	isAfterToday: ({ source, now }) => compareDates(source, 'dateIsAfter', now),
	isLessDaysAgo: ({ source, value, now }) => compareRelativeDates(source, 'isLessDaysAgo', value, now),
	isMoreDaysAgo: ({ source, value, now }) => compareRelativeDates(source, 'isMoreDaysAgo', value, now),
	...Object.fromEntries(
		([['weekday', weekday], ['monthday', monthday], ['month', month], ['year', year]] as const).flatMap(([name, part]) =>
			['Is', 'IsBefore', 'IsAfter'].map((suffix) => [`${name}${suffix}`, ({ source, value }: Input<Timestamp>) => comparePart(source, `${name}${suffix}`, value, part)]),
		),
	),
};

const TEXT: Record<string, Check<string>> = {
	is: equalsIgnoringCase,
	contains: containsIgnoringCase,
	startsWith: startsIgnoringCase,
	endsWith: endsIgnoringCase,
	matches,
	...TIMESTAMP,
	timeIsNow: ({ source, now }) => compareTimes(source, 'timeIs', now),
	timeIsBeforeNow: ({ source, now }) => compareTimes(source, 'timeIsBefore', now),
	timeIsAfterNow: ({ source, now }) => compareTimes(source, 'timeIsAfter', now),
	isLessDaysAway: ({ source, value, now }) => compareRelativeDates(source, 'isLessDaysAway', value, now),
	isMoreDaysAway: ({ source, value, now }) => compareRelativeDates(source, 'isMoreDaysAway', value, now),
	iconIs: equalsIgnoringCase,
	nameIs: equalsIgnoringCase,
	nameContains: containsIgnoringCase,
	nameStartsWith: startsIgnoringCase,
	nameEndsWith: endsIgnoringCase,
	nameMatches: matches,
	colorIs: equalsIgnoringCase,
	hexIs: equalsIgnoringCase,
};

const NUMBER: Record<string, Check<number>> = {
	equals: ({ source, value }) => source === Number(value),
	isLess: ({ source, value }) => source < Number(value),
	isMore: ({ source, value }) => source > Number(value),
	isDivisible: ({ source, value }) => (source / Number(value)) % 1 === 0,
	...TIMESTAMP,
};

const LIST: Record<string, Check<(string | null)[]>> = {
	includes: ({ sourceLowers, valueLower }) => sourceLowers.includes(valueLower),
	allAre: ({ sourceLowers, valueLower }) => all(sourceLowers, 'are', valueLower),
	allContain: ({ sourceLowers, valueLower }) => all(sourceLowers, 'contain', valueLower),
	allStartWith: ({ sourceLowers, valueLower }) => all(sourceLowers, 'startWith', valueLower),
	allEndWith: ({ sourceLowers, valueLower }) => all(sourceLowers, 'endWith', valueLower),
	allMatch: ({ source, value }) => all(source, 'match', value),
	anyContain: ({ sourceLowers, valueLower }) => any(sourceLowers, 'contain', valueLower),
	anyStartWith: ({ sourceLowers, valueLower }) => any(sourceLowers, 'startWith', valueLower),
	anyEndWith: ({ sourceLowers, valueLower }) => any(sourceLowers, 'endWith', valueLower),
	anyMatch: ({ source, value }) => any(source, 'match', value),
	// The "none" family compares lower-cased items with the value as typed, as Iconic does.
	noneContain: ({ sourceLowers, value }) => none(sourceLowers, 'contain', value),
	noneStartWith: ({ sourceLowers, value }) => none(sourceLowers, 'startWith', value),
	noneEndWith: ({ sourceLowers, value }) => none(sourceLowers, 'endWith', value),
	noneMatch: ({ source, value }) => none(source, 'match', value),
	countIs: ({ source, value }) => value !== '' && source.length === Number(value),
	countIsLess: ({ source, value }) => value !== '' && source.length < Number(value),
	countIsMore: ({ source, value }) => value !== '' && source.length > Number(value),
};

const BOOLEAN: Record<string, Check<boolean>> = {
	isTrue: ({ source }) => source === true,
	isFalse: ({ source }) => source === false,
};

/**
 * Evaluate one condition operator (without its `!` negation) against a resolved source value.
 * The source type picks the table; an operator that does not apply to that type does not match.
 */
export function evaluateOperator(operator: string, source: unknown, value: string, now: Date): boolean {
	if (operator === 'hasValue') return source !== null && source !== undefined;
	if (operator === 'hasProperty') return source !== undefined;
	const input = {
		source,
		value,
		now,
		sourceLower: typeof source === 'string' ? source.toLowerCase() : '',
		sourceLowers: Array.isArray(source) ? source.map((item) => String(item).toLowerCase()) : [],
		valueLower: typeof value === 'string' ? value.toLowerCase() : '',
	};
	if (typeof source === 'boolean') return BOOLEAN[operator]?.(input as Input<boolean>) ?? false;
	if (typeof source === 'string') return TEXT[operator]?.(input as Input<string>) ?? false;
	if (typeof source === 'number') return NUMBER[operator]?.(input as Input<number>) ?? false;
	if (Array.isArray(source)) return LIST[operator]?.(input as Input<(string | null)[]>) ?? false;
	return false;
}
