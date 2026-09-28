import { h } from 'preact';
import type { PomodoroService } from '../../../platform/obsidian/pomodoro/pomodoro-service';
import { DashboardPanelModal } from '../ui/panel-modal';
import { PomodoroTagsPanel } from './PomodoroTagsPanel';
export function openPomodoroTagManager(_doc: Document, service: PomodoroService, onChange: () => void): void {
	new DashboardPanelModal(
		service.getApp(),
		'dashboard-pomodoro-stats-modal dashboard-pomodoro-tagmanager',
		(close) => h(PomodoroTagsPanel, { service, close, onChange }),
		service,
	).open();
}
