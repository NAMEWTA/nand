// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { GroupBy, SortBy, SortDirection } from './types';

/** The list settings a single folder, tag or property may override. */
export interface ListAppearance {
	sortBy: SortBy;
	sortDirection: SortDirection;
	groupBy: GroupBy;
	/** The frontmatter property notes are grouped by when `groupBy` is `property`. */
	groupProperty: string;
	titleRows: number;
	previewRows: number;
	compact: boolean;
	includeDescendants: boolean;
}

export type AppearanceOverride = Partial<ListAppearance>;
export type AppearanceField = keyof ListAppearance;

export const APPEARANCE_FIELDS: readonly AppearanceField[] = ['sortBy', 'sortDirection', 'groupBy', 'groupProperty', 'titleRows', 'previewRows', 'compact', 'includeDescendants'];

/** The appearance of one context: the global settings with the context's overrides on top. */
export function resolveAppearance(base: ListAppearance, override: AppearanceOverride | undefined): ListAppearance {
	if (!override) return base;
	return { ...base, ...override };
}

export function hasOverride(override: AppearanceOverride | undefined): boolean {
	return !!override && Object.keys(override).length > 0;
}

const SORTS: readonly SortBy[] = ['modified', 'created', 'name'];
const DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];
const GROUPS: readonly GroupBy[] = ['none', 'date', 'folder', 'property'];

const clampInt = (value: unknown, min: number, max: number): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : undefined;

/** Keep only well-formed overrides from stored data. */
export function normalizeOverride(value: unknown): AppearanceOverride {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	const source = value as Record<string, unknown>;
	const result: AppearanceOverride = {};
	if (SORTS.includes(source['sortBy'] as SortBy)) result.sortBy = source['sortBy'] as SortBy;
	if (DIRECTIONS.includes(source['sortDirection'] as SortDirection)) result.sortDirection = source['sortDirection'] as SortDirection;
	if (GROUPS.includes(source['groupBy'] as GroupBy)) result.groupBy = source['groupBy'] as GroupBy;
	if (typeof source['groupProperty'] === 'string' && source['groupProperty']) result.groupProperty = source['groupProperty'].slice(0, 60);
	const title = clampInt(source['titleRows'], 1, 3);
	if (title !== undefined) result.titleRows = title;
	const preview = clampInt(source['previewRows'], 1, 5);
	if (preview !== undefined) result.previewRows = preview;
	if (typeof source['compact'] === 'boolean') result.compact = source['compact'];
	if (typeof source['includeDescendants'] === 'boolean') result.includeDescendants = source['includeDescendants'];
	return result;
}
