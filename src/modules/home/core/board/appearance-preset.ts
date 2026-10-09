/** Fields a named appearance may store. Board paths, credentials and device settings are not part of it. */
export interface ThemeFields {
	preset: string;
	headings: string;
	emphasis: string;
	accentLight: string;
	accentDark: string;
	lineHeight: number;
}

export interface HomeDecorFields {
	bgImage: string;
	bgDim: number;
	bgBlur: number;
	bgSize: string;
	surfaceOpacity: number | null;
	glassBlur: number | null;
	radiusScale: number | null;
	fontScale: string;
}

export interface AppearancePreset {
	id: string;
	name: string;
	theme: ThemeFields;
	home: HomeDecorFields;
}

/** Theme colors stay on the global theme. Home appearance stores decor only. */
export const HOME_DECOR_THEME: ThemeFields = {
	preset: 'system',
	headings: 'sans',
	emphasis: 'bold',
	accentLight: '',
	accentDark: '',
	lineHeight: 1.5,
};

/** The theme studio writes decor through the shared appearance commit. */
export function commitHomeDecor(
	decor: HomeDecorFields,
	writeTheme: (theme: ThemeFields) => void,
	writeHome: (home: HomeDecorFields) => void,
): { saved: true } | { saved: false; error: string } {
	return commitAppearancePreset(appearancePreset('home-decor', 'Home', HOME_DECOR_THEME, decor), writeTheme, writeHome);
}

export function appearancePreset(id: string, name: string, theme: ThemeFields, home: HomeDecorFields): AppearancePreset {
	return { id, name, theme: { ...theme }, home: { ...home } };
}

/**
 * Write theme and home through their own stores.
 * A thrown write is the saved state: the caller must not report success.
 */
export function commitAppearancePreset(
	preset: AppearancePreset,
	writeTheme: (theme: ThemeFields) => void,
	writeHome: (home: HomeDecorFields) => void,
): { saved: true } | { saved: false; error: string } {
	try {
		writeTheme({ ...preset.theme });
		writeHome({ ...preset.home });
		return { saved: true };
	} catch (error) {
		return { saved: false, error: error instanceof Error ? error.message : String(error) };
	}
}
