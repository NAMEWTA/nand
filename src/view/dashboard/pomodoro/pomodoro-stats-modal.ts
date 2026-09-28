import { h } from 'preact';
import type { PomodoroService } from '../../../platform/obsidian/pomodoro/pomodoro-service';
import { DashboardPanelModal } from '../ui/panel-modal';
import { PomodoroStatsPanel } from './PomodoroStatsPanel';
export function showPomodoroStats(_doc: Document, service: PomodoroService): void {
	new DashboardPanelModal(
		service.getApp(),
		'dashboard-pomodoro-stats-modal dashboard-pomodoro-stats-modal--wide',
		(close, root) => h(PomodoroStatsPanel, { service, close, root }),
		service,
	).open();
}
