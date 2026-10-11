import type { App, PluginManifest } from 'obsidian';
import type { ModuleContext } from '../../../app/contracts/module';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { AutomationUiPort } from '../../../shared/automation/types';
import { AUTOMATIONS } from '../../automations/api';
import { BROWSER_OPEN, type BrowserOpenRequest } from '../../browser/api';
import { BOARD_SURFACE_TYPE, type BoardOperations, type BoardSurfaceApi } from '../api';
import type { BoardLayout, DashboardSettings } from '../core/board/types/model';
import { t } from '../../../shared/i18n';
import { normalizeWorkspacePath } from '../core/workspace/workspace-registry';
import { AppearancePresets } from './appearance-presets';

/** Board settings as the board code reads them, plus the module switch it checks before drawing. */
export type HomeSettingsView = DashboardSettings & { modules: { dashboard: boolean } };

/**
 * What the board code asks of its module: the `home` settings namespace (read and changed in place, then
 * saved), board refresh, the board registry and the workbench. Created once per module activation.
 */
export interface HomeHost {
	readonly app: App;
	readonly manifest: PluginManifest;
	readonly appearance: AppearancePresets;
	settings: HomeSettingsView;
	saveSettings(): Promise<void>;
	boards?: BoardOperations;
	readonly automationHost: AutomationUiPort | undefined;
	refreshAllDashboards(): void;
	reloadAllDashboards(): Promise<void>;
	boardSurfaces(): BoardSurfaceApi[];
	activeDashboard(): BoardSurfaceApi | undefined;
	openSettings(): void;
	openBrowser(request: BrowserOpenRequest): Promise<void>;
	workbenchRefresh(): void;
	switchWorkspace(path: string): Promise<void>;
	createWorkspace(name: string, layout?: BoardLayout): Promise<void>;
	openBoard(path: string): Promise<void>;
	setBoardLayout(path: string, layout: BoardLayout): Promise<void>;
	renameWorkspace(path: string, name: string): Promise<void>;
	removeWorkspace(path: string): Promise<void>;
	reorderWorkspaces(from: number, to: number): Promise<void>;
	retargetWorkspace(oldPath: string, newPath: string): Promise<void>;
}

export function createHomeHost(context: ModuleContext, handle: SettingsHandle<DashboardSettings>): HomeHost {
	const app = context.app;
	const modules = { get dashboard() { return true; } };
	// Reads and in-place writes go to the namespace value; `saveSettings` persists them (`touch`).
	let cached: { target: DashboardSettings; proxy: HomeSettingsView } | undefined;
	const view = (): HomeSettingsView => {
		const target = handle.get();
		if (cached?.target !== target) {
			cached = {
				target,
				proxy: new Proxy(target as HomeSettingsView, {
					get: (value, key, receiver): unknown => (key === 'modules' ? modules : Reflect.get(value, key, receiver)),
					set: (value, key, next, receiver) => key === 'modules' || Reflect.set(value, key, next, receiver),
					// Spreads and copies of the view keep `modules`.
					ownKeys: (value) => [...Reflect.ownKeys(value).filter((key) => key !== 'modules'), 'modules'],
					getOwnPropertyDescriptor: (value, key) =>
						key === 'modules' ? { value: modules, enumerable: true, configurable: true, writable: true } : Reflect.getOwnPropertyDescriptor(value, key),
				}),
			};
		}
		return cached.proxy;
	};
	// Board pages live in workbench leaves, which list their page surfaces.
	const surfaces = (): BoardSurfaceApi[] => {
		const found: BoardSurfaceApi[] = [];
		app.workspace.iterateAllLeaves((leaf) => {
			const owner = leaf.view as typeof leaf.view & { getNativeSurfaces?: () => readonly BoardSurfaceApi[] };
			for (const surface of owner.getNativeSurfaces?.() ?? []) if (surface.getViewType() === BOARD_SURFACE_TYPE) found.push(surface);
		});
		return found;
	};
	const host: HomeHost = {
		app,
		manifest: context.manifest,
		appearance: new AppearancePresets(context.settings, handle),
		get settings() {
			return view();
		},
		set settings(next) {
			const target = handle.get() as unknown as Record<string, unknown>;
			for (const [key, value] of Object.entries(next)) if (key !== 'modules' && target[key] !== value) target[key] = value;
		},
		saveSettings: () => handle.touch(),
		get automationHost() {
			return context.services.peek(AUTOMATIONS);
		},
		refreshAllDashboards: () => {
			for (const surface of surfaces()) void surface.refresh();
		},
		reloadAllDashboards: async () => {
			for (const surface of surfaces()) await surface.reloadFromDisk();
		},
		boardSurfaces: surfaces,
		activeDashboard: () => {
			const leaf = app.workspace.getMostRecentLeaf();
			const win = leaf?.view.containerEl.win ?? app.workspace.containerEl.win;
			const candidates = surfaces().filter((surface) => surface.contentEl.win === win && !surface.contentEl.hidden);
			return candidates.find((surface) => surface.leaf === leaf) ?? candidates[0];
		},
		openSettings: () => {
			void context.shell.open({ feature: 'settings', section: 'dashboard' });
		},
		openBrowser: async (request) => {
			const browser = context.services.peek(BROWSER_OPEN);
			if (browser) await browser.show(request);
			else if (request.url) window.open(request.url);
		},
		workbenchRefresh: () => context.shell.refresh(),
		switchWorkspace: (path) => host.boards?.switch(path) ?? Promise.resolve(),
		createWorkspace: (name, layout) => host.boards?.create(name, layout) ?? Promise.resolve(),
		openBoard: path => context.shell.open({ feature: 'dashboard', resourceId: normalizeWorkspacePath(path) }),
		setBoardLayout: async (path, layout) => {
			await host.openBoard(path);
			const surface = host.activeDashboard();
			if (!surface || normalizeWorkspacePath(surface.plugin.settings.dashboardFile) !== normalizeWorkspacePath(path)) throw new Error(t('workbench.missing'));
			await surface.sync.setBoardLayout(layout);
		},
		renameWorkspace: (path, name) => host.boards?.rename(path, name) ?? Promise.resolve(),
		removeWorkspace: (path) => host.boards?.remove(path) ?? Promise.resolve(),
		reorderWorkspaces: (from, to) => host.boards?.reorder(from, to) ?? Promise.resolve(),
		retargetWorkspace: (oldPath, newPath) => host.boards?.retarget(oldPath, newPath) ?? Promise.resolve(),
	};
	return host;
}

/** Point every open board at the active board file. Serial: each board drains its queued writes first. */
export async function repointBoards(host: HomeHost): Promise<void> {
	const active = normalizeWorkspacePath(host.settings.dashboardFile);
	for (const surface of host.boardSurfaces()) {
		const current = normalizeWorkspacePath(surface.plugin.settings.dashboardFile);
		if (!host.settings.workspaceFiles.includes(current)) await surface.plugin.switchWorkspace(active);
		else await surface.applyWorkspaceSwitch();
	}
}
