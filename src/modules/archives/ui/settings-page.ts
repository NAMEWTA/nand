import { FuzzySuggestModal, Notice, Setting, TFolder, type App } from 'obsidian';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { validContactsFolder, type ContactsSettings } from '../../../shared/contacts-settings';
import type { SettingsHandle } from '../../../shared/settings/store';
import { bindLocalizedControl } from '../../../ui/primitives/localized-dom';
import type { ContactsController } from '../platform/controller';
import { confirm, ct, errorText } from './forms';

class ArchiveFolderPicker extends FuzzySuggestModal<TFolder> {
	constructor(app: App, private done: (path: string) => void) {
		super(app);
		this.setPlaceholder(ct('folder'));
		bindLocalizedControl(this, 'placeholder', 'contacts.folder');
		this.emptyStateText = ct('noMatchingFolders');
	}
	getItems(): TFolder[] {
		return this.app.vault.getAllLoadedFiles().filter((file): file is TFolder => file instanceof TFolder && validContactsFolder(file.path));
	}
	getItemText(folder: TFolder): string {
		return folder.path;
	}
	onChooseItem(folder: TFolder): void {
		this.done(folder.path);
	}
}

/** Settings → Archives: the archive folder (previewed before switching) and card columns. */
export function archivesSettingsPage(app: App, controller: ContactsController, settings: SettingsHandle<ContactsSettings>): SettingsPageRenderer {
	return (host, page) => {
		new Setting(host).setName(ct('storage')).setHeading();
		let candidate = settings.get().rootFolder;
		const setting = new Setting(host).setName(ct('folder')).setDesc(ct('folderHint'));
		setting.settingEl.addClass('nand-contacts-folder-setting');
		setting.addText((input) => {
			input.setValue(candidate).onChange((value) => {
				candidate = value.trim().replace(/\\/g, '/').replace(/\/$/, '');
			});
			setting.addButton((button) =>
				button.setButtonText(ct('browse')).onClick(() =>
					new ArchiveFolderPicker(app, (path) => {
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
					const root = candidate;
					const count = await controller.countFolder(root);
					if (!(await confirm(app, ct('folderPreview', { folder: root, count }), ct('apply')))) return;
					await controller.queue.settled();
					const previous = settings.get().rootFolder;
					try {
						await settings.update((draft) => { draft.rootFolder = root; }, { persist: 'immediate' });
					} catch (error) {
						void settings.update((draft) => { draft.rootFolder = previous; }).catch(() => undefined);
						throw error;
					}
					await controller.reload();
					page.refresh();
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
					.setValue(String(settings.get().maxColumns))
					.onChange((value) => {
						void settings.update((draft) => { draft.maxColumns = value === '5' ? 5 : 6; }).catch((error: unknown) => new Notice(errorText(error)));
					}),
			);
	};
}
