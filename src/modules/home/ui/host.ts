import type { App } from 'obsidian';
import type { DashboardSettings } from '../core/board/types/model';
import type { AutomationUiPort } from '../../../shared/automation/types';

/** Capabilities the dashboard asks of the native plugin composition. */
export interface DashboardHost {
	openBrowser?(request: import('../../browser/api').BrowserOpenRequest): Promise<void>;
	app: App;
	manifest: import('obsidian').PluginManifest;
	settings: DashboardSettings & { modules: { dashboard: boolean }; contacts?: { rootFolder: string } };
	automationHost?: AutomationUiPort;
	saveSettings(): Promise<void>;
	refreshAllDashboards(): void;
	openSettings(): void;
	switchWorkspace(path: string): Promise<void>;
	createWorkspace(name: string): Promise<void>;
	renameWorkspace(path: string, name: string): Promise<void>;
	removeWorkspace(path: string): Promise<void>;
}
