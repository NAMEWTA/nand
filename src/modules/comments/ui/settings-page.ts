import { Notice, Setting } from 'obsidian';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { CommentsSettings } from '../settings';

/** The existing renderer is wrapped by the shell's React settings adapter. */
export function commentsSettingsPage(settings: SettingsHandle<CommentsSettings>): SettingsPageRenderer {
	const save = (recipe: (draft: CommentsSettings) => void) => { void settings.update(recipe).catch(() => new Notice(t('settings.writeFailed'))); };
	return (container) => {
		let color: Setting | undefined;
		new Setting(container).setName(t('editor.comments.author')).addText(text => text.setValue(settings.get().author).onChange(value => save(draft => { draft.author = value; })));
		for (const [key, label] of [
			['highlightEnabled', 'settings.editorHighlight'], ['popoverEnabled', 'settings.editorPopover'],
			['gutterEnabled', 'editor.comments.gutterEnabled'], ['showCount', 'editor.comments.showCount'],
			['highlightLines', 'editor.comments.highlightLines'], ['highlightResolved', 'editor.comments.highlightResolved'],
			['followAccent', 'editor.comments.followAccent'], ['deleteWithNote', 'editor.comments.deleteWithNote'],
		] as const) new Setting(container).setName(t(label)).addToggle(toggle => toggle.setValue(settings.get()[key]).onChange(value => { save(draft => { draft[key] = value; }); if (key === 'followAccent') color?.settingEl.toggle(!value); }));
		color = new Setting(container).setName(t('editor.comments.color')).addColorPicker(picker => {
			const swatch = container.createSpan(); swatch.style.color = settings.get().color || 'var(--interactive-accent)';
			const [r = 0, g = 0, b = 0] = container.ownerDocument.defaultView!.getComputedStyle(swatch).color.match(/[\d.]+/g)?.map(Number) ?? [];
			swatch.remove(); picker.setValueRgb({ r, g, b }).onChange(value => save(draft => { draft.color = value; }));
		});
		color.settingEl.toggle(!settings.get().followAccent);
		new Setting(container).setName(t('editor.comments.hoverDelay')).addSlider(slider => slider.setLimits(200, 1000, 50).setValue(settings.get().hoverDelay).onChange(value => save(draft => { draft.hoverDelay = value; })));
		new Setting(container).setName(t('editor.comments.fuzzyThreshold')).addSlider(slider => slider.setLimits(0.1, 0.5, 0.05).setValue(settings.get().fuzzyThreshold).onChange(value => save(draft => { draft.fuzzyThreshold = value; })));
		new Setting(container).setName(t('editor.comments.panelSide')).addDropdown(dropdown => dropdown.addOptions({ left: t('editor.comments.left'), right: t('editor.comments.right') }).setValue(settings.get().panelSide).onChange(value => save(draft => { draft.panelSide = value === 'left' ? 'left' : 'right'; })));
		new Setting(container).setName(t('editor.comments.sort')).addDropdown(dropdown => dropdown.addOptions({ position: t('editor.comments.position'), created: t('editor.comments.created'), activity: t('editor.comments.activity') }).setValue(settings.get().sort).onChange(value => save(draft => { draft.sort = value === 'created' || value === 'activity' ? value : 'position'; })));
	};
}
