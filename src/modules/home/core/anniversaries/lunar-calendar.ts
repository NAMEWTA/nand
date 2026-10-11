import { Lunar, LunarMonth, Solar } from 'lunar-typescript';
import { validCivilDate } from './civil-date';
import type { LunarLookup } from './lunar-map';

/** Shared pure conversion. Consumers load this module only when a lunar view is needed. */
export function calendarDay(date: Date): { solar: Solar; lunar: Lunar } {
	const solar = Solar.fromDate(date);
	return { solar, lunar: solar.getLunar() };
}

export const lunarLookup: LunarLookup = {
	toLunar(iso) {
		if (!validCivilDate(iso)) throw new RangeError('Invalid solar day');
		const [year, month, day] = iso.split('-').map(Number);
		const lunar = Solar.fromYmd(year!, month!, day!).getLunar();
		return { year: lunar.getYear(), month: Math.abs(lunar.getMonth()), leap: lunar.getMonth() < 0, day: lunar.getDay() };
	},
	monthDays(year, month, leap) {
		if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) return undefined;
		return LunarMonth.fromYm(year, leap ? -month : month)?.getDayCount();
	},
	toSolar(year, month, leap, day) {
		const length = lunarLookup.monthDays(year, month, leap);
		if (!length || !Number.isInteger(day) || day < 1 || day > length) throw new RangeError('Invalid lunar day');
		const solar = Lunar.fromYmd(year, leap ? -month : month, day).getSolar();
		const iso = `${String(solar.getYear()).padStart(4, '0')}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`;
		if (!validCivilDate(iso)) throw new RangeError('Invalid converted solar day');
		return iso;
	},
};
