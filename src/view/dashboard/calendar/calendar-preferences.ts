import { Notice } from 'obsidian';
import { type CalendarTaskFilter } from '../../../core/calendar/task-filter';
import { CALENDAR_TASK_FILTERS } from '../../../platform/obsidian/calendar/alltasks-scan';
import { t } from '../../../shared/i18n/index';
import type { DashboardSettingsAccess } from '../settings-access';

/** Current persisted filter shared by both calendar surfaces. */
export function readCalendarTaskFilter(access?: DashboardSettingsAccess): CalendarTaskFilter {
	const raw = access?.getSettings().calendarTaskFilter;
	return raw !== undefined && CALENDAR_TASK_FILTERS.includes(raw) ? raw : 'all';
}

export async function writeCalendarTaskFilter(
	access: DashboardSettingsAccess | undefined,
	filter: CalendarTaskFilter,
): Promise<boolean> {
	if (!access) {
		new Notice(t('settings.writeFailed'));
		return false;
	}
	return access.updateSettings((current) => ({ ...current, calendarTaskFilter: filter }));
}

export function readTaskTarget(
	access?: DashboardSettingsAccess,
): import('../../../core/dashboard/types/index').CalendarTaskTarget | undefined {
	const target = access?.getSettings().calendarTaskTarget;
	return target && target.path?.trim() && (target.kind === 'file' || target.kind === 'folder') ? target : undefined;
}

export function readTaskInsertPosition(access?: DashboardSettingsAccess): 'start' | 'end' {
	return access?.getSettings().calendarTaskInsertPosition === 'end' ? 'end' : 'start';
}
