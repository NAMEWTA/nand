// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads, src/expense-stats-modal.ts
import { createElement } from 'react';
import { t } from '../../../../shared/i18n';
import type { ExpenseService } from '../../platform/expense/expense-service';
import { openRecordDialog } from '../dialogs/open-record-dialog';
import { ExpenseStatsPanel } from './ExpenseStatsPanel';
export function showExpenseStats(doc: Document, service: ExpenseService): void {
	openRecordDialog(
		doc,
		t('expense.statsTitle'),
		'dashboard-expense-stats-modal dashboard-expense-stats-modal--wide',
		(close) => createElement(ExpenseStatsPanel, { service, close }),
	);
}
