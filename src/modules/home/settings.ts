import { domainSettings } from '../../shared/settings/schema';
import { DEFAULT_DASHBOARD_SETTINGS, type DashboardSettings } from './core/board/types/model';
import { normalizeDashboardSettings } from './core/board/settings';
import { normalizeAppearancePresets } from './core/board/appearance-preset';
import { themeSettings } from '../../theme/settings';

export { seedDashboardSettings } from './core/board/settings';
export type { DashboardSettings } from './core/board/types/model';

/** Settings namespace `home` (board, widgets and sections). */
export const homeSettings = domainSettings<DashboardSettings>({
	defaults: () => structuredClone(DEFAULT_DASHBOARD_SETTINGS),
	normalize: input => {
		const settings = normalizeDashboardSettings(input);
		settings.appearancePresets = normalizeAppearancePresets(settings.appearancePresets, value => themeSettings.normalize(value));
		if (!settings.appearancePresets.some(preset => preset.id === settings.activeAppearancePresetId)) delete settings.activeAppearancePresetId;
		return settings;
	},
});
