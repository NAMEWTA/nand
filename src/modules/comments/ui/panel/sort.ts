// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/ui/panel-sort.ts
import type { CommentThread } from '../../core/model';
export type SortOrder = 'position' | 'created' | 'activity';
export function sortThreads(threads: readonly CommentThread[], order: SortOrder) {
	return [...threads].sort((a, b) => {
		if ((a.status === 'orphaned') !== (b.status === 'orphaned')) return a.status === 'orphaned' ? 1 : -1;
		if (order === 'position') return a.anchor.start - b.anchor.start;
		return order === 'created' ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt);
	});
}
