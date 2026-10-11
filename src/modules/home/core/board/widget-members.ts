import type { BoardWidgetMember, DashboardSettings } from './types/model';

/** The old renderer's actual order, including enabled families and its stacked quick-actions pin. */
export function legacyBoardMembers(settings: DashboardSettings, stacked: boolean, phone = false): BoardWidgetMember[] {
	const members: BoardWidgetMember[] = [];
	const add = (kind: string, instanceId = 'default') => members.push({ memberId: `home:${kind}:${instanceId}`, provider: 'home', kind, instanceId });
	if (settings.widgetQuickActionsEnabled) add('quick-actions');
	if (settings.widgetLunarEnabled) add('lunar');
	if (settings.widgetYearProgressEnabled) add('year-progress');
	if (settings.widgetCalendarEnabled) add('calendar');
	if (settings.widgetWeatherEnabled) add('weather');
	if (settings.pomodoroEnabled) add('pomodoro');
	if (settings.readingEnabled) add('reading');
	if (settings.widgetHabitEnabled) add('habit');
	if (settings.widgetExpenseEnabled) add('expense');
	for (const item of settings.albums ?? []) add('album', String(item.id));
	if (settings.anniversaryEnabled) for (const item of settings.anniversaries ?? []) add('anniversary', item.id);
	if (settings.widgetMusicEnabled && !phone) add('music');
	if (settings.countdownEnabled) for (const item of settings.countdowns ?? []) add('countdown', item.id);
	const order = settings.widgetOrder?.length ? settings.widgetOrder : ['quickActions', 'lunar', 'weather', 'pomodoro', 'reading', 'countdown', 'anniversary', 'yearProgress', 'calendar', 'habit', 'expense', 'album', 'music'];
	const rank = new Map(order.map((key, i) => [key, i]));
	members.sort((a, b) => (rank.get(widgetPresentationKey(a)) ?? order.length) - (rank.get(widgetPresentationKey(b)) ?? order.length));
	return stacked ? [...members.filter(m => m.kind === 'quick-actions'), ...members.filter(m => m.kind !== 'quick-actions')] : members;
}

/** Existing CSS/data refresh hooks retain their presentation keys; membership uses memberId. */
export function widgetPresentationKey(member: Pick<BoardWidgetMember, 'provider' | 'kind' | 'instanceId'>): string {
	if (member.provider !== 'home') return `${member.provider}:${member.kind}:${member.instanceId}`;
	if (member.kind === 'quick-actions') return 'quickActions';
	if (member.kind === 'year-progress') return 'yearProgress';
	return ['album', 'anniversary', 'countdown'].includes(member.kind) ? `${member.kind}-${member.instanceId}` : member.kind;
}
