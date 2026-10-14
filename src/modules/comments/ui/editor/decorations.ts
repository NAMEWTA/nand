// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/editor/marker-pass.ts, src/editor/line-highlight.ts
import { Decoration, type DecorationSet, type EditorView } from '@codemirror/view';
import type { CommentsEnv } from '../env';
import { pathOf } from './markers';

/** Split overlapping ranges into disjoint marks carrying every covering thread id. */
export function segments(ranges: { start: number; end: number; id: string }[]) {
	const edges = [...new Set(ranges.flatMap(range => [range.start, range.end]))].sort((a, b) => a - b);
	return edges.slice(0, -1).flatMap((start, index) => {
		const end = edges[index + 1]!;
		const ids = ranges.filter(range => range.start <= start && range.end >= end).map(range => range.id);
		return ids.length ? [{ start, end, ids }] : [];
	});
}
export function buildDecorations(view: EditorView, env: CommentsEnv): DecorationSet {
	const settings = env.service.settings(), path = pathOf(view.state);
	if (!path || !settings.highlightEnabled) return Decoration.none;
	const ranges: { start: number; end: number; id: string }[] = [];
	const lines = new Set<number>();
	for (const thread of env.service.store.threadsFor(path)) {
		if (thread.status === 'orphaned' || (thread.status === 'resolved' && !settings.highlightResolved)) continue;
		const { start, end, text } = thread.anchor;
		if (start < 0 || end > view.state.doc.length || view.state.doc.sliceString(start, end) !== text) continue;
		if (thread.kind === 'line') { if (settings.highlightLines) lines.add(view.state.doc.lineAt(start).from); }
		else if (end > start) ranges.push({ start, end, id: thread.id });
	}
	return Decoration.set([
		...segments(ranges).map(range => Decoration.mark({ class: 'nand-comment-hl', attributes: { 'data-comment-ids': range.ids.join(' ') } }).range(range.start, range.end)),
		...[...lines].map(pos => Decoration.line({ class: 'nand-comment-line' }).range(pos)),
	], true);
}
