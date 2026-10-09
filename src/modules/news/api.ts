import { serviceKey } from '../../app/contracts/module';
import { HOME_WIDGETS } from '../home/api';
import type { NewsAnalysis, NewsHeatSnapshot, NewsMaterial, NewsSource, NewsSourceHealth, NewsStory, NewsView } from './core/model';

export type { NewsAnalysis, NewsHeatSnapshot, NewsMaterial, NewsSource, NewsSourceHealth, NewsStory, NewsView };

export interface NewsReadService {
	sources(): readonly NewsSource[];
	materials(): readonly NewsMaterial[];
	analyses(): readonly NewsAnalysis[];
	stories(): readonly NewsStory[];
	heat(): readonly NewsHeatSnapshot[];
	views(): readonly NewsView[];
	health(sourceId: string): NewsSourceHealth | undefined;
	focusedId(): string;
	refresh(sourceId?: string): Promise<void>;
	subscribe(listener: () => void): () => void;
}

export const NEWS_READ = serviceKey<NewsReadService>('news', 'read');

/** News contributes to the home widget point. Home does not import the news UI. */
export const NEWS_HOME_WIDGETS = HOME_WIDGETS;
