import type { TextComponent } from 'obsidian';
import type { SettingsPageHost } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import { bindLocalizedControl, bindLocalizedOptions, setLocalizedAttribute, setLocalizedText } from '../../../ui/primitives/localized-dom';
import type { AgentId } from '../../agent/api';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, ITEM_TYPES, SCORE_KEYS, validWeights } from '../core/scoring';
import type { NewsActions } from '../services/news-actions';
import type { NewsSettings } from '../settings';
import { sourceSetting } from './source-settings';
import { promptSettings } from './prompt-settings';
import { saveAnalysisSettings } from '../services/analysis-settings';

/** Draft tables/templates commit explicitly, without requesting a model or reanalyzing old items. */
export function analysisSettings(container: HTMLElement, handle: SettingsHandle<NewsSettings>, actions: NewsActions, host: SettingsPageHost): void {
	let alive = true;
	host.keep(() => { alive = false; });
	const status = container.createEl('p', { attr: { role: 'status' } });
	const update = async (recipe: (settings: NewsSettings) => void): Promise<void> => {
		try { await saveAnalysisSettings(handle, recipe); if (alive) setLocalizedText(status, 'news.settings.saved'); }
		catch { if (alive) setLocalizedText(status, 'news.settings.saveFailed'); }
	};
	const agentRow = sourceSetting(container, 'news.settings.agent');
	const agents = actions.agents().filter(agent => agent.enabled && agent.installed);
	agentRow.addDropdown(control => {
		control.addOption('', t('news.settings.firstAgent'));
		for (const agent of agents) control.addOption(agent.id, agent.title);
		const selected = handle.get().agentId ?? '';
		if (selected && !agents.some(agent => agent.id === selected)) control.addOption(selected, selected);
		control.setValue(selected).onChange(value => update(settings => { settings.agentId = value as AgentId | ''; }));
		bindLocalizedOptions(control, { '': ['news.settings.firstAgent'] });
	});
	if (!agents.length) bindLocalizedControl(agentRow.setDesc(t('news.settings.agentUnavailable')), 'desc', 'news.settings.agentUnavailable');
	sourceSetting(container, 'news.settings.cwd').addText(input => input.setValue(handle.get().cwd ?? '').onChange(value => update(settings => { settings.cwd = value.trim(); })));
	sourceSetting(container, 'news.settings.interest').addTextArea(input => input.setValue(handle.get().interest).onChange(value => update(settings => { settings.interest = value; })));
	for (const [key, fallback, min, max] of [['dailyCallLimit', 20, 0, 1000], ['batchSize', 12, 1, 12], ['bodyLimit', 1500, 100, 10000], ['batchTimeoutMinutes', 10, 1, 120], ['understandFloor', 50, 0, 100]] as const) {
		sourceSetting(container, `news.settings.${key}`).addText(input => {
			input.inputEl.type = 'number'; input.inputEl.min = String(min); input.inputEl.max = String(max); input.inputEl.step = '1';
			input.setValue(String(handle.get()[key] ?? fallback)).onChange(value => {
				const next = Number(value);
				if (!value.trim() || !Number.isInteger(next) || next < min || next > max) return;
				void update(settings => { settings[key] = next; });
			});
		});
	}
	sourceSetting(container, 'news.settings.keepTerminal').addToggle(control => control.setValue(handle.get().keepTerminal === true).onChange(value => update(settings => { settings.keepTerminal = value; })));
	sourceSetting(container, 'news.settings.doubleScore').addToggle(control => control.setValue(handle.get().doubleScore === true).onChange(value => update(settings => { settings.doubleScore = value; })));
	const advanced = container.createEl('details', { cls: 'nand-news-analysis-settings' });
	setLocalizedText(advanced.createEl('summary'), 'news.settings.scoring');
	setLocalizedText(advanced.createEl('p'), 'news.settings.weightsHelp');
	const weights = structuredClone(handle.get().weights ?? DEFAULT_WEIGHTS);
	const weightControls: { input: TextComponent; type: typeof ITEM_TYPES[number]; key: typeof SCORE_KEYS[number] }[] = [];
	for (const type of ITEM_TYPES) {
		const row = sourceSetting(advanced, `news.type.${type}`);
		row.settingEl.addClass('nand-news-weight-row');
		for (const key of SCORE_KEYS) row.addText(input => {
			const label = row.controlEl.createEl('label', { cls: 'nand-ui-field' });
			setLocalizedText(label.createSpan(), `news.axis.${key}`);
			label.appendChild(input.inputEl);
			input.inputEl.type = 'number'; input.inputEl.min = '0'; input.inputEl.max = '10'; input.inputEl.step = '1';
			setLocalizedAttribute(input.inputEl, 'aria-label', `news.axis.${key}`);
			setLocalizedAttribute(input.inputEl, 'title', `news.axis.${key}`);
			input.setValue(String(weights[type][key])).onChange(value => { weights[type][key] = value.trim() ? Number(value) : NaN; });
			weightControls.push({ input, type, key });
		});
	}
	const thresholds = { ...(handle.get().thresholds ?? DEFAULT_THRESHOLDS) };
	for (const key of ['T1', 'T1_5', 'T2'] as const) sourceSetting(advanced, `news.source.tier.${key}`).addText(input => {
		input.inputEl.type = 'number'; input.inputEl.min = '0'; input.inputEl.max = '100'; input.inputEl.step = '1';
		input.setValue(String(thresholds[key])).onChange(value => { thresholds[key] = value.trim() ? Number(value) : NaN; });
	});
	sourceSetting(advanced, 'news.settings.weights').addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.save')), 'buttonText', 'news.settings.save').onClick(async () => {
		if (!validWeights(weights) || Object.values(thresholds).some(value => !Number.isInteger(value) || value < 0 || value > 100)) { setLocalizedText(status, 'news.settings.weightsInvalid'); return; }
		await update(settings => { settings.weights = structuredClone(weights); settings.thresholds = { ...thresholds }; });
	})).addButton(button => bindLocalizedControl(button.setButtonText(t('news.settings.resetWeights')), 'buttonText', 'news.settings.resetWeights').onClick(async () => {
		Object.assign(weights, structuredClone(DEFAULT_WEIGHTS));
		for (const { input, type, key } of weightControls) input.setValue(String(weights[type][key]));
		await update(settings => { settings.weights = structuredClone(weights); });
	}));
	promptSettings(container, handle, host);
}
