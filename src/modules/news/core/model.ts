export type NewsSourceType = 'rss' | 'atom' | 'jsonfeed' | 'web-list';
export type NewsSourceKind = NewsSourceType | 'json';
export type NewsTier = 'primary' | 'secondary' | 'other';
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
	lastAttempt?: number;
	lastSuccess?: number;
	failureCount: number;
	nextDue?: number;
	initializedAt: number;
	etag?: string;
	lastModified?: string;
	configHash: string;
}

export interface NewsMaterial {
	id: string;
	sourceId: string;
	sourceItemId: string;
	originalUrl: string;
	canonicalKey: string;
	title: string;
	author?: string;
	bodyExcerpt: string;
	publishedAt?: number;
	claimedAt?: number;
	discoveredAt: number;
	revision: number;
	contentHash: string;
	backfillReason?: 'initial-import' | 'older-than-window' | 'unknown-date' | 'future-date';
	canonicalUrl?: string;
	summary?: string;
	body?: string;
	firstSeenAt?: number;
	updatedAt?: number;
	hash?: string;
	labels?: string[];
}

export interface NewsOccurrence { id: string; materialIds: string[]; storyId: string; firstSeenAt: number; latestAt: number; kind: 'report' | 'follow-up' | 'analysis' | 'roundup'; }
export interface NewsStory { id: string; title: string; materialIds: string[]; occurrenceIds: string[]; firstSeenAt: number; latestAt: number; category?: string; representativeId?: string; }
export interface NewsScoreAxes { relevance: number; novelty: number; quality: number; impact: number; clarity: number; }
export interface NewsAnalysis { materialId: string; version: string; accepted: boolean; axes: NewsScoreAxes; score: number; target: 'featured' | 'brief' | 'ignore'; reason?: string; createdAt: number; raw?: string; }
export interface NewsView { id: string; name: string; category?: string; tags?: string[]; sourceIds?: string[]; minScore?: number; query?: string; }
export interface NewsEdition { id: string; date: string; materialIds: string[]; storyIds: string[]; generatedAt: number; }
export interface NewsRun { id: string; at: number; status: string; calls: number; spent: number; storyId?: string; materialId?: string; }
export interface NewsHeatSnapshot {
	sourceId: string;
	score: number;
	observedAt: number;
	cohortSize: number;
	participants: number;
	eventId?: string;
	hour?: number;
	complete?: boolean;
	cohort?: string;
	ruleVersion?: string;
}

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
export function normalizeNewsSource(raw: unknown): NewsSource | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const value = raw as Partial<NewsSource> & { type?: string; kind?: string };
	if (typeof value.id !== 'string' || !ID.test(value.id) || typeof value.url !== 'string' || typeof value.name !== 'string') return undefined;
	const type: NewsSourceType = value.type === 'atom' || value.type === 'jsonfeed' || value.type === 'web-list' ? value.type : value.kind === 'json' ? 'jsonfeed' : value.kind === 'atom' ? 'atom' : value.kind === 'web-list' ? 'web-list' : 'rss';
	const intervalMinutes = typeof value.intervalMinutes === 'number' && Number.isFinite(value.intervalMinutes) ? Math.max(15, Math.min(1440, Math.round(value.intervalMinutes))) : 60;
	const participation: NewsParticipation = value.participation === 'signal' || value.participation === 'isolated' ? value.participation : 'editorial';
	return { id: value.id, name: value.name.trim().slice(0, 120) || value.url, type, kind: type, url: value.url.trim(), tier: value.tier === 'primary' || value.tier === 'secondary' ? value.tier : 'other', participation, ...(typeof value.participantStrategy === 'string' ? { participantStrategy: value.participantStrategy as NewsSource['participantStrategy'] } : {}), ...(typeof value.groupId === 'string' ? { groupId: value.groupId.slice(0, 120) } : {}), ...(typeof value.ownerEntityId === 'string' ? { ownerEntityId: value.ownerEntityId.slice(0, 120) } : {}), ...(typeof value.publisherRole === 'string' ? { publisherRole: value.publisherRole.slice(0, 120) } : {}), intervalMinutes, enabled: value.enabled === true, ...(value.selectors ? { selectors: value.selectors } : {}) };
}
