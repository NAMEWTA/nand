import { PluginSettingTab, Setting, type App, type SettingDefinitionItem } from 'obsidian';
import { t } from '../../shared/i18n/index';
import type DashboardPlugin from '../main';

/**
 * Obsidian's settings tab: an entry point to the full
 * settings inside the NAND workbench. Product settings render only in the workbench settings page.
 */
export class NandSettingTab extends PluginSettingTab {
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
				],
			},
		];
	}
}
