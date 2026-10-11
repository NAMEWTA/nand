import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import type { NewsFilter } from '../core/model';
import { normalizeNewsFilter } from '../core/views';

export const NEWS_SECTIONS = ['featured', 'all', 'hot', 'today', 'favorites', 'sources', 'runs', 'views'] as const;
export type NewsSection = typeof NEWS_SECTIONS[number];
export interface NewsPageState { section: NewsSection; selected: string; view: string; filter: NewsFilter; order: 'asc' | 'desc'; }
export function newsPageState(raw: Record<string, unknown> = {}): NewsPageState {
	const bounded = (value: unknown): string => typeof value === 'string' ? value.slice(0, 120) : '';
	return { section: NEWS_SECTIONS.includes(raw.section as NewsSection) ? raw.section as NewsSection : 'featured', selected: bounded(raw.selected), view: bounded(raw.view), filter: normalizeNewsFilter(raw.filter), order: raw.order === 'asc' ? 'asc' : 'desc' };
}
export function newsTarget(state: NewsPageState): WorkbenchTarget {
	return { feature: 'news', section: state.section, ...(state.section === 'views' && state.view ? { resourceId: state.view } : state.selected ? { resourceId: state.selected } : {}) };
}
