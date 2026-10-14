import { Notice, Platform, Setting } from 'obsidian';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { BrowserOpener } from '../api';
import type { BrowserSettings, SearchEngine } from '../core/model';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import { profileSettings } from './profile-settings';

/** Settings → Browser: search engine and browser profiles. */
export function browserSettingsPage(current: () => BrowserModule, settings: SettingsHandle<BrowserSettings>, opener: BrowserOpener): SettingsPageRenderer {
	const save = (recipe: (draft: BrowserSettings) => void) => { void settings.update(recipe).catch((error: unknown) => new Notice(browserError(error))); };
	return (container, page) => {
		new Setting(container)
			.setName(t('browser.open'))
			.setDesc(Platform.isDesktopApp ? t('browser.description') : t('browser.mobile'))
			.addButton((button) => button.setIcon('globe').setTooltip(t('browser.open')).onClick(() => { void opener.show({}); }));
		new Setting(container).setName(t('browser.searchEngine')).addDropdown((dropdown) =>
			dropdown
				.addOptions({ google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo' })
				.setValue(settings.get().searchEngine)
				.onChange((value) => save((draft) => { draft.searchEngine = value as SearchEngine; })),
		);
		if (!Platform.isDesktopApp) return;
		profileSettings(container, current(), page);
	};
}
