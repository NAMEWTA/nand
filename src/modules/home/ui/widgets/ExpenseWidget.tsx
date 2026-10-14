// Adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), src/expense-widget.ts.
import { useRef, useState } from 'react';
import { useStore } from 'zustand';
import { ArrowDownRight, ArrowUpRight, CalendarPlus, Wallet } from 'lucide-react';
import { Input } from '../../../../ui/components/input';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { todayStr } from '../../core/habit/model';
import { Choice, IconButton } from '../board/controls';
import { DashboardDialog } from '../dialogs/DashboardDialog';
export function ExpenseWidget({ store, compact = false }: { store: BoardStore; compact?: boolean }) {
	useStore(store.state, (s) => s.widgetRevision);
	const t = useT(),
		service = store.widgets.expense,
		[amounts, setAmounts] = useState({ expense: '', income: '' }),
		[categories, setCategories] = useState({ expense: '', income: '' }),
		[note, setNote] = useState(''),
		[date, setDate] = useState(todayStr),
		[backfill, setBackfill] = useState(false),
		[invalid, setInvalid] = useState(false),
		active = useRef<'expense' | 'income'>('expense');
	if (!service) return null;
	const totals = service.getTodayTotals();
	const submit = (type: 'expense' | 'income') => {
		const result = service.addRecord({
			type,
			amount: +amounts[type],
			category: categories[type] || service.getOrderedCategories(type)[0] || '',
			note,
			date,
		});
		setInvalid(!result);
		if (result) {
			setAmounts((s) => ({ ...s, [type]: '' }));
			setNote('');
		}
	};
	return (
		<>
			<div className={`flex h-5 items-center gap-1.5 ${compact ? 'mb-1' : 'mb-1.5'}`}>
				<h3 className="m-0 flex items-center gap-1 text-[.7em] font-semibold tracking-[.08em] text-primary">
					<Wallet className="size-3" />
					{t('expense.title')}
				</h3>
				<span className="text-[.65em] text-muted-foreground" aria-label={t('home.dashboard.net')}>
					{totals.income || totals.expense
						? `${service.getCurrency()}${(totals.income - totals.expense).toFixed(2)}`
						: ''}
				</span>
				<IconButton
					className="ml-auto size-5"
					label={t('expense.backfillTitle')}
					onClick={() => setBackfill(true)}
				>
					<CalendarPlus className="size-3" />
				</IconButton>
			</div>
			<div className={`dashboard-expense-form flex flex-col ${compact ? 'gap-1 text-[.92em]' : 'gap-[7px]'}`}>
				{(['expense', 'income'] as const).map((type) => {
					const options = service.getOrderedCategories(type),
						category = categories[type] || options[0] || '';
					return (
						<div
							key={type}
							className="flex h-[calc(var(--input-height,30px)+1px)] min-w-0 items-center gap-1"
							onFocus={() => {
								active.current = type;
							}}
						>
							<span className="flex shrink-0 items-center gap-1 text-[.7em] text-muted-foreground">
								{type === 'expense' ? (
									<ArrowDownRight className="size-2.5 text-destructive" />
								) : (
									<ArrowUpRight className="size-2.5 text-primary" />
								)}
								{t(`home.dashboard.${type}`)}
							</span>
							<div className="flex min-w-0 flex-1 items-center gap-1 border-b border-[var(--db-border-card)] px-0.5">
								<span className="text-[.7em] text-muted-foreground">{service.getCurrency()}</span>
								<Input
									aria-label={t(`home.dashboard.${type}`)}
									aria-invalid={invalid}
									inputMode="decimal"
									placeholder="0.00"
									className="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-[3px] text-[.82em] shadow-none"
									value={amounts[type]}
									onChange={(e) => setAmounts({ ...amounts, [type]: e.target.value })}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(type);
									}}
								/>
							</div>
							<Choice
								className="h-8 w-auto min-w-0 max-w-[42%] shrink border-0 bg-transparent px-1 py-[3px] text-[.68em] shadow-none"
								label={t('home.dashboard.category')}
								value={category}
								onChange={(value) => setCategories({ ...categories, [type]: value })}
								options={options.map((value) => ({
									value,
									label:
										t(`expense.cat.${value}`) === `expense.cat.${value}`
											? value
											: t(`expense.cat.${value}`),
								}))}
							/>
						</div>
					);
				})}
				<div className="flex h-[var(--input-height,30px)] min-w-0 items-center gap-1.5">
					<Input
						aria-label={t('expense.notePlaceholder')}
						placeholder={t('expense.notePlaceholder')}
						value={note}
						className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 py-[3px] text-[.72em] shadow-none"
						onChange={(e) => setNote(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(active.current);
						}}
					/>
					<Button
						variant="ghost"
						className="h-8 px-2 py-[3px] text-[.72em] text-primary"
						onClick={() => submit(active.current)}
					>
						{t('expense.submit')}
					</Button>
				</div>
			</div>
			{backfill && (
				<DashboardDialog
					title={t('expense.backfillTitle')}
					onClose={() => setBackfill(false)}
					onSave={() => setBackfill(false)}
				>
					<Input
						aria-label={t('home.dashboard.date')}
						type="date"
						value={date}
						onChange={(e) => setDate(e.target.value)}
					/>
				</DashboardDialog>
			)}
		</>
	);
}
