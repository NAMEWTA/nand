import { TFile } from 'obsidian';
import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { deviceId } from '../../host/obsidian/storage/device-id';
import { privateVaultStorage } from '../../host/obsidian/storage/private-storage';
import { registerMessages } from '../../shared/i18n';
import { AGENT_DIRECTORY, AGENT_PROMPT_RUNNER, AGENT_SESSIONS } from '../agent/api';
import { BROWSER_OPEN } from '../browser/api';
import { NOTIFICATION_INBOX, NOTIFICATION_OPENERS } from '../notifications/api';
import { NEWS_HOME_WIDGETS, NEWS_READ, NEWS_WORKBENCH } from './api';
import { newsHomeWidgets } from './contrib/home-widgets';
import { newsOpener } from './contrib/notifications';
import { newsActions } from './services/news-actions';
import { NewsService } from './services/news-service';
import { newsSettings } from './settings';
import { messages } from './i18n';
import { newsNotePort } from './platform/note-port';
import { NewsRefreshSchedule } from './services/refresh-schedule';
import { NewsHeatSchedule } from './services/heat-schedule';
import { newsWorkbench } from './services/workbench';
import type { HomeWidgetContext } from '../home/api';
import type { NewsWidgetMode } from './core/home-widgets';
registerMessages(messages);
export default function createNewsModule(context: ModuleContext): ModuleInstance {
	const settings = context.settings.bind('news', newsSettings);
	const service = new NewsService(privateVaultStorage(context.app), newsNotePort(context.app, () => settings.get()), () => settings.get(), undefined, `.nand/news/${deviceId(context.app)}`);
	const win = context.app.workspace.containerEl.win;
	const schedule = new NewsRefreshSchedule(service, settings, { set: (callback, ms) => win.setTimeout(callback, ms), clear: timer => win.clearTimeout(timer as number) });
	const heatSchedule = new NewsHeatSchedule(hour => service.observeHeat(hour), { set: (callback, ms) => win.setTimeout(callback, ms), clear: timer => win.clearTimeout(timer as number) });
	const configureWidget = async (mode: NewsWidgetMode, widgetContext: Pick<HomeWidgetContext, 'signal' | 'register' | 'instanceId'>, create: boolean) => {
		const ui = await import('./ui/WidgetConfigDialog');
		return widgetContext.signal.aborted ? null : ui.configureNewsWidget(context.app, settings, mode, widgetContext, create);
	};
	const homeWidgets = newsHomeWidgets(service, async (host, widgetContext) => {
		const ui = await import('./ui/HomeNewsWidget');
		if (widgetContext.signal.aborted) return undefined;
		return ui.mountHomeNewsWidget(host, service, widgetContext, target => context.shell.open(target, widgetContext.window));
	}, configureWidget);
	let stopHeatSettings: (() => void) | undefined;
	const opener = newsOpener((id) => service.run(id), async (resourceId) => {
		await context.shell.open(service.materials().some(item => item.id === resourceId) || service.story(resourceId)
			? { feature: 'news', resourceId } : { feature: 'news', section: 'runs' });
	});
	const actions = newsActions(service, settings, async () => (await context.services.acquire(AGENT_PROMPT_RUNNER))?.value, {
		currentRunner: () => context.services.peek(AGENT_PROMPT_RUNNER),
		watchRunner: listener => context.services.watch(AGENT_PROMPT_RUNNER, listener),
		directory: () => context.services.peek(AGENT_DIRECTORY),
		sessions: () => context.services.peek(AGENT_SESSIONS),
		browser: () => context.services.peek(BROWSER_OPEN),
		inbox: () => context.services.peek(NOTIFICATION_INBOX),
		openNote: async path => {
			const file = context.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) throw new Error('news.note.missing');
			await context.app.workspace.getLeaf(false).openFile(file);
		},
	});
	return { services: [[NEWS_READ, service], [NEWS_WORKBENCH, newsWorkbench(service, actions)]], contributions: [[NEWS_HOME_WIDGETS, homeWidgets], [NOTIFICATION_OPENERS, opener]], pages: { news: async () => (await import('./ui/workbench-page')).createNewsPage(service, actions) }, settingsPage: async () => (await import('./ui/settings-page')).newsSettingsPage(settings, actions, configureWidget), activate: async () => { await service.ready; schedule.start(); heatSchedule.update(settings.get().enabled); stopHeatSettings = settings.subscribe(() => heatSchedule.update(settings.get().enabled)); }, dispose: async () => { schedule.dispose(); heatSchedule.dispose(); stopHeatSettings?.(); try { await actions.dispose(); } finally { await service.shutdown(); } } };
}

