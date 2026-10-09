import type { App } from 'obsidian';
import { h } from 'preact';
import type { HolidayInfo } from '../../platform/calendar/holiday-service';
import { mountDashboardPanel } from '../renderer/render-context';
import { LunarPanel } from './LunarPanel';
export function renderSidebarLunarWidget(
	container: HTMLElement,
	holidayData: Record<string, HolidayInfo>,
	app?: App,
): void {
	const root = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-lunar' });
	mountDashboardPanel(
		root,
		h(LunarPanel, {
			holidays: holidayData,
			win: root.ownerDocument.defaultView!,
			fortune: () => {
				// The fortune texts (~175 KB) load when the dialog is opened.
				if (app) void import('./fortune-stick-modal').then(({ FortuneStickModal }) => new FortuneStickModal().open());
			},
		}),
	);
}
