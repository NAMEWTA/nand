import type { TextComponent } from 'obsidian';
import type { SettingsPageHost } from '../../../app/contracts/module';
import type { SettingsHandle } from '../../../shared/settings/store';
import { t } from '../../../shared/i18n';
import { bindLocalizedControl, setLocalizedText } from '../../../ui/primitives/localized-dom';
import { EDITION_FIELDS, HEAT_FIELDS, GROUPING_FIELDS } from '../core/editorial-rules';
import { saveAnalysisSettings } from '../services/analysis-settings';
import type { NewsSettings } from '../settings';
import { sourceSetting } from './source-settings';

export function editorialSettings(container: HTMLElement, handle: SettingsHandle<NewsSettings>, host: SettingsPageHost): void {
	let alive = true;
	host.keep(() => { alive = false; });
	for (const [group, fields] of [['heatRules', HEAT_FIELDS], ['editionRules', EDITION_FIELDS], ['groupingRules', GROUPING_FIELDS]] as const) {
		const details = container.createEl('details', { cls: 'nand-news-analysis-settings' });
		setLocalizedText(details.createEl('summary'), `news.settings.${group}`);
		setLocalizedText(details.createEl('p'), group === 'groupingRules' ? 'news.settings.groupingRulesHelp' : 'news.settings.localRulesHelp');
		const inputs = new Map<string, TextComponent>();
		const current: Readonly<Record<string, number>> = handle.get()[group] ?? {};
		for (const [key, fallback, min, max] of fields) sourceSetting(details, `news.rules.${key}`).addText(input => {
			input.inputEl.type = 'number'; input.inputEl.min = String(min); input.inputEl.max = String(max); input.inputEl.step = '1';
			input.setValue(String(current[key] ?? fallback)); inputs.set(key, input);
		});
		const status = details.createEl('p', { attr: { role: 'status' } });
		const save = async (reset: boolean): Promise<void> => {
			const values: Record<string, number> = {};
			for (const [key, fallback, min, max] of fields) {
				const text = inputs.get(key)!.getValue(), value = reset ? fallback : Number(text);
				if (!reset && (!text.trim() || !Number.isInteger(value) || value < min || value > max)) {
					setLocalizedText(status, 'news.settings.invalidRule', { name: t(`news.rules.${key}`), min, max });
					inputs.get(key)!.inputEl.focus(); return;
				}
				values[key] = value;
			}
			try {
				await saveAnalysisSettings(handle, draft => { Object.assign(draft, { [group]: values }); });
				if (!alive) return;
				for (const [key, input] of inputs) input.setValue(String(values[key]));
				setLocalizedText(status, 'news.settings.saved');
			} catch { if (alive) setLocalizedText(status, 'news.settings.saveFailed'); }
		};
		const buttons = sourceSetting(details, 'news.settings.save');
		buttons.addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.save')), 'buttonText', 'news.settings.save').onClick(() => save(false)));
		buttons.addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.resetRules')), 'buttonText', 'news.settings.resetRules').onClick(() => save(true)));
	}
}
