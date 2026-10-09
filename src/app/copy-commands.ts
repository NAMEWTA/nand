import { Notice } from 'obsidian';
import type { App, Command } from 'obsidian';
import { t } from '../shared/i18n/index';
import type { LocalizedCommand } from '../host/obsidian/localized-command';
import { collectReferences } from '../host/obsidian/references';

/** "Copy relative/absolute reference" for the editor selection or the file explorer; available with every module set. */
export function registerCopyCommands(plugin: { app: App; addCommand(command: LocalizedCommand): Command }): void {
	plugin.addCommand({
		id: 'copy-relative-reference',
		nameKey: 'editor.copy.relative',
		name: t('editor.copy.relative'),
		callback: () => {
			writeReference(plugin, 'relative');
		},
	});
	plugin.addCommand({
		id: 'copy-absolute-reference',
		nameKey: 'editor.copy.absolute',
		name: t('editor.copy.absolute'),
		callback: () => {
			writeReference(plugin, 'absolute');
		},
	});
}

function writeReference(plugin: { app: App }, kind: 'relative' | 'absolute'): void {
	const text = collectReferences(plugin.app, kind);
	if (!text) {
		new Notice(t('editor.copy.missing'));
		return;
	}
	void navigator.clipboard.writeText(text).then(
		() => {
			new Notice(kind === 'relative' ? t('editor.copy.copiedRelative') : t('editor.copy.copiedAbsolute'));
		},
		() => {
			new Notice(t('editor.copy.failed'));
		},
	);
}
