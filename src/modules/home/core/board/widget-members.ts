import { readBoardMembers } from './board-codec';
import type { BoardWidgetMember } from './types/model';

const record = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);
const OLD_FLAGS = [
	'widgetQuickActionsEnabled',
	'widgetLunarEnabled',
	'pomodoroEnabled',
	'widgetCalendarEnabled',
	'widgetWeatherEnabled',
	'widgetHabitEnabled',
	'widgetExpenseEnabled',
	'widgetMusicEnabled',
	'widgetAlbumEnabled',
	'readingEnabled',
	'countdownEnabled',
	'anniversaryEnabled',
	'widgetYearProgressEnabled',
	'widgetQuickCaptureEnabled',
	'widgetFileSearchEnabled',
	'widgetSkillsEnabled',
	'widgetOrder',
];

/**
 * The widgets the pre-canvas sidebar showed, rebuilt once from the old per-widget enable flags in stored
 * settings. Used only to convert old boards; the flags themselves no longer exist.
 */
export function legacyFlagMembers(raw: Record<string, unknown>): BoardWidgetMember[] {
	const flag = (key: string, fallback: boolean) => (typeof raw[key] === 'boolean' ? raw[key] : fallback);
	const members: BoardWidgetMember[] = [];
	const add = (kind: string, instanceId = 'default') =>
		members.push({ memberId: `home:${kind}:${instanceId}`, provider: 'home', kind, instanceId });
	if (flag('widgetQuickActionsEnabled', true)) add('quick-actions');
	if (flag('widgetQuickCaptureEnabled', false)) add('quickCapture');
	if (flag('widgetFileSearchEnabled', false)) add('fileSearch');
	if (flag('widgetSkillsEnabled', false)) add('skills');
	if (flag('widgetLunarEnabled', true)) add('lunar');
	if (flag('widgetYearProgressEnabled', false)) add('year-progress');
	if (flag('widgetCalendarEnabled', false)) add('calendar');
	if (flag('widgetWeatherEnabled', false)) add('weather');
	if (flag('pomodoroEnabled', true)) add('pomodoro');
	if (flag('readingEnabled', false)) add('reading');
	if (flag('widgetHabitEnabled', false)) add('habit');
	if (flag('widgetExpenseEnabled', false)) add('expense');
	if (Array.isArray(raw.albums))
		for (const item of raw.albums) if (record(item) && typeof item.id === 'number') add('album', String(item.id));
	if (flag('anniversaryEnabled', false) && Array.isArray(raw.anniversaries))
		for (const item of raw.anniversaries)
			if (record(item) && typeof item.id === 'string') add('anniversary', item.id);
	if (flag('widgetMusicEnabled', false)) add('music');
	if (flag('countdownEnabled', false) && Array.isArray(raw.countdowns))
		for (const item of raw.countdowns) if (record(item) && typeof item.id === 'string') add('countdown', item.id);
	const order =
		Array.isArray(raw.widgetOrder) && raw.widgetOrder.length
			? raw.widgetOrder.filter((key): key is string => typeof key === 'string')
			: [
					'quickActions',
					'lunar',
					'weather',
					'pomodoro',
					'reading',
					'countdown',
					'anniversary',
					'yearProgress',
					'calendar',
					'habit',
					'expense',
					'album',
					'music',
				];
	const rank = new Map(order.map((key, i) => [key, i]));
	const rankOf = (member: BoardWidgetMember) => rank.get(widgetFamilyKey(member)) ?? order.length;
	return members.sort((a, b) => rankOf(a) - rankOf(b));
}

/** Old settings that carry any trace of the sidebar widget switches (a fresh install carries none). */
export function readLegacyMembers(raw: Record<string, unknown>): BoardWidgetMember[] | undefined {
	const stored = readBoardMembers(raw.legacyWidgetMembers);
	if (stored) return stored;
	return OLD_FLAGS.some((key) => key in raw) ? legacyFlagMembers(raw) : undefined;
}

const widgetFamilyKey = (member: BoardWidgetMember): string =>
	member.kind === 'quick-actions' ? 'quickActions' : member.kind === 'year-progress' ? 'yearProgress' : member.kind;

/** Existing CSS/data refresh hooks retain their presentation keys; membership uses memberId. */
export function widgetPresentationKey(member: Pick<BoardWidgetMember, 'provider' | 'kind' | 'instanceId'>): string {
	if (member.provider !== 'home') return `${member.provider}:${member.kind}:${member.instanceId}`;
	if (member.kind === 'quick-actions') return 'quickActions';
	if (member.kind === 'year-progress') return 'yearProgress';
	// The first banner keeps the plain key (and its saved tile); further banners are told apart by instance.
	if (member.kind === 'banner') return member.instanceId === 'default' ? 'banner' : `banner-${member.instanceId}`;
	return ['album', 'anniversary', 'countdown'].includes(member.kind)
		? `${member.kind}-${member.instanceId}`
		: member.kind;
}
