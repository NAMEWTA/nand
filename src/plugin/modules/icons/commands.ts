import { Platform } from 'obsidian';
import type IconicController from '../../../platform/obsidian/icons/host/controller';
import { STRINGS } from '../../../shared/i18n/icons-accessor';
import IconPicker from '../../../view/icons/dialogs/icon-picker';
import RulePicker from '../../../view/icons/dialogs/rule-picker';

export function registerIconicCommands(controller: IconicController): void {
	// COMMAND: Open rulebook
	controller.addCommand({
		id: 'open-rulebook',
		get name() {
			return STRINGS.commands.openRulebook;
		},
		callback: () => RulePicker.open(controller),
	});

	// COMMAND: Toggle bigger icons
	controller.dialogCommands.push(
		controller.addCommand({
			id: 'toggle-bigger-icons',
			get name() {
				return STRINGS.commands.toggleBiggerIcons;
			},
			callback: () => {
				if (Platform.isDesktop) {
					if (controller.settings.biggerIcons === 'on') controller.settings.biggerIcons = 'mobile';
					else if (controller.settings.biggerIcons === 'desktop') controller.settings.biggerIcons = 'off';
					else if (controller.settings.biggerIcons === 'mobile') controller.settings.biggerIcons = 'on';
					else if (controller.settings.biggerIcons === 'off') controller.settings.biggerIcons = 'desktop';
				} else {
					if (controller.settings.biggerIcons === 'on') controller.settings.biggerIcons = 'desktop';
					else if (controller.settings.biggerIcons === 'desktop') controller.settings.biggerIcons = 'on';
					else if (controller.settings.biggerIcons === 'mobile') controller.settings.biggerIcons = 'off';
					else if (controller.settings.biggerIcons === 'off') controller.settings.biggerIcons = 'mobile';
				}
				void controller.saveSettings();
				controller.refreshBody();
			},
		}),
	);

	// COMMAND: Toggle clickable icons
	controller.dialogCommands.push(
		controller.addCommand({
			id: 'toggle-clickable-icons',
			get name() {
				return Platform.isDesktop
					? STRINGS.commands.toggleClickableIcons.desktop
					: STRINGS.commands.toggleClickableIcons.mobile;
			},
			callback: () => {
				if (Platform.isDesktop) {
					if (controller.settings.clickableIcons === 'on') controller.settings.clickableIcons = 'mobile';
					else if (controller.settings.clickableIcons === 'desktop')
						controller.settings.clickableIcons = 'off';
					else if (controller.settings.clickableIcons === 'mobile') controller.settings.clickableIcons = 'on';
					else if (controller.settings.clickableIcons === 'off')
						controller.settings.clickableIcons = 'desktop';
				} else {
					if (controller.settings.clickableIcons === 'on') controller.settings.clickableIcons = 'desktop';
					else if (controller.settings.clickableIcons === 'desktop')
						controller.settings.clickableIcons = 'on';
					else if (controller.settings.clickableIcons === 'mobile')
						controller.settings.clickableIcons = 'off';
					else if (controller.settings.clickableIcons === 'off')
						controller.settings.clickableIcons = 'mobile';
				}
				void controller.saveSettings();
				controller.refreshManagers();
				controller.refreshBody();
			},
		}),
	);

	// COMMAND: Toggle all file icons
	controller.dialogCommands.push(
		controller.addCommand({
			id: 'toggle-all-file-icons',
			get name() {
				return STRINGS.commands.toggleAllFileIcons;
			},
			callback: () => {
				controller.settings.showAllFileIcons = !controller.settings.showAllFileIcons;
				void controller.saveSettings();
				controller.refreshManagers('file');
			},
		}),
	);

	// COMMAND: Toggle all folder icons
	controller.dialogCommands.push(
		controller.addCommand({
			id: 'toggle-all-folder-icons',
			get name() {
				return STRINGS.commands.toggleAllFolderIcons;
			},
			callback: () => {
				controller.settings.showAllFolderIcons = !controller.settings.showAllFolderIcons;
				void controller.saveSettings();
				controller.refreshManagers('file', 'tag');
			},
		}),
	);

	// COMMAND: Toggle minimal folder icons
	controller.dialogCommands.push(
		controller.addCommand({
			id: 'toggle-minimal-folder-icons',
			get name() {
				return STRINGS.commands.toggleMinimalFolderIcons;
			},
			callback: () => {
				controller.settings.minimalFolderIcons = !controller.settings.minimalFolderIcons;
				void controller.saveSettings();
				controller.refreshManagers('file', 'tag');
			},
		}),
	);

	// COMMAND: Toggle Markdown tab icons
	controller.dialogCommands.push(
		controller.addCommand({
			id: 'toggle-markdown-tab-icons',
			get name() {
				return STRINGS.commands.toggleMarkdownTabIcons;
			},
			callback: () => {
				controller.settings.showMarkdownTabIcons = !controller.settings.showMarkdownTabIcons;
				void controller.saveSettings();
				controller.refreshBody();
			},
		}),
	);

	// COMMAND: Toggle title icons
	controller.dialogCommands.push(
		controller.addCommand({
			id: 'toggle-title-icons',
			get name() {
				return STRINGS.commands.toggleTitleIcons;
			},
			callback: () => {
				controller.settings.showTitleIcons = !controller.settings.showTitleIcons;
				void controller.saveSettings();
				controller.refreshManagers('file');
			},
		}),
	);

	// COMMAND: Toggle tag pill icons
	controller.addCommand({
		id: 'toggle-tag-pill-icons',
		get name() {
			return STRINGS.commands.toggleTagPillIcons;
		},
		callback: () => {
			controller.settings.showTagPillIcons = !controller.settings.showTagPillIcons;
			void controller.saveSettings();
			controller.refreshManagers('tag');
		},
	});

	// COMMAND: Toggle menu actions
	controller.addCommand({
		id: 'toggle-menu-actions',
		get name() {
			return STRINGS.commands.toggleMenuActions;
		},
		callback: () => {
			controller.settings.showMenuActions = !controller.settings.showMenuActions;
			void controller.saveSettings();
			controller.refreshManagers();
			controller.menuManager?.closeAndFlush();
		},
	});

	// COMMAND: Toggle suggestion icons
	controller.addCommand({
		id: 'toggle-suggestion-icons',
		get name() {
			return STRINGS.commands.toggleSuggestionIcons;
		},
		callback: () => {
			controller.settings.showSuggestionIcons = !controller.settings.showSuggestionIcons;
			void controller.saveSettings();
		},
	});

	// COMMAND: Toggle quick switcher icons
	controller.addCommand({
		id: 'toggle-quick-switcher-icons',
		get name() {
			return STRINGS.commands.toggleQuickSwitcherIcons;
		},
		callback: () => {
			controller.settings.showQuickSwitcherIcons = !controller.settings.showQuickSwitcherIcons;
			void controller.saveSettings();
		},
	});

	// COMMAND: Toggle "Move file" icons
	controller.addCommand({
		id: 'toggle-move-file-icons',
		get name() {
			return STRINGS.commands.toggleMoveFileIcons;
		},
		callback: () => {
			controller.settings.showMoveFileIcons = !controller.settings.showMoveFileIcons;
			void controller.saveSettings();
		},
	});

	// COMMAND: Change icon of the current file
	controller.addCommand({
		id: 'change-icon-current-file',
		get name() {
			return STRINGS.commands.changeIconCurrentFile;
		},
		checkCallback: (checking) => {
			const tFile = controller.app.workspace.getActiveFile();
			if (tFile === null) return false;

			const file = controller.getFileItem(tFile.path);
			if (file === null) return false;

			if (!checking) {
				IconPicker.openSingle(controller, file, (newIcon, newColor) => {
					controller.saveFileIcon(file, newIcon, newColor);
					controller.refreshManagers('file');
				});
			}
			return true;
		},
	});
}
