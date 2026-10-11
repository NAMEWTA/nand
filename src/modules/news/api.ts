import { serviceKey } from '../../app/contracts/module';
import type { PanelModel, WorkbenchTarget } from '../../app/contracts/workbench';
import { HOME_WIDGETS } from '../home/api';
import type { NewsAnalysis, NewsBrief, NewsHeatSnapshot, NewsMaterial, NewsOccurrence, NewsRun, NewsSource, NewsSourceHealth, NewsStory, NewsView } from './core/model';
import type { HeatFact, HeatRank } from './core/heat';
import type { HeatRules } from './core/editorial-rules';
import type { NewsWidgetConfig } from './core/home-widgets';

export type { NewsAnalysis, NewsHeatSnapshot, NewsMaterial, NewsSource, NewsSourceHealth, NewsStory, NewsView };

export interface NewsReadService {
	runHistory(): readonly NewsRun[];
	callBudget(): { used: number; limit: number };
	analysisActivity(): readonly { id: string; status: 'running' | 'needs-attention'; terminalId: string }[];
	sources(): readonly NewsSource[];
	materials(): readonly NewsMaterial[];
	favorites(): readonly NewsMaterial[];
	favoriteIssues(): readonly string[];
	favoriteLocation(id: string): string | undefined;
	analyses(): readonly NewsAnalysis[];
	stories(): readonly NewsStory[];
	story(id: string): NewsStory | undefined;
	brief(id: string): NewsBrief | undefined;
	occurrences(): readonly NewsOccurrence[];
	heat(): readonly NewsHeatSnapshot[];
	heatRules(): HeatRules;
	heatEvidence(now?: number): readonly HeatFact[];
	hot(now?: number): readonly HeatRank[];
	views(): readonly NewsView[];
	widgets(): readonly NewsWidgetConfig[];
	isHidden(id: string): boolean;
	collectionActivity(): { pending: number; lastSuccess?: number; enabled: boolean };
	health(sourceId: string): NewsSourceHealth | undefined;
	refresh(sourceId?: string): Promise<void>;
	/** Applies the explicit stale-refresh policy using this instance's threshold. */
	refreshWidget(instanceId: string): Promise<void>;
	subscribe(listener: () => void): () => void;
}

export const NEWS_READ = serviceKey<NewsReadService>('news', 'read');
export interface NewsWorkbench { panel(target: WorkbenchTarget): PanelModel; title(target: WorkbenchTarget): string; subscribe(listener: () => void): () => void; }
export const NEWS_WORKBENCH = serviceKey<NewsWorkbench>('news', 'workbench');

/** News contributes to the home widget point. Home does not import the news UI. */
export const NEWS_HOME_WIDGETS = HOME_WIDGETS;
