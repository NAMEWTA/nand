// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/expense-stats-modal.ts
import { RecordButton as Button } from '../dialogs/RecordButton';
import { Input } from '../../../../ui/components/input';
import { widgetClasses } from '../theme/widget-classes';
import { RecordSaveStatus as SaveStatus } from '../dialogs/RecordSaveStatus';
import { Notice } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'react';
import {
	type ExpenseRecord,
	type ExpenseType,
	expenseToday,
	formatExpenseAmount,
	UNGROUPED_PRIMARY,
} from '../../core/expense/model';
import type { ExpenseService } from '../../platform/expense/expense-service';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import { RecordConfirm } from '../dialogs/RecordConfirm';
import { RecordDialog } from '../dialogs/RecordDialog';
import { Choice } from '../board/controls';
import { Checkbox } from '../../../../ui/components/checkbox';
import { ExpenseEntryPanel } from './ExpenseEntryPanel';
import { categoryLabel } from './expense-label';
import { ledgerCsv } from './ledger-csv';
type SortKey = 'date' | 'type' | 'category' | 'primary' | 'amount' | 'note';
const COLUMNS: SortKey[] = ['date', 'amount', 'type', 'primary', 'category', 'note'];
export function ExpenseLedgerPanel({ service, close }: { service: ExpenseService; close: () => void }) {
	const [editing, setEditing] = useState<ExpenseRecord | null>(null),
		[deleting, setDeleting] = useState<string[]>([]),
		[, refresh] = useState(0),
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
	const csv = ledgerCsv(service),
		expense = filtered.filter((r) => r.type === 'expense').reduce((n, r) => n + r.amount, 0),
		income = filtered.filter((r) => r.type === 'income').reduce((n, r) => n + r.amount, 0);
	const go = (next: number) => {
		setPage(Math.max(0, Math.min(pages - 1, next)));
		if (tableWrap.current) tableWrap.current.scrollTop = 0;
	};
	return (
		<>
			{editing && (
				<RecordDialog
					title={t('expense.editTitle')}
					classes="dashboard-library-config-modal"
					onClose={() => setEditing(null)}
				>
					<ExpenseEntryPanel
						service={service}
						initial={editing}
						close={() => setEditing(null)}
						onSave={(input) => !!service.updateRecord(editing.id, input)}
					/>
				</RecordDialog>
			)}
			<RecordConfirm
				open={deleting.length > 0}
				onOpenChange={(open) => {
					if (!open) setDeleting([]);
				}}
				title={t('expense.ledger.batchDeleteTitle')}
				description={t('expense.ledger.batchDeleteMessage', { n: deleting.length })}
				onConfirm={() => {
					service.deleteRecords(deleting);
					setSelected(new Set());
					setDeleting([]);
				}}
			/>
			<SaveStatus source={service} />
			<div className={widgetClasses('dashboard-expense-stats-header')}>
				<div className={widgetClasses('dashboard-expense-stats-header-title')}>{t('expense.ledger.title')}</div>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-expense-stats-close')}
					onClick={close}
					aria-label={t('common.close')}
				>
					<Icon name="x" />
				</Button>
			</div>
			<div className={widgetClasses('dashboard-expense-ledger-toolbar')}>
				<div className={widgetClasses('dashboard-expense-ledger-filters')}>
					<Choice
						compact
						className={widgetClasses('dashboard-expense-ledger-select')}
						label={t('expense.colType')}
						value={typeFilter}
						onChange={(value) => {
							setType(value as typeof typeFilter);
							setPage(0);
						}}
						options={(['all', 'expense', 'income'] as const).map((value) => ({
							value,
							label: t(
								value === 'all'
									? 'expense.ledger.filterAll'
									: value === 'expense'
										? 'expense.typeExpense'
										: 'expense.typeIncome',
							),
						}))}
					/>
					<Choice
						compact
						className={widgetClasses(
							'dashboard-expense-ledger-select dashboard-expense-ledger-select--category',
						)}
						label={t('expense.colCategory')}
						value={categoryFilter || '_all'}
						onChange={(value) => changeFilter(setCategory, value === '_all' ? '' : value)}
						options={[
							{ value: '_all', label: t('expense.colCategory') },
							...categories.map((value) => ({ value, label: categoryLabel(value) })),
						]}
					/>
					<Choice
						compact
						className={widgetClasses(
							'dashboard-expense-ledger-select dashboard-expense-ledger-select--primary',
						)}
						label={t('expense.colPrimary')}
						value={primaryFilter || '_all'}
						onChange={(value) => changeFilter(setPrimary, value === '_all' ? '' : value)}
						options={[
							{ value: '_all', label: t('expense.colPrimary') },
							...primaries.map((value) => ({ value, label: value })),
							{ value: UNGROUPED_PRIMARY, label: t('expense.cat.ungrouped') },
						]}
					/>
					<Input
						data-hit-control
						className={widgetClasses('dashboard-expense-ledger-date h-[30px] md:text-[0.72em]')}
						type="date"
						aria-label={t('expense.ledger.dateFrom')}
						max={expenseToday()}
						value={dateFrom}
						onChange={(e) => changeFilter(setFrom, e.currentTarget.value)}
					/>
					<Input
						data-hit-control
						className={widgetClasses('dashboard-expense-ledger-date h-[30px] md:text-[0.72em]')}
						type="date"
						aria-label={t('expense.ledger.dateTo')}
						max={expenseToday()}
						value={dateTo}
						onChange={(e) => changeFilter(setTo, e.currentTarget.value)}
					/>
					<Input
						data-hit-control
						className={widgetClasses('dashboard-expense-ledger-search h-[30px] md:text-[0.72em]')}
						type="text"
						autoComplete="off"
						placeholder={t('expense.ledger.searchPlaceholder')}
						value={search}
						onInput={(e) => changeFilter(setSearch, e.currentTarget.value)}
					/>
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-expense-ledger-btn dashboard-expense-ledger-btn--ghost')}
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
					</Button>
				</div>
				<div className={widgetClasses('dashboard-expense-ledger-actions')}>
					<Input
						data-hit-control
						ref={fileInput}
						className={widgetClasses('dashboard-expense-ledger-file')}
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
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-expense-ledger-btn')}
						disabled={busy}
						title={t('expense.ledger.importHint')}
						onClick={() => fileInput.current?.click()}
					>
						{t('expense.ledger.import')}
					</Button>
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-expense-ledger-btn')}
						disabled={busy || !filtered.length}
						title={t('expense.ledger.exportHint')}
						onClick={() => void run(() => csv.exportCsv(filtered))}
					>
						{t('expense.ledger.export')}
					</Button>
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-expense-ledger-btn dashboard-expense-ledger-btn--danger')}
						disabled={busy || !selected.size}
						onClick={() => setDeleting([...selected])}
					>
						{t('expense.ledger.deleteSelected', { n: selected.size })}
					</Button>
				</div>
			</div>
			<div ref={tableWrap} className={widgetClasses('dashboard-expense-ledger-wrap')}>
				<table className={widgetClasses('dashboard-expense-ledger-table')}>
					<thead>
						<tr>
							<th className={widgetClasses('dashboard-expense-ledger-th-check')}>
								<Checkbox
									className={widgetClasses('dashboard-expense-ledger-check')}

									checked={allChecked ? true : someChecked ? 'indeterminate' : false}
									aria-label={t('expense.ledger.selectAllPage')}
									onCheckedChange={(checked) =>
										toggle(
											rows.map((r) => r.id),
											checked === true,
										)
									}
								/>
							</th>
							{COLUMNS.map((col) => (
								<th
									key={col}
									className={widgetClasses(
										`dashboard-expense-ledger-th dashboard-expense-ledger-th-${col}`,
									)}
									scope="col"
									aria-sort={sortKey === col ? (sortAsc ? 'ascending' : 'descending') : 'none'}
								>
									<Button
										variant="ghost"
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
											<span className={widgetClasses('dashboard-expense-ledger-sort')}>
												{sortAsc ? '↑' : '↓'}
											</span>
										)}
									</Button>
								</th>
							))}
							<th className={widgetClasses('dashboard-expense-ledger-th-actions')} />
						</tr>
					</thead>
					<tbody>
						{!rows.length ? (
							<tr>
								<td className={widgetClasses('dashboard-expense-ledger-empty')} colSpan={8}>
									{t(records.length ? 'expense.ledger.emptyFiltered' : 'expense.ledger.emptyAll')}
								</td>
							</tr>
						) : (
							rows.map((r) => (
								<tr
									key={r.id}
									className={widgetClasses(
										selected.has(r.id) ? 'dashboard-expense-ledger-row--selected' : '',
									)}
								>
									<td className={widgetClasses('dashboard-expense-ledger-td-check')}>
										<Checkbox
											className={widgetClasses('dashboard-expense-ledger-check')}

											checked={selected.has(r.id)}
											aria-label={t('expense.ledger.selectRow')}
											onCheckedChange={(checked) => toggle([r.id], checked === true)}
										/>
									</td>
									<td className={widgetClasses('dashboard-expense-ledger-td-date')}>{r.date}</td>
									<td
										className={widgetClasses(
											`dashboard-expense-ledger-td-amount${r.type === 'income' ? ' dashboard-expense-records-amount--income' : ''}`,
										)}
									>
										{r.type === 'income' ? '+' : ''}
										{fmt(r.amount)}
									</td>
									<td
										className={widgetClasses(
											`dashboard-expense-ledger-td-type dashboard-expense-records-type--${r.type}`,
										)}
									>
										<Icon
											className={widgetClasses('dashboard-expense-ledger-type-icon')}
											name={r.type === 'expense' ? 'arrow-down-right' : 'arrow-up-right'}
										/>
										<span>
											{t(r.type === 'expense' ? 'expense.typeExpense' : 'expense.typeIncome')}
										</span>
									</td>
									<td className={widgetClasses('dashboard-expense-ledger-td-primary')}>
										{primaryOf(r) || '—'}
									</td>
									<td className={widgetClasses('dashboard-expense-ledger-td-category')}>
										{categoryLabel(r.category)}
									</td>
									<td className={widgetClasses('dashboard-expense-ledger-td-note')} title={r.note}>
										{r.note}
									</td>
									<td className={widgetClasses('dashboard-expense-ledger-td-actions')}>
										<Button
											variant="ghost"
											className={widgetClasses('dashboard-expense-ledger-action')}
											aria-label={t('expense.ledger.editRecord')}
											onClick={() => setEditing(r)}
										>
											<Icon name="pencil" />
										</Button>
										<Button
											variant="ghost"
											className={widgetClasses('dashboard-expense-ledger-action')}
											aria-label={t('expense.deleteRecord')}
											onClick={() => {
												setDeleting([r.id]);
											}}
										>
											<Icon name="trash-2" />
										</Button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<div className={widgetClasses('dashboard-expense-ledger-footer')}>
				<div className={widgetClasses('dashboard-expense-ledger-footer-info')}>
					{t('expense.ledger.footerTotals', { n: filtered.length, e: fmt(expense), i: fmt(income) })}
				</div>
				<div className={widgetClasses('dashboard-expense-ledger-pager')}>
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-expense-year-nav-btn dashboard-expense-ledger-pager-btn')}
						disabled={currentPage <= 0}
						aria-label={t('expense.ledger.prevPage')}
						onClick={() => go(currentPage - 1)}
					>
						<Icon name="chevron-left" />
					</Button>
					<div className={widgetClasses('dashboard-expense-ledger-pager-label')}>
						{t('expense.ledger.page', { p: currentPage + 1, total: pages })}
					</div>
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-expense-year-nav-btn dashboard-expense-ledger-pager-btn')}
						disabled={currentPage >= pages - 1}
						aria-label={t('expense.ledger.nextPage')}
						onClick={() => go(currentPage + 1)}
					>
						<Icon name="chevron-right" />
					</Button>
				</div>
			</div>
		</>
	);
}
