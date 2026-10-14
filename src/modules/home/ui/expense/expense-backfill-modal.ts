// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads, src/expense-backfill-modal.ts
import type { App } from 'obsidian';
import { createElement } from 'react';
import { t } from '../../../../shared/i18n';
import { homeServices } from '../../services/instances';
import type { ExpenseRecord } from '../../core/expense/model';
import { openRecordDialog } from '../dialogs/open-record-dialog';
import { ExpenseEntryPanel, type ExpenseEntry } from './ExpenseEntryPanel';
export type ExpenseBackfillInput = ExpenseEntry;
export interface ExpenseBackfillOptions {
	initial?: ExpenseRecord;
	aboveOverlay?: boolean;
}
export class ExpenseBackfillModal {
	private cleanup?: () => void;
	constructor(
		private app: App,
		private onSave: (input: ExpenseEntry) => void,
		private options: ExpenseBackfillOptions = {},
	) {}
	open(): void {
		const service = homeServices.expense;
		if (!service) return;
		this.cleanup = openRecordDialog(
			this.app.workspace.containerEl.ownerDocument,
			t(this.options.initial ? 'expense.editTitle' : 'expense.backfillTitle'),
			'dashboard-library-config-modal',
			(close) =>
				createElement(ExpenseEntryPanel, {
					service,
					initial: this.options.initial,
					onSave: (input) => {
						this.onSave(input);
						return true;
					},
					close,
				}),
		);
	}
	close(): void {
		this.cleanup?.();
		this.cleanup = undefined;
	}
}
