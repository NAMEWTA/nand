// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads, src/expense-ledger-modal.ts
import { createElement } from 'react';
import { t } from '../../../../shared/i18n';
import type { ExpenseService } from '../../platform/expense/expense-service';
import { openRecordDialog } from '../dialogs/open-record-dialog';
import { ExpenseLedgerPanel } from './ExpenseLedgerPanel';
export function showExpenseLedger(doc: Document, service: ExpenseService): void {
	openRecordDialog(doc, t('expense.ledger.title'), 'dashboard-expense-ledger-modal', (close) =>
		createElement(ExpenseLedgerPanel, { service, close }),
	);
}
