// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/editor/marker-pass.ts
import { StateEffect, StateField, type EditorState } from '@codemirror/state';
import { editorInfoField } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import type { CommentsEnv } from '../env';
export const refreshComments = StateEffect.define<number>();
export const setHoveredLine = StateEffect.define<number | null>();
export const hoveredLineField = StateField.define<number | null>({ create: () => null, update(value, tr) { for (const effect of tr.effects) if (effect.is(setHoveredLine)) return effect.value; return tr.docChanged ? null : value; } });
export function pathOf(state: EditorState): string | null { const path = state.field(editorInfoField, false)?.file?.path; return path?.endsWith('.md') ? path : null; }
export function threadsOnLine(view: EditorView, env: CommentsEnv, first: number, last = first) {
	const path = pathOf(view.state);
	return (path ? env.service.store.threadsFor(path) : []).filter(thread => {
		if (thread.status === 'orphaned' || (thread.status === 'resolved' && !env.service.settings().highlightResolved)) return false;
		if (thread.anchor.start > view.state.doc.length) return false;
		const line = view.state.doc.lineAt(thread.anchor.start).number;
		return line >= first && line <= last;
	});
}
