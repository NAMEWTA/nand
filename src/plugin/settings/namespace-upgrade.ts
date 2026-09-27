import { PluginSettingTab, Setting } from 'obsidian';
import { t } from '../../shared/i18n';

/** Read-only recovery entry. Never merges defaults into an unmigrated store. */
export class NamespaceUpgradeTab extends PluginSettingTab {
	display(): void {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(t('namespace.title')).setDesc(t('namespace.instructions'));
	}
	getSettingDefinitions() {
		return [{ name: t('namespace.title'), desc: t('namespace.instructions') }];
	}
}
