// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/ui/panel-filter.ts
import type { CommentThread } from '../../core/model';
export type ThreadFilter = 'all' | 'open' | 'resolved';
export function filterThreads(threads: readonly CommentThread[], filter: ThreadFilter) { return filter === 'all' ? [...threads] : threads.filter(thread => (thread.status === 'resolved') === (filter === 'resolved')); }
export function countThreads(threads: readonly CommentThread[]) { const resolved = threads.filter(thread => thread.status === 'resolved').length; return { all: threads.length, open: threads.length - resolved, resolved }; }
