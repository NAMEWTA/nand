import type { StatusBarPreferences, StatusSegment } from '../contracts/workbench';
import type { WorkbenchContribution } from '../contracts/workbench-host';

/** Items of the Obsidian status bar that the user can show or hide; `labelKey` is a startup dictionary key. */
export const STATUS_ITEMS = [
	{ id: 'usage', labelKey: 'shell.usage' },
	{ id: 'agents-waiting', labelKey: 'shell.waiting' },
	{ id: 'agents-running', labelKey: 'shell.running' },
	{ id: 'automations', labelKey: 'shell.automations' },
	{ id: 'automation-load', labelKey: 'shell.automationError' },
	{ id: 'sync', labelKey: 'shell.sync' },
	{ id: 'dashboard-save', labelKey: 'shell.saveError' },
	{ id: 'notifications', labelKey: 'shell.notifications' },
] as const;

/** `sync:<repo>` and `dashboard-save:<board>` rows belong to the preference key before the colon. */
export const segmentGroup = (id: string): string => id.split(':')[0] ?? id;

/** Whether the user left an item group visible (anything not explicitly switched off is shown). */
export const itemShown = (preferences: Pick<StatusBarPreferences, 'segments'>, id: string): boolean =>
	preferences.segments[id] !== false && preferences.segments[segmentGroup(id)] !== false;

/** Every contribution's current segments, ordered for display. Works without an open workbench. */
export function collectStatusSegments(contributions: readonly Pick<WorkbenchContribution, 'statusSegments'>[]): StatusSegment[] {
	return contributions.flatMap((item) => item.statusSegments?.() ?? []).sort((a, b) => a.order - b.order);
}

export function visibleSegments(segments: readonly StatusSegment[], preferences: Pick<StatusBarPreferences, 'segments'>): StatusSegment[] {
	return segments.filter((segment) => itemShown(preferences, segment.id));
}

export function withItemShown(preferences: StatusBarPreferences, id: string, shown: boolean): StatusBarPreferences {
	return { ...preferences, segments: { ...preferences.segments, [id]: shown } };
}
