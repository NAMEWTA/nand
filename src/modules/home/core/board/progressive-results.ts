import { nextWindow, renderWindow } from './board-experience';

export const SECTION_CANDIDATE_LIMIT = 500;

/** Input is already filtered and sorted; the cap applies before any grouping. */
export function sectionCandidates<T>(ordered: readonly T[]): { items: readonly T[]; total: number; limited: boolean } {
	return {
		items: ordered.slice(0, SECTION_CANDIDATE_LIMIT),
		total: ordered.length,
		limited: ordered.length > SECTION_CANDIDATE_LIMIT,
	};
}

export function progressiveGroup<T>(
	items: readonly T[],
	key: (item: T) => string,
	candidates: ReadonlySet<string>,
	loaded = 50,
): { items: T[]; total: number; available: number; shown: number } {
	const available = items.filter((item) => candidates.has(key(item)));
	const shown = renderWindow(available.length, loaded).count;
	return { items: available.slice(0, shown), total: items.length, available: available.length, shown };
}

export function moreGroupItems(loaded: number | undefined, available: number): number {
	return nextWindow(loaded ?? 50, available);
}
