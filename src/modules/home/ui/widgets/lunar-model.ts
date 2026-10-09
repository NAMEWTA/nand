import type { App } from 'obsidian';
import { fetchHolidayData, type HolidayInfo } from '../../platform/calendar/holiday-service';

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

export async function loadHolidayData(app: App): Promise<Record<string, HolidayInfo>> {
	const year = new Date().getFullYear();
	return fetchHolidayData(app, year);
}

type LunarCompute = typeof import('./lunar-compute');
let compute: LunarCompute | undefined;
let loading: Promise<LunarCompute> | undefined;
/** The lunar calendar library and almanac (~340 KB) load the first time a lunar widget renders. */
export function loadLunar(): Promise<LunarCompute> {
	loading ??= import('./lunar-compute').then((module) => (compute = module));
	return loading;
}
/** The loaded lunar functions, or undefined before `loadLunar()` resolves. */
export const lunarCompute = (): LunarCompute | undefined => compute;
