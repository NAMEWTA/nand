import type { TextComponent, ToggleComponent } from 'obsidian';
import type { SettingsPageHost } from '../../../app/contracts/module';
import type { SettingsHandle } from '../../../shared/settings/store';
import { t } from '../../../shared/i18n';
import { bindLocalizedControl, setLocalizedText } from '../../../ui/primitives/localized-dom';
import { favoriteFolder, editionFolder, newsFolder } from '../core/note-folders';
import { saveAnalysisSettings } from '../services/analysis-settings';
import type { NewsSettings } from '../settings';
import { sourceSetting } from './source-settings';

export function storageSettings(container: HTMLElement, handle: SettingsHandle<NewsSettings>, host: SettingsPageHost): void {
	let alive = true;
	host.keep(() => { alive = false; });
	const details = container.createEl('details', { cls: 'nand-news-analysis-settings' });
	setLocalizedText(details.createEl('summary'), 'news.settings.storage');
	setLocalizedText(details.createEl('p'), 'news.settings.storageHelp');
	let retention!: TextComponent, favorite!: TextComponent, edition!: TextComponent, adaptive!: ToggleComponent;
	sourceSetting(details, 'news.settings.retentionDays').addText(input => {
		retention = input; input.inputEl.type = 'number'; input.inputEl.min = '1'; input.inputEl.max = '365'; input.inputEl.step = '1'; input.setValue(String(handle.get().retentionDays ?? 30));
	});
	sourceSetting(details, 'news.settings.adaptiveInterval').addToggle(toggle => { adaptive = toggle; toggle.setValue(handle.get().adaptiveInterval !== false); });
	sourceSetting(details, 'news.settings.favoriteFolder').addText(input => { favorite = input; input.setValue(favoriteFolder(handle.get())); });
	sourceSetting(details, 'news.settings.editionFolder').addText(input => { edition = input; input.setValue(editionFolder(handle.get())); });
	const status = details.createEl('p', { attr: { role: 'status' } });
	sourceSetting(details, 'news.settings.save').addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.save')), 'buttonText', 'news.settings.save').onClick(async () => {
		const days = Number(retention.getValue()), favoritePath = newsFolder(favorite.getValue()), editionPath = newsFolder(edition.getValue());
		if (!Number.isInteger(days) || days < 1 || days > 365) { setLocalizedText(status, 'news.settings.invalidRule', { name: t('news.settings.retentionDays'), min: 1, max: 365 }); retention.inputEl.focus(); return; }
		if (!favoritePath || !editionPath) { setLocalizedText(status, 'news.settings.invalidFolder'); (!favoritePath ? favorite : edition).inputEl.focus(); return; }
		try {
			await saveAnalysisSettings(handle, draft => { draft.retentionDays = days; draft.adaptiveInterval = adaptive.getValue(); draft.favoriteFolder = favoritePath; draft.editionFolder = editionPath; });
			if (alive) { favorite.setValue(favoritePath); edition.setValue(editionPath); setLocalizedText(status, 'news.settings.saved'); }
		} catch { if (alive) setLocalizedText(status, 'news.settings.saveFailed'); }
	}));
}
