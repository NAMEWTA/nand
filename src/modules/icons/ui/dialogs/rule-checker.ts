import { bindLocalizedControl } from '../../../../ui/primitives/localized-dom';
import type { Hotkey } from 'obsidian';
import { ButtonComponent, Modal, Setting } from 'obsidian';
import type { Category, FileItem } from '../../core/types';
import type IconicController from '../../platform/host/controller';
import { internalApp } from '../../platform/utils/obsidian-internal';
import { t } from '../../../../shared/i18n';
import PathListComponent from '../components/path-list-component';
import IconPicker from './icon-picker';

/**
 * Dialog for previewing the items matched by a rule.
 */
export default class RuleChecker extends Modal {
	private readonly plugin: IconicController;
	private readonly page: Category;
	private readonly matches: FileItem[];

	private constructor(plugin: IconicController, page: Category, matches: FileItem[]) {
		super(plugin.app);
		this.plugin = plugin;
		plugin.trackDialog(this);
		this.page = page;
		this.matches = matches;

		// Allow hotkeys in dialog
		for (const command of this.plugin.dialogCommands)
			if (command.callback) {
				const hotkeys: Hotkey[] = internalApp(this.app).hotkeyManager?.customKeys?.[command.id] ?? [];
				for (const hotkey of hotkeys) {
					this.scope.register(hotkey.modifiers, hotkey.key, command.callback);
				}
			}
	}

	/**
	 * Open a dialog to preview a list of matches.
	 */
	static open(plugin: IconicController, page: Category, matches: FileItem[]): void {
		new RuleChecker(plugin, page, matches).open();
	}

	/**
	 * @override
	 */
	onOpen(): void {
		this.containerEl.addClass('mod-confirmation');
		this.modalEl.addClass('iconic-rule-checker');
		this.contentEl.addClass('iconic-highlight-tree');

		switch (this.page) {
			case 'file': {
				bindLocalizedControl(this.setTitle(
					this.matches.length === 1
						? t('iconic.ruleChecker.fileMatch')
						: t('iconic.ruleChecker.filesMatch').replace('{#}', this.matches.length.toString()),
				), "title", this.matches.length === 1 ? ("iconic.ruleChecker.fileMatch") : ("iconic.ruleChecker.filesMatch"), (this.matches.length === 1) ? (undefined) : ({"#": this.matches.length.toString()}));
				break;
			}
			case 'folder': {
				bindLocalizedControl(this.setTitle(
					this.matches.length === 1
						? t('iconic.ruleChecker.folderMatch')
						: t('iconic.ruleChecker.foldersMatch').replace('{#}', this.matches.length.toString()),
				), "title", this.matches.length === 1 ? ("iconic.ruleChecker.folderMatch") : ("iconic.ruleChecker.foldersMatch"), (this.matches.length === 1) ? (undefined) : ({"#": this.matches.length.toString()}));
			}
		}

		// BUTTONS: Highlight
		const buttons: ButtonComponent[] = [];
		bindLocalizedControl(new Setting(this.contentEl)
			.setName(t('iconic.ruleChecker.highlight')), "name", "iconic.ruleChecker.highlight")
			.addButton((button) => {
				bindLocalizedControl(button.setButtonText(t('iconic.ruleEditor.source.tree')), "buttonText", "iconic.ruleEditor.source.tree").onClick(() => {
					buttons.forEach((button) => button.buttonEl.removeClass('iconic-button-selected'));
					button.buttonEl.addClass('iconic-button-selected');
					this.contentEl.addClass('iconic-highlight-tree');
					this.contentEl.removeClasses(['iconic-highlight-name', 'iconic-highlight-extension']);
				});
				button.buttonEl.addClass('iconic-button-selected');
				buttons.push(button);
			})
			.addButton((button) => {
				bindLocalizedControl(button.setButtonText(t('iconic.ruleEditor.source.name')), "buttonText", "iconic.ruleEditor.source.name").onClick(() => {
					buttons.forEach((button) => button.buttonEl.removeClass('iconic-button-selected'));
					button.buttonEl.addClass('iconic-button-selected');
					this.contentEl.removeClasses(['iconic-highlight-tree', 'iconic-highlight-extension']);
					this.contentEl.addClass('iconic-highlight-name');
				});
				buttons.push(button);
			})
			.addButton((button) => {
				bindLocalizedControl(button
					.setButtonText(t('iconic.ruleEditor.source.extension')), "buttonText", "iconic.ruleEditor.source.extension")
					.setDisabled(this.page !== 'file')
					.onClick(() => {
						buttons.forEach((button) => button.buttonEl.removeClass('iconic-button-selected'));
						button.buttonEl.addClass('iconic-button-selected');
						this.contentEl.removeClasses(['iconic-highlight-tree', 'iconic-highlight-name']);
						this.contentEl.addClass('iconic-highlight-extension');
					});
				buttons.push(button);
			});

		// LIST: Matches
		const pathList = new PathListComponent(this.contentEl);
		const defaultIcon = this.page === 'folder' ? 'lucide-folder' : 'lucide-file';
		for (const match of this.matches) {
			const { tree, basename, extension } = this.plugin.splitFilePath(match.id);
			const rule = this.plugin.ruleManager?.checkRuling(this.page, match.id) ?? match;
			pathList.addPath((path) =>
				path
					.setPathText(tree, basename, extension)
					.setIcon(rule.icon ?? defaultIcon)
					.setIconColor(rule.color ?? null)
					.setIconTooltip(t('iconic.iconPicker.changeIcon'))
					.onIconClick(() =>
						IconPicker.openSingle(this.plugin, match, (newIcon, newColor) => {
							this.plugin.saveFileIcon(match, newIcon, newColor);
							match.icon = newIcon;
							match.color = newColor;
							path.setIcon(newIcon ?? defaultIcon);
							path.setIconColor(newColor);
						}),
					),
			);
		}
	}
	onClose(): void {
		this.plugin.forgetDialog(this);
	}
}
