import { Notice, Platform, Setting } from 'obsidian';
import type { SearchEngine } from '../../core/browser/model';
import { t } from '../../shared/i18n';
import { browserError } from '../../view/browser/BrowserPanel';
import type DashboardPlugin from '../main';

export function renderBrowserSettings(plugin: DashboardPlugin, container: HTMLElement): void {
	new Setting(container)
		.setName(t('browser.open'))
		.setDesc(Platform.isDesktopApp ? t('browser.description') : t('browser.mobile'))
		.addButton((button) =>
			button
				.setIcon('globe')
				.setTooltip(t('browser.open'))
				.onClick(() => {
					void plugin.openBrowser({});
				}),
		);
	new Setting(container).setName(t('browser.searchEngine')).addDropdown((dropdown) =>
		dropdown
			.addOptions({ google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo' })
			.setValue(plugin.settings.browser.searchEngine)
			.onChange(async (value) => {
				plugin.settings.browser.searchEngine = value as SearchEngine;
				await plugin.saveSettings();
			}),
	);
	if (Platform.isDesktopApp)
		new Setting(container)
			.setName(t('browser.connection'))
			.setDesc(t('browser.connectionHint'))
			.addButton((button) =>
				button.setButtonText(t('browser.copyConnection')).onClick(async () => {
					try {
						plugin.browserHost.copyText(await plugin.browserHost.connectionCommand());
						new Notice(t('browser.copied'));
					} catch (error) {
						new Notice(browserError(error));
					}
				}),
			);
}
