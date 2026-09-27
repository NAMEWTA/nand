import { Notice } from 'obsidian';
import { t } from '../shared/i18n';
import type { DashboardSettings } from './types';

export interface DashboardSettingsAccess {
	getSettings(): DashboardSettings;
	updateSettings(change: (current: DashboardSettings) => DashboardSettings): Promise<boolean>;
}

export function createDashboardSettingsAccess(owner: {
	settings: DashboardSettings;
	saveSettings(): Promise<void>;
	refreshAllDashboards(): void;
}): DashboardSettingsAccess {
	return {
		getSettings: () => owner.settings,
		async updateSettings(change) {
			const before = owner.settings;
			const next = change(before);
			owner.settings = next;
			try {
				await owner.saveSettings();
				owner.refreshAllDashboards();
				return true;
			} catch {
				if (owner.settings === next) owner.settings = before;
				new Notice(t('settings.writeFailed'));
				return false;
			}
		},
	};
}
