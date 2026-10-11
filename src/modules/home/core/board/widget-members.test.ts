import { expect, test } from 'vitest';
import { DEFAULT_DASHBOARD_SETTINGS as DEFAULT_SETTINGS } from './types/model';
import { legacyBoardMembers, widgetPresentationKey } from './widget-members';
import { WidgetLifetime } from './widget-lifetime';
import { indexWidgetProviders, widgetProviderKey } from './widget-registry';
import type { HomeWidgetKind } from '../../api';

test('old family expansion keeps the actual order and only the old stacked projection pins quick actions', () => {
	const settings = { ...DEFAULT_SETTINGS, widgetOrder: ['calendar', 'album-7', 'quickActions'], widgetQuickActionsEnabled: true, widgetCalendarEnabled: true, widgetLunarEnabled: false, widgetYearProgressEnabled: false, widgetWeatherEnabled: false, widgetMusicEnabled: false, pomodoroEnabled: false,
		albums: [{ id: 7 }, { id: 9 }] as typeof DEFAULT_SETTINGS.albums };
	const before = JSON.stringify(settings);
	expect(legacyBoardMembers(settings, false).map(widgetPresentationKey)).toEqual(['calendar', 'album-7', 'quickActions', 'album-9']);
	expect(legacyBoardMembers(settings, true).map(widgetPresentationKey)).toEqual(['quickActions', 'calendar', 'album-7', 'album-9']);
	expect(JSON.stringify(settings)).toBe(before);
});

test('widget resources release once, including late async registration and throwing cleanup', () => {
	const errors: unknown[] = [];
	const lifetime = new WidgetLifetime(error => errors.push(error));
	let released = 0;
	const resource = () => { released++; };
	lifetime.register(resource);
	lifetime.register(resource);
	lifetime.register(() => { throw new Error('fixture'); });
	lifetime.dispose(); lifetime.dispose();
	lifetime.register(resource);
	lifetime.register(() => { released++; });
	expect(lifetime.signal.aborted).toBe(true);
	expect(released).toBe(2);
	expect(errors).toHaveLength(1);
});

test('same names in different providers coexist while a duplicate inside a provider is reported', () => {
	const kind: HomeWidgetKind = { key: 'calendar', titleKey: 'calendar', icon: 'calendar', defaultSize: { w: 4, h: 40 }, minSize: { w: 2, h: 3 }, instances: () => [{ id: 'default' }], render: () => undefined };
	const duplicate = { ...kind, icon: 'other' };
	const index = indexWidgetProviders([{ module: 'home', bundle: { kinds: [kind, duplicate] } }, { module: 'news', bundle: { kinds: [duplicate] } }]);
	expect(index.byKey.get(widgetProviderKey('home', 'calendar'))?.kind).toBe(kind);
	expect(index.byKey.get(widgetProviderKey('news', 'calendar'))?.kind).toBe(duplicate);
	expect(index.errors).toEqual(['home/calendar']);
});
