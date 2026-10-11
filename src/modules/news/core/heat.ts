// Heat rules adapted from KKKKhazix/AIHOT c547b669acc7f64720cd82024e502446ee1ef88d (MIT), events/hot.ts.
import type { NewsAnalysis, NewsHeatSnapshot, NewsMaterial, NewsSource, NewsSourceHealth, NewsStory } from './model';
import { DEFAULT_HEAT_RULES, HEAT_FIELDS, type HeatRules } from './editorial-rules';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** AIHOT heat-v1: 48h window, 24h half-life, rewritten here without the upstream name. */
export const HEAT_RULE_VERSION = 'heat-v1';
export function heatRuleVersion(rules: HeatRules): string {
	return HEAT_FIELDS.every(([key]) => rules[key] === DEFAULT_HEAT_RULES[key]) ? HEAT_RULE_VERSION : `${HEAT_RULE_VERSION}:${HEAT_FIELDS.map(([key]) => rules[key]).join(':')}`;
}

export interface HeatFact {
	eventId: string;
	participantId: string;
	editorial: boolean;
	at: number;
	sourceId: string;
	addedAt: number;
	stale: boolean;
	withdrawn?: boolean;
	lastSuccess?: number;
	scheduled?: boolean;
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
	trendPct: number | null;
	badges: ('surge' | 'new' | 'rising')[];
	cohort: string;
	complete: boolean;
}

export function participantKey(
	source: Pick<NewsSource, 'id' | 'participation' | 'participantStrategy' | 'groupId' | 'ownerEntityId'>,
	author?: string,
): string | undefined {
	if (source.participation === 'isolated') return undefined;
	const strategy = source.participantStrategy;
	if ((strategy === 'community' || strategy === 'author') && author?.trim()) return `a:${source.groupId || source.id}:${author.trim()}`;
	if (strategy !== 'source' && strategy !== 'owner' && source.groupId) return `g:${source.groupId}`;
	if (strategy !== 'source' && source.ownerEntityId) return `o:${source.ownerEntityId}`;
	return `s:${source.id}`;
}

/** A source is behind when its last success is older than max(3 intervals, 90 minutes). */
export function sourceIsStale(lastSuccess: number | undefined, intervalMinutes: number, now: number): boolean {
	if (lastSuccess === undefined) return true;
	return now - lastSuccess > Math.max(3 * intervalMinutes * 60_000, 90 * 60_000);
}

function inWindow(at: number, end: number, rules: HeatRules): boolean {
	return at > end - rules.windowHours * HOUR && at <= end;
}

function latestMap(facts: readonly HeatFact[], end: number, allow: (fact: HeatFact) => boolean, rules: HeatRules): Map<string, HeatFact> {
	const map = new Map<string, HeatFact>();
	for (const fact of facts) {
		if (fact.withdrawn || !allow(fact) || !inWindow(fact.at, end, rules)) continue;
		const prev = map.get(fact.participantId);
		if (!prev || fact.at >= prev.at) map.set(fact.participantId, fact);
	}
	return map;
}

function rawOf(map: Map<string, HeatFact>, end: number, rules: HeatRules): number {
	let sum = 0;
	for (const fact of map.values()) sum += 0.5 ** ((end - fact.at) / (rules.halfLifeHours * HOUR));
	return sum;
}

function heatIndex(raw: number): number {
	return Math.round(raw * 100) / 10;
}

/** Rank events from original-publication times. One participant counts once; the window is (t-48h, t]. */
function heatRows(facts: readonly HeatFact[], now: number, rules: HeatRules): HeatRank[] {
	const byEvent = new Map<string, HeatFact[]>();
	for (const fact of facts) {
		if (fact.withdrawn) continue;
		const list = byEvent.get(fact.eventId);
		if (list) list.push(fact);
		else byEvent.set(fact.eventId, [fact]);
	}
	const rows: HeatRank[] = [];
	const shift = rules.trendHours * HOUR, windowMs = rules.windowHours * HOUR;
	const priorEnd = now - shift;
	for (const [eventId, group] of byEvent) {
		const current = latestMap(group, now, () => true, rules);
		const editorialIds = new Set(group.filter(fact => fact.editorial && inWindow(fact.at, now, rules)).map(fact => fact.participantId));
		const editorial = editorialIds.size;
		let latest = 0;
		for (const fact of current.values()) {
			if (fact.at > latest) latest = fact.at;
		}
		if (!current.size) continue;
		const raw = rawOf(current, now, rules);
		// Coverage belongs to the whole participant, including its other channels. A new
		// participant on an established source is real growth and must stay in the comparison.
		const uncomparable = new Set(group.filter(fact => fact.at > priorEnd - windowMs && fact.at <= now && (fact.stale || fact.addedAt > priorEnd - windowMs)).map(fact => fact.participantId));
		const comparable = (fact: HeatFact) => !uncomparable.has(fact.participantId);
		const currentCohort = latestMap(group, now, comparable, rules);
		const priorCohort = latestMap(group, priorEnd, comparable, rules);
		const prevAll = rawOf(latestMap(group, priorEnd, () => true, rules), priorEnd, rules);
		const curRaw = rawOf(currentCohort, now, rules);
		const prevRaw = rawOf(priorCohort, priorEnd, rules);
		const cur = heatIndex(curRaw), prev = heatIndex(prevRaw);
		const pct = prev > 0 ? (cur - prev) / prev : null;
		let trend: HeatRank['trend'] = 'flat';
		if (prevAll <= 0) trend = 'new';
		else if (pct === null) trend = 'unknown';
		else if (pct > 0.1) trend = 'up';
		else if (pct < -0.1) trend = 'down';
		const first = new Map<string, number>();
		for (const fact of group) {
			if (fact.withdrawn || !inWindow(fact.at, now, rules)) continue;
			const prev = first.get(fact.participantId);
			if (prev === undefined || fact.at < prev) first.set(fact.participantId, fact.at);
		}
		const joined = [...current.keys()].filter((id) => (first.get(id) ?? 0) > now - shift);
		const earliest = Math.min(...group.filter(fact => fact.at <= now).map(fact => fact.at));
		const badges: HeatRank['badges'] = [];
		const surge = joined.length >= rules.surgeMinParticipants && joined.length * 100 >= current.size * rules.surgePercent;
		if (surge) badges.push('surge');
		if (earliest > now - shift) badges.push('new');
		if (!surge && pct !== null && pct > rules.risingPercent / 100) badges.push('rising');
		const cohortIds = [...new Set([...currentCohort.keys(), ...priorCohort.keys()])];
		rows.push({
			eventId,
			raw,
			index: heatIndex(raw),
			...(cohortIds.length ? { curve: heatIndex(curRaw) } : {}),
			participants: current.size,
			editorial,
			latest,
			trend,
			trendPct: pct === null ? null : Math.round(pct * 1000) / 10,
			badges,
			cohort: cohortIds.sort().join(','),
			complete: !group.some(fact => fact.stale && fact.at > priorEnd - windowMs && fact.at <= now && current.has(fact.participantId)),
		});
	}
	rows.sort((left, right) => right.raw - left.raw || right.latest - left.latest || left.eventId.localeCompare(right.eventId));
	return rows;
}

export function rankHeat(facts: readonly HeatFact[], now: number, rules = DEFAULT_HEAT_RULES): HeatRank[] {
	return heatRows(facts, now, rules).filter(row => row.participants >= rules.minParticipants && row.editorial >= 1).slice(0, rules.topCount);
}

export function heatFacts(
	materials: readonly NewsMaterial[],
	sources: readonly NewsSource[],
	health: Readonly<Record<string, Pick<NewsSourceHealth, 'initializedAt' | 'lastSuccess' | 'intervalMinutes'>>>,
	stories: readonly NewsStory[],
	now: number,
	analyses: readonly NewsAnalysis[],
): HeatFact[] {
	const facts: HeatFact[] = [];
	const sourceById = new Map(sources.map(item => [item.id, item]));
	const materialById = new Map(materials.map(item => [item.id, item]));
	const analysisById = new Map(analyses.filter(item => { const material = materialById.get(item.materialId); return material?.revision === item.revision && material.contentHash === item.contentHash; }).map(item => [item.materialId, item]));
	const storyByMaterial = new Map(stories.flatMap(story => story.materialIds.map(id => [id, story] as const)));
	for (const material of materials) {
		const source = sourceById.get(material.sourceId);
		const at = material.publishedAt;
		if (!source || at === undefined || material.withdrawn) continue;
		const participantId = participantKey(source, material.author);
		if (!participantId) continue;
		const analysis = analysisById.get(material.id);
		if (!analysis || analysis.relevance === 'BLOCK' || analysis.scope === 'composite') continue;
		let story = analysis.groupConfirmed ? storyByMaterial.get(material.id) : undefined;
		if (source.participation === 'editorial' && (!story || analysis.scope !== 'single' || !analysis.frame)) continue;
		if (!story && source.participation === 'signal') {
			const tie = analysis.relations.find(item => (item.kind === 'SAME_OCCURRENCE' || item.kind === 'SAME_STORY') && item.confidence >= (analysis.groupingConfidence ?? 0.8) && analysisById.get(item.targetId)?.groupConfirmed);
			if (tie) story = storyByMaterial.get(tie.targetId);
		}
		if (!story) continue;
		const state = health[source.id];
		facts.push({
			eventId: story.id,
			participantId,
			editorial: source.participation === 'editorial',
			at,
			sourceId: source.id,
			addedAt: state?.initializedAt ?? now,
			stale: source.enabled && sourceIsStale(state?.lastSuccess, state?.intervalMinutes ?? source.intervalMinutes, now),
			lastSuccess: state?.lastSuccess,
			scheduled: source.enabled,
		});
	}
	return facts;
}

/** Called only for a clock-observed hour. Incomplete observations remain repairable gaps. */
export function observeHeatHour(facts: readonly HeatFact[], hour: number, previous: readonly NewsHeatSnapshot[], rules = DEFAULT_HEAT_RULES): NewsHeatSnapshot[] {
	const rows = heatRows(facts, hour, rules);
	const next = previous.filter(item => item.hour > hour - 7 * DAY && item.hour !== hour);
	for (const row of rows) next.push({
		eventId: row.eventId, score: row.index, observedAt: hour, hour,
		complete: row.complete, cohort: row.cohort, cohortSize: row.editorial,
		participants: row.participants, ruleVersion: heatRuleVersion(rules),
	});
	return next;
}

/** Recompute only hours that were actually observed; a fetch after the hour can complete coverage. */
export function repairHeatHours(facts: readonly HeatFact[], now: number, previous: readonly NewsHeatSnapshot[], rules = DEFAULT_HEAT_RULES): NewsHeatSnapshot[] {
	const byHour = new Map<number, HeatRank[]>();
	const ruleVersion = heatRuleVersion(rules);
	return previous.filter(item => item.hour > now - 7 * DAY).map(snapshot => {
		let rows = byHour.get(snapshot.hour);
		if (!rows) {
			rows = heatRows(facts.map(fact => ({ ...fact, stale: fact.scheduled !== false && (fact.lastSuccess === undefined || fact.lastSuccess < snapshot.hour) })), snapshot.hour, rules);
			byHour.set(snapshot.hour, rows);
		}
		const row = rows.find(item => item.eventId === snapshot.eventId);
		return row ? { ...snapshot, score: row.index, participants: row.participants, cohort: row.cohort, cohortSize: row.editorial, complete: snapshot.ruleVersion === ruleVersion && snapshot.complete || row.complete, ruleVersion }
			: { ...snapshot, score: 0, participants: 0, cohort: '', cohortSize: 0, complete: false, ruleVersion };
	});
}

/** One cohort over the whole chosen plot, recomputed from retained source-time evidence. */
export function heatSeries(
	snapshots: readonly NewsHeatSnapshot[], now: number, spanHours: 24 | 72 | 168,
	eventId: string | undefined, facts: readonly HeatFact[],
	rules = DEFAULT_HEAT_RULES,
): { points: { hour: number; heat: number }[]; draw: boolean; from: number; to: number } {
	const start = now - spanHours * HOUR;
	const observed = snapshots.filter(item => item.complete && item.hour > start && item.hour <= now);
	const chosen = eventId ?? observed.slice().sort((a, b) => b.hour - a.hour || b.score - a.score || a.eventId.localeCompare(b.eventId))[0]?.eventId;
	const hours = [...new Set(observed.filter(item => item.eventId === chosen).map(item => item.hour))].sort((a, b) => a - b);
	const since = (hours[0] ?? now) - rules.windowHours * HOUR;
	const group = facts.filter(fact => fact.eventId === chosen && !fact.withdrawn && fact.at > since && fact.at <= now);
	const late = new Set(group.filter(fact => fact.addedAt > since).map(fact => fact.participantId));
	const values = hours.map(hour => ({ hour, heat: heatIndex(rawOf(latestMap(group, hour, fact => !late.has(fact.participantId), rules), hour, rules)) }));
	const points = values.some(point => point.heat > 0) ? values : [];
	return { points, draw: points.length >= 3, from: points[0]?.hour ?? 0, to: points.at(-1)?.hour ?? 0 };
}
