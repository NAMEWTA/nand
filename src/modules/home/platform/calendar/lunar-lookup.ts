import type { LunarLookup } from '../../core/anniversaries/lunar-map';

/** Lunar conversion for anniversary dates. The library loads only when a lunar anniversary is shown. */
export async function createLunarLookup(): Promise<LunarLookup> {
	const { Solar, Lunar, LunarMonth } = await import('lunar-typescript');
	const iso = (year: number, month: number, day: number) =>
		`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	return {
		toLunar(solarIso) {
			const [year, month, day] = solarIso.split('-').map(Number);
			const lunar = Solar.fromYmd(year!, month!, day!).getLunar();
			const lunarMonth = lunar.getMonth();
			return { year: lunar.getYear(), month: Math.abs(lunarMonth), leap: lunarMonth < 0, day: lunar.getDay() };
		},
		monthDays(year, month, leap) {
			return LunarMonth.fromYm(year, leap ? -month : month)?.getDayCount();
		},
		toSolar(year, month, leap, day) {
			const solar = Lunar.fromYmd(year, leap ? -month : month, day).getSolar();
			return iso(solar.getYear(), solar.getMonth(), solar.getDay());
		},
	};
}
