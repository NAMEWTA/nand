import { Notice } from 'obsidian';
import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { AGENT_SESSIONS, AGENT_BROWSER_TABS, NATIVE_HELPER_SQLITE } from '../agent/api';
import { BROWSER_HOST, BROWSER_OPEN, BROWSER_PROFILES, type BrowserOpener } from './api';
import { BrowserEngine } from './services/host';
import { observeNoteLinks } from './platform/note-links';
import { browserSettings } from './settings';
import { registerMessages, t } from '../../shared/i18n';
import { messages as shared } from '../../shared/i18n/lazy/browser';
import { messages } from './i18n';
registerMessages(shared);
registerMessages(messages);
export default function createBrowserModule(context: ModuleContext): ModuleInstance {
	const settings = context.settings.bind('browser', browserSettings);
	let host: BrowserEngine | undefined;
	const current = () => {
		if (!host) throw new Error(t('browser.browser_disabled'));
		return host;
	};
	const open: BrowserOpener = {
		open: async (request) => {
			const lease = await context.services.acquire(AGENT_BROWSER_TABS);
			if (!lease) throw new Error(t('browser.browser_agent_unavailable'));
			return lease.value.open(request.url, request.profileId, request.reuse);
		},
		show: async (request) => {
			try {
				await open.open(request);
			} catch (error) {
				new Notice(String(error));
			}
		},
	};
	return {
		get services() {
			return host
				? [
						[BROWSER_HOST, host] as const,
						[BROWSER_OPEN, open] as const,
						[
							BROWSER_PROFILES,
							{
								list: () => current().profiles.getState().profiles,
								create: (name: string) => current().createProfile(name),
								rename: (id: string, name: string) => current().renameProfile(id, name),
								affectedPages: (id: string) => current().affectedPages(id),
								remove: (id: string, pages: readonly string[]) => current().deleteProfile(id, pages),
								subscribe: (fn: () => void) => current().profiles.subscribe(fn),
							},
						] as const,
					]
				: [];
		},
		settingsPageKind: 'react',
		settingsPage: async () => (await import('./ui/settings-page')).browserSettingsPage(current()),
		async activate() {
			if (!context.env.desktop) return;
			host = new BrowserEngine(
				context.app,
				settings,
				{
					list: async (pageId) => {
						const sessions = (await context.services.peek(AGENT_SESSIONS)?.list()) ?? [];
						const local = pageId
							? (context.services.peek(AGENT_BROWSER_TABS)?.sessionOrder(pageId) ?? [])
							: [];
						return sessions.sort((a, b) => Number(local.includes(b.id)) - Number(local.includes(a.id)));
					},
					attach: async (id, text, files) => {
						const sessions = context.services.peek(AGENT_SESSIONS);
						if (!sessions) throw new Error(t('browser.browser_agent_unavailable'));
						await sessions.attachMaterial(id, { title: t('browser.contextMaterial'), text, files });
					},
				},
				{
					open: (url, profileId, reuse) => open.open({ url, profileId, reuse }),
					list: () => context.services.peek(AGENT_BROWSER_TABS)?.list() ?? [],
					close: async (id) => {
						await context.services.peek(AGENT_BROWSER_TABS)?.close(id);
					},
					activate: (id) => context.services.peek(AGENT_BROWSER_TABS)?.activate(id),
				},
				async () => {
					const lease = await context.services.acquire(NATIVE_HELPER_SQLITE);
					if (!lease) throw new Error(t('browser.browser_agent_unavailable'));
					return { readCookies: (path, kind, signal) => lease.value.readCookies(path, kind, signal) };
				},
				async (page) => (await import('./ui/chrome-loader')).browserChrome(current(), page),
				() => {
					void context.shell.open({ feature: 'settings', section: 'browser' });
				},
			);
			await host.ready;
			context.lifetime.register(
				observeNoteLinks(
					context.app.workspace,
					() => settings.get().interceptNoteLinks,
					(url, event) => current().routeLink(url, event, 'note'),
				),
			);
		},
		async dispose() {
			await host?.dispose();
			host = undefined;
		},
	};
}
