import { domainSettings } from '../../shared/settings/schema';
import { DEFAULT_DASHBOARD_SETTINGS, type DashboardSettings } from './core/board/types/model';
import { normalizeDashboardSettings } from './core/board/settings';
import { normalizeAppearancePresets } from './core/board/appearance-preset';
import { themeSettings } from '../../theme/settings';

export { seedDashboardSettings } from './core/board/settings';
export type { DashboardSettings } from './core/board/types/model';

/** Settings namespace `home` (board, widgets and sections). */
const schema = domainSettings<DashboardSettings>({
	defaults: () => structuredClone(DEFAULT_DASHBOARD_SETTINGS),
	normalize: input => {
		const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
		const registry = raw.workspaces && typeof raw.workspaces === 'object' ? raw.workspaces as Record<string, unknown> : {};
		const files = Array.isArray(registry.files) ? registry.files.filter((file): file is string => typeof file === 'string' && !!file.trim()) : ['.nand/content/dashboard'];
		if (!files.length) files.push('.nand/content/dashboard');
		const active = typeof registry.active === 'number' && Number.isInteger(registry.active) ? Math.max(0, Math.min(files.length - 1, registry.active)) : 0;
		const settings = normalizeDashboardSettings({ ...raw, workspaceFiles: files, workspaceNames: registry.names, dashboardFile: files[active] });
		settings.workspaces = { files: settings.workspaceFiles, names: settings.workspaceNames ?? [], active: settings.workspaceFiles.indexOf(settings.dashboardFile) };
		settings.stylePreset = ['earth', 'nordic', 'aurora', 'blossom', 'aqua', 'island', 'tundra', 'matcha', 'mono', 'neon', 'volt', 'magma', 'onyx'].includes(String(raw.stylePreset)) ? String(raw.stylePreset) : 'mono';
		settings.useThemeFont = raw.useThemeFont === true;
		settings.sidebarPinned = raw.sidebarPinned === true;
		settings.bannerCollapsed = raw.bannerCollapsed === true;
		settings.collapsedSections = Array.isArray(raw.collapsedSections) ? raw.collapsedSections.filter((name): name is string => typeof name === 'string') : [];
		settings.pomodoroMode = raw.pomodoroMode === 'stopwatch' ? 'stopwatch' : 'countdown';
		settings.pomodoroRemindInterval = typeof raw.pomodoroRemindInterval === 'number' ? Math.max(1,Math.min(240,raw.pomodoroRemindInterval)) : 25;
		settings.quickCaptureMode = raw.quickCaptureMode === 'search' ? 'search' : 'capture';
		settings.appearancePresets = normalizeAppearancePresets(settings.appearancePresets, value => themeSettings.normalize(value));
		if (!settings.appearancePresets.some(preset => preset.id === settings.activeAppearancePresetId)) delete settings.activeAppearancePresetId;
		return settings;
	},
});

/** Flat fields are in-memory adapters for services awaiting later stages, never persisted. */
export const homeSettings = {
	...schema,
	pick(value: DashboardSettings, scope: 'vault' | 'device'): Partial<DashboardSettings> {
		const picked = { ...schema.pick(value, scope) };
		delete picked.workspaceFiles; delete picked.workspaceNames; delete picked.dashboardFile;
		return picked;
	},
};
