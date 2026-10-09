import { Notice } from 'obsidian';
import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { registerMessages, t } from '../../shared/i18n';
import { AGENT_SESSIONS } from '../agent/api';
import { BROWSER_AGENT_BRIDGE, BROWSER_OPEN, type BrowserAgentBridge, type BrowserOpener } from './api';
import { BrowserError, newPageState, type BrowserAgentDeliveryPort } from './core/model';
import { browserError } from './core/text';
import { BrowserModule } from './services';
import type { BrowserWorkbenchPort } from './services/workbench-port';
import { browserSettings } from './settings';
import { messages as browserStrings } from '../../shared/i18n/lazy/browser';

registerMessages(browserStrings);

/**
 * Browser module: one browser host per activation (guests, history, permissions and the agent bridge).
 * Pages live in the workbench; turning the module off closes every guest and the bridge.
 */
export default function createBrowserModule(context: ModuleContext): ModuleInstance {
	const { app, shell } = context;
	const settings = context.settings.bind('browser', browserSettings);
	let host: BrowserModule | undefined;
	const current = () => {
		if (!host) throw new BrowserError('browser_disabled');
		return host;
	};
	const workbench: BrowserWorkbenchPort = {
		open: (state, ownerWindow) => shell.open({ feature: 'browser', resourceId: state.id }, ownerWindow, { ...state }),
		openTab: (state, ownerWindow) => shell.openFocus({ feature: 'browser', resourceId: state.id }, { ...state }, ownerWindow),
		list: () => shell.savedPages('browser').flatMap((page) => (page.target.resourceId ? [newPageState(page.target.resourceId, page.state)] : [])),
		activate: (id) => shell.activateResource('browser', id),
	};
	// Material goes only to agent sessions that exist right now; the browser never starts the agent module.
	const agents: BrowserAgentDeliveryPort = {
		list: async () => (await context.services.peek(AGENT_SESSIONS)?.list()) ?? [],
		attach: async (sessionId, text, files) => {
			const sessions = context.services.peek(AGENT_SESSIONS);
			if (!sessions) throw new BrowserError('browser_agent_unavailable');
			await sessions.attachMaterial(sessionId, { title: t('browser.contextMaterial'), text, files });
		},
	};
	const opener: BrowserOpener = {
		open: async (request) => {
			try {
				return await current().open(request);
			} catch (error) {
				throw new Error(browserError(error));
			}
		},
		show: async (request) => {
			try {
				if (!request.url && !request.target) await shell.open({ feature: 'browser' });
				else await current().open(request);
			} catch (error) {
				new Notice(browserError(error));
			}
		},
	};
	const bridge: BrowserAgentBridge = { environment: () => host?.environment() ?? Promise.resolve({}) };
	return {
		services: [[BROWSER_OPEN, opener], [BROWSER_AGENT_BRIDGE, bridge]],
		pages: {
			browser: async () => (await import('./ui/workbench-page')).createBrowserPage(current),
		},
		settingsPage: async () => (await import('./ui/settings-page')).browserSettingsPage(current, settings, opener),
		activate() {
			host = new BrowserModule(app, () => settings.get(), agents, workbench, async (state, closed) => {
				const { BrowserModal } = await import('./ui/browser-modal');
				const modal = new BrowserModal(current(), state, closed);
				modal.open();
				return modal;
			});
			host.setEnabled(true);
		},
		dispose() {
			host?.dispose();
			host = undefined;
		},
	};
}
