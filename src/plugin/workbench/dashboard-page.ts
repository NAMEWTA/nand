import { normalizeWorkspacePath } from '../../core/workspace/workspace-registry';
import type { DashboardHost } from '../../view/dashboard/host';
import { DashboardSurface } from '../../view/dashboard/view/dashboard-surface';
import type { NativeSurfaceContext } from '../../view/hosts/obsidian/native-surface';
import type { WorkbenchPageBinding } from '../../view/hosts/obsidian/workbench-host';
import type { WorkbenchTarget } from '../../view/contracts/workbench';
import { t } from '../../shared/i18n';
import type DashboardPlugin from '../main';

/** Each workbench keeps its own board pointer; the global registry remains authoritative. */
export function createDashboardPage(plugin: DashboardPlugin, context: NativeSurfaceContext, target: WorkbenchTarget, state: Record<string, unknown>): WorkbenchPageBinding {
 let path = normalizeWorkspacePath(target.resourceId ?? (typeof state.dashboardFile === 'string' ? state.dashboardFile : plugin.settings.dashboardFile));
 if ((target.resourceId || typeof state.dashboardFile === 'string') && !plugin.app.vault.getFileByPath(path + '.md')) throw new Error(t('workbench.missing'));
 let switching: Promise<void> = Promise.resolve();
 let surface: DashboardSurface;
 const switchPath = (requested: string): Promise<void> => {
  const next = normalizeWorkspacePath(requested);
  const operation = switching.then(async () => {
   if (!next || next === path) return;
   if (!plugin.app.vault.getFileByPath(next + '.md')) throw new Error(t('workbench.missing'));
   const previous = path;
   path = next;
   try { await surface.applyWorkspaceSwitch(); } catch (error) { path = previous; throw error; }
   plugin.app.workspace.requestSaveLayout();
  });
  switching = operation.catch(() => {});
  return operation;
 };
 const host: DashboardHost = {
  app: plugin.app, manifest: plugin.manifest,
  get settings() { return { ...plugin.settings, dashboardFile: path, layoutMode: 'stacked' as const }; },
  set settings(value) { const { dashboardFile, modules, layoutMode, ...rest } = value; void layoutMode; path = normalizeWorkspacePath(dashboardFile); void modules; plugin.settings = { ...plugin.settings, ...rest }; },
  get automationHost() { return plugin.automationHost; },
  saveSettings: () => plugin.saveSettings(), refreshAllDashboards: () => plugin.refreshAllDashboards(),
  openSettings: () => plugin.openSettings(), openBrowser: (request) => plugin.openBrowser(request),
  switchWorkspace: switchPath,
  createWorkspace: async (name) => { await plugin.createWorkspace(name); await switchPath(plugin.settings.dashboardFile); },
  renameWorkspace: (file, name) => plugin.renameWorkspace(file, name),
  removeWorkspace: async (file) => { await plugin.removeWorkspace(file); if (!plugin.settings.workspaceFiles.includes(path)) await switchPath(plugin.settings.dashboardFile); },
 };
 surface = new DashboardSurface(context, host);
 surface.registerEvent(plugin.app.vault.on('rename', (file, oldPath) => {
  if (normalizeWorkspacePath(oldPath) === path) { path = normalizeWorkspacePath(file.path); void surface.applyWorkspaceSwitch().catch((error: unknown) => console.error('[NAND workbench]', error)); }
 }));
 return {
  surface, getState: () => ({ dashboardFile: path }), getTarget: () => ({ feature: 'dashboard', resourceId: path }),
  navigate: async (next, signal) => {
   if (signal.aborted) return;
   if (next.resourceId) await switchPath(next.resourceId);
   if (!signal.aborted && next.focusId && !(await surface.focusWidget(next.focusId))) throw new Error(t('workbench.missing'));
  },
 };
}
