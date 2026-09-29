import { FuzzySuggestModal, Notice, Setting, TFolder, type App } from 'obsidian';
import { validContactsFolder } from '../../shared/contacts-settings';
import { confirm, ct, errorText } from '../../view/contacts/forms';
import type { DashboardSettingTab } from './settings-tab';

class ArchiveFolderPicker extends FuzzySuggestModal<TFolder> {
	constructor(
		app: App,
		private done: (path: string) => void,
	) {
		super(app);
		this.setPlaceholder(ct('folder'));
	}
	getItems(): TFolder[] {
		return this.app.vault
			.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder && validContactsFolder(file.path));
	}
	getItemText(folder: TFolder): string {
		return folder.path;
	}
	onChooseItem(folder: TFolder): void {
		this.done(folder.path);
	}
}
export function renderContactsSettings(this: DashboardSettingTab, host: HTMLElement): void {
	new Setting(host).setName(ct('storage')).setHeading();
	let candidate = this.plugin.settings.contacts.rootFolder;
	const setting = new Setting(host).setName(ct('folder')).setDesc(ct('folderHint'));
	setting.settingEl.addClass('nand-contacts-folder-setting');
	setting.addText((input) => {
		input.setValue(candidate).onChange((value) => {
			candidate = value.trim().replace(/\\/g, '/').replace(/\/$/, '');
		});
		setting.addButton((b) =>
			b.setButtonText(ct('browse')).onClick(() =>
				new ArchiveFolderPicker(this.app, (path) => {
					candidate = path;
					input.setValue(path);
				}).open(),
			),
		);
	});
	setting.addButton((button) =>
		button.setButtonText(ct('preview')).onClick(async () => {
			button.setDisabled(true);
			try {
				if (!validContactsFolder(candidate)) {
					new Notice(ct('invalidFolder'));
					return;
				}
				const controller = this.plugin.contactsHost;
				if (!controller) return;
				const root = candidate;
				const count = await controller.countFolder(root);
				if (!(await confirm(this.app, ct('folderPreview', { folder: root, count }), ct('apply')))) return;
				await controller.queue.settled();
				const previous = this.plugin.settings.contacts.rootFolder;
				this.plugin.settings.contacts.rootFolder = root;
				try {
					await this.plugin.saveSettings();
				} catch (error) {
					this.plugin.settings.contacts.rootFolder = previous;
					throw error;
				}
				await controller.reload();
				this.refresh();
			} catch (error) {
				new Notice(errorText(error));
			} finally {
				button.setDisabled(false);
			}
		}),
	);
	new Setting(host)
		.setName(ct('columns'))
		.setDesc(ct('columnsHint'))
		.addDropdown((dropdown) =>
			dropdown
				.addOption('5', '5')
				.addOption('6', '6')
				.setValue(String(this.plugin.settings.contacts.maxColumns))
				.onChange(async (value) => {
					this.plugin.settings.contacts.maxColumns = value === '5' ? 5 : 6;
					await this.plugin.saveSettings();
					this.plugin.refreshContactsViews();
				}),
		);
}
