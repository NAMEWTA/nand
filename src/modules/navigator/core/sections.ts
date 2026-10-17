// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** The root-level sections of the navigation pane. */
export const SECTION_IDS = ['shortcuts', 'recent', 'folders', 'tags', 'properties'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const isSectionId = (value: unknown): value is SectionId => SECTION_IDS.includes(value as SectionId);

/** Stored order made complete: unknown ids are dropped, missing ones follow in their default places. */
export function normalizeSections(value: unknown): SectionId[] {
	const stored = Array.isArray(value) ? value.filter(isSectionId) : [];
	const order: SectionId[] = [...new Set(stored)];
	for (const id of SECTION_IDS) if (!order.includes(id)) order.splice(Math.min(order.length, SECTION_IDS.indexOf(id)), 0, id);
	return order;
}

/** Move `id` in front of `beforeId`, or to the end when `beforeId` is null. */
export function moveSection(order: readonly SectionId[], id: SectionId, beforeId: SectionId | null): SectionId[] {
	if (id === beforeId) return [...order];
	const rest = order.filter((entry) => entry !== id);
	const at = beforeId === null ? rest.length : rest.indexOf(beforeId);
	rest.splice(at < 0 ? rest.length : at, 0, id);
	return rest;
}
