import { t } from '../../../shared/i18n';
import type { NewsReadService, NewsWorkbench } from '../api';
import type { NewsActions } from './news-actions';

const sections = ['featured', 'all', 'hot', 'today', 'favorites', 'sources', 'runs'] as const;
const icons = ['sparkles', 'list', 'flame', 'calendar-days', 'bookmark', 'rss', 'history'];
export function newsWorkbench(service: NewsReadService, actions: NewsActions): NewsWorkbench {
	return {
		subscribe: listener => service.subscribe(listener),
		title: target => target.section === 'views' ? service.views().find(view => view.id === target.resourceId)?.name ?? t('news.section.views') : t(`news.section.${sections.find(section => section === target.section) ?? 'featured'}`),
		panel: target => ({ searchable: true, primary: { label: t('news.refresh'), icon: 'refresh-cw', run: async () => { await actions.enable(); await service.refresh(); } }, sections: [
			{ id: 'sections', items: sections.map((section, index) => ({ id: section, label: t(`news.section.${section}`), icon: icons[index], target: { feature: 'news', section }, active: (target.section ?? 'featured') === section })) },
			{ id: 'views', title: t('news.section.views'), emptyText: t('news.view.empty'), items: service.views().map(view => ({ id: `view-${view.id}`, label: view.name, icon: 'filter', target: { feature: 'news', section: 'views', resourceId: view.id }, active: target.section === 'views' && target.resourceId === view.id })) },
			{ id: 'categories', title: t('news.filter.category'), items: [...new Set(service.analyses().map(item => item.category))].filter(Boolean).sort().map(category => ({ id: `category-${category}`, label: category, icon: 'tag', target: { feature: 'news', section: 'all', focusId: `category:${category}` } })) },
			{ id: 'health', title: t('news.section.sources'), items: service.sources().map(source => {
				const health = service.health(source.id), state = !source.enabled ? 'disabled' : health?.failureCount ? 'retrying' : health?.lastSuccess ? 'healthy' : 'new';
				return { id: `source-${source.id}`, label: source.name, icon: 'rss', meta: t(`news.health.${state}`), target: { feature: 'news' as const, section: 'all', focusId: `source:${source.id}` } };
			}) },
			{ id: 'recent', title: t('news.section.runs'), items: service.runHistory().slice(0, 5).map(run => ({ id: `run-${run.id}`, label: t(`news.run.${run.status}`), meta: new Date(run.at).toLocaleString(), icon: 'history', target: { feature: 'news', section: 'runs', resourceId: run.id } })) },
		] }),
	};
}
