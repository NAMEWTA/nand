import { Setting } from 'obsidian';
import { t } from '../../shared/i18n/index';

/** Settings → General: how the copy-reference commands work (they exist with every module set). */
export function renderCopyHelp(containerEl: HTMLElement): void {
	new Setting(containerEl).setName(t('editor.copy.title')).setDesc(t('editor.copy.howTo')).setHeading();
	new Setting(containerEl).setName(t('editor.copy.relative')).setDesc(t('editor.copy.relativeHelp'));
	new Setting(containerEl).setName(t('editor.copy.absolute')).setDesc(t('editor.copy.absoluteHelp'));
}

