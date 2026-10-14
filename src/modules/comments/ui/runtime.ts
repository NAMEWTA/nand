import { Notice, TFile } from 'obsidian';
import type { ModuleContext } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { CommentsIndex, CommentsPanel } from '../api';
import { CommentStore } from '../core/store';
import { trackActiveMarkdown } from '../platform/active-file';
import { beginCommentStoreActivation } from '../platform/store-handoff';
import { vaultCommentFs } from '../platform/vault-fs';
import { createCommentsService } from '../services/comments';
import type { CommentsSettings } from '../settings';
import { commentsCmExtension } from './editor/extension';
import { registerCommentCommands } from './commands';
import type { CommentsEnv } from './env';
import { CommentsOverlays } from './popover/overlay-host';
import { commentsReadingProcessor, refreshReadingViews } from './reading';
export interface CommentsRuntime { readonly env: CommentsEnv; readonly panel: CommentsPanel; readonly index: CommentsIndex; dispose(): void }
export async function createCommentsRuntime(context: ModuleContext, settings: SettingsHandle<CommentsSettings>): Promise<CommentsRuntime> {
	const { app, lifetime } = context;
	const activation = beginCommentStoreActivation(app);
	await activation.ready();
	const win = app.workspace.containerEl.ownerDocument.defaultView!;
	let alive = true;
	const store = new CommentStore(vaultCommentFs(app), { timers: { set: (callback, ms) => win.setTimeout(callback, ms), clear: handle => win.clearTimeout(handle as number) }, fuzzyThreshold: () => settings.get().fuzzyThreshold, onError: () => { if (alive) new Notice(t('editor.comments.storageFailed')); } });
	const service = createCommentsService(store, () => settings.get());
	const env: CommentsEnv = { app, service, editors: new Set(), alive: () => alive, overlay: doc => overlays.get(doc), open: request => overlays.get(request.ownerDocument).open(request), openSettings: () => { void context.shell.open({ feature: 'settings', section: 'editor' }); } };
	const overlays = new CommentsOverlays(env);
	const readingCleanups = new Set<() => void>();
	const panels = new Set<() => void>();
	context.editor.addExtension(commentsCmExtension(env));
	context.editor.addPostProcessor(commentsReadingProcessor(env, readingCleanups));
	registerCommentCommands(env, context.commands);
	const active = trackActiveMarkdown(app, ref => lifetime.registerEvent(ref), file => service.setPath(file?.path ?? null));
	service.setPath(active?.path ?? null);
	lifetime.registerEvent(app.vault.on('rename', (file, oldPath) => {
		if (!(file instanceof TFile) || file.extension !== 'md') return;
		void store.renamePath(oldPath, file.path).then(() => service.refresh(), () => undefined);
		if (service.state.getState().path === oldPath) service.setPath(file.path);
	}));
	lifetime.registerEvent(app.vault.on('delete', file => {
		if (!(file instanceof TFile) || file.extension !== 'md') return;
		if (settings.get().deleteWithNote) void store.deletePath(file.path);
		if (service.state.getState().path === file.path) service.setPath(null);
		void service.refresh();
	}));
	lifetime.register(settings.subscribe(() => { store.notify(); refreshReadingViews(env); }));
	lifetime.register(store.subscribe(() => refreshReadingViews(env)));
	void service.refresh();
	const panel: CommentsPanel = { mount(container) {
		let unmount: (() => void) | undefined;
		let mounted = true;
		void import('./panel/mount').then(({ mountCommentsPanel }) => { if (mounted && alive) unmount = mountCommentsPanel(container, env); });
		const cleanup = () => { if (!mounted) return; mounted = false; unmount?.(); panels.delete(cleanup); };
		panels.add(cleanup); return cleanup;
	} };
	const index: CommentsIndex = { notes: () => service.state.getState().notes, subscribe: listener => service.state.subscribe(listener) };
	return { env, panel, index, dispose() {
		alive = false; overlays.dispose(); for (const cleanup of panels) cleanup(); for (const cleanup of readingCleanups) cleanup();
		service.dispose(); activation.retire(store); refreshReadingViews(env);
	} };
}
