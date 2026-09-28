import { Setting } from 'obsidian';
import { t } from '../../shared/i18n/index';
import type DashboardPlugin from '../main';

export function renderAutomationSettings(plugin: DashboardPlugin, el: HTMLElement): void {
	new Setting(el).setName(t('automation.title')).setDesc(t('automation.localOnly')).setHeading();
	new Setting(el).setName(t('automation.title')).addButton((button) =>
		button.setButtonText(t('automation.open')).onClick(() => {
			void plugin.automationHost?.open();
		}),
	);
	new Setting(el)
		.setName(t('automation.inbox'))
		.addButton((button) =>
			button.setButtonText(t('automation.open')).onClick(() => plugin.automationHost?.inbox()),
		);
	el.createEl('h4', { text: t('automation.channels') });
	el.createEl('p', { text: t('automation.channelHelp'), cls: 'setting-item-description' });
	el.createEl('h4', { text: t('automation.sessionMode') });
	el.createEl('p', { text: t('automation.hookHelp'), cls: 'setting-item-description' });
}
