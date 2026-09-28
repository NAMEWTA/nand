import { h } from 'preact';
import type { ExpenseService } from '../../../platform/obsidian/expense/expense-service';
import { DashboardPanelModal } from '../ui/panel-modal';
import { ExpenseStatsPanel } from './ExpenseStatsPanel';
export function showExpenseStats(_doc: Document, service: ExpenseService): void {
	new DashboardPanelModal(
		service.getApp(),
		'dashboard-expense-stats-modal dashboard-expense-stats-modal--wide',
		(close, root) => h(ExpenseStatsPanel, { service, close, root }),
	).open();
}
