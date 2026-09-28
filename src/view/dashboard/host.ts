import type { App } from 'obsidian';
import type { DashboardSettings } from '../../core/dashboard/types/model';
import type { AutomationUiPort } from '../../shared/automation/types';

/** Capabilities the dashboard asks of the native plugin composition. */
export interface DashboardHost {
	app: App;
	manifest: import('obsidian').PluginManifest;
	settings: DashboardSettings & { modules: { dashboard: boolean } };
	automationHost?: AutomationUiPort;
	saveSettings(): Promise<void>;
	refreshAllDashboards(): void;
	openHome(): void;
	switchWorkspace(path: string): Promise<void>;
	createWorkspace(name: string): Promise<void>;
	renameWorkspace(path: string, name: string): Promise<void>;
	removeWorkspace(path: string): Promise<void>;
}
