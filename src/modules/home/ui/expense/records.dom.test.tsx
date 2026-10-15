import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../ui/react/test-providers';
import { setLanguage, t } from '../../../../shared/i18n';
import { ExpenseApplication } from '../../core/expense/application';
import type { ExpenseService } from '../../platform/expense/expense-service';
import { ExpenseEntryPanel } from './ExpenseEntryPanel';
import { ExpenseStatsPanel } from './ExpenseStatsPanel';
import { ExpenseLedgerPanel } from './ExpenseLedgerPanel';
import { RecordDialog } from '../dialogs/RecordDialog';
import type { TextStorage } from '../../../../shared/storage/ports';
const data = new Map<string, string>();
const memory: TextStorage = {
	exists: async (path) => data.has(path),
	read: async (path) => data.get(path) ?? '',
	write: async (path, value) => {
		data.set(path, value);
	},
	mkdir: async () => {},
};
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});
function service() {
	data.clear();
	setLanguage('en');
	vi.useFakeTimers({ now: new Date('2026-10-14T12:00:00'), toFake: ['Date'] });
	return new ExpenseApplication(memory, 'data', () => '$') as ExpenseService;
}
test('backfill rejects future dates and saves a full entry only on confirmation', () => {
	const s = service(),
		save = vi.fn(() => true),
		close = vi.fn();
	render(
		<TestProviders>
			<ExpenseEntryPanel service={s} onSave={save} close={close} />
		</TestProviders>,
	);
	fireEvent.change(screen.getByLabelText(t('expense.dateLabel')), { target: { value: '2026-10-15' } });
	fireEvent.change(screen.getByLabelText(t('expense.colAmount')), { target: { value: '12.50' } });
	fireEvent.click(screen.getByText(t('common.save')));
	expect(save).not.toHaveBeenCalled();
	expect(screen.getByRole('alert').textContent).toBe(t('expense.futureDate'));
	fireEvent.change(screen.getByLabelText(t('expense.dateLabel')), { target: { value: '2026-10-13' } });
	fireEvent.click(screen.getByText(t('common.save')));
	expect(save).toHaveBeenCalledExactlyOnceWith({
		type: 'expense',
		amount: 12.5,
		category: 'food',
		date: '2026-10-13',
		note: '',
	});
	expect(close).toHaveBeenCalledTimes(1);
});
test('ledger edit writes the selected record; delete first focuses cancel and only commits after confirmation', async () => {
	const s = service();
	s.addRecord({ type: 'expense', amount: 10, category: 'food', date: '2026-10-14', note: 'Lunch' });
	render(
		<TestProviders>
			<RecordDialog title="Ledger" classes="dashboard-expense-ledger-modal" onClose={() => {}}>
				<ExpenseLedgerPanel service={s} close={() => {}} />
			</RecordDialog>
		</TestProviders>,
	);
	fireEvent.click(screen.getByLabelText(t('expense.ledger.editRecord')));
	fireEvent.change(screen.getByLabelText(t('expense.colAmount')), { target: { value: '25' } });
	fireEvent.click(screen.getByText(t('common.save')));
	expect(s.getRecords()[0]?.amount).toBe(25);
	fireEvent.click(screen.getByLabelText(t('expense.deleteRecord')));
	expect(s.getRecords()).toHaveLength(1);
	await waitFor(() => expect(document.activeElement?.textContent).toBe(t('common.cancel')));
	fireEvent.click(screen.getByText(t('common.cancel')));
	expect(s.getRecords()).toHaveLength(1);
	fireEvent.click(screen.getByLabelText(t('expense.deleteRecord')));
	fireEvent.click(screen.getByText(t('common.confirm')));
	expect(s.getRecords()).toHaveLength(0);
});

test('statistics delete keeps the record on cancel and deletes only after confirmation', async () => {
	const s = service(); s.addRecord({ type: 'expense', amount: 10, category: 'food', date: '2026-10-14' });
	await s.flush();
	render(<TestProviders><ExpenseStatsPanel service={s} /></TestProviders>);
	fireEvent.click(screen.getByRole('button', { name: t('expense.deleteRecord') }));
	await screen.findByRole('alertdialog');
	await waitFor(() => expect(document.activeElement?.textContent).toBe(t('common.cancel')));
	fireEvent.click(screen.getByRole('button', { name: t('common.cancel') })); expect(s.getRecords()).toHaveLength(1);
	fireEvent.click(screen.getByRole('button', { name: t('expense.deleteRecord') }));
	fireEvent.click(screen.getByRole('button', { name: t('common.confirm') })); expect(s.getRecords()).toHaveLength(0);
	await s.flush();
});

function StatisticsFixture() {
 const [open, setOpen] = useState(false);
 return <><button onClick={() => setOpen(true)}>Open statistics</button>{open && <RecordDialog title="Statistics" classes="dashboard-pomodoro-stats-modal" onClose={() => setOpen(false)}><button onClick={() => setOpen(false)}>Close statistics</button></RecordDialog>}</>;
}
test('Escape returns focus to the statistics opener', async () => {
 render(<TestProviders><StatisticsFixture /></TestProviders>);
 const opener = screen.getByRole('button', { name: 'Open statistics' }); opener.focus(); fireEvent.click(opener);
 const dialog = await screen.findByRole('dialog'); fireEvent.keyDown(dialog, { key: 'Escape' });
 await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(document.activeElement).toBe(opener);
});
