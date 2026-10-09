import { Notice, Setting } from 'obsidian';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n/index';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { CommentsSettings } from '../settings';

/** Settings → Editor (comments): highlights and the selection popover. Comment bodies are not settings. */
export function commentsSettingsPage(settings: SettingsHandle<CommentsSettings>): SettingsPageRenderer {
	const save = (recipe: (draft: CommentsSettings) => void) => { void settings.update(recipe).catch(() => new Notice(t('settings.writeFailed'))); };
	return (container) => {
		new Setting(container)
			.setName(t('settings.editorHighlight'))
			.setDesc(t('settings.editorHighlightDesc'))
			.addToggle((toggle) => toggle.setValue(settings.get().highlightEnabled).onChange((value) => save((draft) => { draft.highlightEnabled = value; })));
		new Setting(container)
			.setName(t('settings.editorPopover'))
			.setDesc(t('settings.editorPopoverDesc'))
			.addToggle((toggle) => toggle.setValue(settings.get().popoverEnabled).onChange((value) => save((draft) => { draft.popoverEnabled = value; })));
	};
}
