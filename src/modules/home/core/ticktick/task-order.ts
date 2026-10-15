// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/ticktick-section.ts
/** Descending fractional position, excluding the moved row before finding its neighbours. */
export function computeSortOrder(
	movedId: string,
	beforeId: string | null,
	siblings: readonly { id: string; sortOrder?: number }[],
): number {
	const ordered = [...siblings]
		.filter((t) => t.id !== movedId)
		.sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));
	const at = beforeId ? ordered.findIndex((t) => t.id === beforeId) : ordered.length,
		index = at < 0 ? ordered.length : at;
	const above = ordered[index - 1]?.sortOrder,
		below = ordered[index]?.sortOrder;
	return above !== undefined && below !== undefined
		? (above + below) / 2
		: above !== undefined
			? above - 1000
			: below !== undefined
				? below + 1000
				: 0;
}
