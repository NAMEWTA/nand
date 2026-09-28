import type { App, TFile } from 'obsidian';
import { h } from 'preact';
import type { DashboardSettings } from '../../../core/dashboard/types/index';
import { getRenderContext, mountDashboardPanel } from '../renderer/render-context';
import type { DashboardSettingsAccess } from '../settings-access';
import { CalendarPanel } from './CalendarPanel';
import { DayAgendaModal } from './calendar-modal';
import { calendarReloaders } from './calendar-reload';
export function refreshCalendarSections(kanban: HTMLElement): boolean {
	let refreshed = false;
	kanban.querySelectorAll<HTMLElement>('.dashboard-calendar-section').forEach((root) => {
		const reload = calendarReloaders.get(root);
		if (reload) {
			void reload(false);
			refreshed = true;
		}
	});
	return refreshed;
}
export function renderCalendarSection(
	el: HTMLElement,
	app: App,
	settings: DashboardSettings,
	onOpenNote?: (file: TFile, line?: number) => void,
	settingsAccess?: DashboardSettingsAccess,
): void {
	const root = el.createDiv({ cls: 'dashboard-calendar-section' });
	mountDashboardPanel(
		root,
		h(CalendarPanel, {
			root,
			app,
			settings,
			settingsAccess,
			onOpenNote,
			context: getRenderContext(root),
			openDay: (iso, tasks, focus, onToggle) =>
				new DayAgendaModal(
					app,
					iso,
					tasks,
					{ onToggle, onOpenNote, settingsAccess },
					settings.dashboardFile,
					focus,
				).open(),
		}),
	);
}
