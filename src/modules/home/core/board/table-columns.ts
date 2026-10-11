import { reconcileColumns } from './board-experience';
import type { LibraryConfig } from './types/model';

/** Every matching note contributes fields, independently of the current page or group. */
export function libraryTableCandidates(
	rows: readonly { frontmatter: Record<string, unknown> }[],
	filters: LibraryConfig['filters'],
): string[] {
	const fields = new Set<string>();
	for (const filter of filters) {
		if (!['path', 'created', 'modified'].includes(filter.property)) fields.add(filter.property);
	}
	for (const row of rows)
		for (const key of Object.keys(row.frontmatter)) {
			if (key !== 'position') fields.add(key);
		}
	return ['file.name', 'file.modified', ...Array.from(fields, (key) => `property:${key}`)];
}

/** Projection only: opening or filtering a table never persists preferences. */
export function libraryTableColumns(
	config: Pick<LibraryConfig, 'tableOrder' | 'tableHidden'>,
	candidates: readonly string[],
) {
	const { order, hidden } = reconcileColumns(config.tableOrder ?? [], config.tableHidden ?? [], candidates);
	const available = new Set(candidates),
		concealed = new Set(hidden);
	return { order, hidden, visible: order.filter((key) => available.has(key) && !concealed.has(key)) };
}
