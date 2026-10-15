// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/appearance.ts
import type { DashboardSettings } from './types/model';
export const CUSTOM_COLOR_TOKENS = {
	accent: '--db-accent',
	accentLight: '--db-accent-light',
	bg: '--db-bg',
	bgCard: '--db-bg-card',
	bgSection: '--db-bg-section',
	text: '--db-text',
	textMuted: '--db-text-muted',
	borderCard: '--db-border-card',
} as const;
export type CustomColors = Partial<Record<keyof typeof CUSTOM_COLOR_TOKENS, string>>;
export type CustomTheme = Pick<
	DashboardSettings,
	'bgImage' | 'bgDim' | 'bgBlur' | 'bgSize' | 'surfaceOpacity' | 'glassBlur' | 'radiusScale' | 'fontScale'
> & { id: string; name: string; base: string; colors: CustomColors };
export function normalizeCustomColors(value: unknown): CustomColors {
	if (!value || typeof value !== 'object') return {};
	return Object.fromEntries(
		Object.keys(CUSTOM_COLOR_TOKENS).flatMap((key) => {
			const color = (value as Record<string, unknown>)[key];
			return typeof color === 'string' && /^(light|dark|#[\da-f]{6}|rgba?\([\d.,\s]+\))$/i.test(color)
				? [[key, color]]
				: [];
		}),
	);
}
export function captureAppearanceSnapshot(s: DashboardSettings): Omit<CustomTheme, 'id' | 'name'> {
	return {
		base: s.stylePreset,
		colors: { ...s.customColors },
		bgImage: s.bgImage,
		bgDim: s.bgDim,
		bgBlur: s.bgBlur,
		bgSize: s.bgSize,
		surfaceOpacity: s.surfaceOpacity,
		glassBlur: s.glassBlur,
		radiusScale: s.radiusScale,
		fontScale: s.fontScale,
	};
}
export function customThemeSettingsSlice(theme: CustomTheme): Partial<DashboardSettings> {
	const { id, name: _name, base, colors, ...decor } = theme;
	return { ...decor, stylePreset: base, customColors: { ...colors }, activeCustomThemeId: id };
}
