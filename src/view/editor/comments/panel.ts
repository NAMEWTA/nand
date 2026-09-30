import { MarkdownView, Menu, TFile, type App } from 'obsidian';
import { h, render as paint } from 'preact';
import { makeAnchor, selectionIsCommentable } from '../../../core/comments/anchor';
import type { CommentThread } from '../../../core/comments/model';
import { getCommentStore, type CommentStore } from '../../../core/comments/store';
import { momentOf } from '../../../platform/obsidian/datetime';
import { onLanguageChanged, t } from '../../../shared/i18n/index';
import { EmptyState } from '../../primitives/EmptyState';
import { CommentsPanel } from './CommentsPanel';
import { askText } from './prompt';

export interface CommentPanelContext {
	app: App;
	file: TFile | null;
}

/** Local wall time for a stored UTC timestamp. Invalid values keep the raw prefix. */
export function formatCommentTime(ts: string): string {
	const parsed = momentOf(ts);
	if (!parsed.isValid()) return ts.slice(0, 16).replace('T', ' ');
	return parsed.format('YYYY-MM-DD HH:mm');
}

/** Side-panel thread list. Unmounting this does not remove editor highlights. */
export function mountCommentsPanel(el: HTMLElement, ctx: CommentPanelContext): () => void {
	const store = getCommentStore();
	el.empty();
	el.addClass('nand-editor-comments');
	if (!store) {
		paint(
			h(EmptyState, {
				icon: 'message-square',
				title: t('editor.comments.title'),
				description: t('editor.comments.noFile'),
			}),
			el,
		);
		return () => paint(null, el);
	}
	const path = ctx.file?.extension === 'md' ? ctx.file.path : null;
	let disposed = false;
	const render = () => {
		if (disposed) return;
		const active = el.ownerDocument.activeElement;
		if (active?.instanceOf(HTMLTextAreaElement) && el.contains(active)) return;
		draw(el, ctx, store, path);
	};
	const off = store.subscribe(render);
	const offLanguage = onLanguageChanged(() => {
		if (disposed) return;
		const scroll = el.scrollTop;
		const buttons = Array.from(el.querySelectorAll('button'));
		const focused = buttons.indexOf(el.ownerDocument.activeElement as HTMLButtonElement);
		render();
		if (focused >= 0) el.querySelectorAll('button')[focused]?.focus({ preventScroll: true });
		el.scrollTop = scroll;
	});
	if (path) void store.loadFile(path).then(render, () => undefined);
	else render();
	return () => {
		disposed = true;
		off();
		offLanguage();
		paint(null, el);
	};
}

function draw(el: HTMLElement, ctx: CommentPanelContext, store: CommentStore, path: string | null): void {
	paint(
		h(CommentsPanel, {
			path,
			threads: path ? store.threadsFor(path) : [],
			focusedId: store.focusedId,
			formatTime: formatCommentTime,
			actions: {
				jump: (thread) => {
					void jumpToComment(ctx.app, thread);
				},
				reanchor: (thread) => {
					void reanchorFromSelection(ctx, store, thread);
				},
				resolve: (id) => {
					void store.resolve(id);
				},
				reopen: (id) => {
					void store.reopen(id);
				},
				reply: (id) => {
					void askText(ctx.app, 'editor.comments.reply', 'editor.comments.placeholder').then((text) => {
						if (text) void store.reply(id, text);
					});
				},
				more: (thread, button) => {
					const menu = new Menu();
					menu.addItem((item) =>
						item
							.setTitle(t('editor.comments.delete'))
							.setIcon('trash-2')
							.onClick(() => {
								void store.remove(thread.id);
							}),
					);
					const rect = button.getBoundingClientRect();
					menu.showAtPosition({ x: rect.left, y: rect.bottom });
				},
			},
		}),
		el,
	);
}

async function reanchorFromSelection(
	ctx: CommentPanelContext,
	store: CommentStore,
	thread: CommentThread,
): Promise<void> {
	const view = ctx.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view?.file || view.file.path !== thread.target.path) {
		await jumpToComment(ctx.app, thread);
		return;
	}
	const fromPos = view.editor.getCursor('from');
	const toPos = view.editor.getCursor('to');
	const from = view.editor.posToOffset(fromPos);
	const to = view.editor.posToOffset(toPos);
	const doc = view.editor.getValue();
	if (!selectionIsCommentable(doc, from, to)) return;
	await store.reanchor(thread.id, { quote: makeAnchor(doc, from, to), start: from, end: to });
}

export async function jumpToComment(app: App, thread: CommentThread): Promise<void> {
	const file = app.vault.getFileByPath(thread.target.path);
	if (!(file instanceof TFile)) return;
	const leaves = app.workspace.getLeavesOfType('markdown');
	let leaf = leaves.find((item) => item.view instanceof MarkdownView && item.view.file?.path === file.path);
	if (!leaf) leaf = app.workspace.getLeaf(false);
	if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview') {
		const state = leaf.getViewState();
		await leaf.setViewState({
			type: 'markdown',
			state: { ...(state.state ?? {}), mode: 'source', file: file.path },
			active: true,
		});
	} else if (!(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== file.path) {
		await leaf.openFile(file);
	} else {
		await app.workspace.revealLeaf(leaf);
	}
	const view = leaf.view;
	if (!(view instanceof MarkdownView)) return;
	const from = view.editor.offsetToPos(thread.target.start);
	const to = view.editor.offsetToPos(thread.target.end);
	view.editor.setSelection(from, to);
	view.editor.scrollIntoView({ from, to }, true);
	getCommentStore()?.focus(thread.id);
}
