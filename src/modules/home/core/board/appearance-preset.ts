import type { DashboardSettings } from './types/model';
import { focalForWrite } from './board-experience';

/** Serialized theme fields; their owner supplies validation through themeSettings.normalize. */
export interface ThemeFields {
	preset: string;
	headings: string;
	emphasis: string;
	accentLight: string;
	accentDark: string;
	lineHeight: number;
}

export type HomeDecorFields = Pick<DashboardSettings, 'bgImage' | 'bgDim' | 'bgBlur' | 'bgSize' | 'bgFocal' | 'surfaceOpacity' | 'glassBlur' | 'radiusScale' | 'fontScale'>;
export interface AppearancePreset { id: string; name: string; theme: ThemeFields; home: HomeDecorFields }

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown, min: number, max: number, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const nullable = (value: unknown, max: number) => value == null ? null : number(value, 0, max, max);

/** Copy only global decor. Board paths, widget configuration and credentials never enter a snapshot. */
export function homeDecor(value: unknown): HomeDecorFields {
	const raw = record(value);
	return {
		bgImage: typeof raw.bgImage === 'string' ? raw.bgImage.trim() : '',
		bgDim: number(raw.bgDim, 0, 100, 40), bgBlur: number(raw.bgBlur, 0, 30, 0),
		bgSize: raw.bgSize === 'contain' ? 'contain' : 'cover', bgFocal: focalForWrite(raw.bgFocal),
		surfaceOpacity: nullable(raw.surfaceOpacity, 100), glassBlur: nullable(raw.glassBlur, 20), radiusScale: nullable(raw.radiusScale, 22),
		fontScale: raw.fontScale === 'small' || raw.fontScale === 'large' ? raw.fontScale : 'medium',
	};
}

export const appearanceNameKey = (name: string): string => name.trim().toLowerCase();

export function normalizeAppearancePresets(value: unknown, normalizeTheme: (value: unknown) => ThemeFields): AppearancePreset[] {
	const ids = new Set<string>(), names = new Set<string>();
	return (Array.isArray(value) ? value : []).flatMap(item => {
		const raw = record(item);
		const id = typeof raw.id === 'string' ? raw.id.trim() : '', name = typeof raw.name === 'string' ? raw.name.trim() : '';
		if (!id || !name || ids.has(id) || names.has(appearanceNameKey(name))) return [];
		ids.add(id); names.add(appearanceNameKey(name));
		return [{ id, name, theme: normalizeTheme(raw.theme), home: homeDecor(raw.home) }];
	});
}
