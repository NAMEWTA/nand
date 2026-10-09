import { normalizeWorkspacePath } from '../core/workspace/workspace-registry';
import type { DashboardHost } from './host';
import { DashboardSurface } from './view/dashboard-surface';
import type { NativeSurfaceContext } from '../../../ui/native-surface';
import type { PageCreate, WorkbenchPageBinding } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { createBoardSwitchQueue } from '../../../shell/board-switch';
import { workbenchBoardSettings, workbenchBoardSettingsPatch } from '../../../shell/board-settings';
import { t } from '../../../shared/i18n';
import type { HomeHost } from '../services/home-host';

/** Board page for the workbench (`refresh` updates the workbench status when the board saves). */
export const boardPage = (plugin: HomeHost): PageCreate => async (context, target, state) => createDashboardPage(plugin, context, target, state, () => plugin.workbenchRefresh());

/** Each workbench keeps its own board pointer; the global registry remains authoritative. */
export function createDashboardPage(plugin: HomeHost, context: NativeSurfaceContext, target: WorkbenchTarget, state: Record<string, unknown>, onSaveState?: () => void): WorkbenchPageBinding {
 let path = normalizeWorkspacePath(target.resourceId ?? (typeof state.dashboardFile === 'string' ? state.dashboardFile : plugin.settings.dashboardFile));
 if ((target.resourceId || typeof state.dashboardFile === 'string') && !plugin.app.vault.getFileByPath(path + '.md')) throw new Error(t('workbench.missing'));
 let surface: DashboardSurface;
 const switchBoard = createBoardSwitchQueue({
  current: () => path,
  assign: (next) => { path = next; },
  exists: (candidate) => !!plugin.app.vault.getFileByPath(candidate + '.md'),
  reload: () => surface.applyWorkspaceSwitch(),
  missing: () => new Error(t('workbench.missing')),
  save: () => { plugin.app.workspace.requestSaveLayout(); context.changed?.(); },
 });
 const switchPath = (requested: string, signal?: AbortSignal): Promise<void> => switchBoard(normalizeWorkspacePath(requested), signal);
 const host: DashboardHost = {
  app: plugin.app, manifest: plugin.manifest,
  get settings() { return workbenchBoardSettings(plugin.settings, path); },
  set settings(value) { path = normalizeWorkspacePath(value.dashboardFile); plugin.settings = { ...plugin.settings, ...workbenchBoardSettingsPatch(value) }; },
  get automationHost() { return plugin.automationHost; },
  saveSettings: () => plugin.saveSettings(), refreshAllDashboards: () => plugin.refreshAllDashboards(),
  openSettings: () => plugin.openSettings(), openBrowser: (request) => plugin.openBrowser(request),
  switchWorkspace: switchPath,
  createWorkspace: async (name) => { await plugin.createWorkspace(name); await switchPath(plugin.settings.dashboardFile); },
  renameWorkspace: (file, name) => plugin.renameWorkspace(file, name),
  removeWorkspace: async (file) => { await plugin.removeWorkspace(file); if (!plugin.settings.workspaceFiles.includes(path)) await switchPath(plugin.settings.dashboardFile); },
 };
 surface = new DashboardSurface(context, host);
 let attached = false;
 if (onSaveState) surface.register(surface.sync.onSaveStateUpdate(() => { if (attached) onSaveState(); }));
 attached = true;
 surface.registerEvent(plugin.app.vault.on('rename', (file, oldPath) => {
  if (normalizeWorkspacePath(oldPath) === path) {
   path = normalizeWorkspacePath(file.path);
   void surface.applyWorkspaceSwitch().then(() => context.changed?.()).catch((error: unknown) => console.error('[NAND workbench]', error));
  }
 }));
 return {
  surface, getState: () => ({ dashboardFile: path }), getTarget: () => ({ feature: 'dashboard', resourceId: path }),
  navigate: async (next, signal) => {
   if (signal.aborted) return;
   if (next.resourceId) await switchPath(next.resourceId, signal);
   if (signal.aborted) return;
   if (next.focusId && !(await surface.focusWidget(next.focusId))) throw new Error(t('workbench.missing'));
  },
 };
}
