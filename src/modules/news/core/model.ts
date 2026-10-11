export type NewsSourceType = 'rss' | 'atom' | 'jsonfeed' | 'web-list';
export type NewsSourceKind = NewsSourceType | 'json';
export type NewsTier = 'T1' | 'T1_5' | 'T2' | 'unlisted';
export type NewsParticipation = 'editorial' | 'signal' | 'isolated';

export interface NewsSource {
	id: string;
	name: string;
	type: NewsSourceType;
	kind?: NewsSourceKind;
	url: string;
	tier: NewsTier;
	participation: NewsParticipation;
	participantStrategy?: 'author' | 'community' | 'group' | 'owner' | 'source';
	groupId?: string;
	ownerEntityId?: string;
	publisherRole?: string;
	intervalMinutes: number;
	enabled: boolean;
	selectors?: { item: string; link: string; title: string; date?: string; preserveFragment?: boolean };
}

export interface NewsSourceHealth {
	scheduleKey?: string;
	lastAttempt?: number;
	lastSuccess?: number;
	failureCount: number;
	nextDue?: number;
	initializedAt: number;
	etag?: string;
	lastModified?: string;
	configHash: string;
	intervalMinutes?: number;
	lastError?: string;
}

export interface NewsMaterial {
	id: string;
	sourceId: string;
	sourceItemId: string;
	originalUrl: string;
	canonicalKey: string;
	title: string;
	author?: string;
	language?: string;
	bodyExcerpt: string;
	publishedAt?: number;
	claimedAt?: number;
	discoveredAt: number;
	revision: number;
	contentHash: string;
	/** Previously accepted content within the retained cache; rotating old text is not a new revision. */
	seenContentHashes?: string[];
	backfillReason?: 'initial-import' | 'older-than-window' | 'unknown-date' | 'future-date';
	canonicalUrl?: string;
	summary?: string;
	body?: string;
	firstSeenAt?: number;
	updatedAt?: number;
	hash?: string;
	labels?: string[];
	withdrawn?: boolean;
}

export interface NewsOccurrence { id: string; materialIds: string[]; storyId: string; firstSeenAt: number; latestAt: number; kind: 'report' | 'follow-up' | 'analysis' | 'roundup'; title?: string; frame?: NewsFactFrame; }
export interface NewsStory { id: string; title: string; materialIds: string[]; occurrenceIds: string[]; firstSeenAt: number; latestAt: number; category?: string; representativeId?: string; rootOccurrenceId?: string; aliases?: string[]; }
export type NewsRelationKind = 'SAME_OCCURRENCE' | 'SAME_STORY' | 'UNRELATED' | 'ROUNDUP';
export interface NewsRelation { kind: NewsRelationKind; targetId: string; confidence: number; }
export interface NewsGroupRecord { materialId: string; revision: number; contentHash: string; version: string; analyzedAt: number; confirmed: boolean; }
export interface NewsMention { materialId: string; occurrenceId: string; }
export interface NewsMergeProposal { id: string; leftId: string; rightId: string; left: NewsMaterial; right: NewsMaterial; bridgeId: string; }
export interface NewsMergeReview { proposalId: string; kind: NewsRelationKind; confidence: number; }
export interface NewsEvents {
	stories: NewsStory[]; occurrences: NewsOccurrence[]; records: NewsGroupRecord[]; mentions: NewsMention[];
	proposals: NewsMergeProposal[]; reviews: NewsMergeReview[];
}
export interface NewsScoreAxes { sig: number; nov: number; cred: number; reson: number; act: number; }
export type NewsItemType = 'model_release' | 'product_launch' | 'tool_or_prompt' | 'research_paper' | 'industry_event' | 'opinion_analysis' | 'tutorial_explainer';
export type NewsQualityFlag = 'routine_update' | 'marketing' | 'preview' | 'weak_experience' | 'roundup' | 'vendor_howto' | 'narrow_research' | 'pr_without_data' | 'title_conflict' | 'insufficient_event';
export interface NewsScoreSample { itemType: NewsItemType; axes: NewsScoreAxes; qualityFlags: NewsQualityFlag[]; }
export interface NewsFactFrame {
	title: string;
	subject: string;
	action: string;
	object: string;
	occurredAt: string | null;
	evidence: string;
	conditions: string[];
}
export interface NewsAnalysisRow extends NewsScoreSample {
	id: string;
	relevance: 'PASS' | 'BLOCK' | 'UNKNOWN';
	scope: 'single' | 'composite' | 'unknown';
	subject: string | null;
	frame: NewsFactFrame | null;
	category: string;
	tags: string[];
	titleZh: string;
	summaryZh: string;
	reason: string;
	relations: NewsRelation[];
}
export interface NewsAnalysis extends Omit<NewsAnalysisRow, 'id'> {
	/** The accepted batch's relation threshold; later settings never reinterpret its memberships. */
	groupingConfidence?: number;
	materialId: string;
	agentId?: string;
	accountIdentity?: string;
	revision: number;
	contentHash: string;
	version: string;
	samples: NewsScoreSample[];
	sampleScores: number[];
	groupConfirmed: boolean;
	accepted: boolean;
	score: number;
	target: 'featured' | 'brief' | 'ignore';
	createdAt: number;
}
export interface NewsFilter { category?: string; tags?: string[]; sourceIds?: string[]; minScore?: number; query?: string; }
export interface NewsView extends NewsFilter { id: string; name: string; }
export interface NewsEditionEntry {
	materialId: string; storyId?: string; occurrenceIds: string[]; relatedIds: string[];
	sourceIds: string[]; participants: number; official: boolean; importance: number;
	followUp?: string; fillIn?: boolean;
}
export interface NewsEdition {
	id: string; date: string; startAt: number; endAt: number; timeZone: string; offsetMinutes: number;
	main: NewsEditionEntry[]; flashes: NewsEditionEntry[];
	materialIds: string[]; storyIds: string[]; generatedAt: number;
}
export interface NewsRunReceipt {
	kind: 'analysis' | 'brief' | 'grouping';
	state: 'started' | 'received' | 'applied' | 'failed' | 'interrupted';
	day: string;
	batchId: string;
	sample: number;
	attempt: number;
	agentId?: string;
	accountIdentity?: string;
	plan?: AnalysisPlan;
	merge?: NewsMergeProposal;
	brief?: { storyId: string; title: string; urls: string[]; materialId: string };
	result?: AgentPromptResult;
	usageKnown: boolean;
	endedAt?: number;
	errorCode?: string;
}
export interface NewsRun { id: string; at: number; status: string; calls: number; spent: number; storyId?: string; materialId?: string; receipt?: NewsRunReceipt; }
export interface NewsBrief { id: string; path: string; body: string; }
export interface NewsBriefResult { status: 'complete' | 'needs-attention' | 'budget' | 'failed'; runId: string; path?: string; calls: number; }
export interface NewsHeatSnapshot {
	eventId: string;
	hour: number;
	score: number;
	observedAt: number;
	cohortSize: number;
	participants: number;
	complete: boolean;
	cohort: string;
	ruleVersion: string;
}

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
export function normalizeNewsSource(raw: unknown): NewsSource | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const value = raw as Partial<NewsSource> & { type?: string; kind?: string };
	if (typeof value.id !== 'string' || !ID.test(value.id) || typeof value.url !== 'string' || typeof value.name !== 'string') return undefined;
	if (value.type !== undefined && !['rss', 'atom', 'jsonfeed', 'web-list'].includes(value.type)) return undefined;
	const type: NewsSourceType = value.type === 'atom' || value.type === 'jsonfeed' || value.type === 'web-list' ? value.type : value.kind === 'json' ? 'jsonfeed' : value.kind === 'atom' ? 'atom' : value.kind === 'web-list' ? 'web-list' : 'rss';
	const participation: NewsParticipation = value.participation === 'signal' || value.participation === 'isolated' ? value.participation : 'editorial';
	const ceiling = participation === 'signal' ? 180 : 60;
	const intervalMinutes = typeof value.intervalMinutes === 'number' && Number.isFinite(value.intervalMinutes) ? Math.max(15, Math.min(ceiling, Math.round(value.intervalMinutes))) : 60;
	try {
		const url = new URL(value.url);
		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
	} catch { return undefined; }
	const selectors = value.selectors;
	if (type === 'web-list' && (!selectors || !['item', 'link', 'title'].every(key => typeof selectors[key as keyof typeof selectors] === 'string' && String(selectors[key as keyof typeof selectors]).trim()))) return undefined;
	const strategy = value.participantStrategy;
	return {
		id: value.id, name: value.name.trim().slice(0, 120) || value.url, type, kind: type, url: value.url.trim(),
		tier: value.tier === 'T1' || value.tier === 'T1_5' || value.tier === 'T2' ? value.tier : 'unlisted', participation,
		...(strategy && ['author', 'community', 'group', 'owner', 'source'].includes(strategy) ? { participantStrategy: strategy } : {}),
		...(typeof value.groupId === 'string' ? { groupId: value.groupId.slice(0, 120) } : {}),
		...(typeof value.ownerEntityId === 'string' ? { ownerEntityId: value.ownerEntityId.slice(0, 120) } : {}),
		...(typeof value.publisherRole === 'string' ? { publisherRole: value.publisherRole.slice(0, 120) } : {}), intervalMinutes, enabled: value.enabled === true,
		...(type === 'web-list' && selectors ? { selectors: { item: selectors.item.trim(), link: selectors.link.trim(), title: selectors.title.trim(), ...(typeof selectors.date === 'string' && selectors.date.trim() ? { date: selectors.date.trim() } : {}), preserveFragment: selectors.preserveFragment === true } } : {}),
	};
}
import type { AgentPromptResult } from '../../agent/api';
import type { AnalysisPlan } from './analysis-run';
