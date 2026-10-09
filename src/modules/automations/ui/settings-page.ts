import { Setting } from 'obsidian';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n/index';

/** The automations page in workbench settings: where tasks and results live, and how automations run. */
export const automationsSettingsPage = (open: { tasks(): void; inbox(): void }): SettingsPageRenderer => (el) => {
	new Setting(el).setName(t('automation.title')).setDesc(t('automation.localOnly')).addButton((button) =>
		button.setButtonText(t('automation.open')).onClick(() => open.tasks()),
	);
	new Setting(el)
		.setName(t('automation.inbox'))
		.addButton((button) => button.setButtonText(t('automation.open')).onClick(() => open.inbox()));
	new Setting(el).setName(t('automation.help')).setHeading();
	el.createEl('p', { text: t('automation.configureHelp'), cls: 'setting-item-description' });
	el.createEl('h4', { text: t('automation.channels') });
	el.createEl('p', { text: t('automation.channelHelp'), cls: 'setting-item-description' });
	el.createEl('h4', { text: t('automation.sessionMode') });
	el.createEl('p', { text: t('automation.sessionHelp'), cls: 'setting-item-description' });
	el.createEl('p', { text: t('automation.hookHelp'), cls: 'setting-item-description' });
};
