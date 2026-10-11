import { domainSettings, type Schema } from '../../shared/settings/schema';
import type { AgentId } from '../agent/api';
import type { NotificationChannelId } from '../notifications/api';
import { normalizeNewsSource, type NewsSource, type NewsView } from './core/model';
import { normalizeNewsView } from './core/views';
import { defaultNewsWidgets, normalizeNewsWidgets, type NewsWidgetConfig } from './core/home-widgets';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, validWeights, type NewsThresholds, type NewsWeights } from './core/scoring';
import { DEFAULT_TEMPLATES, type NewsPromptTemplates } from './core/prompt-templates';
import { normalizePrefilter, normalizeVocabulary, type NewsPrefilter, type NewsVocabulary } from './core/analysis-policy';
import { normalizeHeatRules, normalizeEditionRules, normalizeGroupingRules, type HeatRules, type EditionRules, type GroupingRules } from './core/editorial-rules';
import { favoriteFolder, editionFolder } from './core/note-folders';

export interface NewsSettings {
	enabled: boolean;
	sources: NewsSource[];
	views: NewsView[];
	widgets?: NewsWidgetConfig[];
	interest: string;
	analysisEnabled: boolean;
	writeDailyNote: boolean;
	notifyOn?: 'failure' | 'always' | 'never';
	notificationChannels?: NotificationChannelId[];
	/** Background refresh remains opt-in even after the module is enabled. */
	autoRefresh: boolean;
	refreshOnStartup?: boolean;
	refreshWhenStale?: boolean;
	staleMinutes?: number;
	agentId?: AgentId | '';
	cwd?: string;
	batchSize?: number;
	bodyLimit?: number;
	batchTimeoutMinutes?: number;
	keepTerminal?: boolean;
	dailyCallLimit?: number;
	doubleScore?: boolean;
	weights?: NewsWeights;
	thresholds?: NewsThresholds;
	templates?: NewsPromptTemplates;
	prefilter?: NewsPrefilter;
	vocabulary?: NewsVocabulary;
	heatRules?: HeatRules;
	editionRules?: EditionRules;
	groupingRules?: GroupingRules;
	understandFloor?: number;
	retentionDays?: number;
	adaptiveInterval?: boolean;
	favoriteFolder?: string;
	editionFolder?: string;
}
const newsDomain = domainSettings<NewsSettings>({
	defaults: () => ({ enabled: false, sources: [], views: [], widgets: defaultNewsWidgets(), retentionDays: 30, adaptiveInterval: true, favoriteFolder: favoriteFolder({}), editionFolder: editionFolder({}), heatRules: normalizeHeatRules(undefined), editionRules: normalizeEditionRules(undefined), groupingRules: normalizeGroupingRules(undefined), understandFloor: 50, prefilter: normalizePrefilter(undefined), vocabulary: normalizeVocabulary(undefined), interest: '', analysisEnabled: false, writeDailyNote: false, notifyOn: 'failure', notificationChannels: ['in-app'], autoRefresh: false, refreshOnStartup: false, refreshWhenStale: false, staleMinutes: 60, batchSize: 12, bodyLimit: 1500, batchTimeoutMinutes: 10, keepTerminal: false, dailyCallLimit: 20, doubleScore: false, weights: structuredClone(DEFAULT_WEIGHTS), thresholds: { ...DEFAULT_THRESHOLDS }, templates: { ...DEFAULT_TEMPLATES } }),
	normalize: (raw) => {
		const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
		const integer = (key: string, fallback: number, min: number, max: number): number => typeof value[key] === 'number' && Number.isFinite(value[key]) ? Math.round(Math.max(min, Math.min(max, value[key]))) : fallback;
		const rawThresholds = value.thresholds && typeof value.thresholds === 'object' ? value.thresholds as Record<string, unknown> : {};
		const rawTemplates = value.templates && typeof value.templates === 'object' ? value.templates as Record<string, unknown> : {};
		return {
			enabled: value.enabled === true,
			widgets: normalizeNewsWidgets(value.widgets),
			sources: Array.isArray(value.sources) ? value.sources.map(normalizeNewsSource).filter((source): source is NewsSource => source !== undefined) : [],
			views: Array.isArray(value.views) ? [...new Map(value.views.map(normalizeNewsView).filter((view): view is NewsView => !!view).map(view => [view.id, view])).values()].slice(0, 100) : [],
			interest: typeof value.interest === 'string' ? value.interest.slice(0, 1000) : '',
			prefilter: normalizePrefilter(value.prefilter), vocabulary: normalizeVocabulary(value.vocabulary),
			heatRules: normalizeHeatRules(value.heatRules), editionRules: normalizeEditionRules(value.editionRules),
			groupingRules: normalizeGroupingRules(value.groupingRules), understandFloor: integer('understandFloor', 50, 0, 100),
			retentionDays: integer('retentionDays', 30, 1, 365), adaptiveInterval: value.adaptiveInterval !== false,
			favoriteFolder: favoriteFolder({ favoriteFolder: typeof value.favoriteFolder === 'string' ? value.favoriteFolder : undefined }),
			editionFolder: editionFolder({ editionFolder: typeof value.editionFolder === 'string' ? value.editionFolder : undefined }),
			analysisEnabled: value.analysisEnabled === true,
			writeDailyNote: value.writeDailyNote === true,
			notifyOn: value.notifyOn === 'always' || value.notifyOn === 'never' ? value.notifyOn : 'failure',
			notificationChannels: Array.isArray(value.notificationChannels) ? [...new Set(value.notificationChannels.filter((item): item is NotificationChannelId => item === 'in-app' || item === 'system'))] : ['in-app'],
			autoRefresh: value.autoRefresh === true,
			refreshOnStartup: value.refreshOnStartup === true,
			refreshWhenStale: value.refreshWhenStale === true,
			staleMinutes: typeof value.staleMinutes === 'number' && Number.isFinite(value.staleMinutes) ? Math.round(Math.max(15, Math.min(1440, value.staleMinutes))) : 60,
			agentId: typeof value.agentId === 'string' && ['claude-code', 'codex', 'grok', 'opencode', 'gemini', 'pi'].includes(value.agentId) ? value.agentId as AgentId : '',
			cwd: typeof value.cwd === 'string' ? value.cwd : '',
			batchSize: integer('batchSize', 12, 1, 12), bodyLimit: integer('bodyLimit', 1500, 100, 10_000), dailyCallLimit: integer('dailyCallLimit', 20, 0, 1000),
			batchTimeoutMinutes: integer('batchTimeoutMinutes', 10, 1, 120), keepTerminal: value.keepTerminal === true,
			doubleScore: value.doubleScore === true,
			weights: validWeights(value.weights) ? structuredClone(value.weights) : structuredClone(DEFAULT_WEIGHTS),
			thresholds: Object.fromEntries(Object.entries(DEFAULT_THRESHOLDS).map(([key, fallback]) => [key, typeof rawThresholds[key] === 'number' && Number.isInteger(rawThresholds[key]) && rawThresholds[key] >= 0 && rawThresholds[key] <= 100 ? rawThresholds[key] : fallback])) as unknown as NewsThresholds,
			templates: Object.fromEntries(Object.entries(DEFAULT_TEMPLATES).map(([key, fallback]) => [key, typeof rawTemplates[key] === 'string' ? rawTemplates[key] : fallback])) as unknown as NewsPromptTemplates,
		};
	},
});

export const newsSettings: Schema<NewsSettings> = {
	...newsDomain,
	pick(value, scope) {
		const { agentId, cwd, ...vault } = value;
		return scope === 'device' ? { agentId, cwd } : vault;
	},
};
