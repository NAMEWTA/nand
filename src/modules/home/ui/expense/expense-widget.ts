import { App, Notice } from 'obsidian';
import { h } from 'preact';
import { formatExpenseAmount } from '../../core/expense/model';
import { t } from '../../../../shared/i18n';
import { mountDashboardPanel } from '../renderer/render-context';
import { ExpensePanel } from './ExpensePanel';
import { ExpenseBackfillModal } from './expense-backfill-modal';
import { categoryLabel } from './expense-category-ui';
import { showExpenseStats } from './expense-stats-modal';
import { homeServices } from '../../services/instances';
export function renderSidebarExpenseWidget(container: HTMLElement, app: App): void {
	const service = (homeServices.expense ?? null);
	if (!service) return;
	const root = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-expense' });
	root.addEventListener('dragstart', (event) => {
		if ((event.target as HTMLElement).closest('input,select')) event.preventDefault();
	});
	mountDashboardPanel(
		root,
		h(ExpensePanel, {
			service,
			root,
			stats: () => showExpenseStats(root.ownerDocument, service),
			backfill: () => {
				new ExpenseBackfillModal(app, (input) => {
					const live = (homeServices.expense ?? null);
					if (!live) return;
					const record = live.addRecord(input);
					if (!record) {
						new Notice(t('expense.invalidAmount'));
						return;
					}
					void live.flush().then(() => { new Notice(
						t('expense.added', {
							type: t(record.type === 'expense' ? 'expense.expenseLabel' : 'expense.incomeLabel'),
							amount: `${live.getCurrency()}${formatExpenseAmount(record.amount)}`,
							category: categoryLabel(record.category),
							date: record.date.slice(5),
						}),
					);
					}).catch(() => { new Notice(t('storage.unsaved')); });
				}).open();
			},
		}),
	);
}
