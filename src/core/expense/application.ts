import { DurableState } from '../../shared/storage/durable-state';
import type { TextStorage } from '../../shared/storage/ports';
import {
	AddCategoryResult,
	categoriesFor,
	collidesWithPreset,
	DATA_FILE,
	DATE_RE,
	emptyData,
	EXPENSE_CATEGORY_NAME_MAX,
	EXPENSE_MAX_CUSTOM_CATEGORIES,
	EXPENSE_MAX_PRIMARY_CATEGORIES,
	ExpenseData,
	ExpenseRecord,
	expenseToday,
	ExpenseType,
	formatDate,
	makeRecordId,
	MAX_AMOUNT,
	MAX_NOTE_LENGTH,
	normalizeData,
	round2,
} from './model';

export class ExpenseApplication {
	constructor(
		private storage: TextStorage,
		directory: string,
		private currency: () => string,
	) { this.repository = new DurableState(storage, `${directory}/${DATA_FILE}`, emptyData, normalizeData, () => this.notify()); }

	private readonly repository: DurableState<ExpenseData>;
	private get data(): ExpenseData { return this.repository.value; }
	private set data(value: ExpenseData) { this.repository.value = value; }
	private listeners = new Set<() => void>();
	get saveState() { return this.repository.state; }
	load(): Promise<void> { return this.repository.load(); }
	private save(): void { this.repository.save(); }
	flush(): Promise<void> { return this.repository.flush(); }
	retrySave(): Promise<void> { return this.repository.retry(); }
	shutdown(): Promise<void> { return this.repository.shutdown(); }
	syncFromDisk(): Promise<void> { return this.repository.sync(); }

	/** Register a data-changed listener; returns its unsubscribe function. */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	destroy(): void {
		this.listeners.clear();
	}

	private notify(): void {
		for (const listener of [...this.listeners]) {
			listener();
		}
	}

	// ===== Record CRUD =====

	/** All records, append order (shared copy). */
	getRecords(): ExpenseRecord[] {
		return [...this.data.records];
	}

	/** Entry validation shared by addRecord / updateRecord / importRows:
	 *  amount finite in (0, 1e8), category known for the type, date a valid
	 *  past-or-today 'YYYY-MM-DD'. */
	private isValidEntry(type: ExpenseType, amount: number, category: string, date: string): boolean {
		if (!Number.isFinite(amount) || amount <= 0 || amount >= MAX_AMOUNT) return false;
		if (!this.getCategories(type).includes(category)) return false;
		if (!DATE_RE.test(date) || date > expenseToday()) return false;
		return true;
	}

	/** Add an entry; null when validation fails (caller surfaces a Notice). */
	addRecord(input: {
		type: ExpenseType;
		amount: number;
		category: string;
		note?: string;
		date: string;
	}): ExpenseRecord | null {
		const { type, category, date } = input;
		const amount = round2(input.amount);
		if (!this.isValidEntry(type, amount, category, date)) return null;
		const note = input.note?.trim().slice(0, MAX_NOTE_LENGTH);
		const record: ExpenseRecord = {
			id: makeRecordId(),
			type,
			amount,
			category,
			...(note ? { note } : {}),
			date,
			createdAt: Date.now(),
		};
		this.data = {
			...this.data,
			records: [...this.data.records, record],
			lastCategory: { ...this.data.lastCategory, [type]: category },
		};
		this.save();
		this.notify();
		return record;
	}

	/** Patch an existing record (any mutable field); null when the id is
	 *  unknown or the merged entry fails validation. id/createdAt never move. */
	updateRecord(
		id: string,
		patch: { type?: ExpenseType; amount?: number; category?: string; note?: string; date?: string },
	): ExpenseRecord | null {
		const base = this.data.records.find((r) => r.id === id);
		if (!base) return null;
		const type = patch.type ?? base.type;
		const amount = round2(patch.amount ?? base.amount);
		const category = patch.category ?? base.category;
		const date = patch.date ?? base.date;
		if (!this.isValidEntry(type, amount, category, date)) return null;
		const note = (patch.note !== undefined ? patch.note : base.note)?.trim().slice(0, MAX_NOTE_LENGTH);
		const { note: _dropped, ...rest } = base;
		const updated: ExpenseRecord = {
			...rest,
			type,
			amount,
			category,
			date,
			...(note ? { note } : {}),
		};
		this.data = {
			...this.data,
			records: this.data.records.map((r) => (r.id === id ? updated : r)),
			lastCategory: { ...this.data.lastCategory, [type]: category },
		};
		this.save();
		this.notify();
		return updated;
	}

	/** Delete a record by id; true when it existed. */
	deleteRecord(id: string): boolean {
		if (!this.data.records.some((r) => r.id === id)) return false;
		this.data = { ...this.data, records: this.data.records.filter((r) => r.id !== id) };
		this.save();
		this.notify();
		return true;
	}

	/** Bulk delete by ids (one immutable update, one save + notify); returns
	 *  how many actually existed. */
	deleteRecords(ids: readonly string[]): number {
		const doomed = new Set(ids);
		const before = this.data.records.length;
		const records = this.data.records.filter((r) => !doomed.has(r.id));
		if (records.length === before) return 0;
		this.data = { ...this.data, records };
		this.save();
		this.notify();
		return before - records.length;
	}

	/** Bulk insert for CSV import: each row is validated like addRecord,
	 *  invalid rows are skipped; single save + notify. */
	importRows(rows: Array<{ type: ExpenseType; amount: number; category: string; note?: string; date: string }>): {
		added: number;
		skipped: number;
	} {
		const valid: ExpenseRecord[] = [];
		for (const input of rows) {
			const { type, category, date } = input;
			const amount = round2(input.amount);
			if (!this.isValidEntry(type, amount, category, date)) continue;
			const note = input.note?.trim().slice(0, MAX_NOTE_LENGTH);
			valid.push({
				id: makeRecordId(),
				type,
				amount,
				category,
				...(note ? { note } : {}),
				date,
				createdAt: Date.now(),
			});
		}
		if (valid.length > 0) {
			this.data = { ...this.data, records: [...this.data.records, ...valid] };
			this.save();
			this.notify();
		}
		return { added: valid.length, skipped: rows.length - valid.length };
	}

	// ===== Custom categories =====

	/** Preset keys followed by the user's custom names for a direction. */
	getCategories(type: ExpenseType): string[] {
		return [...categoriesFor(type), ...(this.data.customCategories?.[type] ?? [])];
	}

	/** Custom names only (shared copy). */
	getCustomCategories(type: ExpenseType): string[] {
		return [...(this.data.customCategories?.[type] ?? [])];
	}

	/** Records using a category key (usage count in the manager). */
	countCategoryUsage(type: ExpenseType, category: string): number {
		return this.data.records.filter((r) => r.type === type && r.category === category).length;
	}

	/** All categories of a direction in the user's display order: stored
	 *  order entries first (unknown/duplicate entries skipped), then any
	 *  categories the order never mentions in default order. Never persists
	 *  the completion — untouched legacy files stay untouched. */
	getOrderedCategories(type: ExpenseType): string[] {
		const known = this.getCategories(type);
		const order = this.data.categoryOrder?.[type];
		if (!order) return known;
		const seen = new Set<string>();
		const head: string[] = [];
		for (const key of order) {
			if (!known.includes(key) || seen.has(key)) continue;
			seen.add(key);
			head.push(key);
		}
		return [...head, ...known.filter((k) => !seen.has(k))];
	}

	/** Overwrite the stored order for a direction; false unless `keys` is an
	 *  exact, duplicate-free cover of the current category set. */
	reorderCategories(type: ExpenseType, keys: readonly string[]): boolean {
		return this.writeTypeList('categoryOrder', type, keys, this.getCategories(type));
	}

	/** Register a custom category name for a direction; rejected when empty/
	 *  over-long, shadowing a preset, already present, or past the cap. */
	addCustomCategory(type: ExpenseType, rawName: string): AddCategoryResult {
		const name = rawName.trim().slice(0, EXPENSE_CATEGORY_NAME_MAX);
		if (name.length === 0) return { ok: false, reason: 'invalid' };
		const existing = this.data.customCategories?.[type] ?? [];
		if (collidesWithPreset(name, type) || existing.some((n) => n.toLowerCase() === name.toLowerCase())) {
			return { ok: false, reason: 'duplicate' };
		}
		if (existing.length >= EXPENSE_MAX_CUSTOM_CATEGORIES) return { ok: false, reason: 'limit' };
		const next = { ...this.data.customCategories, [type]: [...existing, name] };
		this.data = { ...this.data, customCategories: next };
		this.save();
		this.notify();
		return { ok: true, name };
	}

	/** Remove a custom category (case-insensitive). Existing records keep the
	 *  name — display falls back to the raw key (categoryLabel). The name is
	 *  also dropped from the stored order and any primary mapping so it stops
	 *  appearing in manager/filter lists immediately. */
	removeCustomCategory(type: ExpenseType, name: string): boolean {
		const existing = this.data.customCategories?.[type] ?? [];
		const next = existing.filter((n) => n.toLowerCase() !== name.toLowerCase());
		if (next.length === existing.length) return false;
		const custom = { ...this.data.customCategories, [type]: next };
		// Drop the key entirely when empty so the JSON stays tidy.
		if (next.length === 0) delete custom[type];

		const orderList = this.data.categoryOrder?.[type] ?? [];
		let categoryOrder = this.data.categoryOrder;
		if (orderList.length > 0) {
			const order = orderList.filter((n) => n.toLowerCase() !== name.toLowerCase());
			categoryOrder = { ...this.data.categoryOrder, [type]: order };
			if (order.length === 0) delete categoryOrder[type];
		}

		const parentMap = this.data.categoryParents?.[type];
		let categoryParents = this.data.categoryParents;
		if (parentMap && parentMap[name] !== undefined) {
			const { [name]: _dropped, ...rest } = parentMap;
			categoryParents = { ...this.data.categoryParents, [type]: rest };
		}

		this.data = {
			...this.data,
			customCategories: custom,
			...(categoryOrder !== this.data.categoryOrder ? { categoryOrder } : {}),
			...(categoryParents !== this.data.categoryParents ? { categoryParents } : {}),
		};
		this.save();
		this.notify();
		return true;
	}

	/** Last category picked for a type (or the first known category). */
	getLastCategory(type: ExpenseType): string {
		const cats = this.getCategories(type);
		const saved = this.data.lastCategory[type];
		if (saved && cats.includes(saved)) return saved;
		return cats[0] ?? 'other';
	}

	// ===== Primary groups =====

	/** Ordered primary-group names for a direction (shared copy). */
	getPrimaryCategories(type: ExpenseType): string[] {
		return [...(this.data.primaryCategories?.[type] ?? [])];
	}

	/** Register a primary group; same validation shape as addCustomCategory
	 *  (empty/over-long or preset-shadowing name -> invalid/duplicate). */
	addPrimaryCategory(type: ExpenseType, rawName: string): AddCategoryResult {
		const name = rawName.trim().slice(0, EXPENSE_CATEGORY_NAME_MAX);
		if (name.length === 0) return { ok: false, reason: 'invalid' };
		const existing = this.data.primaryCategories?.[type] ?? [];
		if (collidesWithPreset(name, type) || existing.some((n) => n.toLowerCase() === name.toLowerCase())) {
			return { ok: false, reason: 'duplicate' };
		}
		if (existing.length >= EXPENSE_MAX_PRIMARY_CATEGORIES) return { ok: false, reason: 'limit' };
		this.data = {
			...this.data,
			primaryCategories: { ...this.data.primaryCategories, [type]: [...existing, name] },
		};
		this.save();
		this.notify();
		return { ok: true, name };
	}

	/** Remove a primary group (case-insensitive). Categories mapped to it
	 *  become ungrouped — their records are untouched, the mapping is derived. */
	removePrimaryCategory(type: ExpenseType, name: string): boolean {
		const existing = this.data.primaryCategories?.[type] ?? [];
		const next = existing.filter((n) => n.toLowerCase() !== name.toLowerCase());
		if (next.length === existing.length) return false;
		const primaries = { ...this.data.primaryCategories, [type]: next };
		if (next.length === 0) delete primaries[type];

		const parentMap = this.data.categoryParents?.[type];
		let categoryParents = this.data.categoryParents;
		if (parentMap) {
			const lower = name.toLowerCase();
			const rest = Object.fromEntries(Object.entries(parentMap).filter(([, p]) => p.toLowerCase() !== lower));
			categoryParents = { ...this.data.categoryParents, [type]: rest };
			if (Object.keys(rest).length === 0) delete categoryParents[type];
		}

		this.data = {
			...this.data,
			primaryCategories: primaries,
			...(categoryParents !== this.data.categoryParents ? { categoryParents } : {}),
		};
		this.save();
		this.notify();
		return true;
	}

	/** Categories currently mapped to a primary group (confirm copy + usage). */
	countPrimaryUsage(type: ExpenseType, primary: string): number {
		const lower = primary.toLowerCase();
		return Object.entries(this.data.categoryParents?.[type] ?? {}).filter(([, p]) => p.toLowerCase() === lower)
			.length;
	}

	/** Overwrite the stored primary order for a direction; exact-cover rule
	 *  identical to reorderCategories. */
	reorderPrimaryCategories(type: ExpenseType, names: readonly string[]): boolean {
		return this.writeTypeList('primaryCategories', type, names, this.getPrimaryCategories(type));
	}

	/** Assign a category to a primary group (null = ungroup). False when
	 *  either side is unknown; same-value writes are no-op successes. */
	setCategoryParent(type: ExpenseType, category: string, primary: string | null): boolean {
		if (!this.getCategories(type).includes(category)) return false;
		const map = this.data.categoryParents?.[type] ?? {};
		if (primary !== null && !(this.data.primaryCategories?.[type] ?? []).includes(primary)) return false;
		if (primary === null) {
			if (map[category] === undefined) return true;
			const { [category]: _dropped, ...rest } = map;
			const categoryParents = { ...this.data.categoryParents, [type]: rest };
			if (Object.keys(rest).length === 0) delete categoryParents[type];
			this.data = { ...this.data, categoryParents };
		} else {
			if (map[category] === primary) return true;
			this.data = {
				...this.data,
				categoryParents: { ...this.data.categoryParents, [type]: { ...map, [category]: primary } },
			};
		}
		this.save();
		this.notify();
		return true;
	}

	/** The primary group a category is mapped to, or undefined. */
	getCategoryParent(type: ExpenseType, category: string): string | undefined {
		return this.data.categoryParents?.[type]?.[category];
	}

	/** Shared exact-cover writer for the two per-type list fields (stored
	 *  order, primary order): a candidate is accepted only when it covers the
	 *  current entries exactly, without duplicates. */
	private writeTypeList(
		field: 'categoryOrder' | 'primaryCategories',
		type: ExpenseType,
		candidate: readonly string[],
		current: readonly string[],
	): boolean {
		if (candidate.length !== current.length || new Set(candidate).size !== candidate.length) return false;
		if (candidate.some((k) => !current.includes(k))) return false;
		if (field === 'categoryOrder') {
			const next = { ...this.data.categoryOrder, [type]: [...candidate] };
			if (candidate.length === 0) delete next[type];
			this.data = { ...this.data, categoryOrder: next };
		} else {
			const next = { ...this.data.primaryCategories, [type]: [...candidate] };
			if (candidate.length === 0) delete next[type];
			this.data = { ...this.data, primaryCategories: next };
		}
		this.save();
		this.notify();
		return true;
	}

	/** Currency symbol from settings (trimmed, default '¥'). */
	getCurrency(): string {
		return this.currency().trim() || '¥';
	}

	/** Write a text file into the vault (CSV export); vault-relative path. */
	async writeVaultFile(path: string, content: string): Promise<void> {
		await this.storage.write(path, content);
	}

	// ===== Aggregation queries (pure derivations, no disk access) =====

	/** Records with date in [start, end] (inclusive, 'YYYY-MM-DD' strings),
	 *  oldest first, createdAt as the tiebreak. */
	getRecordsInRange(start: string, end: string, type?: ExpenseType): ExpenseRecord[] {
		return this.data.records
			.filter((r) => r.date >= start && r.date <= end && (type === undefined || r.type === type))
			.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
	}

	/** Expense/income totals over a date range. */
	getRangeTotals(start: string, end: string): { expense: number; income: number } {
		let expense = 0;
		let income = 0;
		for (const r of this.data.records) {
			if (r.date < start || r.date > end) continue;
			if (r.type === 'expense') expense += r.amount;
			else income += r.amount;
		}
		return { expense: round2(expense), income: round2(income) };
	}

	/** Today's totals (drives the widget's row totals and net label). */
	getTodayTotals(): { expense: number; income: number } {
		const today = expenseToday();
		return this.getRangeTotals(today, today);
	}

	/** One point per day across [start, end], zero-filled, for trend charts. */
	getDailyTotals(start: string, end: string, type: ExpenseType): { date: string; amount: number }[] {
		const byDate = new Map<string, number>();
		for (const r of this.data.records) {
			if (r.type !== type || r.date < start || r.date > end) continue;
			byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.amount);
		}
		const series: { date: string; amount: number }[] = [];
		const cursor = new Date(start + 'T00:00:00');
		const last = new Date(end + 'T00:00:00');
		while (cursor <= last) {
			const key = formatDate(cursor);
			series.push({ date: key, amount: round2(byDate.get(key) ?? 0) });
			cursor.setDate(cursor.getDate() + 1);
		}
		return series;
	}

	/** One point per month of the year (1-12, 'YYYY-MM'), zero-filled. */
	getMonthlyTotals(year: number, type: ExpenseType): { month: string; amount: number }[] {
		const byMonth = new Map<string, number>();
		for (const r of this.data.records) {
			if (r.type !== type || !r.date.startsWith(`${year}-`)) continue;
			const key = r.date.slice(0, 7);
			byMonth.set(key, (byMonth.get(key) ?? 0) + r.amount);
		}
		const series: { month: string; amount: number }[] = [];
		for (let m = 1; m <= 12; m++) {
			const key = `${year}-${String(m).padStart(2, '0')}`;
			series.push({ month: key, amount: round2(byMonth.get(key) ?? 0) });
		}
		return series;
	}

	/** Per-category totals over a range, for donut/ranking views. */
	getCategoryBreakdown(start: string, end: string, type: ExpenseType): Map<string, number> {
		const totals = new Map<string, number>();
		for (const r of this.data.records) {
			if (r.type !== type || r.date < start || r.date > end) continue;
			totals.set(r.category, (totals.get(r.category) ?? 0) + r.amount);
		}
		return totals;
	}

	/** Years with records, ascending; always includes the current year so the
	 *  history view can render it even when still empty. */
	getAvailableYears(): number[] {
		const years = new Set<number>();
		for (const r of this.data.records) {
			const y = Number(r.date.slice(0, 4));
			if (Number.isFinite(y)) years.add(y);
		}
		years.add(new Date().getFullYear());
		return [...years].sort((a, b) => a - b);
	}
}
