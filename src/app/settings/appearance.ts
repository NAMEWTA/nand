import { Notice } from 'obsidian';
import { t } from '../../shared/i18n/index';
import type { SettingsHandle } from '../../shared/settings/store';
import { EMPHASIS_STYLES, HEADING_STYLES, THEME_PRESETS, themeSettings, type ThemeSettings } from '../../theme/settings';
import { bindFields, type SettingsPageSpec, type SettingsSectionSpec } from '../contracts/settings';

const EXPORT_KIND = 'nand-appearance';

/** The theme preset picker (also shown in Obsidian's settings tab). */
export function themePresetSection(theme: SettingsHandle<ThemeSettings>): SettingsSectionSpec {
	return {
		titleKey: 'appearance.theme',
		fields: bindFields(theme, [
			{ kind: 'select', key: 'preset', nameKey: 'appearance.preset', descriptionKey: 'appearance.presetDesc', options: THEME_PRESETS.map((value) => ({ value, labelKey: `appearance.preset.${value}` })) },
		]),
	};
}

/** Settings → Appearance: the global theme applied to Obsidian, Markdown and NAND. */
export function appearancePage(theme: SettingsHandle<ThemeSettings>, clipboard: Pick<Clipboard, 'readText' | 'writeText'>): SettingsPageSpec {
	return {
		id: 'appearance',
		titleKey: 'appearance.title',
		descriptionKey: 'appearance.description',
		sections: [
			themePresetSection(theme),
			{
				titleKey: 'appearance.markdown',
				descriptionKey: 'appearance.markdownDesc',
				fields: bindFields(theme, [
					{ kind: 'select', key: 'headings', nameKey: 'appearance.headings', descriptionKey: 'appearance.headingsDesc', options: HEADING_STYLES.map((value) => ({ value, labelKey: `appearance.option.${value}` })) },
					{ kind: 'select', key: 'emphasis', nameKey: 'appearance.emphasis', descriptionKey: 'appearance.emphasisDesc', options: EMPHASIS_STYLES.map((value) => ({ value, labelKey: `appearance.option.${value}` })) },
					{ kind: 'slider', key: 'lineHeight', nameKey: 'appearance.lineHeight', descriptionKey: 'appearance.lineHeightDesc', min: 0, max: 2.2, step: 0.05 },
				]),
			},
			{
				titleKey: 'appearance.colors',
				fields: bindFields(theme, [
					{ kind: 'color', key: 'accentLight', nameKey: 'appearance.accentLight', descriptionKey: 'appearance.accentDesc', resetLabelKey: 'appearance.useDefault' },
					{ kind: 'color', key: 'accentDark', nameKey: 'appearance.accentDark', resetLabelKey: 'appearance.useDefault' },
				]),
			},
			{
				titleKey: 'appearance.backup',
				fields: [
					{
						kind: 'button', nameKey: 'appearance.export', descriptionKey: 'appearance.exportDesc', labelKey: 'appearance.export',
						run: async () => {
							await clipboard.writeText(JSON.stringify({ kind: EXPORT_KIND, version: 1, settings: theme.get() }, null, 2));
							new Notice(t('appearance.exported'));
						},
					},
					{
						kind: 'button', nameKey: 'appearance.import', descriptionKey: 'appearance.importDesc', labelKey: 'appearance.import',
						run: async () => {
							const settings = parseExport(await clipboard.readText());
							if (!settings) {
								new Notice(t('appearance.importFailed'));
								return;
							}
							await theme.update(() => settings, { persist: 'immediate' });
							new Notice(t('appearance.imported'));
						},
					},
					{
						kind: 'button', nameKey: 'appearance.reset', descriptionKey: 'appearance.resetDesc', labelKey: 'appearance.reset',
						run: () => theme.update(() => themeSettings.defaults(), { persist: 'immediate' }),
					},
				],
			},
		],
	};
}

/** Appearance settings from exported JSON, or null when the text is not an export. */
export function parseExport(text: string): ThemeSettings | null {
	try {
		const value: unknown = JSON.parse(text);
		if (!value || typeof value !== 'object' || (value as { kind?: unknown }).kind !== EXPORT_KIND) return null;
		return themeSettings.normalize((value as { settings?: unknown }).settings);
	} catch {
		return null;
	}
}
