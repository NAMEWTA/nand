import type { NewsHeatSnapshot, NewsMaterial, NewsSource, NewsSourceHealth, NewsStory } from './model';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WINDOW = 48 * HOUR;
const SHIFT = 6 * HOUR;
/** AIHOT heat-v1: 48h window, 24h half-life, rewritten here without the upstream name. */
export const HEAT_RULE_VERSION = 'heat-v1';

export interface HeatFact {
	eventId: string;
	participantId: string;
	editorial: boolean;
	at: number;
	sourceId: string;
	addedAt: number;
	stale: boolean;
	withdrawn?: boolean;
}

export interface HeatRank {
	eventId: string;
	raw: number;
	index: number;
	/** Comparable-cohort heat. Absent when this hour must stay a gap. */
	curve?: number;
	participants: number;
	editorial: number;
	latest: number;
	trend: 'new' | 'up' | 'down' | 'flat' | 'unknown';
	badge?: 'surge' | 'new' | 'rising';
	cohort: string;
}

export function participantKey(
	source: Pick<NewsSource, 'id' | 'participation' | 'participantStrategy' | 'groupId' | 'ownerEntityId'>,
	author?: string,
): string | undefined {
	if (source.participation === 'isolated') return undefined;
	const strategy = source.participantStrategy;
	if (strategy === 'community' || strategy === 'author') return author ? `a:${author}` : undefined;
	if (strategy === 'group') return source.groupId ? `g:${source.groupId}` : undefined;
	if (strategy === 'owner') return source.ownerEntityId ? `o:${source.ownerEntityId}` : undefined;
	if (strategy === 'source') return `s:${source.id}`;
	if (source.groupId) return `g:${source.groupId}`;
	if (source.ownerEntityId) return `o:${source.ownerEntityId}`;
	return `s:${source.id}`;
}

/** A source is behind when its last success is older than max(3 intervals, 90 minutes). */
export function sourceIsStale(lastSuccess: number | undefined, intervalMinutes: number, now: number): boolean {
	if (lastSuccess === undefined) return true;
	return now - lastSuccess > Math.max(3 * intervalMinutes * 60_000, 90 * 60_000);
}

function inWindow(at: number, end: number): boolean {
	return at > end - WINDOW && at <= end;
}

function latestMap(facts: readonly HeatFact[], end: number, allow: (fact: HeatFact) => boolean): Map<string, HeatFact> {
	const map = new Map<string, HeatFact>();
	for (const fact of facts) {
		if (fact.withdrawn || !allow(fact) || !inWindow(fact.at, end)) continue;
		const prev = map.get(fact.participantId);
		if (!prev || fact.at >= prev.at) map.set(fact.participantId, fact);
	}
	return map;
}

function rawOf(map: Map<string, HeatFact>, end: number): number {
	let sum = 0;
	for (const fact of map.values()) sum += 0.5 ** ((end - fact.at) / DAY);
	return sum;
}

function heatIndex(raw: number): number {
	return Math.round(raw * 100) / 10;
}

/** Rank events from original-publication times. One participant counts once; the window is (t-48h, t]. */
export function rankHeat(facts: readonly HeatFact[], now: number): HeatRank[] {
	const byEvent = new Map<string, HeatFact[]>();
	for (const fact of facts) {
		if (fact.withdrawn) continue;
		const list = byEvent.get(fact.eventId);
		if (list) list.push(fact);
		else byEvent.set(fact.eventId, [fact]);
	}
	const rows: HeatRank[] = [];
	const priorEnd = now - SHIFT;
	for (const [eventId, group] of byEvent) {
		const current = latestMap(group, now, () => true);
		let editorial = 0;
		let latest = 0;
		for (const fact of current.values()) {
			if (fact.editorial) editorial += 1;
			if (fact.at > latest) latest = fact.at;
		}
		if (current.size < 2 || editorial < 1) continue;
		const raw = rawOf(current, now);
		const comparable = (fact: HeatFact) => !fact.stale && fact.addedAt <= priorEnd - WINDOW;
		const currentCohort = latestMap(group, now, comparable);
		const priorCohort = latestMap(group, priorEnd, comparable);
		const shared: string[] = [];
		for (const id of currentCohort.keys()) if (priorCohort.has(id)) shared.push(id);
		const prevAll = rawOf(latestMap(group, priorEnd, () => true), priorEnd);
		const sharedNow = new Map<string, HeatFact>();
		const sharedThen = new Map<string, HeatFact>();
		for (const id of shared) {
			const left = currentCohort.get(id);
			const right = priorCohort.get(id);
			if (left) sharedNow.set(id, left);
			if (right) sharedThen.set(id, right);
		}
		const curRaw = rawOf(sharedNow, now);
		const prevRaw = rawOf(sharedThen, priorEnd);
		let trend: HeatRank['trend'] = 'flat';
		if (prevAll <= 0) trend = 'new';
		else if (shared.length === 0 || prevRaw <= 0) trend = 'unknown';
		else if (curRaw > prevRaw * 1.1) trend = 'up';
		else if (curRaw < prevRaw * 0.9) trend = 'down';
		const first = new Map<string, number>();
		for (const fact of group) {
			if (fact.withdrawn) continue;
			const prev = first.get(fact.participantId);
			if (prev === undefined || fact.at < prev) first.set(fact.participantId, fact.at);
		}
		const joined = [...current.keys()].filter((id) => (first.get(id) ?? 0) > now - SHIFT);
		let earliest = Number.POSITIVE_INFINITY;
		for (const at of first.values()) if (at < earliest) earliest = at;
		let badge: HeatRank['badge'];
		if (joined.length >= 3 && joined.length * 2 >= current.size) badge = 'surge';
		else if (earliest > now - SHIFT) badge = 'new';
		else if (trend !== 'unknown' && trend !== 'new' && prevRaw > 0 && curRaw > prevRaw * 1.15) badge = 'rising';
		const cohortIds = shared.length ? shared : [...current.keys()];
		rows.push({
			eventId,
			raw,
			index: heatIndex(raw),
			...(shared.length || prevAll <= 0 ? { curve: heatIndex(shared.length ? curRaw : raw) } : {}),
			participants: current.size,
			editorial,
			latest,
			trend,
			cohort: cohortIds.sort().join(','),
			...(badge ? { badge } : {}),
		});
	}
	rows.sort((left, right) => right.raw - left.raw || right.latest - left.latest);
	return rows.slice(0, 10);
}

export function heatFacts(
	materials: readonly NewsMaterial[],
	sources: readonly NewsSource[],
	health: Readonly<Record<string, Pick<NewsSourceHealth, 'initializedAt' | 'lastSuccess'>>>,
	stories: readonly NewsStory[],
	now: number,
): HeatFact[] {
	const facts: HeatFact[] = [];
	for (const material of materials) {
		const source = sources.find((item) => item.id === material.sourceId);
		const at = material.publishedAt ?? material.claimedAt;
		if (!source || at === undefined) continue;
		const participantId = participantKey(source, material.author);
		if (!participantId) continue;
		const story = stories.find((item) => item.materialIds.includes(material.id));
		const state = health[source.id];
		facts.push({
			eventId: story?.id ?? `story-${material.id}`,
			participantId,
			editorial: source.participation === 'editorial',
			at,
			sourceId: source.id,
			addedAt: state?.initializedAt ?? 0,
			stale: sourceIsStale(state?.lastSuccess, source.intervalMinutes, now),
		});
	}
	return facts;
}

/** Record only the hour that just closed. Missed hours stay absent. */
export function closeHeatHour(facts: readonly HeatFact[], now: number, previous: readonly NewsHeatSnapshot[]): NewsHeatSnapshot[] {
	const closed = Math.floor(now / HOUR) * HOUR - HOUR;
	const end = closed + HOUR;
	if (end > now) return [];
	return rankHeat(facts, end).flatMap((row) => {
		if (row.curve === undefined) return [];
		const seen = previous.some((item) => (item.eventId ?? item.sourceId) === row.eventId && item.hour === closed && item.complete !== false);
		if (seen) return [];
		return [{
			sourceId: row.eventId,
			eventId: row.eventId,
			score: row.curve,
			observedAt: end,
			hour: closed,
			complete: true,
			cohort: row.cohort,
			cohortSize: row.participants,
			participants: row.participants,
			ruleVersion: HEAT_RULE_VERSION,
		}];
	});
}

/** Observed complete hours only. Missing hours are not zeroes, and a curve needs at least three points. */
export function heatSeries(
	snapshots: readonly NewsHeatSnapshot[],
	now: number,
	spanHours: 24 | 72 | 168,
	eventId?: string,
): { points: { hour: number; heat: number }[]; draw: boolean; from: number; to: number } {
	const start = now - spanHours * HOUR;
	let chosen = eventId;
	if (!chosen) {
		let best = -1;
		for (const snap of snapshots) {
			const hour = snap.hour ?? Math.floor(snap.observedAt / HOUR) * HOUR;
			if (snap.complete === false || hour + HOUR > now || hour < best) continue;
			best = hour;
			chosen = snap.eventId ?? snap.sourceId;
		}
	}
	const byHour = new Map<number, { hour: number; heat: number; cohort: string }>();
	for (const snap of snapshots) {
		const id = snap.eventId ?? snap.sourceId;
		if (chosen && id !== chosen) continue;
		const hour = snap.hour ?? Math.floor(snap.observedAt / HOUR) * HOUR;
		const closed = hour + HOUR;
		if (snap.complete === false || closed > now || closed <= start) continue;
		byHour.set(hour, { hour, heat: snap.score, cohort: snap.cohort ?? '' });
	}
	const ordered = [...byHour.values()].sort((left, right) => left.hour - right.hour);
	const last = ordered[ordered.length - 1];
	const cohort = last ? last.cohort : '';
	const points = ordered.filter((row) => row.cohort === cohort).map((row) => ({ hour: row.hour, heat: row.heat }));
	return {
		points,
		draw: points.length >= 3,
		from: points[0]?.hour ?? 0,
		to: points[points.length - 1]?.hour ?? 0,
	};
}
