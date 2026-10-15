import { normalizeCustomColors } from './core/board/custom-theme';
import { homeDecor } from './core/board/appearance-preset';
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
	normalize: (input) => {
		const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
		const registry =
			raw.workspaces && typeof raw.workspaces === 'object' ? (raw.workspaces as Record<string, unknown>) : {};
		const files = Array.isArray(registry.files)
			? registry.files.filter((file): file is string => typeof file === 'string' && !!file.trim())
			: ['.nand/content/dashboard'];
		if (!files.length) files.push('.nand/content/dashboard');
		const active =
			typeof registry.active === 'number' && Number.isInteger(registry.active)
				? Math.max(0, Math.min(files.length - 1, registry.active))
				: 0;
		const settings = normalizeDashboardSettings({
			...raw,
			workspaceFiles: files,
			workspaceNames: registry.names,
			dashboardFile: files[active],
		});
		settings.workspaces = {
			files: settings.workspaceFiles,
			names: settings.workspaceNames ?? [],
			active: settings.workspaceFiles.indexOf(settings.dashboardFile),
		};
		settings.stylePreset = [
			'earth',
			'nordic',
			'aurora',
			'blossom',
			'aqua',
			'island',
			'tundra',
			'matcha',
			'mono',
			'neon',
			'volt',
			'magma',
			'onyx',
		].includes(String(raw.stylePreset))
			? String(raw.stylePreset)
			: ((
					{
						prism: 'blossom',
						dusk: 'aqua',
						lilac: 'aqua',
						sakura: 'blossom',
						moonlight: 'nordic',
						ember: 'magma',
						haze: 'volt',
						jade: 'matcha',
						carbon: 'mono',
					} as Record<string, string>
				)[String(raw.stylePreset)] ?? 'mono');
		settings.customColors = normalizeCustomColors(raw.customColors);
		settings.customThemes = (Array.isArray(raw.customThemes) ? raw.customThemes : []).flatMap((item: unknown) => {
			if (!item || typeof item !== 'object') return [];
			const theme = item as Record<string, unknown>;
			if (typeof theme.id !== 'string' || typeof theme.name !== 'string' || typeof theme.base !== 'string')
				return [];
			return [
				{
					...homeDecor(theme),
					id: theme.id,
					name: theme.name,
					base: theme.base,
					colors: normalizeCustomColors(theme.colors),
				},
			];
		});
		settings.activeCustomThemeId =
			typeof raw.activeCustomThemeId === 'string' &&
			settings.customThemes.some((theme) => theme.id === raw.activeCustomThemeId)
				? raw.activeCustomThemeId
				: undefined;
		settings.backupEnabled = raw.backupEnabled === true;
		settings.backupPeriod =
			raw.backupPeriod === 'hourly' || raw.backupPeriod === 'weekly' || raw.backupPeriod === 'monthly'
				? raw.backupPeriod
				: 'daily';
		settings.backupMaxCount =
			typeof raw.backupMaxCount === 'number' && Number.isFinite(raw.backupMaxCount)
				? Math.max(1, Math.min(100, Math.round(raw.backupMaxCount)))
				: 10;
		settings.backupLastRun =
			typeof raw.backupLastRun === 'number' && Number.isFinite(raw.backupLastRun)
				? Math.max(0, raw.backupLastRun)
				: 0;
		settings.rssReadRetentionDays =
			typeof raw.rssReadRetentionDays === 'number' && Number.isFinite(raw.rssReadRetentionDays)
				? Math.max(0, Math.min(365, Math.round(raw.rssReadRetentionDays)))
				: 30;
		settings.ticktickRegion = raw.ticktickRegion === 'ticktick' ? 'ticktick' : 'dida365';
		for (const key of ['ticktickCookie', 'ticktickCsrf', 'ticktickDeviceVersion', 'ticktickTimezone'] as const)
			settings[key] = typeof raw[key] === 'string' ? raw[key] : DEFAULT_DASHBOARD_SETTINGS[key];
		settings.useThemeFont = raw.useThemeFont === true;
		settings.sidebarPinned = raw.sidebarPinned === true;
		settings.bannerCollapsed = raw.bannerCollapsed === true;
		settings.collapsedSections = Array.isArray(raw.collapsedSections)
			? raw.collapsedSections.filter((name): name is string => typeof name === 'string')
			: [];
		settings.pomodoroMode = raw.pomodoroMode === 'stopwatch' ? 'stopwatch' : 'countdown';
		settings.pomodoroRemindInterval =
			typeof raw.pomodoroRemindInterval === 'number'
				? Math.max(1, Math.min(240, raw.pomodoroRemindInterval))
				: 25;
		settings.quickCaptureMode = raw.quickCaptureMode === 'search' ? 'search' : 'capture';
		settings.appearancePresets = normalizeAppearancePresets(settings.appearancePresets, (value) =>
			themeSettings.normalize(value),
		);
		if (!settings.appearancePresets.some((preset) => preset.id === settings.activeAppearancePresetId))
			delete settings.activeAppearancePresetId;
		return settings;
	},
});

/** Flat fields are in-memory adapters for services awaiting later stages, never persisted. */
export const homeSettings = {
	...schema,
	pick(value: DashboardSettings, scope: 'vault' | 'device'): Partial<DashboardSettings> {
		const picked = { ...schema.pick(value, scope) };
		for (const key of ['ticktickCookie', 'ticktickCsrf', 'wereadApiKey'] as const) {
			if (scope === 'device') picked[key] = value[key];
			else delete picked[key];
		}
		delete picked.workspaceFiles;
		delete picked.workspaceNames;
		delete picked.dashboardFile;
		return picked;
	},
};
