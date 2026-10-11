import type { DashboardData } from './types/model';

/** Called by explicit layout edits, never by parse/open/resize. */
export function withStableSectionIds(data: DashboardData, createId: () => string): DashboardData {
	const seen = new Set<string>();
	const reserved = new Set([
		...data.columns.flatMap(column => [column.id, ...column.cards.map(card => card.id)]),
		...(data.widgets ?? []).map(member => member.memberId),
		...(data.immersive ?? []).map(tile => tile.id),
	].filter((id): id is string => !!id));
	const columns = data.columns.map(column => {
		let id = column.id;
		if (!id || seen.has(id)) {
			do { id = createId(); } while (!id || reserved.has(id));
		}
		seen.add(id);
		reserved.add(id);
		return column.id === id ? column : { ...column, id };
	});
	const counts = new Map<string, number>();
	for (const column of columns) counts.set(column.name, (counts.get(column.name) ?? 0) + 1);
	const names = new Map<string, string>();
	for (const [index, column] of columns.entries()) names.set(`section:${column.name}${counts.get(column.name) === 1 ? '' : `:${index}`}`, column.id!);
	return { ...data, columns, immersive: data.immersive?.map(tile => names.has(tile.id) ? { ...tile, id: names.get(tile.id)! } : tile) };
}
