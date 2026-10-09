import { t } from '../../../../shared/i18n/index';

/** Direction of a bookkeeping entry. */
export type ExpenseType = 'expense' | 'income';

/** One expense/income entry owned by the user. */
export interface ExpenseRecord {
	id: string;
	type: ExpenseType;
	/** Positive amount, rounded to 2 decimals on insert. */
	amount: number;
	/** Preset category key (see EXPENSE_CATEGORIES / INCOME_CATEGORIES). */
	category: string;
	/** Optional user note, at most EXPENSE_MAX_NOTE_LENGTH chars. */
	note?: string;
	/** 'YYYY-MM-DD', local time; may be a past date (backfill). */
	date: string;
	/** Epoch ms, ordering tiebreak within one day. */
	createdAt: number;
}

/** In-memory domain snapshot; production persistence uses Markdown documents. */
export interface ExpenseData {
	version: 1;
	/** Append-ordered; never pruned (financial history spans years). */
	records: ExpenseRecord[];
	/** Last category picked per type, so the widget's selects reopen on it. */
	lastCategory: { expense?: string; income?: string };
	/** User-added category names per direction (absent until the user adds one). */
	customCategories?: { expense?: string[]; income?: string[] };
	/** Full display order per direction (preset keys + custom names mixed).
	 *  Absent in files that never reordered; missing categories fall back to
	 *  default order at read time (getOrderedCategories), never on save. */
	categoryOrder?: { expense?: string[]; income?: string[] };
	/** Ordered primary-group names per direction (grouping layer above the
	 *  flat categories; records never store the primary, only the mapping). */
	primaryCategories?: { expense?: string[]; income?: string[] };
	/** Secondary category key/name -> primary-group name, per direction. */
	categoryParents?: { expense?: Record<string, string>; income?: Record<string, string> };
}

export const DATA_FILE = 'expense.json';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Shared with the widget so its validation matches the service. */
export const EXPENSE_MAX_NOTE_LENGTH = 50;

export const MAX_NOTE_LENGTH = EXPENSE_MAX_NOTE_LENGTH;

/** Sanity ceiling for a single entry (in currency units). */
export const MAX_AMOUNT = 1e8;

/** Preset top-level expense categories (keys are stable i18n lookups). */
export const EXPENSE_CATEGORIES = [
	'food',
	'transport',
	'shopping',
	'housing',
	'utilities',
	'entertainment',
	'medical',
	'education',
	'social',
	'other',
] as const;

/** Preset top-level income categories. */
export const INCOME_CATEGORIES = ['salary', 'bonus', 'investment', 'sideJob', 'gift', 'other'] as const;

/** The preset category keys for a direction. */
export function categoriesFor(type: ExpenseType): readonly string[] {
	return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}

/** Custom-category guards shared with the manager UI. */
export const EXPENSE_CATEGORY_NAME_MAX = 12;

export const EXPENSE_MAX_CUSTOM_CATEGORIES = 30;

/** Cap on primary groups per direction (kept far below the 30 customs cap —
 *  primaries are coarse buckets, not fine-grained categories). */
export const EXPENSE_MAX_PRIMARY_CATEGORIES = 10;

/** Breakdown bucket key for categories without a primary group; also the
 *  ledger primary-filter sentinel. Never a real name (double underscores). */
export const UNGROUPED_PRIMARY = '__ungrouped__';

/** Outcome of addCustomCategory — callers map `reason` to a Notice. */
export type AddCategoryResult = { ok: true; name: string } | { ok: false; reason: 'invalid' | 'duplicate' | 'limit' };

/** True when a candidate custom name would shadow a preset key or the
 *  preset's localized label (case-insensitive), which would make records
 *  written with it indistinguishable from preset entries. */
export function collidesWithPreset(name: string, type: ExpenseType): boolean {
	const lower = name.toLowerCase();
	return categoriesFor(type).some(
		(key) => key.toLowerCase() === lower || t(`expense.cat.${key}`).toLowerCase() === lower,
	);
}

export function isExpenseType(value: unknown): value is ExpenseType {
	return value === 'expense' || value === 'income';
}

export function emptyData(): ExpenseData {
	return { version: 1, records: [], lastCategory: {} };
}

/** Round to 2 decimals (insert-time and display-time float guard). */
export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

/** Compact amount display: '25' / '25.5' / '25.05' — trailing zero trimmed,
 *  never a bare integer followed by a dot (shared by widget + stats). */
export function formatExpenseAmount(n: number): string {
	const v = round2(n);
	if (Number.isInteger(v)) return String(v);
	return v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Amount-field sanitizer shared by the widget rows and the backfill modal:
 *  keep only digits and at most one dot with 2 decimals, so pasting
 *  "¥25，5" lands as "25.5" without ever rejecting the keystroke. */
export function sanitizeAmountInput(raw: string): string {
	const cleaned = raw.replace(/[^0-9.]/g, '');
	const dot = cleaned.indexOf('.');
	if (dot === -1) return cleaned;
	const int = cleaned.slice(0, dot);
	const frac = cleaned
		.slice(dot + 1)
		.replace(/\./g, '')
		.slice(0, 2);
	return `${int}.${frac}`;
}

/** Normalize a parsed expense.json: keep only well-formed records so a
 *  hand-edited or corrupted file degrades to partial data. */
export function normalizeData(raw: unknown): ExpenseData {
	if (!raw || typeof raw !== 'object') return emptyData();
	const obj = raw as Partial<ExpenseData>;
	const records = Array.isArray(obj.records)
		? obj.records
				.filter(
					(r): r is ExpenseRecord =>
						!!r &&
						typeof r === 'object' &&
						typeof r.id === 'string' &&
						r.id.length > 0 &&
						isExpenseType(r.type) &&
						typeof r.amount === 'number' &&
						Number.isFinite(r.amount) &&
						r.amount > 0 &&
						typeof r.category === 'string' &&
						r.category.length > 0 &&
						typeof r.date === 'string' &&
						DATE_RE.test(r.date) &&
						typeof r.createdAt === 'number' &&
						Number.isFinite(r.createdAt),
				)
				.map((r) => ({ ...r, amount: round2(r.amount) }))
		: [];
	const lastCategory: { expense?: string; income?: string } = {};
	const lc = obj.lastCategory;
	if (lc && typeof lc === 'object') {
		if (typeof lc.expense === 'string' && lc.expense.length > 0) lastCategory.expense = lc.expense;
		if (typeof lc.income === 'string' && lc.income.length > 0) lastCategory.income = lc.income;
	}
	const customCategories = normalizeCustomCategories(obj.customCategories);
	const categoryOrder = normalizeCategoryOrder(obj.categoryOrder, customCategories);
	const primaryCategories = normalizePrimaryCategories(obj.primaryCategories);
	const categoryParents = normalizeCategoryParents(obj.categoryParents, customCategories, primaryCategories);
	return {
		version: 1,
		records,
		lastCategory,
		...(customCategories ? { customCategories } : {}),
		...(categoryOrder ? { categoryOrder } : {}),
		...(primaryCategories ? { primaryCategories } : {}),
		...(categoryParents ? { categoryParents } : {}),
	};
}

/** Keep only usable custom category names per type: non-empty trimmed strings
 *  that don't shadow a preset key, deduped case-insensitively and capped. A
 *  hand-edited file degrades to partial data instead of failing the load. */
export function normalizeCustomCategories(raw: unknown): ExpenseData['customCategories'] {
	if (!raw || typeof raw !== 'object') return undefined;
	const out: { expense?: string[]; income?: string[] } = {};
	for (const type of ['expense', 'income'] as const) {
		const list = (raw as Record<string, unknown>)[type];
		if (!Array.isArray(list)) continue;
		const names: string[] = [];
		const seen = new Set<string>();
		for (const v of list) {
			if (typeof v !== 'string') continue;
			const name = v.trim().slice(0, EXPENSE_CATEGORY_NAME_MAX);
			if (name.length === 0 || collidesWithPreset(name, type)) continue;
			const key = name.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			names.push(name);
		}
		if (names.length > 0) out[type] = names.slice(0, EXPENSE_MAX_CUSTOM_CATEGORIES);
	}
	return out.expense === undefined && out.income === undefined ? undefined : out;
}

/** Keep only order entries that are known categories for the direction,
 *  deduped. Missing categories are deliberately NOT appended here — a file
 *  must not grow the field on its next save; lenient completion happens
 *  at read time (getOrderedCategories) and never persists. */
export function normalizeCategoryOrder(
	raw: unknown,
	custom: ExpenseData['customCategories'],
): ExpenseData['categoryOrder'] {
	if (!raw || typeof raw !== 'object') return undefined;
	const out: { expense?: string[]; income?: string[] } = {};
	for (const type of ['expense', 'income'] as const) {
		const list = (raw as Record<string, unknown>)[type];
		if (!Array.isArray(list)) continue;
		const known = new Set<string>([...categoriesFor(type), ...(custom?.[type] ?? [])]);
		const keys: string[] = [];
		for (const v of list) {
			if (typeof v !== 'string' || !known.has(v) || keys.includes(v)) continue;
			keys.push(v);
		}
		if (keys.length > 0) out[type] = keys;
	}
	return out.expense === undefined && out.income === undefined ? undefined : out;
}

/** Keep only usable primary-group names per type: non-empty trimmed strings,
 *  deduped case-insensitively and capped. Deliberately no preset-collision
 *  filter — that guard belongs to the write path (addPrimaryCategory); a
 *  hand-edited file keeps what it says rather than silently reverting. */
export function normalizePrimaryCategories(raw: unknown): ExpenseData['primaryCategories'] {
	if (!raw || typeof raw !== 'object') return undefined;
	const out: { expense?: string[]; income?: string[] } = {};
	for (const type of ['expense', 'income'] as const) {
		const list = (raw as Record<string, unknown>)[type];
		if (!Array.isArray(list)) continue;
		const names: string[] = [];
		const seen = new Set<string>();
		for (const v of list) {
			if (typeof v !== 'string') continue;
			const name = v.trim().slice(0, EXPENSE_CATEGORY_NAME_MAX);
			if (name.length === 0) continue;
			const key = name.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			names.push(name);
		}
		if (names.length > 0) out[type] = names.slice(0, EXPENSE_MAX_PRIMARY_CATEGORIES);
	}
	return out.expense === undefined && out.income === undefined ? undefined : out;
}

/** Keep only parent mappings whose category is known for the direction and
 *  whose primary exists after normalization; dangling entries drop out. */
export function normalizeCategoryParents(
	raw: unknown,
	custom: ExpenseData['customCategories'],
	primaries: ExpenseData['primaryCategories'],
): ExpenseData['categoryParents'] {
	if (!raw || typeof raw !== 'object') return undefined;
	const out: { expense?: Record<string, string>; income?: Record<string, string> } = {};
	for (const type of ['expense', 'income'] as const) {
		const map = (raw as Record<string, unknown>)[type];
		if (!map || typeof map !== 'object') continue;
		const knownCats = new Set<string>([...categoriesFor(type), ...(custom?.[type] ?? [])]);
		const knownPrimaries = primaries?.[type] ?? [];
		const clean: Record<string, string> = {};
		for (const [cat, primary] of Object.entries(map)) {
			if (typeof primary !== 'string') continue;
			const name = primary.trim();
			if (!knownCats.has(cat) || !knownPrimaries.includes(name)) continue;
			clean[cat] = name;
		}
		if (Object.keys(clean).length > 0) out[type] = clean;
	}
	return out.expense === undefined && out.income === undefined ? undefined : out;
}

export function formatDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Local-time 'YYYY-MM-DD' for today (shared by the widget and stats modal). */
export function expenseToday(): string {
	return formatDate(new Date());
}

export function makeRecordId(): string {
	return `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Regroup a per-category breakdown (getCategoryBreakdown) up to primary
 *  groups: each category's total lands on its mapped primary, unmapped ones
 *  pool into the UNGROUPED_PRIMARY bucket. Pure — the stats overlay calls it
 *  with its own parentOf so this stays testable without a service instance. */
export function regroupBreakdownByPrimary(
	totals: ReadonlyMap<string, number>,
	parentOf: (category: string) => string | undefined,
): Map<string, number> {
	const out = new Map<string, number>();
	for (const [category, value] of totals) {
		const key = parentOf(category) ?? UNGROUPED_PRIMARY;
		out.set(key, (out.get(key) ?? 0) + value);
	}
	return out;
}
