import { Notice, TFile } from 'obsidian';
import type { ModuleContext } from '../../../app/contracts/module';
import { onLanguageChanged, t } from '../../../shared/i18n/index';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { CommentedNote, CommentsIndex, CommentsPanel } from '../api';
import { CommentStore } from '../core/store';
import { trackActiveMarkdown } from '../platform/active-file';
import { beginCommentStoreActivation } from '../platform/store-handoff';
import { vaultCommentFs } from '../platform/vault-fs';
import type { CommentsSettings } from '../settings';
import { commentsCmExtension } from './comments/cm-extension';
import { registerCommentCommands } from './comments/commands';
import type { CommentsEnv } from './comments/env';
import { mountCommentsPanel } from './comments/panel';
import { CommentPopoverCoordinator } from './comments/popover-coordinator';
import { commentsReadingProcessor, refreshReadingViews } from './comments/reading';

export interface CommentsRuntime {
	readonly env: CommentsEnv;
	readonly panel: CommentsPanel;
	readonly index: CommentsIndex;
	/** Seal the store (pending writes finish in the background before the next activation reads it). */
	dispose(): void;
}

/**
 * One comments runtime per module activation: the sidecar store, editor highlights and the selection
 * popover, the reading-view processor, commands and the active-note tracker. Everything registered here
 * is removed with the module; comment bodies stay in `.nand/editor/comments/`.
 */
export async function createCommentsRuntime(context: ModuleContext, settings: SettingsHandle<CommentsSettings>): Promise<CommentsRuntime> {
	const { app, lifetime } = context;
	const activation = beginCommentStoreActivation(app);
	try {
		await activation.ready();
	} catch (error) {
		new Notice(t('editor.comments.storageFailed'));
		throw error;
	}
	let store: CommentStore | null = new CommentStore(vaultCommentFs(app), {
		timers: { set: (callback, ms) => window.setTimeout(callback, ms), clear: (handle) => window.clearTimeout(handle as number) },
		onError: () => { new Notice(t('editor.comments.storageFailed')); },
	});
	const env: CommentsEnv = { app, store: () => store, settings: () => settings.get() };
	const popovers = new CommentPopoverCoordinator(app);
	popovers.enable();
	context.editor.addExtension([commentsCmExtension(env, popovers)]);
	context.editor.addPostProcessor(commentsReadingProcessor(env));
	registerCommentCommands(env, context.commands);

	// The last Markdown note the user was in; focusing the side panel must not clear it.
	const activeListeners = new Set<(file: TFile | null) => void>();
	let active: TFile | null = null;
	const setActive = (file: TFile | null) => {
		active = file;
		for (const listener of [...activeListeners]) listener(file);
	};
	active = trackActiveMarkdown(app, (ref) => lifetime.registerEvent(ref), setActive);
	lifetime.registerEvent(app.vault.on('rename', (file, oldPath) => {
		if (!(file instanceof TFile) || file.extension !== 'md') return;
		void store?.renamePath(oldPath, file.path);
		if (active?.path === oldPath) setActive(file);
	}));
	lifetime.registerEvent(app.vault.on('delete', (file) => {
		if (!(file instanceof TFile) || file.extension !== 'md') return;
		void store?.deletePath(file.path);
		if (active?.path === file.path) setActive(null);
	}));
	lifetime.register(settings.subscribe(() => {
		store?.notify();
		popovers.refresh();
		refreshReadingViews(env);
	}));

	// Notes with comments, refreshed after store changes.
	let notes: CommentedNote[] = [];
	const indexListeners = new Set<() => void>();
	let reading = 0;
	const reloadIndex = () => {
		const current = store;
		if (!current) return;
		const id = ++reading;
		void current.listFiles().then((rows) => {
			if (id !== reading || current !== store) return;
			notes = rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
			for (const listener of [...indexListeners]) listener();
		}, () => undefined);
	};
	lifetime.register(store.subscribe(reloadIndex));
	reloadIndex();

	const panel: CommentsPanel = {
		mount(container) {
			container.addClass('nand-editor-view');
			const body = container.createDiv({ cls: 'nand-editor-body' });
			let unmount: (() => void) | null = null;
			const render = () => {
				unmount?.();
				unmount = mountCommentsPanel(body, { app, file: active, store });
			};
			activeListeners.add(render);
			// Comment panels translate in place so focus and scroll survive.
			const offLanguage = onLanguageChanged(() => {
				const scroll = body.scrollTop;
				render();
				body.scrollTop = scroll;
			});
			render();
			return () => {
				activeListeners.delete(render);
				offLanguage();
				unmount?.();
				body.remove();
			};
		},
	};
	const index: CommentsIndex = {
		notes: () => notes,
		subscribe: (listener) => {
			indexListeners.add(listener);
			return () => indexListeners.delete(listener);
		},
	};
	return {
		env,
		panel,
		index,
		dispose() {
			popovers.disable();
			activeListeners.clear();
			indexListeners.clear();
			const closing = store;
			store = null;
			// Reading views re-render without highlights; editors drop the extension when the module's lifetime ends.
			refreshReadingViews(env);
			if (closing) activation.retire(closing);
			else activation.cancel();
		},
	};
}
