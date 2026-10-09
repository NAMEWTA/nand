import { defineSettings, f } from '../shared/settings/schema';

export const THEME_PRESETS = ['system', 'claude-code', 'eye-care'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];
export const HEADING_STYLES = ['preset', 'accented', 'plain'] as const;
export const EMPHASIS_STYLES = ['preset', 'accent', 'highlight', 'plain'] as const;

const color = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

/** Settings namespace `theme`: the global look applied to Obsidian, Markdown and NAND. */
export const themeSettings = defineSettings({
	preset: f.enum(THEME_PRESETS, { default: 'system' }),
	headings: f.enum(HEADING_STYLES, { default: 'preset' }),
	emphasis: f.enum(EMPHASIS_STYLES, { default: 'preset' }),
	/** `#rrggbb`, or empty to keep the preset's accent. */
	accentLight: f.custom({ default: '', normalize: (value) => (typeof value === 'string' && color(value) ? value.toLowerCase() : '') }),
	accentDark: f.custom({ default: '', normalize: (value) => (typeof value === 'string' && color(value) ? value.toLowerCase() : '') }),
	/** Reading line height; 0 keeps the preset's value. */
	lineHeight: f.number({ default: 0, min: 0, max: 2.2 }),
});
export type ThemeSettings = ReturnType<typeof themeSettings.defaults>;

/** Heading and emphasis styles each preset uses when the user leaves them on "preset". */
const PRESET_STYLES: Record<ThemePreset, { headings: 'accented' | 'plain'; emphasis: 'accent' | 'highlight' | 'plain' }> = {
	system: { headings: 'plain', emphasis: 'plain' },
	'claude-code': { headings: 'accented', emphasis: 'accent' },
	'eye-care': { headings: 'accented', emphasis: 'highlight' },
};

export interface ResolvedTheme {
	preset: ThemePreset;
	headings: 'accented' | 'plain';
	emphasis: 'accent' | 'highlight' | 'plain';
	accentLight: string;
	accentDark: string;
	lineHeight: number;
}

export function resolveTheme(settings: ThemeSettings): ResolvedTheme {
	const defaults = PRESET_STYLES[settings.preset];
	return {
		preset: settings.preset,
		headings: settings.headings === 'preset' ? defaults.headings : settings.headings,
		emphasis: settings.emphasis === 'preset' ? defaults.emphasis : settings.emphasis,
		accentLight: settings.accentLight,
		accentDark: settings.accentDark,
		lineHeight: settings.lineHeight,
	};
}

/** Body classes and CSS variables for a resolved theme. "Follow system" with defaults produces none. */
export function themeBodyState(theme: ResolvedTheme): { classes: string[]; vars: Record<string, string> } {
	const classes: string[] = [];
	const vars: Record<string, string> = {};
	if (theme.preset !== 'system') classes.push(`nand-theme--${theme.preset}`);
	if (theme.headings !== 'plain') classes.push(`nand-md-headings--${theme.headings}`);
	if (theme.emphasis !== 'plain') classes.push(`nand-md-emphasis--${theme.emphasis}`);
	if (theme.accentLight) {
		classes.push('nand-theme-accent-light');
		vars['--nand-user-accent-light'] = theme.accentLight;
	}
	if (theme.accentDark) {
		classes.push('nand-theme-accent-dark');
		vars['--nand-user-accent-dark'] = theme.accentDark;
	}
	if (theme.lineHeight > 0) {
		classes.push('nand-theme-line-height');
		vars['--nand-user-line-height'] = String(theme.lineHeight);
	}
	return { classes, vars };
}

/** Every class and variable the runtime may set (used to clean up). */
export const THEME_CLASS_PREFIXES = ['nand-theme--', 'nand-md-headings--', 'nand-md-emphasis--', 'nand-theme-accent-', 'nand-theme-line-height'];
export const THEME_VARS = ['--nand-user-accent-light', '--nand-user-accent-dark', '--nand-user-line-height'];
