import { Setting } from 'obsidian';
import type DashboardPlugin from '../main';
import { t } from '../../shared/i18n';

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
	new Setting(el).setName(t('automation.channels')).setDesc(t('automation.channelHelp'));
	new Setting(el).setName(t('automation.sessionMode')).setDesc(t('automation.hookHelp'));
}
