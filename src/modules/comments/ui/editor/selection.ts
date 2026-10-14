import type { EditorView } from '@codemirror/view';
import { createAnchor, selectionIsCommentable } from '../../core/anchor';
import type { CommentsEnv } from '../env';
import { pathOf, threadsOnLine } from './markers';

export function openForLine(view: EditorView, env: CommentsEnv, first: number, last = first, pinned = true): void {
	const threads = threadsOnLine(view, env, first, last);
	if (threads.length) openThreads(view, env, threads.map(thread => thread.id), view.state.doc.line(first).from, pinned);
	else openComposer(view, env, view.state.doc.line(first).from, view.state.doc.line(first).from);
}
function rectAt(view: EditorView, position: number): DOMRect {
	const rect = view.coordsAtPos(Math.min(view.state.doc.length, position)) ?? view.dom.getBoundingClientRect();
	return new view.dom.ownerDocument.defaultView!.DOMRect(rect.left, rect.top, Math.max(1, rect.right - rect.left), rect.bottom - rect.top);
}
export function openThreads(view: EditorView, env: CommentsEnv, threadIds: string[], position: number, pinned: boolean): void {
	const path = pathOf(view.state); if (!path || !threadIds.length) return;
	const at = () => env.service.store.threadsFor(path).find(thread => threadIds.includes(thread.id))?.anchor.start ?? position;
	env.open({ path, ownerDocument: view.dom.ownerDocument, mode: 'threads', threadIds, pinned, rect: () => rectAt(view, at()), focus: () => view.focus(), visible: () => isVisible(view, at()) });
}
export function openComposer(view: EditorView, env: CommentsEnv, from = view.state.selection.main.from, to = view.state.selection.main.to, selectionButton = false): void {
	const path = pathOf(view.state); if (!path) return;
	const text = view.state.doc.toString();
	const anchor = createAnchor(text, from, to);
	if (!selectionIsCommentable(text, anchor.start, Math.max(anchor.end, anchor.start + 1))) return;
	env.open({ path, ownerDocument: view.dom.ownerDocument, mode: selectionButton ? 'selection' : 'compose', anchor, pinned: !selectionButton, rect: () => rectAt(view, selectionButton ? to : from), focus: () => { if (view.dom.isConnected) { view.dispatch({ selection: { anchor: Math.min(from, view.state.doc.length), head: Math.min(to, view.state.doc.length) } }); view.focus(); } }, visible: () => isVisible(view, to) });
}
export function isVisible(view: EditorView, position: number): boolean {
	if (!view.dom.isConnected || !view.dom.getClientRects().length) return false;
	const rect = view.coordsAtPos(Math.min(view.state.doc.length, position));
	const pane = view.scrollDOM.getBoundingClientRect();
	return !!rect && rect.bottom >= pane.top && rect.top <= pane.bottom;
}
