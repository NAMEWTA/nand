import type { App, PluginManifest } from 'obsidian';
import type { DashboardSettings } from '../../core/dashboard/types/model';

/** Native capabilities used by Vault-backed widget adapters. */
export interface WidgetSettingsHost {
	app: App;
	manifest: PluginManifest;
	settings: DashboardSettings;
	saveSettings(): Promise<void>;
}
