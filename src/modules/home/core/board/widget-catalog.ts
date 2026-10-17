import type { HomeWidgetKind } from '../../api';
import { HOME_WIDGET_TIERS, type HomeWidgetCategory, type HomeWidgetTier } from './widget-tiers';

/** The size facts of a kind; the only size table a widget has. */
export type KindSizes = Pick<HomeWidgetKind, 'sizes' | 'defaultTier' | 'minSize'>;
export interface CellSize {
	w: number;
	h: number;
}

/** Tiers a kind supports, smallest first. */
export function supportedTiers(kind: Pick<HomeWidgetKind, 'sizes'>): HomeWidgetTier[] {
	return HOME_WIDGET_TIERS.filter((tier) => kind.sizes[tier]);
}

/** Grid cells of a tier; an unsupported tier falls back to the kind's default tier. */
export function tierSize(kind: KindSizes, tier: HomeWidgetTier = kind.defaultTier): CellSize {
	return { ...(kind.sizes[tier] ?? kind.sizes[kind.defaultTier] ?? { w: 3, h: 16 }) };
}

/** The size a new instance starts with. */
export const defaultCellSize = (kind: KindSizes): CellSize => tierSize(kind, kind.defaultTier);

/** The supported tier closest to a free-form size (by area, then width); the tile keeps its exact size. */
export function nearestTier(kind: KindSizes, size: CellSize): HomeWidgetTier {
	const area = size.w * size.h;
	let best: HomeWidgetTier = kind.defaultTier;
	let distance = Infinity;
	for (const tier of supportedTiers(kind)) {
		const cell = kind.sizes[tier]!;
		const gap = Math.abs(cell.w * cell.h - area) + Math.abs(cell.w - size.w) * 4;
		if (gap < distance) {
			distance = gap;
			best = tier;
		}
	}
	return best;
}

/** Whether a tile still has exactly the cells of one tier. */
export function exactTier(kind: KindSizes, size: CellSize): HomeWidgetTier | undefined {
	return supportedTiers(kind).find((tier) => kind.sizes[tier]!.w === size.w && kind.sizes[tier]!.h === size.h);
}

export interface CatalogEntry {
	module: string;
	kind: HomeWidgetKind;
	title: string;
}

/** Add-widget panel content: entries filtered by a free-text query and an optional category, in a stable order. */
export function filterCatalog(
	entries: readonly CatalogEntry[],
	query: string,
	category?: HomeWidgetCategory,
): CatalogEntry[] {
	const needle = query.trim().toLowerCase();
	return entries.filter(
		(entry) =>
			(!category || entry.kind.category === category) &&
			(!needle || entry.title.toLowerCase().includes(needle) || entry.kind.key.toLowerCase().includes(needle)),
	);
}

/** Categories that still have entries after filtering, in the panel's order. */
export function catalogCategories(
	entries: readonly CatalogEntry[],
	order: readonly HomeWidgetCategory[],
): HomeWidgetCategory[] {
	const present = new Set(entries.map((entry) => entry.kind.category));
	return order.filter((category) => present.has(category));
}
