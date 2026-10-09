import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { COMMENTS_INDEX, COMMENTS_PANEL, type CommentsIndex, type CommentsPanel } from './api';
import { commentsSettings } from './settings';
import type { CommentsRuntime } from './ui/runtime';
import { registerMessages } from '../../shared/i18n/index';
import { messages } from './i18n';

registerMessages(messages);

/**
 * Comments module: sidecar comments on Markdown notes (highlights, selection popover, side panel and the
 * workbench overview). Each activation creates a runtime; turning the module off removes every editor
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
		pages: {
			comments: async () => (await import('./ui/workbench-page')).createCommentsPage(() => runtime),
		},
		settingsPage: async () => (await import('./ui/settings-page')).commentsSettingsPage(settings),
		async activate() {
			const { createCommentsRuntime } = await import('./ui/runtime');
			runtime = await createCommentsRuntime(context, settings);
		},
		dispose() {
			runtime?.dispose();
			runtime = undefined;
		},
	};
}
