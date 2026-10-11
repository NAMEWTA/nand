import type { TextAreaComponent } from 'obsidian';
import type { SettingsPageHost } from '../../../app/contracts/module';
import type { SettingsHandle } from '../../../shared/settings/store';
import { t } from '../../../shared/i18n';
import { bindLocalizedControl, setLocalizedText } from '../../../ui/primitives/localized-dom';
import { DEFAULT_TEMPLATES, type NewsPromptTemplates } from '../core/prompt-templates';
import { DEFAULT_VOCABULARY, normalizeLanguage, normalizePrefilter, normalizeVocabulary } from '../core/analysis-policy';
import { effectivePromptVersion } from '../core/prompts';
import { saveAnalysisSettings } from '../services/analysis-settings';
import type { NewsSettings } from '../settings';
import { sourceSetting } from './source-settings';

export function promptSettings(container: HTMLElement, handle: SettingsHandle<NewsSettings>, host: SettingsPageHost): void {
	let alive = true, versionRequest = 0;
	host.keep(() => { alive = false; versionRequest++; });
	const status = container.createEl('p', { attr: { role: 'status' } });
	const save = async (recipe: (settings: NewsSettings) => void): Promise<void> => {
		try { await saveAnalysisSettings(handle, recipe); if (alive) setLocalizedText(status, 'news.settings.saved'); }
		catch { if (alive) setLocalizedText(status, 'news.settings.saveFailed'); }
	};
	const lists = (value: string): string[] => [...new Set(value.split('\n').map(item => item.trim()).filter(Boolean))];
	const validList = (values: string[]): boolean => values.length <= 200 && values.every(item => item.length <= 100);
	const prefilter = container.createEl('details', { cls: 'nand-news-analysis-settings' });
	setLocalizedText(prefilter.createEl('summary'), 'news.settings.prefilter');
	setLocalizedText(prefilter.createEl('p'), 'news.settings.prefilterHelp');
	const filter = normalizePrefilter(handle.get().prefilter);
	for (const key of ['blockedTerms', 'languages'] as const) sourceSetting(prefilter, `news.settings.${key}`).addTextArea(input => input.setValue(filter[key].join('\n')).onChange(value => { filter[key] = lists(value); }));
	sourceSetting(prefilter, 'news.settings.minCharacters').addText(input => {
		input.inputEl.type = 'number'; input.inputEl.min = '0'; input.inputEl.max = '10000'; input.inputEl.step = '1';
		input.setValue(String(filter.minCharacters)).onChange(value => { filter.minCharacters = value.trim() ? Number(value) : NaN; });
	});
	sourceSetting(prefilter, 'news.settings.prefilter').addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.save')), 'buttonText', 'news.settings.save').onClick(async () => {
		if (!validList(filter.blockedTerms) || !validList(filter.languages) || filter.languages.some(value => !normalizeLanguage(value)) || !Number.isInteger(filter.minCharacters) || filter.minCharacters < 0 || filter.minCharacters > 10000) { setLocalizedText(status, 'news.settings.prefilterInvalid'); return; }
		await save(settings => { settings.prefilter = normalizePrefilter(filter); });
	}));
	const vocabulary = container.createEl('details', { cls: 'nand-news-analysis-settings' });
	setLocalizedText(vocabulary.createEl('summary'), 'news.settings.vocabulary');
	setLocalizedText(vocabulary.createEl('p'), 'news.settings.vocabularyHelp');
	const words = normalizeVocabulary(handle.get().vocabulary);
	const wordControls: { key: keyof typeof words; input: TextAreaComponent }[] = [];
	for (const key of ['categories', 'topics', 'entities'] as const) sourceSetting(vocabulary, `news.settings.${key}`).addTextArea(input => {
		input.setValue(words[key].join('\n')).onChange(value => { words[key] = lists(value); });
		wordControls.push({ key, input });
	});
	sourceSetting(vocabulary, 'news.settings.vocabulary').addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.save')), 'buttonText', 'news.settings.save').onClick(async () => {
		if (!words.categories.length || !Object.values(words).every(validList) || [...words.topics, ...words.entities].some(word => words.categories.includes(word))) { setLocalizedText(status, 'news.settings.vocabularyInvalid'); return; }
		await save(settings => { settings.vocabulary = structuredClone(words); });
	})).addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.resetVocabulary')), 'buttonText', 'news.settings.resetVocabulary').onClick(async () => {
		Object.assign(words, structuredClone(DEFAULT_VOCABULARY));
		for (const { key, input } of wordControls) input.setValue(words[key].join('\n'));
		await save(settings => { settings.vocabulary = structuredClone(words); });
	}));
	const templates = container.createEl('details', { cls: 'nand-news-analysis-settings' });
	setLocalizedText(templates.createEl('summary'), 'news.settings.templates');
	const version = templates.createEl('p', { cls: 'nand-news-prompt-version' });
	const refreshVersion = async (): Promise<void> => {
		const request = ++versionRequest;
		try { const hash = await effectivePromptVersion(handle.get()); if (alive && request === versionRequest) setLocalizedText(version, 'news.settings.promptVersion', { hash }); }
		catch { if (alive && request === versionRequest) setLocalizedText(version, 'news.settings.templateInvalid'); }
	};
	host.keep(handle.subscribe(() => { void refreshVersion(); }));
	void refreshVersion();
	const draft = { ...(handle.get().templates ?? DEFAULT_TEMPLATES) };
	const templateControls: { key: keyof NewsPromptTemplates; input: TextAreaComponent }[] = [];
	for (const key of ['scoring', 'writing', 'grouping', 'brief'] as const) sourceSetting(templates, `news.template.${key}`).addTextArea(input => {
		input.setValue(draft[key]).onChange(value => { draft[key] = value; });
		templateControls.push({ key, input });
	});
	sourceSetting(templates, 'news.settings.templates').addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.save')), 'buttonText', 'news.settings.save').onClick(async () => {
		try { await effectivePromptVersion({ ...handle.get(), templates: draft }); }
		catch { if (alive) setLocalizedText(status, 'news.settings.templateInvalid'); return; }
		if (alive) await save(settings => { settings.templates = { ...draft }; });
	})).addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.resetTemplates')), 'buttonText', 'news.settings.resetTemplates').onClick(async () => {
		Object.assign(draft, DEFAULT_TEMPLATES);
		for (const { key, input } of templateControls) input.setValue(draft[key]);
		await save(settings => { settings.templates = { ...draft }; });
	}));
}
