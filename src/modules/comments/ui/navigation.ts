// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/navigation.ts
import { MarkdownView, TFile } from 'obsidian';
import type { CommentThread } from '../core/model';
import { createAnchor, selectionIsCommentable } from '../core/anchor';
import { t } from '../../../shared/i18n';
import type { CommentsEnv } from './env';

export async function jumpToComment(env: CommentsEnv, path: string, thread: CommentThread): Promise<void> {
	const file = env.app.vault.getFileByPath(path);
	if (!(file instanceof TFile)) return;
	const leaf = env.app.workspace.getLeavesOfType('markdown').find(item => item.view instanceof MarkdownView && item.view.file?.path === path) ?? env.app.workspace.getLeaf(false);
	await leaf.openFile(file, { state: { mode: 'source' } });
	await env.app.workspace.revealLeaf(leaf);
	if (!(leaf.view instanceof MarkdownView)) return;
	const editor = leaf.view.editor;
	const from = editor.offsetToPos(Math.min(thread.anchor.start, editor.getValue().length));
	const to = editor.offsetToPos(Math.min(thread.anchor.end, editor.getValue().length));
	editor.setSelection(from, to); editor.scrollIntoView({ from, to }, true); editor.focus();
	const marks = leaf.view.containerEl.querySelectorAll<HTMLElement>('[data-comment-ids]');
	for (const mark of marks) if (mark.dataset['commentIds']?.split(' ').includes(thread.id)) {
		mark.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 600 });
	}
}
export async function reanchorFromSelection(env: CommentsEnv, path: string, thread: CommentThread): Promise<void> {
	const view = env.app.workspace.getActiveViewOfType(MarkdownView) ?? env.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view).find(view => view instanceof MarkdownView && view.file?.path === path);
	if (!(view instanceof MarkdownView) || view.file?.path !== path) throw new Error(t('editor.comments.reattachHint'));
	const editor = view.editor, doc = editor.getValue();
	const from = editor.posToOffset(editor.getCursor('from')), to = editor.posToOffset(editor.getCursor('to'));
	if (!selectionIsCommentable(doc, from, to)) throw new Error(t('editor.comments.reattachHint'));
	await env.service.reanchor(thread.id, createAnchor(doc, from, to));
}
