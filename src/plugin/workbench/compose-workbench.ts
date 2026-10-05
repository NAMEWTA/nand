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
  { id: 'automations', navigation: { id: 'automations', labelKey: 'workbench.automations', icon: 'workflow', target: { feature: 'automations' } }, availability: () => ({ ...ready(), ready: !!plugin.automationHost }), stateKeys: ['selected', 'search', 'filter', 'agentFilter'], create: async (context) => {
   if (!plugin.automationHost) throw new Error(t('automation.failedLoad'));
   const surface = new AutomationPresentation(context, plugin.automationHost.panelHost);
   return { surface, navigate: async (target, signal) => { if (!signal.aborted && target.resourceId) surface.showRun(target.resourceId); } };
  } },
  { id: 'notifications', navigation: { id: 'notifications', labelKey: 'workbench.notifications', icon: 'bell', target: { feature: 'notifications' } }, availability: () => ({ ...ready(), ready: !!plugin.automationHost }), stateKeys: [], create: async (context) => {
   if (!plugin.automationHost) throw new Error(t('automation.failedLoad'));
   return { surface: new NotificationPresentation(context, plugin.automationHost.notifications, report), navigate: async () => {} };
  } },
 ];
 const host: WorkbenchHost = {
  contributions, subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  openSettings: () => plugin.openHome(), report,
  openStandalone: async (target, state, ownerWindow) => {
   const anchor = plugin.app.workspace.getMostRecentLeaf();
   if (anchor && anchor.view.containerEl.win === ownerWindow) plugin.app.workspace.setActiveLeaf(anchor, { focus: false });
   const types = { dashboard: 'nand-dashboard-view', contacts: 'nand-contacts-view', automations: 'nand-automation-view', browser: 'nand-browser-view' };
   const type = types[target.feature as keyof typeof types];
   if (!type) { if (target.feature === 'notifications') plugin.automationHost?.inbox(); return; }
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
 const refresh = (): void => { for (const listener of listeners) listener(); };
 return { open, refresh, dispose: () => {
  for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) if (leaf.view instanceof WorkbenchView) void leaf.view.disposeSurface().catch(report);
  plugin.browserHost.setWorkbench(undefined);
  listeners.clear();
 } };
}
