import { Notice, Setting, setIcon } from 'obsidian';
import { t } from '../../shared/i18n';
import type { DashboardSettingTab } from './settings-tab';

/** Home is the first settings product. Its only job is to start or stop the others. */
export function renderHomeSettings(this: DashboardSettingTab, containerEl: HTMLElement): void {
	containerEl.addClass('nand-home-settings');
	const modules = this.plugin.settings.modules;
	const rows: Array<{ key: 'dashboard' | 'editor' | 'terminal' | 'iconic' | 'contacts'; name: string; desc: string }> = [
		{ key: 'dashboard', name: t('modules.dashboard'), desc: t('modules.dashboardDesc') },
		{ key: 'editor', name: t('modules.editor'), desc: t('modules.editorDesc') },
		{ key: 'terminal', name: t('modules.terminal'), desc: t('modules.terminalDesc') },
		{ key: 'iconic', name: t('modules.iconic'), desc: t('modules.iconicDesc') },
		{ key: 'contacts', name: t('contacts.title'), desc: t('contacts.description') },
	];
	for (const row of rows) {
		const setting = new Setting(containerEl)
			.setName(row.name)
			.setDesc(row.desc)
			.addToggle((toggle) => {
				toggle.setValue(modules[row.key]).onChange(async (value) => {
					toggle.setDisabled(true);
					try {
						this.plugin.settings.modules = { ...this.plugin.settings.modules, [row.key]: value };
						await this.plugin.saveSettings();
						await this.plugin.applyModuleFlags();
						if (this.activeProduct !== 'home') {
							this.activeProduct = 'home';
							this.activePage = 'home';
						}
						this.refresh();
					} catch {
						new Notice(t('modules.changeFailed'));
					} finally {
						toggle.setDisabled(false);
					}
				});
			});
		const icon = setting.settingEl.createDiv({ cls: 'nand-home-module-icon', attr: { 'aria-hidden': 'true' } });
		setIcon(icon, row.key === 'contacts' ? 'contact-round' : row.key === 'dashboard' ? 'layout-dashboard' : row.key === 'editor' ? 'pen-line' : row.key === 'iconic' ? 'images' : 'terminal');
	}
	new Setting(containerEl).setName(t('modules.sync')).setDesc(t('modules.syncDesc'));
}
