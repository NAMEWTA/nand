import type { ExpenseType } from '../../../core/expense/model';

/** Fixed per-category palettes (index-stable across views, unlike a hash the
 *  preset keys keep their color even when records are sparse). */
const EXPENSE_PALETTE: Record<string, string> = {
	food: '#e74c3c',
	transport: '#e67e22',
	shopping: '#f1c40f',
	housing: '#9b59b6',
	utilities: '#3498db',
	entertainment: '#e91e63',
	medical: '#1abc9c',
	education: '#00bcd4',
	social: '#ff7043',
	other: '#95a5a6',
};

const INCOME_PALETTE: Record<string, string> = {
	salary: '#2ecc71',
	bonus: '#27ae60',
	investment: '#1abc9c',
	sideJob: '#3498db',
	gift: '#f1c40f',
	other: '#95a5a6',
};

/** Neutral gray for empty keys and the ungrouped primary bucket (a real
 *  color would imply a category the user never created). */
export const EXPENSE_FALLBACK_COLOR = '#95a5a6';

const FALLBACK_COLOR = EXPENSE_FALLBACK_COLOR;

/** Deterministic color for a custom category name: FNV-1a hash → HSL hue, so
 *  the same name keeps the same color across the donut, ranking and legend
 *  without persisting a palette. Fixed saturation/lightness read on both the
 *  light and dark card surfaces. */
function customCategoryColor(key: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) {
		hash ^= key.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	const hue = Math.abs(hash) % 360;
	return `hsl(${hue}, 52%, 50%)`;
}

/** Stable color for a category key: preset palettes first, then the name
 *  hash (custom categories), gray only for empty keys. */
export function categoryColor(type: ExpenseType, key: string): string {
	const palette = type === 'expense' ? EXPENSE_PALETTE : INCOME_PALETTE;
	return palette[key] ?? (key.length > 0 ? customCategoryColor(key) : FALLBACK_COLOR);
}

/** Bar colors shared by the widget/stats convention. */
export const EXPENSE_BAR_COLOR = 'var(--db-danger, #e74c3c)';
export const INCOME_BAR_COLOR = '#2ecc71';

export interface ExpenseSlice {
	key: string;
	label: string;
	value: number;
	/** Slice stroke color (categoryColor of the key). */
	color: string;
}

export interface ExpenseBar {
	label: string;
	/** Primary series (expense in the combined view). */
	value: number;
	/** Optional secondary series drawn beside the primary (income). */
	secondary?: number;
	tooltip: string;
}

export interface ExpenseRankRow {
	key: string;
	label: string;
	value: number;
}
