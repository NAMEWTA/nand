import { h } from 'preact';
import { homePages } from '../../services/instances';
import type { ExpenseService } from '../../platform/expense/expense-service';
import { DashboardPanelModal } from '../ui/panel-modal';
import { ExpenseStatsPanel } from './ExpenseStatsPanel';
export function showExpenseStats(_doc: Document, service: ExpenseService): void {
	// Statistics are workbench pages; the dialog remains for hosts without a workbench.
	if (homePages.openRecords) return homePages.openRecords('expenses');
	new DashboardPanelModal(
		service.getApp(),
		'dashboard-expense-stats-modal dashboard-expense-stats-modal--wide',
		(close, root) => h(ExpenseStatsPanel, { service, close, root }),
	).open();
}
