import { DEFAULT_TASK_ARCHIVE_PATH } from '../../core/board/default-paths';
import { Setting, type TextComponent } from 'obsidian';

import { t } from '../../../../shared/i18n/index';
import { openOwnedDashboardModal } from '../ui/dialog-scope';
import { ThemeStudioModal } from '../appearance/theme-studio-modal';
import { QuickNoteConfigModal } from '../notes/quick-note-config-modal';
import { PathPickerModal } from '../ui/path-picker-modal';
import type { BoardSettingsTab } from './board-settings-tab';

/** Dashboard preferences: layout, style, quick notes, paths. Shared by
 *  display() (pre-1.13) and the declarative General section (1.13+). */
export function renderGeneralSettings(this: BoardSettingsTab, containerEl: HTMLElement): void {
	new Setting(containerEl)
		.setName(t('themeStudio.title'))
		.setDesc(t('themeStudio.settingsDesc'))
		.addButton((btn) =>
			btn
				.setButtonText(t('themeStudio.open'))
				.setCta()
				.onClick(() => {
					openOwnedDashboardModal(this.app, new ThemeStudioModal(this.app, this.plugin), this);
				}),
		);

	new Setting(containerEl)
		.setName(t('quickNote.title'))
		.setDesc(t('quickNote.settingsDesc'))
		.addToggle((toggle) =>
			toggle.setValue(this.plugin.settings.quickNotesEnabled).onChange(async (value) => {
				this.plugin.settings = { ...this.plugin.settings, quickNotesEnabled: value };
				await this.plugin.saveSettings();
				this.plugin.refreshAllDashboards();
			}),
		)
		.addButton((btn) =>
			btn.setButtonText(t('quickNote.config')).onClick(() => {
				openOwnedDashboardModal(this.app, new QuickNoteConfigModal(this.app, this.plugin), this);
			}),
		);

	const recentSetting = new Setting(containerEl)
		.setName(t('settings.recentCount') + '  ' + this.plugin.settings.recentDocCount)
		.setDesc(t('settings.recentCountDesc'))
		.addSlider((slider) =>
			slider
				.setLimits(3, 15, 1)
				.setValue(this.plugin.settings.recentDocCount)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						recentDocCount: value,
					};
					await this.plugin.saveSettings();
					recentSetting.nameEl.setText(t('settings.recentCount') + '  ' + value);
				}),
		);

	this.renderWorkspaceSettings(containerEl);

	let memoInput: TextComponent | undefined;
	new Setting(containerEl)
		.setName(t('settings.memoSavePath'))
		.setDesc(t('settings.memoSavePathDesc'))
		.addText((text) => {
			memoInput = text;
			text.setPlaceholder('Memos')
				.setValue(this.plugin.settings.memoSavePath)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						memoSavePath: value.trim(),
					};
					await this.plugin.saveSettings();
				});
		})
		// Browse button: pick an existing folder instead of typing its path.
		.addExtraButton((btn) =>
			btn
				.setIcon('folder-search')
				.setTooltip(t('pathPicker.pickFolder'))
				.onClick(() => {
					new PathPickerModal(this.app, 'folder', (path) => {
						this.plugin.settings = {
							...this.plugin.settings,
							memoSavePath: path,
						};
						void this.plugin.saveSettings();
						memoInput?.setValue(path);
					}).open();
				}),
		);

	let memoTplInput: TextComponent | undefined;
	new Setting(containerEl)
		.setName(t('settings.memoTemplate'))
		.setDesc(t('settings.memoTemplateDesc'))
		.then(setting => renderMemoTemplateDescription(setting.descEl))
		.addText((text) => {
			memoTplInput = text;
			text.setPlaceholder('Templates/memo.md')
				.setValue(this.plugin.settings.memoTemplatePath)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						memoTemplatePath: value.trim(),
					};
					await this.plugin.saveSettings();
				});
		})
		// Browse button: pick an existing template note instead of typing its path.
		.addExtraButton((btn) =>
			btn
				.setIcon('file-search')
				.setTooltip(t('pathPicker.pickFile'))
				.onClick(() => {
					new PathPickerModal(this.app, 'file', (path) => {
						this.plugin.settings = {
							...this.plugin.settings,
							memoTemplatePath: path,
						};
						void this.plugin.saveSettings();
						memoTplInput?.setValue(path);
					}).open();
				}),
		);

	// Archive destination: a fixed file (the historical behavior) or
	// today's daily note (created from the daily-notes template when
	// missing). The path setting below only applies to file mode, so the
	// tab refreshes on switch to show/hide it.
	new Setting(containerEl)
		.setName(t('settings.taskArchiveTarget'))
		.setDesc(t('settings.taskArchiveTargetDesc'))
		.addDropdown((dropdown) =>
			dropdown
				.addOption('file', t('settings.taskArchiveTargetFile'))
				.addOption('daily', t('settings.taskArchiveTargetDaily'))
				.setValue(this.plugin.settings.taskArchiveTarget === 'daily' ? 'daily' : 'file')
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						taskArchiveTarget: value === 'daily' ? 'daily' : 'file',
					};
					await this.plugin.saveSettings();
					this.refresh();
				}),
		);

	if (this.plugin.settings.taskArchiveTarget !== 'daily') {
		let archiveInput: TextComponent | undefined;
		new Setting(containerEl)
			.setName(t('settings.taskArchivePath'))
			.setDesc(t('settings.taskArchivePathDesc'))
			.addText((text) => {
				archiveInput = text;
				text.setPlaceholder(DEFAULT_TASK_ARCHIVE_PATH)
					.setValue(this.plugin.settings.taskArchivePath)
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							taskArchivePath: value.trim(),
						};
						await this.plugin.saveSettings();
					});
			})
			.addExtraButton((btn) =>
				btn
					.setIcon('file-search')
					.setTooltip(t('pathPicker.pickFile'))
					.onClick(() => {
						new PathPickerModal(this.app, 'file', (path) => {
							this.plugin.settings = {
								...this.plugin.settings,
								taskArchivePath: path,
							};
							void this.plugin.saveSettings();
							archiveInput?.setValue(path);
						}).open();
					}),
			);
	}

	let libraryNewNoteInput: TextComponent | undefined;
	new Setting(containerEl)
		.setName(t('settings.libraryNewNotePath'))
		.setDesc(t('settings.libraryNewNotePathDesc'))
		.addText((text) => {
			libraryNewNoteInput = text;
			text.setPlaceholder('Notes/library')
				.setValue(this.plugin.settings.libraryNewNotePath)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						libraryNewNotePath: value.trim(),
					};
					await this.plugin.saveSettings();
				});
		})
		.addExtraButton((btn) =>
			btn
				.setIcon('folder-search')
				.setTooltip(t('pathPicker.pickFolder'))
				.onClick(() => {
					new PathPickerModal(this.app, 'folder', (path) => {
						this.plugin.settings = {
							...this.plugin.settings,
							libraryNewNotePath: path,
						};
						void this.plugin.saveSettings();
						libraryNewNoteInput?.setValue(path);
					}).open();
				}),
		);

	new Setting(containerEl)
		.setName(t('settings.disableNotePopover'))
		.setDesc(t('settings.disableNotePopoverDesc'))
		.addToggle((toggle) =>
			toggle.setValue(this.plugin.settings.disableNotePopover).onChange(async (value) => {
				this.plugin.settings = { ...this.plugin.settings, disableNotePopover: value };
				await this.plugin.saveSettings();
			}),
		);
}

/** These are fixed Markdown property keys, not translated UI labels. */
function renderMemoTemplateDescription(container: HTMLElement): void {
	container.empty();
	for (const part of t('settings.memoTemplateDesc').split(/(`[^`]+`)/g)) {
		if (part.startsWith('`') && part.endsWith('`')) container.createEl('code', { text: part.slice(1, -1) });
		else container.createSpan({ text: part });
	}
}
