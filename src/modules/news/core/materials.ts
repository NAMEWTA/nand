import type { NewsMaterial } from './model';

export interface MaterialInput {
	sourceId: string;
	sourceItemId?: string;
	url: string;
	title: string;
	summary?: string;
	body?: string;
	author?: string;
	publishedAt?: number;
	discoveredAt?: number;
	firstSeenAt?: number;
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
function hash(value: string): string {
	let h = 2166136261;
	for (const char of value) { h ^= char.codePointAt(0) ?? 0; h = Math.imul(h, 16777619); }
	return (h >>> 0).toString(16).padStart(8, '0');
}
function dateReason(publishedAt: number | undefined, discoveredAt: number, existing: NewsMaterial | undefined): NewsMaterial['backfillReason'] {
	if (existing?.backfillReason) return existing.backfillReason;
	if (publishedAt === undefined) return 'unknown-date';
	if (publishedAt < discoveredAt - 48 * 60 * 60 * 1000) return 'older-than-window';
	if (publishedAt > discoveredAt + 60 * 60 * 1000) return 'future-date';
	return undefined;
}

export function materialIdentity(input: MaterialInput, preserveFragment = false): { canonicalKey: string; sourceItemId: string; contentHash: string; id: string } {
	const canonicalKey = canonicalNewsUrl(input.url, preserveFragment);
	const sourceItemId = normalizeText(input.sourceItemId) || canonicalKey;
	const contentHash = hash([normalizeText(input.title), normalizeText(input.summary), normalizeText(input.body)].join('\n'));
	return { canonicalKey, sourceItemId, contentHash, id: `${input.sourceId}:${hash(sourceItemId)}` };
}

export function upsertMaterial(previous: NewsMaterial | undefined, input: MaterialInput, now = Date.now(), preserveFragment = false): NewsMaterial {
	const discoveredAt = previous?.discoveredAt ?? input.discoveredAt ?? input.firstSeenAt ?? now;
	const identity = materialIdentity(input, preserveFragment);
	const title = normalizeText(input.title);
	const summary = normalizeText(input.summary);
	const body = normalizeText(input.body);
	const changed = previous !== undefined && previous.contentHash !== identity.contentHash;
	return {
		id: previous?.id ?? identity.id,
		sourceId: input.sourceId,
		sourceItemId: identity.sourceItemId,
		originalUrl: previous?.originalUrl ?? input.url.trim(),
		canonicalKey: identity.canonicalKey,
		canonicalUrl: identity.canonicalKey,
		title,
		author: normalizeText(input.author) || previous?.author,
		bodyExcerpt: body || summary,
		summary,
		body,
		publishedAt: input.publishedAt ?? previous?.publishedAt,
		discoveredAt,
		firstSeenAt: previous?.firstSeenAt ?? discoveredAt,
		updatedAt: now,
		revision: previous ? previous.revision + (changed ? 1 : 0) : 1,
		contentHash: identity.contentHash,
		hash: identity.contentHash,
		...(dateReason(input.publishedAt ?? previous?.publishedAt, discoveredAt, previous) ? { backfillReason: dateReason(input.publishedAt ?? previous?.publishedAt, discoveredAt, previous) } : {}),
	};
}

export function isTodayMaterial(material: NewsMaterial, now = Date.now()): boolean {
	if (material.backfillReason) return false;
	const start = new Date(now); start.setHours(0, 0, 0, 0);
	const at = material.publishedAt ?? material.discoveredAt;
	return at >= start.getTime() && at < start.getTime() + 86_400_000;
}
