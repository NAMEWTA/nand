import { domainSettings } from '../../shared/settings/schema';
import { normalizeNewsSource, type NewsSource, type NewsView } from './core/model';

export interface NewsSettings {
	enabled: boolean;
	sources: NewsSource[];
	views: NewsView[];
	interest: string;
	analysisEnabled: boolean;
	dailyEditionEnabled: boolean;
	/** Background refresh remains opt-in even after the module is enabled. */
	autoRefresh: boolean;
}
const isNewsView = (view: unknown): view is NewsView =>
	typeof view === 'object' && view !== null && 'id' in view && typeof view.id === 'string';
export const newsSettings = domainSettings<NewsSettings>({
	defaults: () => ({ enabled: false, sources: [], views: [], interest: '', analysisEnabled: false, dailyEditionEnabled: false, autoRefresh: false }),
	normalize: (raw) => {
		const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
		return {
			enabled: value.enabled === true,
			sources: Array.isArray(value.sources) ? value.sources.map(normalizeNewsSource).filter((source): source is NewsSource => source !== undefined) : [],
			views: Array.isArray(value.views) ? value.views.filter(isNewsView) : [],
			interest: typeof value.interest === 'string' ? value.interest.slice(0, 1000) : '',
			analysisEnabled: value.analysisEnabled === true,
			dailyEditionEnabled: value.dailyEditionEnabled === true,
			autoRefresh: value.autoRefresh === true,
		};
	},
});
