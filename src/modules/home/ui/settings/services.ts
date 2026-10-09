import { DEFAULT_HIGHLIGHT_IMPORT_PATH } from '../../core/board/default-paths';
import { Setting } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import type { BoardSettingsTab } from './board-settings-tab';

/** Data-service sections (Weread): content sources rendered as
 *  their own dashboard sections, NOT sidebar widgets — they live on the
 *  General settings page, not the Widgets page. */
export function renderServiceSettings(this: BoardSettingsTab, containerEl: HTMLElement): void {
	// --- Weread (WeChat Read) card ---
	const wereadCard = containerEl.createDiv({ cls: 'dashboard-widget-settings-card' });
	new Setting(wereadCard)
		.setName(t('settings.wereadApiKey'))
		.setDesc(t('settings.wereadApiKeyDesc'))
		.addText((text) =>
			text.setValue(this.plugin.settings.wereadApiKey).onChange(async (value) => {
				this.plugin.settings = { ...this.plugin.settings, wereadApiKey: value.trim() };
				await this.plugin.saveSettings();
				this.plugin.refreshAllDashboards();
			}),
		);
	new Setting(wereadCard)
		.setName(t('settings.wereadGetKey'))
		.setDesc(t('settings.wereadGetKeyDesc'))
		.addButton((btn) =>
			btn
				.setButtonText(t('settings.wereadGetKey'))
				.onClick(() => window.open('https://weread.qq.com/r/weread-skills', '_blank')),
		);
	new Setting(wereadCard)
		.setName(t('settings.wereadImportPath'))
		.setDesc(t('settings.wereadImportPathDesc'))
		.addText((text) =>
			text
				.setPlaceholder(DEFAULT_HIGHLIGHT_IMPORT_PATH)
				.setValue(this.plugin.settings.wereadImportPath)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						wereadImportPath: value.trim().replace(/^\/+|\/+$/g, ''),
					};
					await this.plugin.saveSettings();
				}),
		);
}
