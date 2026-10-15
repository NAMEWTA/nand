// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/editor/comment-navigation.ts
import { MarkdownView } from 'obsidian';
import type { CommandAccess } from '../../../app/contracts/module';
import { NAND_COMMANDS } from '../../../shared/commands';
import { t } from '../../../shared/i18n';
import type { CommentsEnv } from './env';
import { openComposer, openThreads } from './editor/selection';
import { pathOf, threadsOnLine } from './editor/markers';
export function registerCommentCommands(env: CommentsEnv, commands: CommandAccess): void {
	const editor = () => {
		const active = env.app.workspace.getActiveViewOfType(MarkdownView);
		return [...env.editors].find(view => active?.containerEl.contains(view.dom)) ?? [...env.editors].find(view => pathOf(view.state) === env.service.state.getState().path);
	};
	commands.add({ id: NAND_COMMANDS.ADD_COMMENT, nameKey: 'editor.comments.add', name: t('editor.comments.add'), editorCallback: () => { const view = editor(); if (view) openComposer(view, env); } });
	commands.add({ id: 'comments-open-panel', nameKey: 'editor.comments.openPanel', name: t('editor.comments.openPanel'), callback: () => { void env.app.workspace.ensureSideLeaf('nand-comments-view', env.service.settings().panelSide, { active: true, reveal: true }); } });
	commands.add({ id: 'comments-at-cursor', nameKey: 'editor.comments.atCursor', name: t('editor.comments.atCursor'), editorCallback: () => {
		const view = editor(), path = view ? pathOf(view.state) : null;
		if (!view || !path) return;
		void env.service.load(path).then(() => {
			if (!env.alive() || !env.editors.has(view) || pathOf(view.state) !== path) return;
			const threads = threadsOnLine(view, env, view.state.doc.lineAt(view.state.selection.main.head).number);
			openThreads(view, env, threads.map(thread => thread.id), view.state.selection.main.head, true);
		}, () => undefined);
	} });
	for (const [id, direction] of [['next', 1], ['previous', -1]] as const) commands.add({ id: `comments-${id}`, nameKey: `editor.comments.${id}`, name: t(`editor.comments.${id}`), editorCallback: () => {
		const view = editor(); if (!view) return;
		const path = pathOf(view.state); if (!path) return;
		void env.service.load(path).then(() => {
			if (!env.alive() || !env.editors.has(view) || pathOf(view.state) !== path) return;
			const positions = env.service.store.threadsFor(path).filter(thread => thread.status === 'open').map(thread => Math.min(thread.anchor.start, view.state.doc.length)).sort((a, b) => direction * (a - b));
			const next = positions.find(position => direction * (position - view.state.selection.main.head) > 0) ?? positions[0];
			if (next !== undefined) view.dispatch({ selection: { anchor: next }, scrollIntoView: true });
		}, () => undefined);
	} });
	commands.add({ id: 'comments-resolve-all', nameKey: 'editor.comments.resolveAll', name: t('editor.comments.resolveAll'), editorCallback: () => {
		const view = editor(), path = view ? pathOf(view.state) : null; if (!view || !path) return;
		env.open({ path, ownerDocument: view.dom.ownerDocument, rect: () => view.dom.getBoundingClientRect(), mode: 'resolve-all', pinned: true, focus: () => view.focus() });
	} });
}
