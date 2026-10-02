import { Notice, Setting, setIcon } from 'obsidian';
import { t } from '../../shared/i18n/index';
import { normalizeLanguage } from './language';
import type { DashboardSettingTab } from './settings-tab';

/** Global preferences remain available even when every product is disabled. */
export function renderHomeSettings(this: DashboardSettingTab, containerEl: HTMLElement): void {
	containerEl.addClass('nand-home-settings');
	new Setting(containerEl).setName(t('settings.homeGeneral')).setHeading();
	new Setting(containerEl)
		.setName(t('settings.language'))
		.setDesc(t('settings.languageDesc'))
		.addDropdown((dropdown) => {
			dropdown.selectEl.dataset.nandLanguage = 'true';
			dropdown.addOptions({ zh: t('settings.languageZh'), en: t('settings.languageEn') })
				.setValue(this.plugin.settings.language)
				.onChange(async (value) => {
					dropdown.setDisabled(true);
					try {
						await this.plugin.changeLanguage(normalizeLanguage(value));
						this.refresh();
						this.containerEl.querySelector<HTMLSelectElement>('[data-nand-language]')?.focus();
					} catch {
						dropdown.setValue(this.plugin.settings.language);
						new Notice(t('settings.writeFailed'));
					} finally {
						dropdown.setDisabled(false);
					}
				});
		});
	new Setting(containerEl).setName(t('settings.homeModules')).setHeading();
	const modules = this.plugin.settings.modules;
	const rows: Array<{
		key: 'dashboard' | 'browser' | 'editor' | 'terminal' | 'iconic' | 'contacts' | 'automation';
		name: string;
		desc: string;
	}> = [
		{ key: 'browser', name: t('browser.title'), desc: t('browser.description') },
		{ key: 'dashboard', name: t('modules.dashboard'), desc: t('modules.dashboardDesc') },
		{ key: 'editor', name: t('modules.editor'), desc: t('modules.editorDesc') },
		{ key: 'terminal', name: t('modules.terminal'), desc: t('modules.terminalDesc') },
		{ key: 'iconic', name: t('modules.iconic'), desc: t('modules.iconicDesc') },
		{ key: 'contacts', name: t('contacts.title'), desc: t('contacts.description') },
		{ key: 'automation', name: t('automation.title'), desc: t('modules.automationDesc') },
	];
	for (const row of rows) {
		const setting = new Setting(containerEl)
			.setName(row.name)
			.setDesc(row.desc)
			.addToggle((toggle) => {
				toggle.setValue(modules[row.key]).onChange(async (value) => {
					toggle.setDisabled(true);
					const previous = this.plugin.settings.modules[row.key];
					let saved = false;
					try {
						this.plugin.settings.modules = { ...this.plugin.settings.modules, [row.key]: value };
						await this.plugin.saveSettings();
						saved = true;
						await this.plugin.applyModuleFlags();
						if (this.activeProduct !== 'home') {
							this.activeProduct = 'home';
							this.activePage = 'home';
						}
						this.refresh();
					} catch {
						if (!saved) this.plugin.settings.modules[row.key] = previous;
						toggle.setValue(this.plugin.settings.modules[row.key]);
						new Notice(t('modules.changeFailed'));
					} finally {
						toggle.setDisabled(false);
					}
				});
			});
		const icon = setting.settingEl.createDiv({ cls: 'nand-home-module-icon', attr: { 'aria-hidden': 'true' } });
		setIcon(
			icon,
			row.key === 'browser'
				? 'globe'
				: row.key === 'automation'
					? 'timer'
					: row.key === 'contacts'
						? 'contact-round'
						: row.key === 'dashboard'
							? 'layout-dashboard'
							: row.key === 'editor'
								? 'pen-line'
								: row.key === 'iconic'
									? 'images'
									: 'terminal',
		);
	}
	new Setting(containerEl).setName(t('modules.sync')).setDesc(t('modules.syncDesc'));
}
