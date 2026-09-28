import { h } from 'preact';
import type { HabitService } from '../../../platform/obsidian/habit/habit-service';
import { DashboardPanelModal } from '../ui/panel-modal';
import { HabitStatsPanel } from './HabitStatsPanel';
export function showHabitStats(_doc: Document, service: HabitService): void {
	new DashboardPanelModal(service.getApp(), 'dashboard-habit-stats-modal', (close) =>
		h(HabitStatsPanel, { service, close }),
	).open();
}
