import { SaveStatus } from '../../primitives/SaveStatus';
import { Menu, Notice } from 'obsidian';
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import {
	periodLabel,
	periodShift,
	windowFor,
	type PeriodKind,
	type RangeWindow,
} from '../../../core/expense/expense-period';
import {
	expenseToday,
	formatExpenseAmount,
	regroupBreakdownByPrimary,
	UNGROUPED_PRIMARY,
	type ExpenseType,
} from '../../../core/expense/model';
import type { ExpenseService } from '../../../platform/obsidian/expense/expense-service';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { categoryLabel } from './expense-category-ui';
import {
	categoryColor,
	EXPENSE_BAR_COLOR,
	EXPENSE_FALLBACK_COLOR,
	INCOME_BAR_COLOR,
	type ExpenseBar,
	type ExpenseSlice,
} from './expense-charts';
import { showExpenseLedger } from './expense-ledger-modal';
import { ExpenseDonut, ExpenseLines, ExpenseRanking, ExpenseTrend } from './ExpenseCharts';
export function ExpenseStatsPanel({
	service,
	close,
	root,
}: {
	service: ExpenseService;
	close: () => void;
	root: HTMLElement;
}) {
	const [, refresh] = useState(0);
	useLayoutEffect(() => service.subscribe(() => refresh((n) => n + 1)), [service]);
	const [activeRange, setRange] = useState<PeriodKind | 'history'>('week'),
		[activeType, setType] = useState<ExpenseType>('expense'),
		[historyKind, setKind] = useState<PeriodKind>('year'),
		[historyAnchor, setAnchor] = useState(expenseToday),
		[categoryLevel, setLevel] = useState<'secondary' | 'primary'>('secondary');
	const today = expenseToday(),
		kind = activeRange === 'history' ? historyKind : activeRange,
		win = windowFor(kind, activeRange === 'history' ? historyAnchor : today, today),
		fmt = (n: number) => `${service.getCurrency()}${formatExpenseAmount(n)}`;
	const minDate = `${service.getAvailableYears()[0] ?? new Date().getFullYear()}-01-01`;
	const canShift = (delta: 1 | -1) => {
		const next = windowFor(historyKind, periodShift(historyKind, historyAnchor, delta), today);
		return delta > 0 ? next.curStart <= today : next.curEnd >= minDate;
	};
	const shift = (delta: 1 | -1) => {
		if (canShift(delta)) setAnchor(periodShift(historyKind, historyAnchor, delta));
	};
	const periodMenu = (event: MouseEvent) => {
		const menu = new Menu();
		let anchor = today;
		for (let i = 0; i < 2000; i++) {
			const period = windowFor(historyKind, anchor, today);
			if (period.curEnd < minDate) break;
			menu.addItem((item) =>
				item
					.setTitle(periodLabel(historyKind, period))
					.setChecked(period.curStart === win.curStart)
					.onClick(() => setAnchor(period.curStart)),
			);
			anchor = periodShift(historyKind, anchor, -1);
		}
		menu.showAtMouseEvent(event);
	};
	function breakdownSlices(win: RangeWindow): ExpenseSlice[] {
		const raw = service.getCategoryBreakdown(win.curStart, win.curEnd, activeType);
		const totals =
			categoryLevel === 'primary'
				? regroupBreakdownByPrimary(raw, (cat) => service.getCategoryParent(activeType, cat))
				: raw;
		const labelOf = (key: string): string =>
			key === UNGROUPED_PRIMARY
				? t('expense.cat.ungrouped')
				: categoryLevel === 'primary'
					? key
					: categoryLabel(key);
		return [...totals.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([key, value]) => ({
				key,
				label: labelOf(key),
				value,
				color: key === UNGROUPED_PRIMARY ? EXPENSE_FALLBACK_COLOR : categoryColor(activeType, key),
			}));
	}

	/** Slot series shared by the trend bars and the comparison lines:
	 *  daily slots for week/month (any history kind except year), monthly
	 *  slots for year. */
	function buildBars(win: RangeWindow): ExpenseBar[] {
		const kind = activeRange === 'history' ? historyKind : activeRange;
		if (kind === 'year') {
			const expense = service.getMonthlyTotals(win.year, 'expense');
			const income = service.getMonthlyTotals(win.year, 'income');
			return expense.map((e, i) => {
				const inc = income[i]?.amount ?? 0;
				return {
					label: e.month.slice(5),
					value: e.amount,
					secondary: inc,
					tooltip: `${e.month} · ${t('expense.expenseLabel')} ${fmt(e.amount)} / ${t('expense.incomeLabel')} ${fmt(inc)}`,
				};
			});
		}
		const expense = service.getDailyTotals(win.curStart, win.curEnd, 'expense');
		const income = service.getDailyTotals(win.curStart, win.curEnd, 'income');
		return expense.map((e, i) => {
			const inc = income[i]?.amount ?? 0;
			return {
				label: e.date.slice(8),
				value: e.amount,
				secondary: inc,
				tooltip: `${e.date} · ${t('expense.expenseLabel')} ${fmt(e.amount)} / ${t('expense.incomeLabel')} ${fmt(inc)}`,
			};
		});
	}

	const totals = service.getRangeTotals(win.curStart, win.curEnd),
		prev = service.getRangeTotals(win.prevStart, win.prevEnd),
		delta = (cur: number, old: number) => (old > 0 ? ((cur - old) / old) * 100 : undefined),
		net = Math.round((totals.income - totals.expense) * 100) / 100;
	const slices = breakdownSlices(win),
		bars = buildBars(win),
		records = service.getRecordsInRange(win.curStart, win.curEnd).reverse(),
		empty = t('expense.noRecords');
	return (
		<>
			<SaveStatus source={service} />
			<div class="dashboard-expense-stats-header">
				<div class="dashboard-expense-stats-header-titlewrap">
					<div class="dashboard-expense-stats-header-title">{t('expense.statsTitle')}</div>
					<div class="dashboard-expense-insight">{periodLabel(kind, win)}</div>
				</div>
				<div class="dashboard-expense-stats-header-right">
					<div class="dashboard-expense-range-toggle">
						{(['week', 'month', 'year', 'history'] as const).map((range) => (
							<button
								key={range}
								class={`dashboard-expense-range-btn${range === activeRange ? ' dashboard-expense-range-btn--active' : ''}`}
								onClick={() => setRange(range)}
							>
								{t(`expense.range${range[0]!.toUpperCase() + range.slice(1)}`)}
							</button>
						))}
					</div>
					{activeRange === 'history' && (
						<>
							<div class="dashboard-expense-subrange-toggle dashboard-expense-subrange-toggle--visible">
								{(['week', 'month', 'year'] as const).map((k) => (
									<button
										key={k}
										class={`dashboard-expense-subrange-btn${k === historyKind ? ' dashboard-expense-subrange-btn--active' : ''}`}
										onClick={() => {
											setKind(k);
											setAnchor(today);
										}}
									>
										{t(`expense.range${k[0]!.toUpperCase() + k.slice(1)}`)}
									</button>
								))}
							</div>
							<div class="dashboard-expense-year-nav dashboard-expense-year-nav--visible">
								<button
									class="dashboard-expense-year-nav-btn"
									disabled={!canShift(-1)}
									aria-label={t('expense.prevPeriod')}
									onClick={() => shift(-1)}
								>
									<Icon name="chevron-left" />
								</button>
								<button
									class={`dashboard-expense-year-nav-label${historyKind === 'week' ? ' dashboard-expense-year-nav-label--wide' : ''}`}
									onClick={periodMenu}
								>
									{periodLabel(historyKind, win)}
								</button>
								<button
									class="dashboard-expense-year-nav-btn"
									disabled={!canShift(1)}
									aria-label={t('expense.nextPeriod')}
									onClick={() => shift(1)}
								>
									<Icon name="chevron-right" />
								</button>
							</div>
						</>
					)}
					<div class="dashboard-expense-type-toggle">
						{(['expense', 'income'] as const).map((type) => (
							<button
								key={type}
								class={`dashboard-expense-type-btn${type === activeType ? ' dashboard-expense-type-btn--active' : ''}`}
								onClick={() => setType(type)}
							>
								{t(type === 'expense' ? 'expense.typeExpense' : 'expense.typeIncome')}
							</button>
						))}
					</div>
					<button class="dashboard-expense-stats-close" onClick={close} aria-label={t('common.close')}>
						<Icon name="x" />
					</button>
				</div>
			</div>
			<div class="dashboard-expense-stats-body">
				<div class="dashboard-expense-kpi-col">
					<div class="dashboard-expense-stats-summary">
						<Kpi
							value={fmt(totals.expense)}
							label={t('expense.kpiExpenseTotal')}
							delta={delta(totals.expense, prev.expense)}
							invert
						/>
						<Kpi
							value={fmt(totals.income)}
							label={t('expense.kpiIncomeTotal')}
							delta={delta(totals.income, prev.income)}
						/>
					</div>
					<div class="dashboard-expense-stats-summary">
						<Kpi value={`${net < 0 ? '-' : ''}${fmt(Math.abs(net))}`} label={t('expense.kpiNet')} />
						<Kpi
							value={fmt(totals.expense / Math.max(1, win.elapsedDays))}
							label={t('expense.kpiDailyAvg')}
						/>
					</div>
					<Section
						title={t('expense.records')}
						action={
							<button
								class="dashboard-expense-records-viewall"
								onClick={() => showExpenseLedger(root.ownerDocument, service)}
							>
								{t('expense.viewAll')}
								<Icon name="chevron-right" />
							</button>
						}
					>
						{records.length ? (
							<div class="dashboard-expense-records-scroll">
								<table class="dashboard-expense-records-table">
									<thead>
										<tr>
											{[
												'expense.colType',
												'expense.colAmount',
												'expense.colCategory',
												'expense.colNote',
												'expense.colDate',
												'',
											].map((key) => (
												<th key={key} scope="col">
													{key ? t(key) : ''}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{records.slice(0, 50).map((r) => (
											<tr key={r.id}>
												<td
													class={`dashboard-expense-records-type dashboard-expense-records-type--${r.type}`}
												>
													<Icon
														name={
															r.type === 'expense' ? 'arrow-down-right' : 'arrow-up-right'
														}
													/>
												</td>
												<td
													class={`dashboard-expense-records-amount${r.type === 'income' ? ' dashboard-expense-records-amount--income' : ''}`}
												>
													{r.type === 'income' ? '+' : ''}
													{fmt(r.amount)}
												</td>
												<td class="dashboard-expense-records-category">
													{categoryLabel(r.category)}
												</td>
												<td class="dashboard-expense-records-note" title={r.note}>
													{r.note}
												</td>
												<td class="dashboard-expense-records-date">
													{Number(r.date.slice(0, 4)) === new Date().getFullYear()
														? r.date.slice(5)
														: r.date}
												</td>
												<td class="dashboard-expense-records-actions">
													<button
														class="dashboard-expense-records-delete"
														aria-label={t('expense.deleteRecord')}
														onClick={() => {
															if (service.deleteRecord(r.id))
																new Notice(t('expense.recordDeleted'));
														}}
													>
														<Icon name="trash-2" />
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<div class="dashboard-expense-donut-empty">{empty}</div>
						)}
					</Section>
				</div>
				<div class="dashboard-expense-mid-col">
					<Section
						title={t('expense.categoryShare')}
						action={
							<div class="dashboard-expense-level-toggle">
								{(['secondary', 'primary'] as const).map((level) => (
									<button
										key={level}
										class={`dashboard-expense-level-btn${categoryLevel === level ? ' dashboard-expense-level-btn--active' : ''}`}
										onClick={() => setLevel(level)}
									>
										{t(level === 'secondary' ? 'expense.levelSecondary' : 'expense.levelPrimary')}
									</button>
								))}
							</div>
						}
					>
						<div class="dashboard-expense-donut-container">
							<ExpenseDonut slices={slices} formatValue={fmt} emptyText={empty} />
						</div>
					</Section>
					<Section title={t('expense.ranking')}>
						<div class="dashboard-expense-rank-container">
							<ExpenseRanking
								rows={slices}
								colorOf={(key) =>
									key === UNGROUPED_PRIMARY ? EXPENSE_FALLBACK_COLOR : categoryColor(activeType, key)
								}
								formatValue={fmt}
								emptyText={empty}
							/>
						</div>
					</Section>
				</div>
				<div class="dashboard-expense-right-col">
					<Section title={t(kind === 'year' ? 'expense.trendMonthly' : 'expense.trendDaily')}>
						<ExpenseTrend
							bars={bars}
							primaryColor={EXPENSE_BAR_COLOR}
							secondaryColor={INCOME_BAR_COLOR}
							emptyText={empty}
						/>
					</Section>
					<Section title={t('expense.compare')}>
						<ExpenseLines
							bars={bars}
							primaryColor={EXPENSE_BAR_COLOR}
							secondaryColor={INCOME_BAR_COLOR}
							primaryLabel={t('expense.typeExpense')}
							secondaryLabel={t('expense.typeIncome')}
							emptyText={empty}
						/>
					</Section>
				</div>
			</div>
		</>
	);
}
function Kpi({
	value,
	label,
	delta,
	invert = false,
}: {
	value: string;
	label: string;
	delta?: number;
	invert?: boolean;
}) {
	return (
		<div class="dashboard-expense-stats-card">
			<div class="dashboard-expense-stats-card-value-row">
				<div class="dashboard-expense-stats-card-value">{value}</div>
				{delta !== undefined && Number.isFinite(delta) && (
					<div
						class={`dashboard-expense-stats-card-delta dashboard-expense-stats-card-delta--${(invert ? delta < 0 : delta >= 0) ? 'up' : 'down'}`}
						title={t('pomodoro.vsPrev')}
					>
						{delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(delta))}%
					</div>
				)}
			</div>
			<div class="dashboard-expense-stats-card-label">{label}</div>
		</div>
	);
}
function Section({
	title,
	action,
	children,
}: {
	title: string;
	action?: ComponentChildren;
	children: ComponentChildren;
}) {
	return (
		<div class="dashboard-expense-stats-section">
			<div class="dashboard-expense-stats-section-title-row">
				<div class="dashboard-expense-stats-section-title">{title}</div>
				{action}
			</div>
			{children}
		</div>
	);
}
