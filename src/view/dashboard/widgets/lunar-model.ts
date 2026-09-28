import { Solar } from 'lunar-typescript';
import type { App } from 'obsidian';
import {
	fetchHolidayData,
	getHolidayForDate,
	type HolidayInfo,
} from '../../../platform/obsidian/calendar/holiday-service';
import { getTodayAlmanac } from './lunar-almanac';

export interface LunarWidgetData {
	lunarDate: string;
	ganZhiYear: string;
	zodiac: string;
	ganZhiMonth: string;
	ganZhiDay: string;
	jieQi: string;
	festivals: string[];
	holiday: HolidayInfo | null;
	almanac: string;
}

export function computeLunarData(date: Date, holidayData: Record<string, HolidayInfo>): LunarWidgetData {
	const solar = Solar.fromDate(date);
	const lunar = solar.getLunar();

	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	const dateStr = `${y}-${m}-${d}`;

	const festivals = [...lunar.getFestivals(), ...solar.getFestivals(), ...lunar.getOtherFestivals()].filter(
		(v, i, a) => a.indexOf(v) === i,
	);

	return {
		lunarDate: formatLunarDate(lunar),
		ganZhiYear: lunar.getYearInGanZhi(),
		zodiac: lunar.getYearShengXiao(),
		ganZhiMonth: lunar.getMonthInGanZhi(),
		ganZhiDay: lunar.getDayInGanZhi(),
		jieQi: lunar.getJieQi() ?? '',
		festivals: festivals.filter((v, i, a) => a.indexOf(v) === i),
		holiday: getHolidayForDate(dateStr, holidayData),
		almanac: getTodayAlmanac(),
	};
}

export function formatLunarDate(lunar: import('lunar-typescript').Lunar): string {
	const month = lunar.getMonthInChinese();
	const day = lunar.getDayInChinese();
	const isLeap = lunar.getMonth() < 0;
	return (isLeap ? '闰' : '') + month + '月' + day;
}

export async function loadHolidayData(app: App): Promise<Record<string, HolidayInfo>> {
	const year = new Date().getFullYear();
	return fetchHolidayData(app, year);
}
