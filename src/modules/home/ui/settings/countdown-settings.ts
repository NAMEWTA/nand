import { Setting } from 'obsidian';
import { resolveWidgetLabel } from '../../core/board/default-widget-label';
import type { CountdownConfig } from '../../core/board/types/index';
import { t } from '../../../../shared/i18n/index';
import { CountdownSettingsModal } from '../widgets/countdown-modal';
import type { BoardSettingsTab } from './board-settings-tab';

export function renderCountdownList(this: BoardSettingsTab, containerEl: HTMLElement): void {
	const list = this.plugin.settings.countdowns ?? [];

	for (const cd of list) {
		const summary = resolveWidgetLabel(cd, 'countdown') || cd.targetDate || t('countdown.untitled');
		new Setting(containerEl)
			.setName(summary)
			.setDesc(
				cd.targetDate ? `${cd.targetDate} · ${t(`countdown.${cd.displayMode}`)}` : t('countdown.setTarget'),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon('pencil')
					.setTooltip(t('common.edit'))
					.onClick(() => this.editCountdown(cd)),
			)
			.addExtraButton((btn) =>
				btn
					.setIcon('trash-2')
					.setTooltip(t('common.delete'))
					.onClick(async () => {
						this.plugin.settings = {
							...this.plugin.settings,
							countdowns: list.filter((c) => c.id !== cd.id),
						};
						await this.plugin.saveSettings();
						this.plugin.refreshAllDashboards();
						this.refresh();
					}),
			);
	}

	new Setting(containerEl).addButton((btn) =>
		btn
			.setButtonText(t('countdown.add'))
			.setIcon('plus')
			.onClick(() => this.editCountdown(null)),
	);
}

export function editCountdown(this: BoardSettingsTab, existing: CountdownConfig | null): void {
	const baseline: CountdownConfig = existing ?? {
		id: `cd-${Date.now()}`,
		label: '',
		targetDate: '',
		displayMode: 'days',
		reminderDays: 0,
	};
	const modal = new CountdownSettingsModal(this.app, baseline, (updated) => {
		void this.applyCountdownUpdate(updated);
	});
	modal.open();
}

export async function applyCountdownUpdate(this: BoardSettingsTab, updated: CountdownConfig): Promise<void> {
	const current = this.plugin.settings.countdowns ?? [];
	const exists = current.some((c) => c.id === updated.id);
	this.plugin.settings = {
		...this.plugin.settings,
		countdowns: exists ? current.map((c) => (c.id === updated.id ? updated : c)) : [...current, updated],
	};
	await this.plugin.saveSettings();
	this.plugin.refreshAllDashboards();
	this.refresh();
}
