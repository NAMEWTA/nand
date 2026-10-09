import { PluginSettingTab, Setting, type App, type SettingDefinitionItem } from 'obsidian';
import { t } from '../../shared/i18n/index';
import type DashboardPlugin from '../main';
import { renderHomeSettings, type HomeSettingsHost } from './home';

/**
 * Obsidian's settings tab: a short entry point (language, appearance, modules) and a link to the full
 * settings inside the NAND workbench. Product settings render only in the workbench settings page.
 */
export class NandSettingTab extends PluginSettingTab implements HomeSettingsHost {
	private readonly subscriptions = new Map<string, () => void>();

	constructor(app: App, readonly plugin: DashboardPlugin) {
		super(app, plugin);
	}

	keepSubscription(key: string, off: () => void): void {
		this.subscriptions.get(key)?.();
		this.subscriptions.set(key, off);
	}

	override hide(): void {
		for (const off of this.subscriptions.values()) off();
		this.subscriptions.clear();
		super.hide();
	}

	refresh(): void {
		(this as unknown as { update?: () => void }).update?.();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				items: [
					{
						name: t('settings.openWorkbenchSettings'),
						desc: t('settings.openWorkbenchSettingsDesc'),
						render: (setting: Setting) => {
							setting.setName(t('settings.openWorkbenchSettings')).setDesc(t('settings.openWorkbenchSettingsDesc'));
							setting.addButton((button) => button.setButtonText(t('settings.openWorkbenchSettingsButton')).setCta().onClick(() => {
								void this.plugin.openWorkbenchSettings().catch((error: unknown) => console.error('[NAND settings]', error));
							}));
						},
					},
					{
						name: t('settings.productHome'),
						desc: t('settings.homeDesc'),
						aliases: [t('workbench.statusSetting'), t('settings.language'), t('settings.homeGeneral'), t('settings.homeModules'), t('appearance.title')],
						render: (setting: Setting) => {
							setting.settingEl.addClass('dashboard-settings-section');
							setting.settingEl.empty();
							renderHomeSettings.call(this, setting.settingEl);
						},
					},
				],
			},
		];
	}
}
