// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { getMoment, type WeekStart } from '../core/moment-format';

/** Obsidian's interface language as a Moment locale (e.g. `en`, `zh-cn`). */
export function obsidianLocale(): string | undefined {
	return getMoment().locale() || undefined;
}

/** First day of the week the locale uses (0 = Sunday), as Obsidian's Moment has it. */
export function localeWeekStart(): WeekStart {
	const first = getMoment().localeData().firstDayOfWeek();
	return first >= 0 && first <= 6 ? (first as WeekStart) : 1;
}

export type WeekStartSetting = 'auto' | 'monday' | 'sunday' | 'saturday';

export function resolveWeekStart(setting: WeekStartSetting): WeekStart {
	switch (setting) {
		case 'monday': return 1;
		case 'sunday': return 0;
		case 'saturday': return 6;
		default: return localeWeekStart();
	}
}
