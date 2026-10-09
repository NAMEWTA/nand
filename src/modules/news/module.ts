import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { deviceId } from '../../host/obsidian/storage/device-id';
import { privateStorageIfDesktop } from '../../host/private-storage';
import { registerMessages } from '../../shared/i18n';
import type { TextStorage } from '../../shared/storage/ports';
import { AGENT_PROMPT_RUNNER, AGENT_SESSIONS } from '../agent/api';
import { BROWSER_OPEN } from '../browser/api';
import { NOTIFICATION_INBOX, NOTIFICATION_OPENERS } from '../notifications/api';
import { NEWS_HOME_WIDGETS, NEWS_READ } from './api';
import { newsHomeWidgets } from './contrib/home-widgets';
import { newsOpener } from './contrib/notifications';
import { newsActions } from './services/news-actions';
import { NewsService } from './services/news-service';
import { newsSettings } from './settings';
import { messages } from './i18n';
registerMessages(messages);
export default function createNewsModule(context: ModuleContext): ModuleInstance {
	const settings = context.settings.bind('news', newsSettings);
	const adapter = context.app.vault.adapter as unknown as TextStorage & { getBasePath?: () => string };
	const root = typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : '';
	const service = new NewsService(privateStorageIfDesktop(adapter, root), () => settings.get(), undefined, `.nand/news/${deviceId(context.app)}`);
	const opener = newsOpener((id) => service.run(id), async (resourceId) => {
		service.focus(resourceId);
		await context.shell.open({ feature: 'news', resourceId });
	});
	const actions = newsActions(service, settings, () => context.services.peek(AGENT_PROMPT_RUNNER), {
		sessions: () => context.services.peek(AGENT_SESSIONS),
		browser: () => context.services.peek(BROWSER_OPEN),
		inbox: () => context.services.peek(NOTIFICATION_INBOX),
	});
	return { services: [[NEWS_READ, service]], contributions: [[NEWS_HOME_WIDGETS, newsHomeWidgets], [NOTIFICATION_OPENERS, opener]], pages: { news: async () => (await import('./ui/workbench-page')).createNewsPage(service, actions) }, settingsPage: async () => (await import('./ui/settings-page')).newsSettingsPage(settings, actions), activate: () => service.ready, dispose: () => service.shutdown() };
}

