import { bindLocalizedControl } from '../../../ui/primitives/localized-dom';
import { Modal, Notice, Setting, type App } from 'obsidian';
import type { AutomationDefinition } from '../../../shared/automation/types';
import { t } from '../../../shared/i18n';

export function pinActionModal(
	app: App,
	definition: AutomationDefinition,
	paths: string[],
	pin: (path: string) => Promise<void>,
): void {
	const modal = new Modal(app);
	let selected = paths[0] ?? '',
		saving = false;
	bindLocalizedControl(new Setting(modal.contentEl)
		.setName(t('automation.pin')), "name", 'automation.pin')
		.setDesc(definition.name)
		.addDropdown((input) => {
			for (const path of paths) input.addOption(path, path);
			input.setValue(selected).onChange((path) => {
				selected = path;
			});
		});
	new Setting(modal.contentEl).addButton((button) =>
		bindLocalizedControl(button
			.setButtonText(t('common.save')), "buttonText", 'common.save')
			.setCta()
			.setDisabled(!selected)
			.onClick(() => {
				if (saving) return;
				saving = true;
				void pin(selected)
					.then(() => modal.close())
					.catch((error) => new Notice(String(error)))
					.finally(() => {
						saving = false;
					});
			}),
	);
	modal.open();
}
