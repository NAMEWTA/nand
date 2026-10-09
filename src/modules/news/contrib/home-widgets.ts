import type { HomeWidgetBundle } from '../../home/api';

/** Several news widgets can be placed independently. */
export const newsHomeWidgets: HomeWidgetBundle = {
	kinds: [
		{ key: 'news-raw', titleKey: 'news.widget.raw', icon: 'newspaper', defaultSize: { w: 4, h: 8 }, minSize: { w: 2, h: 4 }, multiple: true },
		{ key: 'news-hot', titleKey: 'news.widget.hot', icon: 'flame', defaultSize: { w: 4, h: 6 }, minSize: { w: 2, h: 3 }, multiple: true },
		{ key: 'news-view', titleKey: 'news.widget.view', icon: 'list-filter', defaultSize: { w: 4, h: 6 }, minSize: { w: 2, h: 3 }, multiple: true },
	],
};

