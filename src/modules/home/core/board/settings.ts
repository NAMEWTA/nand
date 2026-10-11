import { DEFAULT_DASHBOARD_SETTINGS, type DashboardSettings } from './types/model';
import type { AlbumConfig, AnniversaryConfig, CountdownConfig } from './types/index';
import { normalizeWorkspaces } from '../workspace/workspace-registry';
import { sanitizeMediaTags } from '../media/tags';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Defaults merged with stored values; lists and the workspace registry are validated. */
export function normalizeDashboardSettings(input: unknown): DashboardSettings {
	const raw = isRecord(input) ? input : {};
	const workspace = normalizeWorkspaces(raw);
	return {
		...structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		...(raw as Partial<DashboardSettings>),
		layoutMode: raw.layoutMode === 'side' || raw.layoutMode === 'stacked' ? raw.layoutMode : undefined,
		countdowns: Array.isArray(raw.countdowns) ? (raw.countdowns as CountdownConfig[]).filter((c) => c && typeof c.id === 'string') : [],
		albums: Array.isArray(raw.albums) ? (raw.albums as AlbumConfig[]).filter((a) => a && typeof a.id === 'number') : [],
		anniversaries: Array.isArray(raw.anniversaries)
			? (raw.anniversaries as AnniversaryConfig[]).filter((a) => a && typeof a.id === 'string' && typeof a.startDate === 'string') : [],
		mediaTags: sanitizeMediaTags(raw.mediaTags),
		workspaceFiles: workspace.files,
		workspaceNames: workspace.names,
		dashboardFile: workspace.active,
	};
}

/** One year before `today` as YYYY-MM-DD, so the sample anniversary reads sensibly on day one. */
function oneYearBefore(today: Date): string {
	const date = new Date(today);
	date.setFullYear(date.getFullYear() - 1);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** First-run board: a few widgets turned on with sample entries. No remote images are referenced. */
export function seedDashboardSettings(settings: DashboardSettings, labels: { countdown: string; anniversary: string }, today = new Date()): DashboardSettings {
	return {
		...settings,
		quickNotesEnabled: true,
		widgetHabitEnabled: true,
		countdownEnabled: true,
		countdowns: [{ id: 'cd-default', label: labels.countdown, defaultLabel: true, targetDate: `${today.getFullYear()}-12-31T23:55`, displayMode: 'hours', reminderDays: 0 }],
		anniversaryEnabled: true,
		anniversaries: [{ id: 'av-default', label: labels.anniversary, defaultLabel: true, startDate: oneYearBefore(today), precision: 'ymd', annualReminder: false }],
	};
}
