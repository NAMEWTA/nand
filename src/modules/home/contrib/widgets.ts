import type { HomeWidgetBundle, HomeWidgetContext, HomeWidgetInstance, HomeWidgetKind } from '../api';
import type { DashboardSettings } from '../core/board/types/model';

/** All built-ins use the same lazy mount contract as module contributions. */
export function builtinHomeWidgets(settings: () => DashboardSettings, render: (key: string, ...args: Parameters<HomeWidgetKind['render']>) => ReturnType<HomeWidgetKind['render']>, configure?: (key: string, context: HomeWidgetContext, create: boolean) => Promise<HomeWidgetInstance | null>): HomeWidgetBundle {
	const singleton = [{ id: 'default' }];
	const kind = (key: string, icon: string, w: number, h: number): HomeWidgetKind => ({
		key, titleKey: `home.widget.${key}`, icon, defaultSize: { w, h }, minSize: { w: Math.min(2, w), h: 3 },
		multiple: ['album', 'anniversary', 'countdown'].includes(key),
		...(configure && ['album', 'anniversary', 'countdown'].includes(key) ? {
			create: (context: HomeWidgetContext) => configure(key, context, true),
			configure: async (context: HomeWidgetContext) => { await configure(key, context, false); },
		} : {}),
		instances: () => key === 'album' ? settings().albums.map(item => ({ id: String(item.id), label: item.folder }))
			: key === 'anniversary' ? settings().anniversaries.map(item => ({ id: item.id, label: item.label }))
				: key === 'countdown' ? settings().countdowns.map(item => ({ id: item.id, label: item.label })) : singleton,
		render: (host, context) => render(key, host, context),
	});
	return { kinds: [kind('calendar', 'calendar', 4, 40), kind('lunar', 'moon', 3, 16), kind('anniversary', 'cake', 3, 16),
		kind('countdown', 'timer', 3, 16), kind('habit', 'check-circle', 4, 32), kind('expense', 'wallet', 4, 24),
		kind('pomodoro', 'timer-reset', 3, 24), kind('reading', 'book-open', 4, 24), kind('weather', 'cloud-sun', 3, 32),
		kind('music', 'music', 4, 24), kind('album', 'image', 4, 32), kind('year-progress', 'calendar-range', 4, 16),
		kind('quick-actions', 'zap', 4, 40), kind('skills', 'sparkles', 4, 40)] };
}
