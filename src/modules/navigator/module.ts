// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { NAVIGATOR_LISTS, NAVIGATOR_PANEL, type NavigatorLists, type NavigatorListsSnapshot, type NavigatorPanel } from './api';
import { navigatorSchema } from './settings';
import { registerMessages } from '../../shared/i18n/index';
import { messages } from './i18n';

registerMessages(messages);

type NavigatorRuntime = Awaited<ReturnType<typeof import('./ui/runtime')['createNavigatorRuntime']>>;

/**
 * Notes navigator module: a two-pane folder/tag tree and note list in the left sidebar view
 * (`nand-navigator-view`). Each activation creates a runtime; turning the module off releases it.
 */
export default function createNavigatorModule(context: ModuleContext): ModuleInstance {
	const settings = context.settings.bind('navigator', navigatorSchema);
	let runtime: NavigatorRuntime | undefined;
	const panel: NavigatorPanel = {
		mount: (container) => runtime?.panel.mount(container) ?? (() => undefined),
		reveal: (path) => runtime?.panel.reveal(path),
		focus: (pane) => runtime?.panel.focus(pane),
	};
	// Widgets may subscribe before the runtime exists (or across a restart); their listeners follow the live runtime.
	const empty: NavigatorListsSnapshot = { recent: [], shortcuts: [] };
	const listeners = new Set<() => void>();
	let detach: (() => void) | undefined;
	const lists: NavigatorLists = {
		snapshot: () => runtime?.lists.snapshot() ?? empty,
		subscribe(listener) {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		open: (target) => runtime?.lists.open(target),
	};
	const fire = () => { for (const listener of [...listeners]) listener(); };
	return {
		services: [[NAVIGATOR_PANEL, panel], [NAVIGATOR_LISTS, lists]],
		pages: { notes: async () => (await import('./ui/workbench-page')).createNotesPage(panel) },
		settingsPage: async () => (await import('./ui/settings-page')).navigatorSettingsPage(settings, () => runtime),
		async activate(signal) {
			const { createNavigatorRuntime } = await import('./ui/runtime');
			const next = await createNavigatorRuntime(context, settings);
			if (signal.aborted) { await next.dispose(); return; }
			runtime = next;
			detach = next.lists.subscribe(fire);
			fire();
			context.app.workspace.onLayoutReady(() => {
				if (signal.aborted || !runtime || settings.get().panelAutoPlaced) return;
				void context.app.workspace.ensureSideLeaf('nand-navigator-view', 'left', { active: false, reveal: false }).then(() => {
					if (!signal.aborted) return settings.update((draft) => { draft.panelAutoPlaced = true; });
					return undefined;
				});
			});
		},
		async dispose() {
			const current = runtime;
			runtime = undefined;
			detach?.();
			detach = undefined;
			fire();
			await current?.dispose();
		},
	};
}
