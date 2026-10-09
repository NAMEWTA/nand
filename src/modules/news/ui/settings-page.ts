import { Setting } from 'obsidian';
import { t } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { NewsActions } from '../services/news-actions';
import type { NewsSettings } from '../settings';

export function newsSettingsPage(handle: SettingsHandle<NewsSettings>, actions: NewsActions) {
	return (container: HTMLElement) => {
		new Setting(container).setName(t('news.settings.heading')).setHeading();
		new Setting(container).setName(t('news.settings.enabled')).addToggle((toggle) =>
			toggle.setValue(handle.get().enabled).onChange(async (value) => {
				if (value) await actions.enable();
				else await handle.update((settings) => { settings.enabled = false; });
			}),
		);
		new Setting(container).setName(t('news.settings.analysis')).addToggle((toggle) =>
			toggle.setValue(handle.get().analysisEnabled).onChange(async (value) => {
				await handle.update((settings) => { settings.analysisEnabled = value; });
			}),
		);
		const preview = container.createDiv({ cls: 'nand-news-edition' });
		const paintEdition = () => {
			preview.empty();
			const edition = actions.edition();
			if (!edition) return;
			preview.setText(`${t('news.edition')} ${edition.date}`);
		};
		new Setting(container).setName(t('news.settings.daily')).addToggle((toggle) =>
			toggle.setValue(handle.get().dailyEditionEnabled).onChange(async (value) => {
				await handle.update((settings) => { settings.dailyEditionEnabled = value; });
				paintEdition();
			}),
		);
		paintEdition();
		let url = '';
		new Setting(container).setName(t('news.source')).addText((text) => text.onChange((value) => { url = value; })).addButton((button) =>
			button.setButtonText(t('news.addSource')).onClick(async () => {
				const added = await actions.addSource(url);
				if (added) url = '';
			}),
		);
		let opml = '';
		new Setting(container).setName(t('news.opml')).addTextArea((area) => area.onChange((value) => { opml = value; })).addButton((button) =>
			button.setButtonText(t('news.importOpml')).onClick(() => void actions.importOpml(opml)),
		);
		new Setting(container).setName(t('news.analyze')).addButton((button) =>
			button.setButtonText(t('news.analyze')).onClick(async () => {
				await actions.enable();
				await actions.analyze();
			}),
		);
	};
}
