import { Setting } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import { WidgetBackgroundModal } from '../widgets/widget-background';
import type { BoardSettingsTab } from './board-settings-tab';

/** Shared background row for the singleton widget cards: opens the
 *  background modal and writes the result straight into one of the
 *  *Background settings keys (undefined = removed). */
export function renderWidgetBackgroundSetting(
	this: BoardSettingsTab,
	containerEl: HTMLElement,
	key:
		| 'quickActionsBackground'
		| 'pomodoroBackground'
		| 'habitBackground'
		| 'musicBackground'
		| 'yearProgressBackground',
): void {
	new Setting(containerEl)
		.setName(t('wbg.set'))
		.setDesc(this.plugin.settings[key]?.image ?? '')
		.addExtraButton((btn) =>
			btn
				.setIcon('image')
				.setTooltip(t('wbg.title'))
				.onClick(() => {
					new WidgetBackgroundModal(this.app, this.plugin.settings[key], (bg) => {
						this.plugin.settings = { ...this.plugin.settings, [key]: bg };
						void this.plugin.saveSettings();
						this.plugin.refreshAllDashboards();
						this.refresh();
					}).open();
				}),
		);
}
