export interface LunarParts {
	year: number;
	month: number;
	leap: boolean;
	day: number;
}

/** Injected calendar so the mapping rules stay testable without a host. */
export interface LunarLookup {
	toLunar(solarIso: string): LunarParts;
	/** Undefined when that leap month does not exist in the year. */
	monthDays(year: number, month: number, leap: boolean): number | undefined;
	toSolar(year: number, month: number, leap: boolean, day: number): string;
}

export interface LunarAnniversary {
	solar: string;
	rule: 'exact' | 'plain-month' | 'month-end';
	leapCollapsed: boolean;
}

/**
 * Anniversary in `targetYear` for a stored solar start.
 * A missing leap month uses the same-numbered plain month. A short month uses its last day.
 * The stored solar start is not rewritten.
 */
export function lunarAnniversaryThisYear(startSolar: string, targetYear: number, lookup: LunarLookup): LunarAnniversary {
	const lunar = lookup.toLunar(startSolar);
	let leap = lunar.leap;
	let rule: LunarAnniversary['rule'] = 'exact';
	if (leap && lookup.monthDays(targetYear, lunar.month, true) === undefined) {
		leap = false;
		rule = 'plain-month';
	}
	const length = lookup.monthDays(targetYear, lunar.month, leap) ?? lunar.day;
	const day = Math.min(lunar.day, length);
	if (day !== lunar.day) rule = 'month-end';
	return { solar: lookup.toSolar(targetYear, lunar.month, leap, day), rule, leapCollapsed: lunar.leap && !leap };
}
