// Timeline rules adapted from KKKKhazix/AIHOT c547b669acc7f64720cd82024e502446ee1ef88d (MIT).
// Copyright (c) 2026 数字生命卡兹克. See NOTICE and docs/third-party/aihot-news.md.
import type { NewsMaterial } from './model';
import { normalizeLanguage } from './analysis-policy';

export interface MaterialInput {
	sourceId: string;
	sourceItemId?: string;
	url: string;
	title: string;
	summary?: string;
	body?: string;
	author?: string;
	language?: string;
	publishedAt?: number;
	discoveredAt?: number;
	firstSeenAt?: number;
	initialImport?: boolean;
}

const TRACKING = /^(?:utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|vero_id)$/i;
export function canonicalNewsUrl(input: string, preserveFragment = false): string {
	try {
		const url = new URL(input.trim());
		if (url.protocol === 'http:' || url.protocol === 'https:') url.protocol = 'https:';
		else url.protocol = url.protocol.toLowerCase();
		url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
		if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
		if (!preserveFragment) url.hash = '';
		const params = [...url.searchParams.entries()].filter(([key]) => !TRACKING.test(key)).sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(b));
		url.search = '';
		for (const [key, value] of params) url.searchParams.append(key, value);
		if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
		return url.toString();
	} catch { return input.trim(); }
}

function normalizeText(value: string | undefined): string {
	return (value ?? '').replace(/\s+/g, ' ').trim();
}
async function hash(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function dateReason(publishedAt: number | undefined, discoveredAt: number, existing: NewsMaterial | undefined): NewsMaterial['backfillReason'] {
	if (existing?.backfillReason === 'initial-import' || existing?.backfillReason === 'older-than-window') return existing.backfillReason;
	if (publishedAt === undefined || !Number.isFinite(publishedAt)) return 'unknown-date';
	if (publishedAt < discoveredAt - 48 * 60 * 60 * 1000) return 'older-than-window';
	if (publishedAt > discoveredAt + 60 * 60 * 1000) return 'future-date';
	return undefined;
}

export async function materialIdentity(input: MaterialInput, preserveFragment = false): Promise<{ canonicalKey: string; sourceItemId: string; contentHash: string; id: string }> {
	const canonicalKey = canonicalNewsUrl(input.url, preserveFragment);
	const sourceItemId = normalizeText(input.sourceItemId) || canonicalKey;
	const [contentHash, itemHash] = await Promise.all([hash([normalizeText(input.title), normalizeText(input.body), normalizeText(input.summary)].join('\u0001')), hash(sourceItemId)]);
	return { canonicalKey, sourceItemId, contentHash, id: `${input.sourceId}:${itemHash}` };
}

export async function upsertMaterial(previous: NewsMaterial | undefined, input: MaterialInput, now = Date.now(), preserveFragment = false): Promise<NewsMaterial> {
	// A mirror's rendering of the same canonical article does not revise its owning source.
	if (previous && previous.sourceId !== input.sourceId) return previous;
	input = { ...input, body: input.body ?? previous?.body, summary: input.summary ?? previous?.summary };
	const discoveredAt = previous?.discoveredAt ?? input.discoveredAt ?? input.firstSeenAt ?? now;
	const identity = await materialIdentity(input, preserveFragment);
	const title = normalizeText(input.title);
	const summary = normalizeText(input.summary);
	const body = normalizeText(input.body);
	const claimedAt = previous?.publishedAt ?? input.publishedAt ?? previous?.claimedAt;
	const publishedAt = claimedAt !== undefined && Number.isFinite(claimedAt) && claimedAt <= discoveredAt + 3_600_000 ? claimedAt : undefined;
	const reason = !previous && input.initialImport ? 'initial-import' : dateReason(claimedAt, discoveredAt, previous);
	const filledDate = previous !== undefined && previous.publishedAt === undefined && publishedAt !== undefined;
	const seen = new Set([...(previous?.seenContentHashes ?? []), ...(previous ? [previous.contentHash] : [])]);
	if (previous && !filledDate && previous.contentHash !== identity.contentHash && seen.has(identity.contentHash)) return { ...previous, updatedAt: now };
	const changed = previous !== undefined && (previous.contentHash !== identity.contentHash || filledDate);
	seen.add(identity.contentHash);
	return {
		id: previous?.id ?? identity.id,
		sourceId: input.sourceId,
		language: normalizeLanguage(input.language) ?? previous?.language,
		sourceItemId: identity.sourceItemId,
		originalUrl: previous?.originalUrl ?? input.url.trim(),
		canonicalKey: identity.canonicalKey,
		canonicalUrl: identity.canonicalKey,
		title,
		author: normalizeText(input.author) || previous?.author,
		bodyExcerpt: body || summary,
		summary,
		body,
		publishedAt,
		claimedAt,
		discoveredAt,
		firstSeenAt: previous?.firstSeenAt ?? discoveredAt,
		updatedAt: now,
		revision: previous ? previous.revision + (changed ? 1 : 0) : 1,
		contentHash: identity.contentHash,
		seenContentHashes: [...seen],
		hash: identity.contentHash,
		...(reason ? { backfillReason: reason } : {}),
	};
}

export function isTodayMaterial(material: NewsMaterial, now = Date.now()): boolean {
	if (material.backfillReason) return false;
	const start = new Date(now); start.setHours(0, 0, 0, 0);
	const end = new Date(start); end.setDate(end.getDate() + 1);
	const at = material.publishedAt;
	return at !== undefined && at >= start.getTime() && at < end.getTime();
}
