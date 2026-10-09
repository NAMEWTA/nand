import { Notice } from 'obsidian';
import { CSV_HEADER, parseCsv, serializeCsv } from '../../core/expense/expense-csv';
import { type ExpenseRecord, type ExpenseType, expenseToday, formatExpenseAmount } from '../../core/expense/model';
import { type ExpenseService } from '../../platform/expense/expense-service';
import { t } from '../../../../shared/i18n/index';
import { categoryLabel } from './expense-category-ui';

export function ledgerCsv(service: ExpenseService) {
	/** Column aliases accepted in a header row (canonical export plus common
	 *  Chinese headers). */
	const HEADER_ALIASES: Record<string, readonly string[]> = {
		date: ['date', 'day', '日期', '记账日期'],
		type: ['type', 'direction', '类型', '收支'],
		category: ['category', '分类', '类别', '类目'],
		amount: ['amount', '金额', '支出金额'],
		note: ['note', '备注', 'memo', '摘要'],
	};

	function normalizeImportDate(raw: string): string {
		const cleaned = raw.trim().replace(/[/.]/g, '-');
		const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(cleaned);
		if (!match) return '';
		const [, y = '', m = '', d = ''] = match;
		return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
	}

	function normalizeImportType(raw: string): ExpenseType | null {
		const value = raw.trim().toLowerCase();
		if (['expense', '支出', '花费', '开销'].includes(value)) return 'expense';
		if (['income', '收入', '所得'].includes(value)) return 'income';
		return null;
	}

	/** Resolve a CSV category cell to a record key: exact custom name, preset
	 *  key, or current-locale preset label (case-insensitive); an unknown
	 *  name registers itself as a custom category of that direction. */
	function resolveImportCategory(raw: string, type: ExpenseType): string {
		const name = raw.trim();
		if (name.length === 0) return 'other';
		const known = service.getCategories(type);
		const lower = name.toLowerCase();
		const direct = known.find((k) => k === name || k.toLowerCase() === lower);
		if (direct) return direct;
		const byLabel = known.find((k) => categoryLabel(k).toLowerCase() === lower);
		if (byLabel) return byLabel;
		const added = service.addCustomCategory(type, name);
		return added.ok ? added.name : 'other';
	}

	function importCsvText(text: string): void {
		const rows = parseCsv(text);
		if (rows.length === 0) {
			new Notice(t('expense.ledger.importFailed'));
			return;
		}
		// Header row: first cell matching any date alias.
		let index = 0;
		const first = rows[0]!.map((c) => c.trim().toLowerCase());
		const colOf = (field: string): number => first.findIndex((cell) => HEADER_ALIASES[field]!.includes(cell));
		if (colOf('date') !== -1) index = 1;
		const iDate = colOf('date') === -1 ? 0 : colOf('date');
		const iType = colOf('type') === -1 ? 1 : colOf('type');
		const iCategory = colOf('category') === -1 ? 2 : colOf('category');
		const iAmount = colOf('amount') === -1 ? 3 : colOf('amount');
		const iNote = colOf('note') === -1 ? 4 : colOf('note');

		const entries: Array<{ type: ExpenseType; amount: number; category: string; note?: string; date: string }> = [];
		for (const row of rows.slice(index)) {
			const cell = (i: number): string => (row[i] ?? '').trim();
			const type = normalizeImportType(cell(iType));
			const date = normalizeImportDate(cell(iDate));
			const amount = Number(cell(iAmount).replace(/[^0-9.-]/g, ''));
			if (type === null || date.length === 0) continue;
			const note = cell(iNote).slice(0, 50);
			entries.push({
				type,
				amount,
				category: resolveImportCategory(cell(iCategory), type),
				...(note ? { note } : {}),
				date,
			});
		}
		if (entries.length === 0) {
			new Notice(t('expense.ledger.importFailed'));
			return;
		}
		const { added, skipped } = service.importRows(entries);
		new Notice(
			t('expense.ledger.imported', { n: added }) +
				(skipped > 0 ? t('expense.ledger.importSkipped', { n: skipped }) : ''),
		);
	}

	async function exportCsv(lastFiltered: ExpenseRecord[]): Promise<void> {
		if (lastFiltered.length === 0) return;
		const lines = [
			[...CSV_HEADER],
			...lastFiltered.map((r) => [
				r.date,
				r.type,
				categoryLabel(r.category),
				formatExpenseAmount(r.amount),
				r.note ?? '',
			]),
		];
		// BOM so Excel detects UTF-8 (parseCsv strips it on the way back in).
		const path = `expense-export-${expenseToday()}.csv`;
		try {
			await service.writeVaultFile(path, '\uFEFF' + serializeCsv(lines));
			new Notice(t('expense.ledger.exported', { n: lastFiltered.length, path }));
		} catch {
			new Notice(t('expense.ledger.exportFailed'));
		}
	}

	return { importCsvText, exportCsv };
}
