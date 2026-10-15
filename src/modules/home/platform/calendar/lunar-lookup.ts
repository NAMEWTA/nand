import type { LunarLookup } from '../../core/anniversaries/lunar-map';

/** Lunar conversion for anniversary dates. The library loads only when a lunar anniversary is shown. */
export type DisplayLunarLookup = LunarLookup & {
	displayDate(solarIso: string): { year: string; month: string; day: string };
};
export async function createLunarLookup(): Promise<DisplayLunarLookup> {
	const { lunarLookup, calendarDay } = await import('../../core/anniversaries/lunar-calendar');
	return {
		...lunarLookup,
		displayDate(iso) {
			const { lunar } = calendarDay(new Date(iso + 'T12:00:00'));
			return { year: lunar.getYearInChinese(), month: lunar.getMonthInChinese(), day: lunar.getDayInChinese() };
		},
	};
}
