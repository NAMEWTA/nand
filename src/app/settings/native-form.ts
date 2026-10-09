import { Notice, Setting } from 'obsidian';
import { t } from '../../shared/i18n/index';
import type { FieldSpec, SettingsPageSpec } from '../contracts/settings';

/** Render a settings page spec with Obsidian's native `Setting` rows. */
export function renderNativeSettingsPage(container: HTMLElement, page: SettingsPageSpec): void {
	for (const section of page.sections) {
		if (section.titleKey) {
			const heading = new Setting(container).setName(t(section.titleKey)).setHeading();
			if (section.descriptionKey) heading.setDesc(t(section.descriptionKey));
		}
		for (const field of section.fields) {
			if (field.visible && !field.visible()) continue;
			renderField(container, field);
		}
	}
}

function renderField(container: HTMLElement, field: FieldSpec): void {
	const setting = new Setting(container).setName(t(field.nameKey));
	if (field.descriptionKey) setting.setDesc(t(field.descriptionKey));
	if (field.kind === 'button') {
		setting.addButton((button) => {
			button.setButtonText(t(field.labelKey)).onClick(() => {
				void Promise.resolve(field.run()).catch(report);
			});
			if (field.cta) button.setCta();
		});
		return;
	}
	const read = () => (field.handle.get() as Record<string, unknown>)[field.key as string];
	const write = (value: unknown) =>
		field.handle.update((draft) => {
			(draft as Record<string, unknown>)[field.key as string] = value;
		}).catch(report);
	switch (field.kind) {
		case 'toggle':
			setting.addToggle((toggle) => toggle.setValue(read() === true).onChange((value) => void write(value)));
			break;
		case 'select':
			setting.addDropdown((dropdown) => {
				for (const option of field.options) dropdown.addOption(option.value, t(option.labelKey));
				dropdown.setValue(String(read())).onChange((value) => void write(value));
			});
			break;
		case 'text':
			setting.addText((text) => {
				text.setValue(asString(read())).onChange((value) => void write(value));
				if (field.placeholderKey) text.setPlaceholder(t(field.placeholderKey));
			});
			break;
		case 'slider':
			setting.addSlider((slider) =>
				slider.setLimits(field.min, field.max, field.step).setValue(Number(read()) || 0).onChange((value) => void write(value)),
			);
			break;
		case 'color': {
			setting.addColorPicker((picker) => {
				const value = asString(read());
				// Unset: show the accent the current theme already uses instead of black.
				const accent = value ? undefined : themeAccent(setting.settingEl);
				if (accent) picker.setValueHsl(accent);
				else picker.setValue(value || '#000000');
				picker.onChange((next) => void write(next));
			});
			setting.addExtraButton((button) =>
				button.setIcon('rotate-ccw').setTooltip(t(field.resetLabelKey)).onClick(() => void write('')),
			);
			break;
		}
	}
}

/** Obsidian's accent as HSL (from `--accent-h/s/l`), or undefined when the theme does not define it. */
function themeAccent(el: HTMLElement): { h: number; s: number; l: number } | undefined {
	const style = el.win.getComputedStyle(el);
	const [h, s, l] = ['--accent-h', '--accent-s', '--accent-l'].map((name) => Number.parseFloat(style.getPropertyValue(name)));
	return [h, s, l].every((part) => Number.isFinite(part)) ? { h: h!, s: s!, l: l! } : undefined;
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

function report(error: unknown): void {
	console.error('[NAND settings]', error);
	new Notice(t('settings.writeFailed'));
}
