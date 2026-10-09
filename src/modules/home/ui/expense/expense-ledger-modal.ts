import { h } from 'preact';
import type { ExpenseService } from '../../platform/expense/expense-service';
import { DashboardPanelModal } from '../ui/panel-modal';
import { ExpenseLedgerPanel } from './ExpenseLedgerPanel';
export function showExpenseLedger(_doc: Document, service: ExpenseService): void {
	new DashboardPanelModal(service.getApp(), 'dashboard-expense-ledger-modal', (close) =>
		h(ExpenseLedgerPanel, { service, close }),
	).open();
}
