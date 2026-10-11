import { Notice, Setting, setIcon } from 'obsidian';
import { bindLocalizedControl } from '../../ui/primitives/localized-dom';
import { t } from '../../shared/i18n/index';
import { normalizeLanguage } from './language';
import { appearancePage, themePresetSection } from './appearance';
import { renderNativeSettingsPage } from './native-form';
import type DashboardPlugin from '../main';

/** What the Home settings renderers need from the tab (or workbench page) showing them. */
export interface HomeSettingsHost {
	plugin: DashboardPlugin;
	containerEl: HTMLElement;
	refresh(): void;
	keepSubscription(key: string, off: () => void): void;
}

/** Obsidian's settings tab: global preferences, the theme preset and module switches (the rest lives in the workbench). */
export function renderHomeSettings(this: HomeSettingsHost, containerEl: HTMLElement): void {
	containerEl.addClass('nand-home-settings');
	renderPreferences.call(this, containerEl);
	renderThemePreset.call(this, containerEl);
	renderModuleToggles.call(this, containerEl);
}

/** Only the theme preset; the full appearance editor is Settings → Appearance in the workbench. */
export function renderThemePreset(this: HomeSettingsHost, containerEl: HTMLElement): void {
	const section = containerEl.createDiv({ cls: 'nand-settings-appearance' });
	const rerender = () => {
		section.empty();
		renderNativeSettingsPage(section, { id: 'theme-preset', titleKey: 'appearance.title', sections: [themePresetSection(this.plugin.theme)] });
	};
	rerender();
	this.keepSubscription('appearance', this.plugin.theme.subscribe(rerender));
}

/** Language and workbench status. */
export function renderPreferences(this: HomeSettingsHost, containerEl: HTMLElement): void {
	new Setting(containerEl).setName(t('settings.homeGeneral')).setHeading();
	new Setting(containerEl)
		.setName(t('settings.language'))
		.setDesc(t('settings.languageDesc'))
		.addDropdown((dropdown) => {
			dropdown.selectEl.dataset.nandLanguage = 'true';
			dropdown.addOptions({ zh: t('settings.languageZh'), en: t('settings.languageEn') })
				.setValue(this.plugin.appSettings.get().language)
				.onChange(async (value) => {
					dropdown.setDisabled(true);
					try {
						await this.plugin.changeLanguage(normalizeLanguage(value));
						this.refresh();
						this.containerEl.querySelector<HTMLSelectElement>('[data-nand-language]')?.focus();
					} catch {
						dropdown.setValue(this.plugin.appSettings.get().language);
						new Notice(t('settings.writeFailed'));
					} finally {
						dropdown.setDisabled(false);
					}
				});
		});
	new Setting(containerEl)
		.setName(t('workbench.statusSetting')).setDesc(t('workbench.statusSettingDesc'))
		.addDropdown((dropdown) => {
			dropdown.addOptions({ automatic: t('workbench.statusAutomatic'), hidden: t('workbench.statusHidden') })
				.setValue(this.plugin.appSettings.get().workbenchStatus ?? 'automatic').onChange(async (value) => {
					const previous = this.plugin.appSettings.get().workbenchStatus;
					dropdown.setDisabled(true);
					try { await this.plugin.appSettings.update((draft) => { draft.workbenchStatus = value === 'hidden' ? 'hidden' : 'automatic'; }); }
					catch { dropdown.setValue(previous ?? 'automatic'); new Notice(t('settings.writeFailed')); }
					finally { dropdown.setDisabled(false); }
				});
		});
}

/** Settings → Appearance (global theme and Markdown styles). */
export function renderAppearanceSection(this: HomeSettingsHost, containerEl: HTMLElement): void {
	const appearance = containerEl.createDiv({ cls: 'nand-settings-appearance' });
	const rerender = () => {
		appearance.empty();
		renderNativeSettingsPage(appearance, appearancePage(this.plugin.theme, navigator.clipboard));
	};
	rerender();
	this.keepSubscription('appearance', this.plugin.theme.subscribe(rerender));
}

/** Module on/off switches, one per module manifest. */
export function renderModuleToggles(this: HomeSettingsHost, containerEl: HTMLElement): void {
	bindLocalizedControl(new Setting(containerEl).setName(t('settings.homeModules')).setHeading(), 'name', 'settings.homeModules');
	for (const manifest of this.plugin.moduleManifests()) {
		const setting = new Setting(containerEl)
			.setName(t(manifest.titleKey))
			.setDesc(t(manifest.descriptionKey))
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.moduleEnabled(manifest.id)).onChange(async (value) => {
					toggle.setDisabled(true);
					try {
						await this.plugin.setModuleEnabled(manifest.id, value);
						this.refresh();
					} catch {
						toggle.setValue(this.plugin.moduleEnabled(manifest.id));
						new Notice(t('modules.changeFailed'));
					} finally {
						toggle.setDisabled(false);
					}
				});
			});
		bindLocalizedControl(setting, 'name', manifest.titleKey);
		bindLocalizedControl(setting, 'desc', manifest.descriptionKey);
		setIcon(setting.settingEl.createDiv({ cls: 'nand-home-module-icon', attr: { 'aria-hidden': 'true' } }), manifest.icon);
	}
}
