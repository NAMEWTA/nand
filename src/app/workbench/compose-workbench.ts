import { Notice, Platform } from 'obsidian';
import type { ModuleId } from '../contracts/module';
import type { PageCreate } from '../contracts/workbench-host';
import { FEATURE_MODULES, type WorkbenchFeature, type StatusSegment, type WorkbenchTarget } from '../contracts/workbench';
import { registerUsageMirror } from './surfaces/usage-mirror';
import { registerWorkbenchRibbon } from './surfaces/ribbon';
import { settingsCategories, settingsPanel } from './settings-categories';
import { iconsPanel, iconsTitle } from './icons-panel';
import type DashboardPlugin from '../main';
import { t } from '../../shared/i18n';
import { WORKBENCH_VIEW_TYPE, WorkbenchView } from './workbench-leaf';
import type { WorkbenchContribution, WorkbenchHost } from '../contracts/workbench-host';
import { dashboardSaveStatuses } from './status-policy';
import { focusLeafState } from './focus-state';
import { NOTIFICATION_INBOX } from '../../modules/notifications/api';
import { AGENT_WORKBENCH, AGENT_USAGE } from '../../modules/agent/api';
import { HOME_WORKBENCH } from '../../modules/home/api';
import { AUTOMATIONS } from '../../modules/automations/api';
import { SYNC_WORKBENCH } from '../../modules/sync/api';

export function composeWorkbench(plugin: DashboardPlugin) {
	const listeners = new Set<() => void>();
	const pending = new WeakMap<Window, Promise<WorkbenchView>>();
	const report = (error: unknown): void => {
		console.error('[NAND workbench]', error);
		new Notice(error instanceof Error ? error.message : String(error));
	};
	const ready = () => ({ enabled: true, supported: true, ready: true });
	/** A page provided by a module; opening it activates the module if it is still idle or loading. */
	const modulePage = (module: ModuleId, page: string): PageCreate => async (context, target, state, signal) => {
		const load = (await plugin.activateModule(module))?.pages?.[page];
		if (!load) throw new Error(t('workbench.notReady'));
		return (await load())(context, target, state, signal);
	};
	const home = () => plugin.services.peek(HOME_WORKBENCH);

	const contributions: WorkbenchContribution[] = [
		{
			id: 'dashboard',
			chrome: 'none',
			statusSegments: () => dashboardSaveStatuses(home()?.saveStatuses() ?? []).map(row => ({ id: `dashboard-save:${row.id}`, icon: 'save-off', label: row.label, target: row.target, tone: 'error', order: 60 })),
			rail: { slot: 'top' },
			navigation: { id: 'dashboard', labelKey: 'workbench.home', icon: 'home', target: { feature: 'dashboard' } },

			availability: () => ({ ...ready(), enabled: plugin.moduleEnabled('home') }),
			stateKeys: ['dashboardFile'],
			create: modulePage('home', 'board'),
		},
		{
			id: 'terminal',
			chrome: 'none',
			navigationContext: true,
			statusSegments: agentSegments,
			rail: { slot: 'top' },
			navigation: { id: 'terminal', labelKey: 'workbench.agent', icon: 'bot', target: { feature: 'terminal' }, children: [
				{ id: 'terminal-running', labelKey: 'workbench.running', icon: 'terminal-square', target: { feature: 'terminal', section: 'running' } },
				{ id: 'terminal-history', labelKey: 'workbench.history', icon: 'history', target: { feature: 'terminal', section: 'history' } },
				{ id: 'terminal-usage', labelKey: 'workbench.usage', icon: 'chart-no-axes-column', target: { feature: 'terminal', section: 'usage' } },
			] },
			title: (target) => plugin.services.peek(AGENT_WORKBENCH)?.title(target),
			availability: () => ({ ...ready(), enabled: plugin.moduleEnabled('agent'), supported: Platform.isDesktopApp, ready: !!plugin.services.peek(AGENT_WORKBENCH) }),
			stateKeys: ['agentView', 'agentHistory', 'agentHistoryWidth'],
			create: modulePage('agent', 'terminal'),
		},
		{
			id: 'contacts',
			panel: ({ target }) => ({ sections: [{ id: 'contacts', items: [{ id: 'person', label: t('workbench.people'), icon: 'user', target: { feature: 'contacts', section: 'person' }, active: target.section !== 'company' }, { id: 'company', label: t('workbench.companies'), icon: 'building-2', target: { feature: 'contacts', section: 'company' }, active: target.section === 'company' }] }] }),
			rail: { slot: 'top' },
			navigation: { id: 'contacts', labelKey: 'workbench.contacts', icon: 'contact-round', target: { feature: 'contacts' }, children: [
				{ id: 'contacts-person', labelKey: 'workbench.people', icon: 'user', target: { feature: 'contacts', section: 'person' } },
				{ id: 'contacts-company', labelKey: 'workbench.companies', icon: 'building-2', target: { feature: 'contacts', section: 'company' } },
			] },
			availability: () => ({ ...ready(), enabled: plugin.moduleEnabled('archives'), ready: plugin.moduleState('archives') === 'active' }),
			stateKeys: ['query', 'page', 'selectedPath', 'selectedId', 'scroll', 'layout', 'anchors'],
			create: modulePage('archives', 'archives'),
		},
		{
			id: 'automations',
			chrome: 'none',
			statusSegments: automationSegments,
			rail: { slot: 'top' },
			navigation: { id: 'automations', labelKey: 'workbench.automations', icon: 'workflow', target: { feature: 'automations' }, children: [
				{ id: 'automations-tasks', labelKey: 'workbench.tasks', icon: 'list-checks', target: { feature: 'automations', section: 'tasks' } },
				{ id: 'automations-runs', labelKey: 'workbench.runs', icon: 'history', target: { feature: 'automations', section: 'runs' } },
			] },
			availability: () => ({ ...ready(), enabled: plugin.moduleEnabled('automations'), ready: !!plugin.services.peek(AUTOMATIONS) }),
			stateKeys: ['selected', 'search', 'filter', 'sort'],
			create: modulePage('automations', 'automations'),
		},
		{
			id: 'sync',
			statusSegments: () => (plugin.services.peek(SYNC_WORKBENCH)?.status() ?? []).map(row => ({ id: `sync:${row.id}`, icon: 'git-branch', label: row.label, tone: row.kind === 'error' ? 'error' : 'neutral', target: { feature: 'sync', section: row.section }, order: 50 })),
			rail: { slot: 'top' },
			navigation: { id: 'sync', labelKey: 'workbench.sync', icon: 'git-branch', target: { feature: 'sync' }, children: [
				{ id: 'sync-changes', labelKey: 'workbench.syncChanges', icon: 'file-diff', target: { feature: 'sync', section: 'changes' } },
				{ id: 'sync-history', labelKey: 'workbench.history', icon: 'history', target: { feature: 'sync', section: 'history' } },
			] },
			panel: ({ target }) => plugin.services.peek(SYNC_WORKBENCH)?.panel(target),
			title: (target) => plugin.services.peek(SYNC_WORKBENCH)?.title(target),
			availability: () => ({ ...ready(), enabled: plugin.moduleEnabled('sync'), supported: Platform.isDesktopApp, ready: plugin.moduleState('sync') === 'active' }),
			stateKeys: ['section', 'selected', 'message'],
			create: modulePage('sync', 'sync'),
		},
		{
			id: 'icons',
			rail: { slot: 'top' },
			navigation: { id: 'icons', labelKey: 'modules.iconic', icon: 'images', target: { feature: 'icons' } },
			panel: ({ target }) => iconsPanel(target.section),
			title: (target) => iconsTitle(target.section),
			availability: () => ({ ...ready(), enabled: plugin.moduleEnabled('icons'), ready: plugin.moduleState('icons') === 'active' }),
			stateKeys: [],
			create: modulePage('icons', 'icons'),
		},
		{
			id: 'notifications',
			statusSegments: () => { const count = plugin.services.peek(NOTIFICATION_INBOX)?.unread ?? 0; return count ? [{ id: 'notifications', icon: 'bell', count, label: t('workbench.unreadCount', { count }), target: { feature: 'notifications' }, order: 90 }] : []; },
			rail: { slot: 'bottom', badge: () => plugin.services.peek(NOTIFICATION_INBOX)?.unread ?? 0 },
			navigation: { id: 'notifications', labelKey: 'workbench.notifications', icon: 'bell', target: { feature: 'notifications' }, children: [
				{ id: 'notifications-unread', labelKey: 'workbench.unread', icon: 'mail', target: { feature: 'notifications', section: 'unread' } },
				{ id: 'notifications-all', labelKey: 'workbench.allNotifications', icon: 'inbox', target: { feature: 'notifications', section: 'all' } },
			] },
			panel: ({ target }) => ({ sections: [{ id: 'inbox', items: [
				{ id: 'unread', label: t('workbench.unread'), icon: 'mail', badge: plugin.services.peek(NOTIFICATION_INBOX)?.unread, target: { feature: 'notifications', section: 'unread' }, active: target.section === 'unread' },
				{ id: 'all', label: t('workbench.allNotifications'), icon: 'inbox', target: { feature: 'notifications', section: 'all' }, active: target.section !== 'unread' },
			] }] }),
			availability: () => ({ ...ready(), enabled: plugin.moduleEnabled('notifications'), ready: !!plugin.services.peek(NOTIFICATION_INBOX) }),
			stateKeys: [],
			releaseWhenHidden: true,
			create: modulePage('notifications', 'inbox'),
		},
		{
			id: 'content', rail: { slot: 'top' },
			navigation: { id: 'content', labelKey: 'content.title', icon: 'files', target: { feature: 'content' } },
			panel: ({ target }) => ({ searchable: true, sections: [{ id: 'content', emptyText: t('content.noResults'), items: (plugin.managedContent?.allManaged() ?? []).map(file => ({ id: file.path, label: file.basename, meta: file.path.replace(/^\.nand\/content\//, ''), icon: file.extension === 'md' ? 'file-text' : 'paperclip', target: { feature: 'content' as const, resourceId: file.path }, active: target.resourceId === file.path })) }] }),
			title: target => target.resourceId?.split('/').at(-1) ?? t('content.title'),
			availability: ready, stateKeys: [], resourcePages: true, resourceTabs: () => false,
			create: async (context, target, state, signal) => (await import('../content/page')).createContentPage(context, target, state, signal),
		},
		{
			id: 'settings',
			rail: { slot: 'bottom' },
			navigation: { id: 'settings', labelKey: 'workbench.settings', icon: 'settings', target: { feature: 'settings' } },
			panel: ({ target }) => settingsPanel(plugin, target.section),
			title: (target) => {
				const category = settingsCategories(plugin).find((item) => item.id === (target.section ?? 'general'));
				return category ? `${t('workbench.settings')} · ${category.label}` : t('workbench.settings');
			},
			availability: ready,
			stateKeys: [],
			create: async (context, target, state, signal) => (await import('./settings-page')).createSettingsPage(plugin)(context, target, state, signal),
		},
	];

	function agentSegments(): StatusSegment[] {
		const sessions = plugin.services.peek(AGENT_WORKBENCH)?.status() ?? [];
		return (['waiting', 'running'] as const).flatMap(kind => {
			const items = sessions.filter(session => session.status === kind);
			return items.length ? [{ id: `agents-${kind}`, icon: kind === 'waiting' ? 'circle-help' : 'loader-circle', tone: kind === 'waiting' ? 'attention' as const : 'running' as const, count: items.length, label: t(kind === 'waiting' ? 'workbench.statusWaiting' : 'workbench.statusSessions', { count: items.length }), target: { feature: 'terminal' as const, section: 'running', resourceId: items[0]?.id }, order: kind === 'waiting' ? 10 : 20 }] : [];
		});
	}
	function automationSegments(): StatusSegment[] {
		const service = plugin.services.peek(AUTOMATIONS), runs = service?.activeRuns() ?? [];
		const rows: StatusSegment[] = [];
		if (runs.length) rows.push({ id: 'automations', icon: 'timer', count: runs.length, label: t('workbench.statusRunning', { count: runs.length }), target: { feature: 'automations', section: 'runs' }, order: 30 });
		if (service?.loadError) rows.push({ id: 'automation-load', icon: 'triangle-alert', tone: 'error', label: t('automation.failedLoad'), target: { feature: 'automations' }, order: 40 });
		return rows;
	}

	// Scope recency to the window's central area. Sidebar leaves do not anchor a
	// new tab, so choosing one can send programmatic navigation to another window.
	const activateWindowLeaf = (win?: Window): void => {
		if (!win) return;
		const workspace = plugin.app.workspace;
		let anchor = workspace.getMostRecentLeaf(workspace.rootSplit);
		if (anchor?.view.containerEl.win !== win) workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.containerEl.win === win) anchor = workspace.getMostRecentLeaf(leaf.getContainer());
		});
		if (anchor?.view.containerEl.win === win) workspace.setActiveLeaf(anchor, { focus: false });
	};

	/** The full (non-focus) workbench leaf of a window, creating one if needed. */
	const mainLeafView = async (ownerWindow?: Window): Promise<WorkbenchView> => {
		const workspace = plugin.app.workspace;
		const win = ownerWindow ?? workspace.getMostRecentLeaf()?.view.containerEl.win ?? workspace.containerEl.win;
		const active = workspace.getMostRecentLeaf();
		const candidates = workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE).filter((leaf) => leaf.view.containerEl.win === win && !(leaf.view instanceof WorkbenchView && leaf.view.focusMode));
		const existing = candidates.includes(active!) ? active : candidates.sort((left, right) => (right.view instanceof WorkbenchView ? right.view.lastActivatedAt : 0) - (left.view instanceof WorkbenchView ? left.view.lastActivatedAt : 0))[0];
		if (existing) await existing.loadIfDeferred();
		if (existing?.view instanceof WorkbenchView) return existing.view;
		let opening = pending.get(win);
		if (!opening) {
			opening = (async () => {
				activateWindowLeaf(win);
				const leaf = workspace.getLeaf('tab');
				await leaf.setViewState({ type: WORKBENCH_VIEW_TYPE, active: true });
				if (!(leaf.view instanceof WorkbenchView)) throw new Error(t('workbench.notReady'));
				return leaf.view;
			})();
			pending.set(win, opening);
		}
		try {
			return await opening;
		} finally {
			if (pending.get(win) === opening) pending.delete(win);
		}
	};

	const open = async (target?: WorkbenchTarget, ownerWindow?: Window, initial?: Record<string, unknown>): Promise<void> => {
		const view = await mainLeafView(ownerWindow);
		await plugin.app.workspace.revealLeaf(view.leaf);
		if (target) await view.navigate(target, initial);
		else await view.ensureActivePage();
	};

	const host: WorkbenchHost = {
		contributions,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		openSettings: (feature) => {
			const product = { dashboard: 'dashboard', terminal: 'terminal', contacts: 'contacts', automations: 'automation', notifications: 'general', icons: 'iconic', sync: 'sync', content: 'general', settings: 'general' } as const;
			void plugin.openWorkbenchSettings(feature ? product[feature] : 'general').catch(report);
		},
		openFocus: async (target, state, placement, ownerWindow) => {
			activateWindowLeaf(ownerWindow);
			const leaf = plugin.app.workspace.getLeaf(placement);
			await leaf.setViewState({ type: WORKBENCH_VIEW_TYPE, active: true, state: focusLeafState(target, state) });
			await plugin.app.workspace.revealLeaf(leaf);
		},
		openInWorkbench: (target, state, ownerWindow) => open(target, ownerWindow, state),
		failed: (feature: WorkbenchFeature) => {
			const module = FEATURE_MODULES[feature];
			return module !== 'app' && plugin.moduleState(module) === 'failed';
		},
		usage: () => plugin.services.peek(AGENT_USAGE),
		statusBar: () => plugin.appSettings.get().statusBar,
		setStatusBar: async preferences => { await plugin.appSettings.update(draft => { draft.statusBar = preferences; }); plugin.services.peek(AGENT_USAGE)?.setDisplay(preferences.usageDisplay); },
		appearance: () => ({ font: plugin.appSettings.get().font, palette: plugin.appSettings.get().palette }),
		report,
	};
	plugin.registerView(WORKBENCH_VIEW_TYPE, (leaf) => new WorkbenchView(leaf, host));

	/** Workbench services for modules (`ShellAccess`). */
	// The page keeps its identity (a module opening a new page in a tab waits for that page id).
	const openFocus = async (target: WorkbenchTarget, state: Record<string, unknown>, ownerWindow?: Window): Promise<void> => {
		activateWindowLeaf(ownerWindow);
		const leaf = plugin.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: WORKBENCH_VIEW_TYPE, active: true, state: { target, focus: true, pages: [{ target, state }] } });
		await plugin.app.workspace.revealLeaf(leaf);
	};
	const savedPages = (feature: WorkbenchFeature) => plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE).flatMap((leaf) => (leaf.view instanceof WorkbenchView ? leaf.view.getSavedPages(feature) : []));
	const activateResource = async (feature: WorkbenchFeature, resourceId: string): Promise<boolean> => {
		for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) {
			await leaf.loadIfDeferred();
			if (leaf.view instanceof WorkbenchView && await leaf.view.activateResource(feature, resourceId)) return true;
		}
		return false;
	};

	const closeResource = async (feature: WorkbenchFeature, resourceId: string): Promise<void> => {
		for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) {
			await leaf.loadIfDeferred();
			if (leaf.view instanceof WorkbenchView) await leaf.view.closeResource(feature, resourceId);
		}
	};

	const status = registerUsageMirror(plugin, {
		preferences: () => plugin.appSettings.get().statusBar,
		usage: () => plugin.services.peek(AGENT_USAGE),
		open: ownerWindow => open({ feature: 'terminal', section: 'usage' }, ownerWindow),
		report,
	});
	// The automation host can appear after the workbench (module enabled later or a retried start).
	// Run statuses follow the automations service while that module is active.
	let offAutomations = plugin.services.peek(AUTOMATIONS)?.subscribe(() => refresh());
	const offAutomationsWatch = plugin.services.watch(AUTOMATIONS, (automations) => {
		offAutomations?.();
		offAutomations = automations?.subscribe(() => refresh());
		refresh();
	});
	plugin.register(() => { offAutomations?.(); offAutomationsWatch(); });
	// Unread count and attention status follow the inbox while the notifications module is active.
	let offInbox = plugin.services.peek(NOTIFICATION_INBOX)?.subscribe(() => refresh());
	const offInboxWatch = plugin.services.watch(NOTIFICATION_INBOX, (inbox) => {
		offInbox?.();
		offInbox = inbox?.subscribe(() => refresh());
		refresh();
	});
	plugin.register(() => { offInbox?.(); offInboxWatch(); });
	// Board saves refresh the home status while that module is active.
	let offHome = plugin.services.peek(HOME_WORKBENCH)?.subscribe(() => refresh());
	const offHomeWatch = plugin.services.watch(HOME_WORKBENCH, (service) => {
		offHome?.();
		offHome = service?.subscribe(() => refresh());
		refresh();
	});
	plugin.register(() => { offHome?.(); offHomeWatch(); });
	// Git status and runs refresh the sync panel and statuses while that module is active.
	let offSync = plugin.services.peek(SYNC_WORKBENCH)?.subscribe(() => refresh());
	const offSyncWatch = plugin.services.watch(SYNC_WORKBENCH, (sync) => {
		offSync?.();
		offSync = sync?.subscribe(() => refresh());
		refresh();
	});
	plugin.register(() => { offSync?.(); offSyncWatch(); });
	// Agent sessions, history and usage refresh the agent panel and statuses while that module is active.
	let offAgent = plugin.services.peek(AGENT_WORKBENCH)?.subscribe(() => refresh());
	const offAgentWatch = plugin.services.watch(AGENT_WORKBENCH, (agent) => {
		offAgent?.();
		offAgent = agent?.subscribe(() => refresh());
		refresh();
	});
	const refresh = (): void => {
		status.refresh();
		for (const listener of listeners) listener();
	};
	plugin.register(plugin.onModuleChanged(refresh));
	plugin.register(plugin.appSettings.subscribe(refresh));
	plugin.register(() => { offAgent?.(); offAgentWatch(); status.dispose(); });
	registerWorkbenchRibbon(plugin, (ownerWindow) => open(undefined, ownerWindow), report);
	refresh();

	const prepareModuleChanges = async (flags: Readonly<Record<ModuleId, boolean>>): Promise<void> => {
		const disabled = new Set<WorkbenchFeature>();
		for (const [feature, module] of Object.entries(FEATURE_MODULES) as Array<[WorkbenchFeature, ModuleId | 'app']>) if (module !== 'app' && !flags[module]) disabled.add(feature);
		for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) {
			if (leaf.view instanceof WorkbenchView) await leaf.view.prepareModuleChanges(disabled);
		}
	};

	return {
		open,
		refresh,
		openFocus,
		savedPages,
		activateResource,
		closeResource,
		prepareModuleChanges,
		dispose: () => {
			for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) if (leaf.view instanceof WorkbenchView) void leaf.view.disposeSurface().catch(report);
			listeners.clear();
		},
	};
}
