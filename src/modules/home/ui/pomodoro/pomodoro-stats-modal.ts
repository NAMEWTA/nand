import { h } from 'preact';
import { homePages } from '../../services/instances';
import type { PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import { DashboardPanelModal } from '../ui/panel-modal';
import { PomodoroStatsPanel } from './PomodoroStatsPanel';
export function showPomodoroStats(_doc: Document, service: PomodoroService): void {
	// Statistics are workbench pages; the dialog remains for hosts without a workbench.
	if (homePages.openRecords) return homePages.openRecords('pomodoro');
	new DashboardPanelModal(
		service.getApp(),
		'dashboard-pomodoro-stats-modal dashboard-pomodoro-stats-modal--wide',
		(close, root) => h(PomodoroStatsPanel, { service, close, root }),
		service,
	).open();
}
