import { domainSettings } from '../../shared/settings/schema';
import { DEFAULT_DASHBOARD_SETTINGS, type DashboardSettings } from './core/board/types/model';
import { normalizeDashboardSettings } from './core/board/settings';

export { seedDashboardSettings } from './core/board/settings';
export type { DashboardSettings } from './core/board/types/model';

/** Settings namespace `home` (board, widgets and sections). */
export const homeSettings = domainSettings<DashboardSettings>({
	defaults: () => structuredClone(DEFAULT_DASHBOARD_SETTINGS),
	normalize: normalizeDashboardSettings,
});
