import { Setting } from 'obsidian';
import { t } from '../../shared/i18n/index';
import { renderEmptyState } from '../../view/primitives/empty-state';
import type { DashboardSettingTab } from './settings-tab';

/** Editor product block. Comment bodies stay in the vault sidecar, not data.json. */
export function renderEditorSettings(this: DashboardSettingTab, containerEl: HTMLElement): void {
	const workbench = this.plugin.settings.editorWorkbench;

	new Setting(containerEl)
		.setName(t('settings.editorHighlight'))
		.setDesc(t('settings.editorHighlightDesc'))
		.addToggle((toggle) =>
			toggle.setValue(workbench.highlightEnabled).onChange(async (value) => {
				this.plugin.settings = {
					...this.plugin.settings,
					editorWorkbench: { ...this.plugin.settings.editorWorkbench, highlightEnabled: value },
				};
				await this.plugin.saveSettings();
				this.plugin.editorHost?.notifySettingsChanged();
			}),
		);

	new Setting(containerEl)
		.setName(t('settings.editorPopover'))
		.setDesc(t('settings.editorPopoverDesc'))
		.addToggle((toggle) =>
			toggle.setValue(workbench.popoverEnabled).onChange(async (value) => {
				this.plugin.settings = {
					...this.plugin.settings,
					editorWorkbench: { ...this.plugin.settings.editorWorkbench, popoverEnabled: value },
				};
				await this.plugin.saveSettings();
				this.plugin.editorHost?.notifySettingsChanged();
			}),
		);
}

/** Sync product is not built yet. One line, so the settings page already has a home for it. */
export function renderSyncSettings(this: DashboardSettingTab, containerEl: HTMLElement): void {
	renderEmptyState(containerEl, {
		icon: 'refresh-cw',
		title: t('settings.tabSync'),
		description: t('editor.sync.placeholder'),
		layout: 'content',
	});
}
