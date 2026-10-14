// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/expense-backfill-modal.ts
import { useState } from 'react';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { RecordButton as Button } from '../dialogs/RecordButton';
import { Choice } from '../board/controls';
import { widgetClasses } from '../theme/widget-classes';
import { useT } from '../../../../ui/react/hooks';
import {
	expenseToday,
	sanitizeAmountInput,
	EXPENSE_MAX_NOTE_LENGTH,
	type ExpenseRecord,
	type ExpenseType,
} from '../../core/expense/model';
import type { ExpenseService } from '../../platform/expense/expense-service';
import { categoryLabel } from './expense-label';
export interface ExpenseEntry {
	type: ExpenseType;
	amount: number;
	category: string;
	note: string;
	date: string;
}
export function ExpenseEntryPanel({
	service,
	initial,
	onSave,
	close,
}: {
	service: ExpenseService;
	initial?: ExpenseRecord;
	onSave(this: void, input: ExpenseEntry): boolean;
	close(this: void): void;
}) {
	const t = useT(),
		[date, setDate] = useState(initial?.date ?? expenseToday()),
		[type, setType] = useState<ExpenseType>(initial?.type ?? 'expense'),
		[amount, setAmount] = useState(initial ? String(initial.amount) : ''),
		[category, setCategory] = useState(initial?.category ?? service.getOrderedCategories('expense')[0] ?? ''),
		[note, setNote] = useState(initial?.note ?? ''),
		[error, setError] = useState('');
	const save = () => {
		if (date > expenseToday()) {
			setError(t('expense.futureDate'));
			return;
		}
		if (!onSave({ type, amount: Number(amount), category, note, date })) {
			setError(t('expense.invalidAmount'));
			return;
		}
		close();
	};
	return (
		<form
			className={widgetClasses('dashboard-modal dashboard-modal--compact')}
			onSubmit={(e) => {
				e.preventDefault();
				save();
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault();
			}}
		>
			<div className={widgetClasses('dashboard-modal-header')}>
				<div className={widgetClasses('dashboard-modal-title')}>
					{t(initial ? 'expense.editTitle' : 'expense.backfillTitle')}
				</div>
			</div>
			<div className={widgetClasses('dashboard-modal-body')}>
				<Label className="grid gap-2">
					{t('expense.dateLabel')}
					<Input type="date" max={expenseToday()} value={date} onChange={(e) => setDate(e.target.value)} />
				</Label>
				<div className={widgetClasses('dashboard-library-view-toggle')}>
					{(['expense', 'income'] as const).map((value) => (
						<Button
							type="button"
							key={value}
							className={widgetClasses(`dashboard-library-view-btn ${value === type ? 'active' : ''}`)}
							onClick={() => {
								setType(value);
								setCategory(service.getOrderedCategories(value)[0] ?? '');
							}}
						>
							{t(value === 'expense' ? 'expense.typeExpense' : 'expense.typeIncome')}
						</Button>
					))}
				</div>
				<div className="flex items-center gap-2">
					<span>{service.getCurrency()}</span>
					<Input
						autoFocus
						aria-label={t('expense.colAmount')}
						inputMode="decimal"
						value={amount}
						placeholder="0.00"
						onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
					/>
					<Choice
						label={t('expense.colCategory')}
						value={category}
						onChange={setCategory}
						options={service
							.getOrderedCategories(type)
							.map((value) => ({ value, label: categoryLabel(value) }))}
					/>
				</div>
				<Label className="grid gap-2">
					{t('expense.colNote')}
					<Input
						value={note}
						maxLength={EXPENSE_MAX_NOTE_LENGTH}
						placeholder={t('expense.notePlaceholder')}
						onChange={(e) => setNote(e.target.value)}
					/>
				</Label>
				{error && (
					<p role="alert" className="text-destructive">
						{error}
					</p>
				)}
			</div>
			<div className={widgetClasses('dashboard-modal-footer')}>
				<Button
					type="button"
					className={widgetClasses('dashboard-modal-btn dashboard-modal-btn--cancel')}
					onClick={close}
				>
					{t('common.cancel')}
				</Button>
				<Button type="submit" className={widgetClasses('dashboard-modal-btn dashboard-modal-btn--confirm')}>
					{t('common.save')}
				</Button>
			</div>
		</form>
	);
}
