import type { ModuleGates } from '../settings/nav';
import type { WorkbenchFeature } from '../../view/contracts/workbench';
import { registerWorkbenchStatus } from './surfaces/status-bar';
import type { WorkbenchStatus } from '../../view/contracts/workbench';
import { registerWorkbenchRibbon } from './surfaces/ribbon';
import { NotificationInbox } from '../../view/notifications/inbox';
import { createTerminalPage } from './terminal-page';
import { newPageState } from '../../core/browser/model';
import { createBrowserPage } from './browser-page';
import { Notice, Platform } from 'obsidian';
import type DashboardPlugin from '../main';
import { t } from '../../shared/i18n';
import { WorkbenchView } from '../../view/hosts/obsidian/workbench-view';
import type { WorkbenchContribution, WorkbenchHost } from '../../view/hosts/obsidian/workbench-host';
import type { WorkbenchTarget } from '../../view/contracts/workbench';
import { WORKBENCH_VIEW_TYPE } from '../../view/workbench/view-type';
import { ContactsPresentation } from '../../view/contacts/contacts-presentation';
import { AutomationPresentation } from '../../view/automations/automation-presentation';
import { NotificationPresentation } from '../../view/notifications/notification-presentation';
import { createDashboardPage } from './dashboard-page';

export function composeWorkbench(plugin: DashboardPlugin) {
 const listeners = new Set<() => void>();
 const pending = new WeakMap<Window, Promise<WorkbenchView>>();
 const report = (error: unknown): void => { console.error('[NAND workbench]', error); new Notice(error instanceof Error ? error.message : String(error)); };
 const ready = () => ({ enabled: true, supported: true, ready: true });
 const contributions: WorkbenchContribution[] = [
  { id: 'dashboard', navigation: { id: 'dashboard', labelKey: 'workbench.home', icon: 'home', target: { feature: 'dashboard' } }, availability: () => ({ ...ready(), enabled: plugin.settings.modules.dashboard }), stateKeys: ['dashboardFile'], create: async (context, target, state) => createDashboardPage(plugin, context, target, state) },

  { id: 'terminal', navigation: { id: 'terminal', labelKey: 'workbench.agent', icon: 'terminal', target: { feature: 'terminal' }, children: [
   { id: 'terminal-running', labelKey: 'workbench.running', icon: 'terminal', target: { feature: 'terminal', section: 'running' } },
   { id: 'terminal-history', labelKey: 'workbench.history', icon: 'history', target: { feature: 'terminal', section: 'history' } },
   { id: 'terminal-usage', labelKey: 'workbench.usage', icon: 'chart-no-axes-column', target: { feature: 'terminal', section: 'usage' } },
  ] }, availability: () => ({ ...ready(), enabled: plugin.settings.modules.terminal, supported: Platform.isDesktopApp, ready: plugin.terminalHost?.isActive() === true }), stateKeys: ['sidebarWidth', 'wideSidebarOpen', 'navigation', 'sessionQuery', 'historyQuery', 'historyFilter', 'historyOffset', 'sessionId', 'section'], create: createTerminalPage(() => plugin.terminalHost) },
  { id: 'browser', navigation: { id: 'browser', labelKey: 'workbench.browser', icon: 'globe', target: { feature: 'browser' } }, availability: () => ({ ...ready(), enabled: plugin.settings.modules.browser, supported: Platform.isDesktopApp }), stateKeys: ['id', 'url', 'title', 'zoom', 'scroll'], resourcePages: true, create: createBrowserPage(plugin.browserHost) },
  { id: 'contacts', navigation: { id: 'contacts', labelKey: 'workbench.contacts', icon: 'contact-round', target: { feature: 'contacts' }, children: [
   { id: 'contacts-person', labelKey: 'workbench.people', icon: 'user', target: { feature: 'contacts', section: 'person' } },
   { id: 'contacts-company', labelKey: 'workbench.companies', icon: 'building-2', target: { feature: 'contacts', section: 'company' } },
  ] }, availability: () => ({ ...ready(), enabled: plugin.settings.modules.contacts, ready: !!plugin.contactsHost }), stateKeys: ['query', 'page', 'selectedPath', 'selectedId', 'scroll'], create: async (context) => {
   const surface = new ContactsPresentation(context, plugin);
   return { surface, navigate: async (target, signal) => {
    if (signal.aborted) return;
    if (target.section === 'person' || target.section === 'company') surface.changeKind(target.section);
    if (target.resourceId) {
     await surface.controller?.ensureLoaded(); if (signal.aborted) return;
     const record = surface.controller?.index.get(target.resourceId) ?? surface.controller?.index.byPath.get(target.resourceId);
     if (!record) throw new Error(t('workbench.missing'));
     surface.select(record.path);
    }
   } };
  } },
  { id: 'automations', navigation: { id: 'automations', labelKey: 'workbench.automations', icon: 'workflow', target: { feature: 'automations' }, children: [
   { id: 'automations-tasks', labelKey: 'workbench.tasks', icon: 'list', target: { feature: 'automations', section: 'tasks' } },
   { id: 'automations-runs', labelKey: 'workbench.runs', icon: 'history', target: { feature: 'automations', section: 'runs' } },
  ] }, availability: () => ({ ...ready(), ready: !!plugin.automationHost }), stateKeys: ['selected', 'search', 'filter', 'agentFilter', 'section', 'runHistory'], create: async (context) => {
   if (!plugin.automationHost) throw new Error(t('automation.failedLoad'));
   const surface = new AutomationPresentation(context, plugin.automationHost.panelHost);
   return { surface, getTarget: () => surface.getTarget(), navigate: async (target, signal) => { if (signal.aborted) return; if (target.resourceId) surface.showRun(target.resourceId); else surface.showSection(target.section); } };
  } },
  { id: 'notifications', navigation: { id: 'notifications', labelKey: 'workbench.notifications', icon: 'bell', target: { feature: 'notifications' } }, availability: () => ({ ...ready(), ready: !!plugin.automationHost }), stateKeys: [], create: async (context) => {
   if (!plugin.automationHost) throw new Error(t('automation.failedLoad'));
   return { surface: new NotificationPresentation(context, plugin.automationHost.notifications, report), navigate: async () => {} };
  } },
 ];
 const host: WorkbenchHost = {
  contributions, subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  openSettings: () => plugin.openSettings(), report,
  openStandalone: async (target, state, ownerWindow) => {
   const anchor = plugin.app.workspace.getMostRecentLeaf();
   if (anchor && anchor.view.containerEl.win === ownerWindow) plugin.app.workspace.setActiveLeaf(anchor, { focus: false });
   const types = { dashboard: 'nand-dashboard-view', contacts: 'nand-contacts-view', automations: 'nand-automation-view', browser: 'nand-browser-view', terminal: 'terminal-view' };
   const type = types[target.feature as keyof typeof types];
   if (!type) { if (target.feature === 'notifications') if (plugin.automationHost) new NotificationInbox(plugin.app, plugin.automationHost.notifications).open(); return; }
   const leaf = plugin.app.workspace.getLeaf('tab');
   // A copied browser page is a new resource, not another owner of the same guest.
   await leaf.setViewState({ type, active: true, state: target.feature === 'browser' ? { ...state, id: crypto.randomUUID() } : state }); await plugin.app.workspace.revealLeaf(leaf);
  },
 };
 plugin.registerView(WORKBENCH_VIEW_TYPE, (leaf) => new WorkbenchView(leaf, host));
 const open = async (target?: WorkbenchTarget, ownerWindow?: Window, initial?: Record<string, unknown>): Promise<void> => {
  const workspace = plugin.app.workspace;
  const win = ownerWindow ?? workspace.getMostRecentLeaf()?.view.containerEl.win ?? workspace.containerEl.win;
  const existing = workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE).find((leaf) => leaf.view.containerEl.win === win);
  if (existing) await existing.loadIfDeferred();
  let view = existing?.view;
  if (!(view instanceof WorkbenchView)) {
   let opening = pending.get(win);
   if (!opening) {
    opening = (async () => {
     let anchor = workspace.getMostRecentLeaf();
     if (anchor?.view.containerEl.win !== win) { workspace.iterateAllLeaves((leaf) => { if (leaf.view.containerEl.win === win) anchor = leaf; }); }
     if (anchor && anchor.view.containerEl.win === win) workspace.setActiveLeaf(anchor, { focus: false });
     const leaf = workspace.getLeaf('tab');
     await leaf.setViewState({ type: WORKBENCH_VIEW_TYPE, active: true, state: target ? { target, pages: initial ? [{ target, state: initial }] : [] } : undefined });
     if (!(leaf.view instanceof WorkbenchView)) throw new Error(t('workbench.notReady'));
     return leaf.view;
    })();
    pending.set(win, opening);
   }
   try { view = await opening; } finally { if (pending.get(win) === opening) pending.delete(win); }
  }
  if (!(view instanceof WorkbenchView)) throw new Error(t('workbench.notReady'));
  await workspace.revealLeaf(view.leaf);
  if (target) await view.navigate(target, initial);
  else await view.ensureActivePage();
 };

 plugin.browserHost.setWorkbench({
  open: (state, ownerWindow) => open({ feature: 'browser', resourceId: state.id }, ownerWindow, { ...state }),
  list: () => plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE).flatMap((leaf) => {
   const raw = leaf.view instanceof WorkbenchView ? leaf.view.getSavedPages('browser') : Array.isArray(leaf.getViewState().state?.pages) ? leaf.getViewState().state?.pages as unknown[] : [];
   return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as { target?: { feature?: string; resourceId?: string }; state?: Record<string, unknown> };
    return entry.target?.feature === 'browser' && entry.target.resourceId ? [newPageState(entry.target.resourceId, entry.state)] : [];
   });
  }),
  activate: async (id) => {
   for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) {
    if (leaf.view instanceof WorkbenchView && await leaf.view.activateResource('browser', id)) return true;
    const states: unknown = leaf.getViewState().state?.pages;
    if (!Array.isArray(states) || !states.some((state: unknown) => {
     if (!state || typeof state !== 'object') return false;
     const target = (state as { target?: { feature?: string; resourceId?: string } }).target;
     return target?.feature === 'browser' && target.resourceId === id;
    })) continue;
    await leaf.loadIfDeferred();
    if (leaf.view instanceof WorkbenchView && await leaf.view.activateResource('browser', id)) return true;
   }
   return false;
  },
 });

 const status = registerWorkbenchStatus(plugin, {
  enabled: () => plugin.settings.workbenchStatus !== 'hidden',
  quota: () => ({ source: plugin.terminalHost?.getUsageSource(), pinned: !!plugin.settings.modules.terminal && plugin.terminalHost?.isActive() === true && plugin.terminalHost.settings.agentSettings.showUsageInStatusBar }),
  read: () => {
   const rows: WorkbenchStatus[] = [];
   const automation = plugin.automationHost;
   if (automation?.service.loadError) rows.push({ id: 'automation-load', kind: 'error', label: t('automation.failedLoad'), target: { feature: 'automations' } });
   const attention = automation?.notifications.records.filter((record) => !record.read && (record.presentation?.status === 'failed' || record.presentation?.status === 'interrupted' || Object.values(record.deliveries).includes('failed'))) ?? [];
   if (attention.length) rows.push({ id: 'attention', kind: 'error', label: t('workbench.statusAttention', { count: attention.length }), target: { feature: 'notifications' } });
   const runs = automation?.service.state.runs.filter((run) => run.status === 'running' || run.status === 'pending') ?? [];
   if (runs.length) rows.push({ id: 'automations-running', kind: 'running', label: t('workbench.statusRunning', { count: runs.length }), target: { feature: 'automations', section: 'runs', resourceId: runs.length === 1 ? runs[0]?.id : undefined } });
   const sessions = plugin.terminalHost?.getRuntimeStatus().filter((session) => !session.automated) ?? [];
   for (const kind of ['waiting', 'running'] as const) {
    const items = sessions.filter((session) => session.status === kind);
    if (items.length) rows.push({ id: 'terminal-' + kind, kind: kind === 'waiting' ? 'error' : 'running', label: t(kind === 'waiting' ? 'workbench.statusWaiting' : 'workbench.statusSessions', { count: items.length }), target: { feature: 'terminal', section: 'running', resourceId: items.length === 1 ? items[0]?.id : undefined } });
   }
   return rows;
  }, open: (target, ownerWindow) => open(target, ownerWindow), report,
 });
 let runtimeHost = plugin.terminalHost;
 let offRuntime = runtimeHost?.subscribeRuntime(status.refresh);
 plugin.register(() => { offRuntime?.(); status.dispose(); });
 registerWorkbenchRibbon(plugin, (ownerWindow) => open(undefined, ownerWindow), report);
 const refresh = (): void => {
  if (runtimeHost !== plugin.terminalHost) { offRuntime?.(); runtimeHost = plugin.terminalHost; offRuntime = runtimeHost?.subscribeRuntime(status.refresh); }
  status.refresh();
  const notifications = contributions.find((item) => item.id === 'notifications');
  if (notifications) notifications.navigation.badge = plugin.automationHost?.notifications.unread ?? 0;
  for (const listener of listeners) listener();
 };
 if (plugin.automationHost) {
  plugin.register(plugin.automationHost.notifications.subscribe(refresh));
  plugin.register(plugin.automationHost.service.subscribe(status.refresh));
 }
 refresh();
 const prepareModuleChanges = async (flags: Readonly<ModuleGates>): Promise<void> => {
  const disabled = new Set<WorkbenchFeature>();
  for (const feature of ['dashboard', 'terminal', 'browser', 'contacts'] as const) if (!flags[feature]) disabled.add(feature);
  for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) {
   if (leaf.view instanceof WorkbenchView) await leaf.view.prepareModuleChanges(disabled);
  }
 };

 return { open, refresh, prepareModuleChanges, dispose: () => {
  for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) if (leaf.view instanceof WorkbenchView) void leaf.view.disposeSurface().catch(report);
  plugin.browserHost.setWorkbench(undefined);
  listeners.clear();
 } };
}
