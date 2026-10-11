import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { deviceId } from '../../host/obsidian/storage/device-id';
import { AGENT_DIRECTORY, AGENT_DISPATCH, AGENT_SESSIONS, AGENT_SKILLS } from '../agent/api';
import { AUTOMATIONS, AUTOMATION_SOURCES, type AutomationSource } from '../automations/api';
import { HOME_WIDGETS, HOME_WORKBENCH, type HomeWorkbench } from './api';
import { indexWidgetProviders } from './core/board/widget-registry';
import { builtinHomeWidgets } from './contrib/widgets';
import { dashboardAutomationSource } from './contrib/automation-source';
import { ExpenseService } from './platform/expense/expense-service';
import { HabitService } from './platform/habit/habit-service';
import { MediaTagService } from './platform/media/media-tags';
import { MusicService } from './platform/music/music-service';
import { PomodoroService } from './platform/pomodoro/pomodoro-service';
import { ReadingService } from './platform/reading/reading-service';
import { BoardRegistry } from './services/board-registry';
import { registerHomeCommands } from './services/commands';
import { createHomeHost, repointBoards } from './services/home-host';
import { homePages, homeServices } from './services/instances';
import { homeSettings } from './settings';
import { registerMessages } from '../../shared/i18n/index';
import { messages } from './i18n';
import { messages as automationStrings } from '../../shared/i18n/lazy/automation';
import { messages as browserStrings } from '../../shared/i18n/lazy/browser';
import { messages as commonStrings } from '../../shared/i18n/lazy/common';

registerMessages(automationStrings);
registerMessages(browserStrings);
registerMessages(commonStrings);
registerMessages(messages);

/**
 * Home (board) module: the boards and their registry, widget services (one each per activation), board
 * commands, the records pages and the dashboard automation source. Board code reads and writes the `home`
 * settings namespace through the module's host.
 */
export default function createHomeModule(context: ModuleContext): ModuleInstance {
	const app = context.app;
	const host = createHomeHost(context, context.settings.bind('home', homeSettings));
	const widgets = builtinHomeWidgets(() => host.settings, async (key, root, ctx) => {
		const ui = await import('./ui/widgets/widget-loader');
		if (!ctx.signal.aborted) await ui.mountBuiltinWidget(key, root, ctx);
	}, async (key, ctx, create) => {
		const ui = await import('./ui/widgets/widget-loader');
		return ctx.signal.aborted ? null : ui.configureBuiltinWidget(host, key, ctx, create);
	});
	let widgetGeneration = 0;
	let widgetSubscriptions: (() => void)[] = [];
	const widgetListeners = new Set<() => void>();
	const listeners = new Set<() => void>();
	const changed = () => {
		for (const listener of [...listeners]) listener();
	};
	let ui: { closeModals: (app: typeof context.app) => void; teardown: (app: typeof context.app) => void } | undefined;
	let automationSource: AutomationSource | undefined;
	let workbench: HomeWorkbench | undefined;
	let owned: typeof homeServices = {};
	return {
		/** Read after `activate()`. */
		get services() {
			return workbench ? [[HOME_WORKBENCH, workbench] as const] : [];
		},
		get contributions() {
			const contribution = [HOME_WIDGETS, widgets] as const;
			return automationSource ? [contribution, [AUTOMATION_SOURCES, automationSource] as const] : [contribution];
		},
		pages: {
			board: async () => (await import('./ui/workbench-page')).boardPage(host),
			records: async () => (await import('./ui/records-page')).createRecordsPage(),
		},
		settingsPage: async () => (await import('./ui/settings-page')).homeSettingsPage(host),
		async activate() {
			// Board UI helpers that must run on dispose (synchronously) and the workbench panel load now.
			const [{ closeDashboardPanelModals }, { teardownBasenameIndex }, { homeWorkbench }] = await Promise.all([
				import('./ui/ui/panel-modal'),
				import('./ui/renderer/render-context'),
				import('./ui/workbench-panel'),
			]);
			ui = { closeModals: closeDashboardPanelModals, teardown: teardownBasenameIndex };
			const media = new MediaTagService(host);
			media.load();
			const habit = new HabitService(host);
			const expense = new ExpenseService(host);
			const pomodoro = new PomodoroService(host);
			const reading = new ReadingService(host);
			const music = context.env.phone ? undefined : new MusicService(host);
			// Disposed with the module even if loading fails; published to widgets once loaded.
			owned = { mediaTags: media, habit, expense, pomodoro, reading, music };
			await Promise.all([habit.load(), expense.load(), pomodoro.loadSessions(), reading.loadSessions(), music?.load()]);
			Object.assign(homeServices, owned);
			homeServices.acquireDispatch = () => Promise.resolve(context.services.peek(AGENT_DISPATCH));
			homeServices.agents = () => context.services.peek(AGENT_DIRECTORY)?.list() ?? [];
			homeServices.sessions = () => context.services.peek(AGENT_SESSIONS);
			homeServices.skills = () => context.services.peek(AGENT_SKILLS);
			homeServices.watchAgents = listener => {
				const stopDirectory = context.services.watch(AGENT_DIRECTORY, listener);
				const stopSkills = context.services.watch(AGENT_SKILLS, listener);
				return () => { stopDirectory(); stopSkills(); };
			};
			homeServices.watchWidgets = listener => { widgetListeners.add(listener); return () => { widgetListeners.delete(listener); }; };
			context.lifetime.register(() => widgetListeners.clear());
			context.lifetime.register(() => { for (const off of widgetSubscriptions.splice(0)) off(); });
			const notifyWidgets = () => {
				homeServices.widgetRevision = (homeServices.widgetRevision ?? 0) + 1;
				for (const listener of widgetListeners) listener();
				host.refreshAllDashboards();
			};
			context.lifetime.register(context.services.watch(AUTOMATIONS, notifyWidgets));
			const publishWidgets = async () => {
				const generation = ++widgetGeneration;
				try {
					const contributed = await context.contributions.collect(HOME_WIDGETS, { activate: false });
					if (generation !== widgetGeneration) return;
					const next = indexWidgetProviders([
						{ module: 'home', bundle: widgets },
						...contributed.filter((item) => item.module !== 'home').map((item) => ({ module: item.module, bundle: item.value })),
					]);
					const previous = homeServices.widgets;
					if (previous && previous.byKey.size === next.byKey.size && [...next.byKey].every(([key, value]) => previous.byKey.get(key)?.kind === value.kind) && previous.errors.join() === next.errors.join()) return;
					homeServices.widgets = next;
					for (const off of widgetSubscriptions.splice(0)) off();
					for (const item of contributed) {
						try {
							const off = item.value.subscribeInstances?.(() => { if (homeServices.widgets === next) notifyWidgets(); });
							if (off) widgetSubscriptions.push(off);
						} catch (error) { console.error('Home widget instance subscription failed', item.module, error); }
					}
					notifyWidgets();
				} catch (error) {
					console.error('Home widget registry update failed', error);
				}
			};
			homeServices.widgets = indexWidgetProviders([{ module: 'home', bundle: widgets }]);
			homeServices.widgetRevision = 0;
			context.lifetime.register(context.contributions.watch(HOME_WIDGETS, () => { void publishWidgets(); }));
			void publishWidgets();
			homePages.openRecords = (section) => { void context.shell.open({ feature: 'records', section }); };
			const boards = new BoardRegistry({
				settings: () => host.settings,
				app,
				read: () => ({ workspaceFiles: host.settings.workspaceFiles, workspaceNames: host.settings.workspaceNames, dashboardFile: host.settings.dashboardFile }),
				write: async (next) => {
					host.settings = { ...host.settings, ...next };
					await host.saveSettings();
					changed();
				},
				repointAll: () => repointBoards(host),
				refreshAll: () => host.refreshAllDashboards(),
			});
			boards.watch((ref) => context.lifetime.registerEvent(ref));
			app.workspace.onLayoutReady(() => {
				if (host.boards === boards) void boards.prune();
			});
			host.boards = boards;
			automationSource = dashboardAutomationSource({
				app,
				settings: () => host.settings,
				deviceId: deviceId(app),
				saveSettings: () => host.saveSettings(),
				shell: context.shell,
				registerEvent: (ref) => context.lifetime.registerEvent(ref),
			});
			workbench = homeWorkbench(host, (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			});
			// Widget switches change the records rows; board saves change the save statuses.
			context.lifetime.register(context.settings.bind('home', homeSettings).subscribe(changed));
			registerHomeCommands(host, context.commands, () => context.shell.open({ feature: 'dashboard' }));
			if (app.workspace.layoutReady) host.refreshAllDashboards();
		},
		dispose(reason) {
			widgetGeneration++;
			ui?.closeModals(app);
			if (reason === 'unload') ui?.teardown(app);
			host.boards = undefined;
			workbench = undefined;
			listeners.clear();
			const { mediaTags, habit, expense, pomodoro, reading, music } = owned;
			owned = {};
			for (const key of Object.keys(homeServices) as Array<keyof typeof homeServices>) delete homeServices[key];
			homePages.openRecords = undefined;
			if (mediaTags) void mediaTags.flush();
			mediaTags?.destroy();
			habit?.destroy();
			expense?.destroy();
			pomodoro?.destroy();
			reading?.destroy();
			music?.destroy();
			if (reason === 'disabled' && app.workspace.layoutReady) host.refreshAllDashboards();
		},
	};
}
