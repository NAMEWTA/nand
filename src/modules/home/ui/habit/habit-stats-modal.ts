import { h } from 'preact';
import { homePages } from '../../services/instances';
import type { HabitService } from '../../platform/habit/habit-service';
import { DashboardPanelModal } from '../ui/panel-modal';
import { HabitStatsPanel } from './HabitStatsPanel';
export function showHabitStats(_doc: Document, service: HabitService): void {
	// Statistics are workbench pages; the dialog remains for hosts without a workbench.
	if (homePages.openRecords) return homePages.openRecords('habits');
	new DashboardPanelModal(service.getApp(), 'dashboard-habit-stats-modal', (close) =>
		h(HabitStatsPanel, { service, close }),
	).open();
}
