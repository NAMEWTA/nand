import type { HomeWidgetBundle, HomeWidgetContext, HomeWidgetInstance, HomeWidgetKind } from '../../home/api';
import type { NewsReadService } from '../api';
import type { NewsWidgetMode } from '../core/home-widgets';

/** Several news widgets can be placed independently. */
export function newsHomeWidgets(service: Pick<NewsReadService, 'widgets' | 'views' | 'subscribe'>, render: HomeWidgetKind['render'], configure: (mode: NewsWidgetMode, context: HomeWidgetContext, create: boolean) => Promise<HomeWidgetInstance | null>): HomeWidgetBundle {
	return { subscribeInstances(listener) {
		const snapshot = () => JSON.stringify([service.widgets(), service.views()]);
		let previous = snapshot();
		return service.subscribe(() => { const next = snapshot(); if (next !== previous) { previous = next; listener(); } });
	}, kinds: (['featured', 'hot', 'view'] as const).map(mode => ({
		key: `news-${mode}`, titleKey: `news.widget.${mode}`, icon: mode === 'hot' ? 'flame' : mode === 'view' ? 'list-filter' : 'newspaper',
		defaultSize: { w: 4, h: 40 }, minSize: { w: 2, h: 10 }, multiple: true,
		instances: () => service.widgets().filter(item => item.mode === mode).map(item => ({ id: item.id, label: item.name || service.views().find(view => view.id === item.viewId)?.name })),
		create: context => configure(mode, context, true),
		configure: async context => { await configure(mode, context, false); },
		render,
	})) };
}

