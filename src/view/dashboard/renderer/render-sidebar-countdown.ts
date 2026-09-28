import { App } from 'obsidian';
import { h } from 'preact';
import type { PomodoroService } from '../../../platform/obsidian/pomodoro/pomodoro-service';
import type { ReadingService } from '../../../platform/obsidian/reading/reading-service';
import { showPomodoroStats as openWidePomodoroStats } from '../pomodoro/pomodoro-stats-modal';
import { openBookSearch, openEditBookInfo, openEndReadingModal, showReadingStats } from '../reading/reading-dialogs';
import { ReadingPanel } from '../reading/ReadingPanel';
import type { DashboardSettingsAccess } from '../settings-access';
import { CountdownSettingsModal } from '../widgets/countdown-modal';
import { CountdownPanel } from '../widgets/CountdownPanel';
import { applyWidgetBackground } from '../widgets/widget-background';
import { mountDashboardPanel } from './render-context';

export function renderSidebarCountdown(
	container: HTMLElement,
	cd: import('../../../core/dashboard/types').CountdownConfig,
	app: App,
	settingsAccess?: DashboardSettingsAccess,
): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-countdown' });
	applyWidgetBackground(widget, cd.background, app);
	mountDashboardPanel(
		widget,
		h(CountdownPanel, {
			config: cd,
			win: widget.ownerDocument.defaultView!,
			edit: () => {
				new CountdownSettingsModal(app, cd, (updated) => {
					void settingsAccess?.updateSettings((current) => ({
						...current,
						countdowns: current.countdowns.map((c) => (c.id === updated.id ? updated : c)),
					}));
				}).open();
			},
		}),
	);
}
export function showPomodoroStats(doc: Document, service: PomodoroService): void {
	// Landscape stats modal lives in its own module (KPIs, donut, trend,
	// ranking, heatmap, recent records + tag management entry).
	openWidePomodoroStats(doc, service);
}
export function renderSidebarReading(container: HTMLElement, service: ReadingService): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-reading' });
	mountDashboardPanel(
		widget,
		h(ReadingPanel, {
			service,
			add: () =>
				openBookSearch(widget.ownerDocument, service, (book) => {
					if (book) void service.addActiveBook(book);
				}),
			statistics: () => showReadingStats(widget.ownerDocument, service),
			edit: (book) => openEditBookInfo(widget.ownerDocument, service, book, () => {}),
			finish: (book) =>
				openEndReadingModal(widget.ownerDocument, service, book, service.getElapsedSeconds(), () => {}),
		}),
	);
}
