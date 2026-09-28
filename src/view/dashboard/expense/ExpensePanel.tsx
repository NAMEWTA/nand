import { Notice } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { expenseToday, formatExpenseAmount, sanitizeAmountInput, type ExpenseType } from '../../../core/expense/model';
import type { ExpenseService } from '../../../platform/obsidian/expense/expense-service';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import {
	CATEGORY_ADD_OPTION,
	CATEGORY_MANAGE_OPTION,
	categoryLabel,
	promptAndAddCategory,
	showCategoryManager,
} from './expense-category-ui';
export function ExpensePanel({
	service,
	root,
	backfill,
	stats,
}: {
	service: ExpenseService;
	root: HTMLElement;
	backfill: () => void;
	stats: () => void;
}) {
	const [, refresh] = useState(0),
		[note, setNote] = useState(''),
		[amounts, setAmounts] = useState({ expense: '', income: '' }),
		[categories, setCategories] = useState({
			expense: service.getLastCategory('expense'),
			income: service.getLastCategory('income'),
		});
	const [invalid, setInvalid] = useState<ExpenseType | null>(null),
		timer = useRef<number>(),
		inputs = useRef<Partial<Record<ExpenseType, HTMLInputElement | null>>>({}),
		last = useRef<ExpenseType>('expense');
	const win = root.ownerDocument.defaultView!;
	useLayoutEffect(() => service.subscribe(() => refresh((n) => n + 1)), [service]);
	useLayoutEffect(
		() => () => {
			if (timer.current !== undefined) win.clearTimeout(timer.current);
		},
		[win],
	);
	const flash = (type: ExpenseType) => {
		setInvalid(type);
		if (timer.current !== undefined) win.clearTimeout(timer.current);
		timer.current = win.setTimeout(() => setInvalid(null), 600);
	};
	const currency = service.getCurrency(),
		totals = service.getTodayTotals(),
		net = Math.round((totals.income - totals.expense) * 100) / 100;
	const commit = (type: ExpenseType, button = false) => {
		const raw = amounts[type].trim();
		if (!raw) {
			if (button) flash(type);
			return;
		}
		const record = service.addRecord({
			type,
			amount: Number(raw),
			category: service.getOrderedCategories(type).includes(categories[type])
				? categories[type]
				: service.getLastCategory(type),
			note,
			date: expenseToday(),
		});
		if (!record) {
			flash(type);
			new Notice(t('expense.invalidAmount'));
			return;
		}
		setAmounts((values) => ({ ...values, [type]: '' }));
		setNote('');
		new Notice(
			t('expense.added', {
				type: t(type === 'expense' ? 'expense.expenseLabel' : 'expense.incomeLabel'),
				amount: `${currency}${formatExpenseAmount(record.amount)}`,
				category: categoryLabel(record.category),
				date: record.date.slice(5),
			}),
		);
		inputs.current[type]?.focus();
	};
	return (
		<>
			<div class="dashboard-sidebar-expense-top">
				<div class="dashboard-sidebar-expense-title">
					<Icon className="dashboard-sidebar-expense-title-icon" name="wallet" />
					<span>{t('expense.title')}</span>
				</div>
				<div class="dashboard-sidebar-expense-count" aria-label={t('expense.netToday')}>
					{totals.expense > 0 || totals.income > 0
						? `${net < 0 ? '-' : ''}${currency}${formatExpenseAmount(Math.abs(net))}`
						: ''}
				</div>
				<div class="dashboard-sidebar-expense-top-spacer" />
				<div
					class="dashboard-sidebar-expense-icon-btn"
					role="button"
					aria-label={t('expense.backfillTitle')}
					onClick={backfill}
				>
					<Icon name="calendar-plus" />
				</div>
				<div
					class="dashboard-sidebar-expense-icon-btn"
					role="button"
					aria-label={t('expense.statsTitle')}
					onClick={stats}
				>
					<Icon name="bar-chart-2" />
				</div>
			</div>
			<div class="dashboard-sidebar-expense-form">
				{(['expense', 'income'] as const).map((type) => (
					<div key={type} class={`dashboard-sidebar-expense-row dashboard-sidebar-expense-row--${type}`}>
						<div
							class="dashboard-sidebar-expense-row-main"
							onFocusIn={() => {
								last.current = type;
							}}
						>
							<div class="dashboard-sidebar-expense-row-label">
								<Icon
									className="dashboard-sidebar-expense-row-label-icon"
									name={type === 'expense' ? 'arrow-down-right' : 'arrow-up-right'}
								/>
								<span>{t(type === 'expense' ? 'expense.expenseLabel' : 'expense.incomeLabel')}</span>
							</div>
							<div class="dashboard-sidebar-expense-amount-wrap">
								<div class="dashboard-sidebar-expense-currency">{currency}</div>
								<input
									ref={(el) => {
										inputs.current[type] = el;
									}}
									class={`dashboard-sidebar-expense-amount${invalid === type ? ' dashboard-sidebar-expense-invalid' : ''}`}
									type="text"
									inputMode="decimal"
									autoComplete="off"
									placeholder="0.00"
									aria-label={t(type === 'expense' ? 'expense.expenseLabel' : 'expense.incomeLabel')}
									value={amounts[type]}
									onInput={(e) => {
										const value = sanitizeAmountInput(e.currentTarget.value);
										e.currentTarget.value = value;
										setAmounts((old) => ({ ...old, [type]: value }));
									}}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && !e.isComposing) {
											e.preventDefault();
											commit(type);
										}
									}}
								/>
							</div>
							<select
								class="dashboard-sidebar-expense-category"
								value={
									service.getOrderedCategories(type).includes(categories[type])
										? categories[type]
										: service.getLastCategory(type)
								}
								onChange={(e) => {
									const value = e.currentTarget.value;
									if (value === CATEGORY_ADD_OPTION) {
										e.currentTarget.value = categories[type];
										void promptAndAddCategory(service, type).then((name) => {
											if (name) setCategories((old) => ({ ...old, [type]: name }));
										});
									} else if (value === CATEGORY_MANAGE_OPTION) {
										e.currentTarget.value = categories[type];
										showCategoryManager(root.ownerDocument, service);
									} else setCategories((old) => ({ ...old, [type]: value }));
								}}
							>
								{service.getOrderedCategories(type).map((value) => (
									<option key={value} value={value}>
										{categoryLabel(value)}
									</option>
								))}
								<option value={CATEGORY_ADD_OPTION}>{t('expense.cat.addOption')}</option>
								<option value={CATEGORY_MANAGE_OPTION}>{t('expense.cat.manageOption')}</option>
							</select>
						</div>
					</div>
				))}
				<div class="dashboard-sidebar-expense-note-wrap">
					<input
						class="dashboard-sidebar-expense-note"
						value={note}
						placeholder={t('expense.notePlaceholder')}
						aria-label={t('expense.notePlaceholder')}
						onInput={(e) => setNote(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.isComposing) {
								e.preventDefault();
								commit(last.current);
							}
						}}
					/>
					<button class="dashboard-sidebar-expense-submit" onClick={() => commit(last.current, true)}>
						{t('expense.submit')}
					</button>
				</div>
			</div>
		</>
	);
}
