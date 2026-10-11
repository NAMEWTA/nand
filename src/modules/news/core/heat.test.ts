import { analysisRow } from '../../../../test/news/analysis';
import { acceptScore } from './scoring';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { observeHeatHour, repairHeatHours, heatFacts, heatSeries, HEAT_RULE_VERSION, participantKey, rankHeat, sourceIsStale, type HeatFact } from './heat';
import { normalizeNewsSource, type NewsMaterial, type NewsSource } from './model';
import { DEFAULT_HEAT_RULES } from './editorial-rules';

const HOUR = 3_600_000;
const now = Date.UTC(2026, 9, 9, 12, 0, 0);

function fact(over: Partial<HeatFact> = {}): HeatFact {
	return { eventId: 'e', participantId: 'a', editorial: true, at: now, sourceId: 's', addedAt: 0, stale: false, ...over };
}

function pair(eventId: string, at: number, latest = at): HeatFact[] {
	return [fact({ eventId, participantId: `${eventId}-a`, at: latest }), fact({ eventId, participantId: `${eventId}-b`, at })];
}

const source = (over: Partial<NewsSource> = {}): NewsSource =>
	normalizeNewsSource({ id: 'alpha', name: 'Alpha', url: 'https://example.com/a.xml', type: 'rss', enabled: true, participation: 'editorial', intervalMinutes: 60, ...over })!;

test('edited heat rules recompute ranking and observed curves without inventing history', () => {
	const facts = pair('e', now - 24 * HOUR).map(item => ({ ...item, scheduled: false }));
	const rules = { ...DEFAULT_HEAT_RULES, halfLifeHours: 12, topCount: 1 };
	assert.equal(rankHeat(facts, now)[0]!.index, 10);
	assert.equal(rankHeat(facts, now, rules)[0]!.index, 5);
	assert.equal(rankHeat(facts, now, { ...rules, windowHours: 12 }).length, 0);
	assert.equal(rankHeat(facts, now, { ...rules, minParticipants: 3 }).length, 0);
	assert.equal(rankHeat([...facts, ...pair('second', now)], now, rules).length, 1);
	const snapshots = [now - 2 * HOUR, now].flatMap(hour => observeHeatHour(facts, hour, []));
	const repaired = repairHeatHours(facts, now, snapshots, rules);
	assert.deepEqual(repaired.map(item => item.hour), snapshots.map(item => item.hour));
	assert.ok(repaired.every(item => item.ruleVersion !== HEAT_RULE_VERSION));
	assert.equal(repaired.at(-1)!.score, 5);
	const curve = heatSeries(repaired, now, 24, 'e', facts, rules);
	assert.equal(curve.points.at(-1)!.heat, 5); assert.equal(curve.draw, false);
	const empty = repairHeatHours(facts, now, snapshots, { ...rules, windowHours: 1 });
	assert.ok(empty.every(item => item.score === 0 && !item.complete));
});

test('heat counts each participant once on a 48h window and a 24h half-life', () => {
	const ranked = rankHeat([fact({ participantId: 'a', at: now }), fact({ participantId: 'a', at: now - HOUR }), fact({ participantId: 'b', at: now - 24 * HOUR })], now);
	assert.equal(ranked.length, 1);
	assert.equal(ranked[0]?.raw, 1.5);
	assert.equal(ranked[0]?.index, 15);
	assert.equal(ranked[0]?.participants, 2);
	assert.equal(rankHeat([fact({ at: now }), fact({ participantId: 'b', at: now - 48 * HOUR })], now).length, 0);
	assert.equal(rankHeat([fact({ at: now }), fact({ participantId: 'b', at: now - 48 * HOUR + 1 })], now).length, 1);
	assert.equal(rankHeat([fact({ editorial: false }), fact({ participantId: 'b', editorial: false })], now).length, 0);
	assert.equal(rankHeat([fact(), fact({ participantId: 'b', withdrawn: true })], now).length, 0);
	const many = Array.from({ length: 12 }, (_, index) => pair(`e${index}`, now - index * HOUR)).flat();
	const top = rankHeat(many, now);
	assert.equal(top.length, 10);
	assert.equal(top[0]?.eventId, 'e0');
	assert.equal(top.some((row) => row.eventId === 'e11'), false);
	assert.equal(participantKey(source({ participantStrategy: 'community' }), 'ada'), 'a:alpha:ada');
	assert.equal(participantKey(source({ participantStrategy: 'community' })), 's:alpha');
	assert.equal(participantKey(source({ participation: 'isolated', participantStrategy: 'community' }), 'ada'), undefined);
	assert.equal(participantKey(source({ groupId: 'lab', ownerEntityId: 'org' })), 'g:lab');
});

test('trends use the 6h-earlier window and ignore late or stale sources', () => {
	const steady = [fact({ participantId: 'a', at: now - HOUR }), fact({ participantId: 'a', at: now - 7 * HOUR }), fact({ participantId: 'b', at: now - 2 * HOUR }), fact({ participantId: 'b', at: now - 8 * HOUR })];
	assert.equal(rankHeat(steady, now)[0]?.trend, 'flat');
	assert.deepEqual(rankHeat(steady, now)[0]?.badges, []);
	const rising = [fact({ participantId: 'a', at: now }), fact({ participantId: 'a', at: now - 30 * HOUR }), fact({ participantId: 'b', at: now }), fact({ participantId: 'b', at: now - 30 * HOUR })];
	assert.equal(rankHeat(rising, now)[0]?.trend, 'up');
	assert.deepEqual(rankHeat(rising, now)[0]?.badges, ['rising']);
	const aged = (ratio: number) => (24 * Math.log(1 / ratio) / Math.log(0.5)) * HOUR;
	const boundary = (ratio: number) => rankHeat([
		fact({ participantId: 'a', at: now }), fact({ participantId: 'a', at: now - 6 * HOUR - aged(ratio) }),
		fact({ participantId: 'b', at: now }), fact({ participantId: 'b', at: now - 6 * HOUR - aged(ratio) }),
	], now)[0];
	assert.equal(boundary(1.1)?.trend, 'flat');
	assert.equal(boundary(1.15)?.trend, 'up');
	assert.deepEqual(boundary(1.15)?.badges, []);
	const falling = [fact({ participantId: 'a', at: now - 6 * HOUR }), fact({ participantId: 'b', at: now - 6 * HOUR })];
	assert.equal(rankHeat(falling, now)[0]?.trend, 'down');
	assert.equal(rankHeat(steady.map((item) => ({ ...item, stale: true })), now)[0]?.trend, 'unknown');
	assert.equal(rankHeat(steady.map((item) => ({ ...item, addedAt: now - 10 * HOUR })), now)[0]?.trend, 'unknown');
	const fresh = [fact({ participantId: 'a', at: now - HOUR }), fact({ participantId: 'b', at: now - HOUR })];
	assert.equal(rankHeat(fresh, now)[0]?.trend, 'new');
	assert.deepEqual(rankHeat(fresh, now)[0]?.badges, ['new']);
	const surge = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((id) => {
		const recent = id < 'd';
		return [fact({ participantId: id, at: now - (recent ? HOUR : 30 * HOUR) }), ...(recent ? [] : [fact({ participantId: id, at: now - 40 * HOUR })])];
	});
	assert.deepEqual(rankHeat(surge, now)[0]?.badges, ['surge']);
	assert.equal(sourceIsStale(now - 90 * 60_000, 30, now), false);
	assert.equal(sourceIsStale(now - 90 * 60_000 - 1, 30, now), true);
	assert.equal(sourceIsStale(now - 180 * 60_000, 60, now), false);
	assert.equal(sourceIsStale(now - 180 * 60_000 - 1, 60, now), true);
});

test('new participants on established sources count as growth; every channel controls participant coverage', () => {
	const existing = [fact({ participantId: 'old', at: now - 7 * HOUR }), fact({ participantId: 'old', at: now - HOUR })];
	const growth = [...existing, fact({ participantId: 'new', at: now - HOUR })];
	assert.equal(rankHeat(growth, now)[0]?.trend, 'up');
	assert.ok((rankHeat(growth, now)[0]?.trendPct ?? 0) > 90);
	assert.equal(rankHeat([...existing, fact({ participantId: 'new', at: now - HOUR, addedAt: now - 10 * HOUR })], now)[0]?.trend, 'flat');
	const staleChannel = [...growth, fact({ participantId: 'old', sourceId: 'other-channel', at: now - 8 * HOUR, stale: true })];
	assert.equal(rankHeat(staleChannel, now)[0]?.trend, 'unknown');
	const lost = [fact({ participantId: 'gone', at: now - 50 * HOUR }), fact({ participantId: 'a', at: now }), fact({ participantId: 'b', at: now })];
	assert.equal(rankHeat(lost, now)[0]?.trend, 'up');
	assert.ok((rankHeat(lost, now)[0]?.trendPct ?? 0) > 100);
});

test('editorial evidence survives a newer signal by the same owner, and surge can also be new', () => {
	const facts = [fact({ participantId: 'owner', editorial: true, at: now - HOUR }), fact({ participantId: 'owner', editorial: false, at: now }), fact({ participantId: 'b', editorial: false }), fact({ participantId: 'c', editorial: false })];
	const rank = rankHeat(facts, now)[0];
	assert.equal(rank?.participants, 3);
	assert.equal(rank?.editorial, 1);
	assert.deepEqual(rank?.badges, ['surge', 'new']);
});

test('only observed hours exist; incomplete coverage can be repaired and one cohort spans the plot', () => {
	const facts = [40, 30, 3, 2].flatMap(hours => pair('e', now - hours * HOUR));
	const observed = [40, 30, 3, 2].reduce((rows, hours) => observeHeatHour(facts, now - hours * HOUR, rows), [] as import('./model').NewsHeatSnapshot[]);
	const series = heatSeries(observed, now, 168, 'e', facts);
	assert.deepEqual(series.points.map(point => point.hour), [40, 30, 3, 2].map(hours => now - hours * HOUR));
	assert.deepEqual(series.points.map(point => point.heat), [20, 20, 20, 20]);
	assert.equal(series.draw, true);
	assert.equal(heatSeries(observed, now, 24, 'e', facts).draw, false);
	const late = [...facts, fact({ participantId: 'late', at: now - 2 * HOUR, addedAt: now - 10 * HOUR })];
	assert.equal(rankHeat(late, now)[0]?.participants, 3);
	assert.deepEqual(heatSeries(observed, now, 168, 'e', late).points.map(point => point.heat), [20, 20, 20, 20]);
	const incomplete = observeHeatHour(facts.map(item => ({ ...item, stale: true })), now - HOUR, observed);
	assert.equal(incomplete.at(-1)?.complete, false);
	assert.equal(heatSeries(incomplete, now, 168, 'e', facts).points.length, 4);
	const repaired = repairHeatHours(facts.map(item => ({ ...item, lastSuccess: now })), now, incomplete);
	assert.equal(repaired.length, 5);
	assert.equal(repaired.at(-1)?.complete, true);
	assert.equal(repaired.some(item => item.hour === now - 4 * HOUR), false);
	assert.equal(repairHeatHours(facts, now + 8 * 24 * HOUR, observed).length, 0);
	assert.ok(observed.every(item => item.ruleVersion === HEAT_RULE_VERSION));
});

test('current evidence roles, owners, withdrawal and factual editorial membership control heat', () => {
	const editorial = source(), second = source({ id: 'beta' });
	const material = (id: string, sourceId: string): NewsMaterial => ({
		id, sourceId, sourceItemId: id, originalUrl: `https://example.com/${id}`, canonicalKey: id, title: 'Release', bodyExcerpt: 'Company released a model.', discoveredAt: now, publishedAt: now, revision: 1, contentHash: id,
	});
	const materials = [material('m1', 'alpha'), material('m2', 'beta')];
	const analyses = materials.map(item => acceptScore(item, analysisRow(item.id, { scope: 'single', frame: { title: 'Release', subject: 'Company', action: 'released', object: 'model', occurredAt: null, evidence: item.bodyExcerpt, conditions: [] } }), { version: 'fixture', now, groupConfirmed: true }));
	const story = { id: 'story-1', title: 'Release', materialIds: ['m1', 'm2'], occurrenceIds: [], firstSeenAt: now, latestAt: now };
	const evidence = () => heatFacts(materials, [editorial, second], {}, [story], now, analyses);
	assert.equal(rankHeat(evidence(), now)[0]?.index, 20);
	editorial.ownerEntityId = second.ownerEntityId = 'one-owner';
	assert.equal(rankHeat(evidence(), now).length, 0);
	delete editorial.ownerEntityId; delete second.ownerEntityId;
	second.participation = 'isolated'; assert.equal(evidence().length, 1);
	second.participation = 'editorial'; materials[1]!.withdrawn = true; assert.equal(evidence().length, 1);
	delete materials[1]!.withdrawn;
	analyses[1]!.groupConfirmed = false; analyses[1]!.scope = 'unknown'; analyses[1]!.frame = null;
	assert.equal(evidence().length, 1);
	second.participation = 'signal'; analyses[1]!.relations = [{ kind: 'SAME_STORY', targetId: 'm1', confidence: 0.8 }];
	assert.equal(rankHeat(evidence(), now)[0]?.editorial, 1);
	assert.equal(rankHeat(evidence(), now)[0]?.participants, 2);
	analyses[1]!.scope = 'composite'; assert.equal(evidence().length, 1);
});
