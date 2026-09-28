import { Notice } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
	type ExpenseRecord,
	type ExpenseType,
	expenseToday,
	formatExpenseAmount,
	UNGROUPED_PRIMARY,
} from '../../../core/expense/model';
import type { ExpenseService } from '../../../platform/obsidian/expense/expense-service';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { showConfirmDialog } from '../ui/confirm-dialog';
import { ExpenseBackfillModal } from './expense-backfill-modal';
import { categoryLabel } from './expense-category-ui';
import { ledgerCsv } from './ledger-csv';
type SortKey = 'date' | 'type' | 'category' | 'primary' | 'amount' | 'note';
const COLUMNS: SortKey[] = ['date', 'amount', 'type', 'primary', 'category', 'note'];
export function ExpenseLedgerPanel({ service, close }: { service: ExpenseService; close: () => void }) {
	const [version, refresh] = useState(0),
		[typeFilter, setType] = useState<'all' | ExpenseType>('all'),
		[categoryFilter, setCategory] = useState(''),
		[primaryFilter, setPrimary] = useState(''),
		[dateFrom, setFrom] = useState(''),
		[dateTo, setTo] = useState(''),
		[search, setSearch] = useState(''),
		[sortKey, setSort] = useState<SortKey>('date'),
		[sortAsc, setAsc] = useState(false),
		[page, setPage] = useState(0),
		[selected, setSelected] = useState(new Set<string>()),
		[busy, setBusy] = useState(false);
	const tableWrap = useRef<HTMLDivElement>(null),
		fileInput = useRef<HTMLInputElement>(null),
		alive = useRef(true),
		pending = useRef(false);
	useLayoutEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	useLayoutEffect(() => service.subscribe(() => refresh((n) => n + 1)), [service]);
	const records = service.getRecords(),
		categories = [
			...new Set([
				...service.getOrderedCategories('expense'),
				...service.getOrderedCategories('income'),
				...records.map((r) => r.category),
			]),
		],
		primaries = [
			...new Map(
				[...service.getPrimaryCategories('expense'), ...service.getPrimaryCategories('income')].map((name) => [
					name.toLowerCase(),
					name,
				]),
			).values(),
		];
	useLayoutEffect(() => {
		const ids = new Set(service.getRecords().map((r) => r.id));
		setSelected((old) => new Set([...old].filter((id) => ids.has(id))));
		if (categoryFilter && !categories.includes(categoryFilter)) setCategory('');
		if (primaryFilter && primaryFilter !== UNGROUPED_PRIMARY && !primaries.includes(primaryFilter)) setPrimary('');
	}, [version, service]);
	const fmt = (n: number) => `${service.getCurrency()}${formatExpenseAmount(n)}`,
		primaryOf = (r: ExpenseRecord) => service.getCategoryParent(r.type, r.category) ?? '';
	const comparators: Record<SortKey, (a: ExpenseRecord, b: ExpenseRecord) => number> = {
		date: (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
		type: (a, b) =>
			t(a.type === 'expense' ? 'expense.typeExpense' : 'expense.typeIncome').localeCompare(
				t(b.type === 'expense' ? 'expense.typeExpense' : 'expense.typeIncome'),
			),
		category: (a, b) => categoryLabel(a.category).localeCompare(categoryLabel(b.category)),
		primary: (a, b) => primaryOf(a).localeCompare(primaryOf(b)),
		amount: (a, b) => a.amount - b.amount,
		note: (a, b) => (a.note ?? '').localeCompare(b.note ?? ''),
	};
	const q = search.trim().toLowerCase(),
		dir = sortAsc ? 1 : -1;
	const filtered = records
		.filter(
			(r) =>
				(typeFilter === 'all' || r.type === typeFilter) &&
				(!categoryFilter || r.category === categoryFilter) &&
				(!primaryFilter ||
					(primaryFilter === UNGROUPED_PRIMARY ? primaryOf(r) === '' : primaryOf(r) === primaryFilter)) &&
				(!dateFrom || r.date >= dateFrom) &&
				(!dateTo || r.date <= dateTo) &&
				(!q || `${r.note ?? ''} ${categoryLabel(r.category)} ${primaryOf(r)}`.toLowerCase().includes(q)),
		)
		.sort((a, b) => comparators[sortKey](a, b) * dir || comparators.date(a, b) * dir);
	const pages = Math.max(1, Math.ceil(filtered.length / 50)),
		currentPage = Math.min(page, pages - 1),
		rows = filtered.slice(currentPage * 50, (currentPage + 1) * 50),
		allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id)),
		someChecked = rows.some((r) => selected.has(r.id));
	const changeFilter = (set: (v: string) => void, value: string) => {
		set(value);
		setPage(0);
	};
	const toggle = (ids: string[], checked: boolean) =>
		setSelected((old) => {
			const next = new Set(old);
			for (const id of ids) {
				if (checked) next.add(id);
				else next.delete(id);
			}
			return next;
		});
	const edit = (record: ExpenseRecord) =>
		new ExpenseBackfillModal(
			service.getApp(),
			(input) => {
				if (!service.updateRecord(record.id, input)) new Notice(t('expense.invalidAmount'));
			},
			{ initial: record, aboveOverlay: true },
		).open();
	const run = async (action: () => Promise<void>) => {
		if (pending.current) return;
		pending.current = true;
		setBusy(true);
		try {
			await action();
		} finally {
			pending.current = false;
			if (alive.current) setBusy(false);
		}
	};
	const deleteSelected = () =>
		run(async () => {
			const ids = [...selected];
			if (!ids.length) return;
			if (
				!(await showConfirmDialog(service.getApp(), {
					title: t('expense.ledger.batchDeleteTitle'),
					message: t('expense.ledger.batchDeleteMessage', { n: ids.length }),
				})) ||
				!alive.current
			)
				return;
			const n = service.deleteRecords(ids);
			setSelected(new Set());
			if (n) new Notice(t('expense.ledger.recordsDeleted', { n }));
		});
	const csv = ledgerCsv(service),
		expense = filtered.filter((r) => r.type === 'expense').reduce((n, r) => n + r.amount, 0),
		income = filtered.filter((r) => r.type === 'income').reduce((n, r) => n + r.amount, 0);
	const go = (next: number) => {
		setPage(Math.max(0, Math.min(pages - 1, next)));
		if (tableWrap.current) tableWrap.current.scrollTop = 0;
	};
	return (
		<>
			<div class="dashboard-expense-stats-header">
				<div class="dashboard-expense-stats-header-title">{t('expense.ledger.title')}</div>
				<button class="dashboard-expense-stats-close" onClick={close} aria-label={t('common.close')}>
					<Icon name="x" />
				</button>
			</div>
			<div class="dashboard-expense-ledger-toolbar">
				<div class="dashboard-expense-ledger-filters">
					<select
						class="dashboard-expense-ledger-select"
						value={typeFilter}
						onChange={(e) => {
							setType(e.currentTarget.value as typeof typeFilter);
							setPage(0);
						}}
					>
						{(['all', 'expense', 'income'] as const).map((type) => (
							<option key={type} value={type}>
								{t(
									type === 'all'
										? 'expense.ledger.filterAll'
										: type === 'expense'
											? 'expense.typeExpense'
											: 'expense.typeIncome',
								)}
							</option>
						))}
					</select>
					<select
						class="dashboard-expense-ledger-select dashboard-expense-ledger-select--category"
						aria-label={t('expense.colCategory')}
						value={categoryFilter}
						onChange={(e) => changeFilter(setCategory, e.currentTarget.value)}
					>
						<option value="">{t('expense.colCategory')}</option>
						{categories.map((key) => (
							<option key={key} value={key}>
								{categoryLabel(key)}
							</option>
						))}
					</select>
					<select
						class="dashboard-expense-ledger-select dashboard-expense-ledger-select--primary"
						aria-label={t('expense.colPrimary')}
						value={primaryFilter}
						onChange={(e) => changeFilter(setPrimary, e.currentTarget.value)}
					>
						<option value="">{t('expense.colPrimary')}</option>
						{primaries.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
						<option value={UNGROUPED_PRIMARY}>{t('expense.cat.ungrouped')}</option>
					</select>
					<input
						class="dashboard-expense-ledger-date"
						type="date"
						aria-label={t('expense.ledger.dateFrom')}
						max={expenseToday()}
						value={dateFrom}
						onChange={(e) => changeFilter(setFrom, e.currentTarget.value)}
					/>
					<input
						class="dashboard-expense-ledger-date"
						type="date"
						aria-label={t('expense.ledger.dateTo')}
						max={expenseToday()}
						value={dateTo}
						onChange={(e) => changeFilter(setTo, e.currentTarget.value)}
					/>
					<input
						class="dashboard-expense-ledger-search"
						type="text"
						autoComplete="off"
						placeholder={t('expense.ledger.searchPlaceholder')}
						value={search}
						onInput={(e) => changeFilter(setSearch, e.currentTarget.value)}
					/>
					<button
						class="dashboard-expense-ledger-btn dashboard-expense-ledger-btn--ghost"
						onClick={() => {
							setType('all');
							setCategory('');
							setPrimary('');
							setFrom('');
							setTo('');
							setSearch('');
							setPage(0);
						}}
					>
						{t('expense.ledger.clearFilters')}
					</button>
				</div>
				<div class="dashboard-expense-ledger-actions">
					<input
						ref={fileInput}
						class="dashboard-expense-ledger-file"
						type="file"
						accept=".csv,text/csv,text/plain"
						onChange={(e) => {
							const file = e.currentTarget.files?.[0];
							e.currentTarget.value = '';
							if (file)
								void run(async () => {
									try {
										const text = await file.text();
										if (alive.current) csv.importCsvText(text);
									} catch {
										new Notice(t('expense.ledger.importFailed'));
									}
								});
						}}
					/>
					<button
						class="dashboard-expense-ledger-btn"
						disabled={busy}
						title={t('expense.ledger.importHint')}
						onClick={() => fileInput.current?.click()}
					>
						{t('expense.ledger.import')}
					</button>
					<button
						class="dashboard-expense-ledger-btn"
						disabled={busy || !filtered.length}
						title={t('expense.ledger.exportHint')}
						onClick={() => void run(() => csv.exportCsv(filtered))}
					>
						{t('expense.ledger.export')}
					</button>
					<button
						class="dashboard-expense-ledger-btn dashboard-expense-ledger-btn--danger"
						disabled={busy || !selected.size}
						onClick={() => void deleteSelected()}
					>
						{t('expense.ledger.deleteSelected', { n: selected.size })}
					</button>
				</div>
			</div>
			<div ref={tableWrap} class="dashboard-expense-ledger-wrap">
				<table class="dashboard-expense-ledger-table">
					<thead>
						<tr>
							<th class="dashboard-expense-ledger-th-check">
								<input
									class="dashboard-expense-ledger-check"
									type="checkbox"
									checked={allChecked}
									ref={(input) => {
										if (input) input.indeterminate = !allChecked && someChecked;
									}}
									aria-label={t('expense.ledger.selectAllPage')}
									onChange={(e) =>
										toggle(
											rows.map((r) => r.id),
											e.currentTarget.checked,
										)
									}
								/>
							</th>
							{COLUMNS.map((col) => (
								<th
									key={col}
									class={`dashboard-expense-ledger-th dashboard-expense-ledger-th-${col}`}
									scope="col"
									aria-sort={sortKey === col ? (sortAsc ? 'ascending' : 'descending') : 'none'}
								>
									<button
										onClick={() => {
											if (sortKey === col) setAsc(!sortAsc);
											else {
												setSort(col);
												setAsc(col !== 'date');
											}
										}}
									>
										{t(`expense.col${col[0]!.toUpperCase() + col.slice(1)}`)}
										{sortKey === col && (
											<span class="dashboard-expense-ledger-sort">{sortAsc ? '↑' : '↓'}</span>
										)}
									</button>
								</th>
							))}
							<th class="dashboard-expense-ledger-th-actions" />
						</tr>
					</thead>
					<tbody>
						{!rows.length ? (
							<tr>
								<td class="dashboard-expense-ledger-empty" colSpan={8}>
									{t(records.length ? 'expense.ledger.emptyFiltered' : 'expense.ledger.emptyAll')}
								</td>
							</tr>
						) : (
							rows.map((r) => (
								<tr
									key={r.id}
									class={selected.has(r.id) ? 'dashboard-expense-ledger-row--selected' : ''}
								>
									<td class="dashboard-expense-ledger-td-check">
										<input
											class="dashboard-expense-ledger-check"
											type="checkbox"
											checked={selected.has(r.id)}
											aria-label={t('expense.ledger.selectRow')}
											onChange={(e) => toggle([r.id], e.currentTarget.checked)}
										/>
									</td>
									<td class="dashboard-expense-ledger-td-date">{r.date}</td>
									<td
										class={`dashboard-expense-ledger-td-amount${r.type === 'income' ? ' dashboard-expense-records-amount--income' : ''}`}
									>
										{r.type === 'income' ? '+' : ''}
										{fmt(r.amount)}
									</td>
									<td
										class={`dashboard-expense-ledger-td-type dashboard-expense-records-type--${r.type}`}
									>
										<Icon
											className="dashboard-expense-ledger-type-icon"
											name={r.type === 'expense' ? 'arrow-down-right' : 'arrow-up-right'}
										/>
										<span>
											{t(r.type === 'expense' ? 'expense.typeExpense' : 'expense.typeIncome')}
										</span>
									</td>
									<td class="dashboard-expense-ledger-td-primary">{primaryOf(r) || '—'}</td>
									<td class="dashboard-expense-ledger-td-category">{categoryLabel(r.category)}</td>
									<td class="dashboard-expense-ledger-td-note" title={r.note}>
										{r.note}
									</td>
									<td class="dashboard-expense-ledger-td-actions">
										<button
											class="dashboard-expense-ledger-action"
											aria-label={t('expense.ledger.editRecord')}
											onClick={() => edit(r)}
										>
											<Icon name="pencil" />
										</button>
										<button
											class="dashboard-expense-ledger-action"
											aria-label={t('expense.deleteRecord')}
											onClick={() => {
												if (service.deleteRecord(r.id)) new Notice(t('expense.recordDeleted'));
											}}
										>
											<Icon name="trash-2" />
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<div class="dashboard-expense-ledger-footer">
				<div class="dashboard-expense-ledger-footer-info">
					{t('expense.ledger.footerTotals', { n: filtered.length, e: fmt(expense), i: fmt(income) })}
				</div>
				<div class="dashboard-expense-ledger-pager">
					<button
						class="dashboard-expense-year-nav-btn dashboard-expense-ledger-pager-btn"
						disabled={currentPage <= 0}
						aria-label={t('expense.ledger.prevPage')}
						onClick={() => go(currentPage - 1)}
					>
						<Icon name="chevron-left" />
					</button>
					<div class="dashboard-expense-ledger-pager-label">
						{t('expense.ledger.page', { p: currentPage + 1, total: pages })}
					</div>
					<button
						class="dashboard-expense-year-nav-btn dashboard-expense-ledger-pager-btn"
						disabled={currentPage >= pages - 1}
						aria-label={t('expense.ledger.nextPage')}
						onClick={() => go(currentPage + 1)}
					>
						<Icon name="chevron-right" />
					</button>
				</div>
			</div>
		</>
	);
}
