/** Local ranking controls. Changing these never requests another model answer. */
export const HEAT_FIELDS = [
	['windowHours', 48, 1, 168], ['halfLifeHours', 24, 1, 168],
	['minParticipants', 2, 1, 100], ['topCount', 10, 1, 100],
	['trendHours', 6, 1, 168], ['risingPercent', 15, 0, 1000],
	['surgeMinParticipants', 3, 1, 100], ['surgePercent', 50, 1, 100],
] as const;
export const EDITION_FIELDS = [
	['mainLimit', 12, 1, 100], ['flashLimit', 10, 0, 100],
	['perSourceLimit', 2, 1, 100], ['memoryDays', 7, 1, 30],
] as const;
export const GROUPING_FIELDS = [
	['recallDays', 14, 1, 365], ['similarityPercent', 25, 0, 100], ['confidencePercent', 80, 0, 100],
] as const;
export type HeatRules = Record<typeof HEAT_FIELDS[number][0], number>;
export type EditionRules = Record<typeof EDITION_FIELDS[number][0], number>;
export type GroupingRules = Record<typeof GROUPING_FIELDS[number][0], number>;

function normalize<K extends string>(raw: unknown, fields: readonly (readonly [K, number, number, number])[]): Record<K, number> {
	const values = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
	return Object.fromEntries(fields.map(([key, fallback, min, max]) => [key, typeof values[key] === 'number' && Number.isFinite(values[key]) ? Math.round(Math.max(min, Math.min(max, values[key]))) : fallback])) as Record<K, number>;
}
export const normalizeHeatRules = (raw: unknown): HeatRules => normalize(raw, HEAT_FIELDS);
export const normalizeEditionRules = (raw: unknown): EditionRules => normalize(raw, EDITION_FIELDS);
export const normalizeGroupingRules = (raw: unknown): GroupingRules => normalize(raw, GROUPING_FIELDS);
export const DEFAULT_HEAT_RULES = normalizeHeatRules(undefined);
export const DEFAULT_EDITION_RULES = normalizeEditionRules(undefined);
export const DEFAULT_GROUPING_RULES = normalizeGroupingRules(undefined);
