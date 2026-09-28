import type { App, TFile } from 'obsidian';
import { h } from 'preact';
import type { DashboardSettings } from '../../../core/dashboard/types/index';
import { getRenderContext, mountDashboardPanel } from '../renderer/render-context';
import type { DashboardSettingsAccess } from '../settings-access';
import { CalendarPanel } from './CalendarPanel';
import { CalendarMonthModal, DayAgendaModal } from './calendar-modal';
import { calendarReloaders } from './calendar-reload';
export function refreshSidebarTaskCalendar(root: HTMLElement, resetToToday = false): boolean {
	const widget = root.querySelector<HTMLElement>('.dashboard-sidebar-calendar'),
		reload = widget && calendarReloaders.get(widget);
	if (!widget?.isConnected || !reload) return false;
	void reload(resetToToday);
	return true;
}
export function renderSidebarCalendar(
	container: HTMLElement,
	settings: DashboardSettings,
	app: App,
	onOpenNote?: (file: TFile, line?: number) => void,
	opts?: { autoLoad?: boolean },
	settingsAccess?: DashboardSettingsAccess,
): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-calendar' });
	const content = widget.createDiv({ cls: 'dashboard-library-content dashboard-calendar-content' });
	mountDashboardPanel(
		content,
		h(CalendarPanel, {
			root: widget,
			app,
			settings,
			settingsAccess,
			onOpenNote,
			autoLoad: opts?.autoLoad,
			widget: true,
			context: getRenderContext(widget),
			openDay: (iso, tasks, focus, onToggle) =>
				new DayAgendaModal(
					app,
					iso,
					tasks,
					{ onToggle, onOpenNote, settingsAccess },
					settings.dashboardFile,
					focus,
				).open(),
			openFull: (byDay, view, week, onToggle) =>
				new CalendarMonthModal(
					app,
					byDay,
					{ onToggle, onOpenNote, settingsAccess },
					view,
					view === 'week' ? week : undefined,
					settings.dashboardFile,
				).open(),
		}),
	);
}
