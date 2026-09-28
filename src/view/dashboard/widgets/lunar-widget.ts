import type { App } from 'obsidian';
import { h } from 'preact';
import type { HolidayInfo } from '../../../platform/obsidian/calendar/holiday-service';
import { mountDashboardPanel } from '../renderer/render-context';
import { LunarPanel } from './LunarPanel';
import { FortuneStickModal } from './fortune-stick-modal';
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
				if (app) new FortuneStickModal().open();
			},
		}),
	);
}
