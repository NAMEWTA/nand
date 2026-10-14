import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { COMMENTS_INDEX, COMMENTS_PANEL, type CommentsIndex, type CommentsPanel } from './api';
import { commentsSettings } from './settings';
type CommentsRuntime = Awaited<ReturnType<typeof import('./ui/runtime')['createCommentsRuntime']>>;
import { registerMessages } from '../../shared/i18n/index';
import { messages } from './i18n';

registerMessages(messages);

/**
 * Comments module: sidecar comments on Markdown notes (highlights, gutter, per-window React overlays and the
 * persistent side panel). Each activation creates a runtime; turning the module off removes every editor
 * feature it added and seals the store.
 */
export default function createCommentsModule(context: ModuleContext): ModuleInstance {
	const settings = context.settings.bind('comments', commentsSettings);
	let runtime: CommentsRuntime | undefined;
	const panel: CommentsPanel = { mount: (container) => runtime?.panel.mount(container) ?? (() => undefined) };
	const index: CommentsIndex = {
		notes: () => runtime?.index.notes() ?? [],
		subscribe: (listener) => runtime?.index.subscribe(listener) ?? (() => undefined),
	};
	return {
		services: [[COMMENTS_PANEL, panel], [COMMENTS_INDEX, index]],
		settingsPage: async () => (await import('./ui/settings-page')).commentsSettingsPage(settings),
		async activate(signal) {
			const { createCommentsRuntime } = await import('./ui/runtime');
			runtime = await createCommentsRuntime(context, settings);
			context.app.workspace.onLayoutReady(() => {
				if (signal.aborted || !runtime || settings.get().panelAutoPlaced) return;
				void context.app.workspace.ensureSideLeaf('nand-comments-view', settings.get().panelSide, { active: false, reveal: false }).then(() => {
					if (!signal.aborted) return settings.update(draft => { draft.panelAutoPlaced = true; });
					return undefined;
				});
			});
		},
		dispose() {
			runtime?.dispose();
			runtime = undefined;
		},
	};
}
