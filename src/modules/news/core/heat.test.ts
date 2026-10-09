import assert from 'node:assert/strict';
import { test } from 'vitest';
import { closeHeatHour, heatFacts, heatSeries, HEAT_RULE_VERSION, participantKey, rankHeat, sourceIsStale, type HeatFact } from './heat';
import { normalizeNewsSource, type NewsMaterial, type NewsSource } from './model';

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
	assert.equal(participantKey(source({ participantStrategy: 'community' }), 'ada'), 'a:ada');
	assert.equal(participantKey(source({ participantStrategy: 'community' })), undefined);
	assert.equal(participantKey(source({ participation: 'isolated', participantStrategy: 'community' }), 'ada'), undefined);
	assert.equal(participantKey(source({ groupId: 'lab', ownerEntityId: 'org' })), 'g:lab');
});

test('trends use the 6h-earlier window and ignore late or stale sources', () => {
	const steady = [fact({ participantId: 'a', at: now - HOUR }), fact({ participantId: 'a', at: now - 7 * HOUR }), fact({ participantId: 'b', at: now - 2 * HOUR }), fact({ participantId: 'b', at: now - 8 * HOUR })];
	assert.equal(rankHeat(steady, now)[0]?.trend, 'flat');
	assert.equal(rankHeat(steady, now)[0]?.badge, undefined);
	const rising = [fact({ participantId: 'a', at: now }), fact({ participantId: 'a', at: now - 30 * HOUR }), fact({ participantId: 'b', at: now }), fact({ participantId: 'b', at: now - 30 * HOUR })];
	assert.equal(rankHeat(rising, now)[0]?.trend, 'up');
	assert.equal(rankHeat(rising, now)[0]?.badge, 'rising');
	const aged = (ratio: number) => (24 * Math.log(1 / ratio) / Math.log(0.5)) * HOUR;
	const boundary = (ratio: number) => rankHeat([
		fact({ participantId: 'a', at: now }), fact({ participantId: 'a', at: now - 6 * HOUR - aged(ratio) }),
		fact({ participantId: 'b', at: now }), fact({ participantId: 'b', at: now - 6 * HOUR - aged(ratio) }),
	], now)[0];
	assert.equal(boundary(1.1)?.trend, 'flat');
	assert.equal(boundary(1.15)?.trend, 'up');
	assert.equal(boundary(1.15)?.badge, undefined);
	const falling = [fact({ participantId: 'a', at: now - 6 * HOUR }), fact({ participantId: 'b', at: now - 6 * HOUR })];
	assert.equal(rankHeat(falling, now)[0]?.trend, 'down');
	assert.equal(rankHeat(steady.map((item) => ({ ...item, stale: true })), now)[0]?.trend, 'unknown');
	assert.equal(rankHeat(steady.map((item) => ({ ...item, addedAt: now - 10 * HOUR })), now)[0]?.trend, 'unknown');
	const fresh = [fact({ participantId: 'a', at: now - HOUR }), fact({ participantId: 'b', at: now - HOUR })];
	assert.equal(rankHeat(fresh, now)[0]?.trend, 'new');
	assert.equal(rankHeat(fresh, now)[0]?.badge, 'new');
	const surge = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((id) => {
		const recent = id < 'd';
		return [fact({ participantId: id, at: now - (recent ? HOUR : 30 * HOUR) }), ...(recent ? [] : [fact({ participantId: id, at: now - 40 * HOUR })])];
	});
	assert.equal(rankHeat(surge, now)[0]?.badge, 'surge');
	assert.equal(sourceIsStale(now - 90 * 60_000, 30, now), false);
	assert.equal(sourceIsStale(now - 90 * 60_000 - 1, 30, now), true);
	assert.equal(sourceIsStale(now - 180 * 60_000, 60, now), false);
	assert.equal(sourceIsStale(now - 180 * 60_000 - 1, 60, now), true);
});

test('hourly history keeps gaps, the comparable cohort, and the closed hour only', () => {
	const current = Math.floor(now / HOUR) * HOUR;
	const snap = (hoursAgo: number, heat: number, cohort: string, complete = true) => ({
		sourceId: 'e', eventId: 'e', score: heat, observedAt: current - hoursAgo * HOUR + HOUR, hour: current - hoursAgo * HOUR, complete, cohort, cohortSize: 2, participants: 2, ruleVersion: HEAT_RULE_VERSION,
	});
	const observed = [snap(2, 10, 'a,b'), snap(3, 11, 'a,b'), snap(30, 12, 'a,b'), snap(0, 0, 'a,b', false)];
	const series = heatSeries(observed, now, 168);
	assert.deepEqual(series.points.map((point) => point.heat), [12, 11, 10]);
	assert.equal(series.draw, true);
	assert.equal(series.from, current - 30 * HOUR);
	assert.equal(series.to, current - 2 * HOUR);
	assert.equal(series.points.some((point) => point.heat === 0), false);
	const day = heatSeries(observed, now, 24);
	assert.deepEqual(day.points.map((point) => point.heat), [11, 10]);
	assert.equal(day.draw, false);
	const newer = { ...snap(1, 4, 'a,b'), eventId: 'other', sourceId: 'other' };
	assert.deepEqual(heatSeries([...observed, newer], now, 168).points.map((point) => point.heat), [4]);
	const mixed = heatSeries([snap(50, 21, 'old'), snap(40, 22, 'old'), snap(30, 23, 'old'), snap(2, 9, 'new')], now, 168);
	assert.deepEqual(mixed.points.map((point) => point.heat), [9]);
	assert.equal(mixed.draw, false);
	const facts = [fact({ participantId: 'a', at: now - HOUR }), fact({ participantId: 'b', at: now - HOUR })];
	const mid = now + 30 * 60_000;
	const first = closeHeatHour(facts, mid, []);
	assert.equal(first.length, 1);
	assert.equal(first[0]?.complete, true);
	assert.equal(first[0]?.hour, current - HOUR);
	assert.equal(first[0]?.ruleVersion, HEAT_RULE_VERSION);
	assert.equal(closeHeatHour(facts, mid, first).length, 0);
	assert.deepEqual(closeHeatHour(facts, mid, []).map((item) => item.hour), [current - HOUR]);
	const kept = { ...first[0]!, ruleVersion: 'keep-me', score: 1 };
	assert.equal(closeHeatHour(facts, mid, [kept]).length, 0);
	const stale = facts.map((item) => ({ ...item, stale: true, at: now - 30 * HOUR }));
	stale.push(fact({ participantId: 'a', at: now - 40 * HOUR, stale: true }), fact({ participantId: 'b', at: now - 40 * HOUR, stale: true }));
	assert.equal(closeHeatHour(stale, mid, []).length, 0);
	const editorial = source();
	const isolated = source({ id: 'beta', participation: 'isolated' });
	const material = (id: string, sourceId: string): NewsMaterial => ({
		id, sourceId, sourceItemId: id, originalUrl: `https://example.com/${id}`, canonicalKey: id, title: 'Same', bodyExcerpt: '', discoveredAt: now, publishedAt: now, revision: 1, contentHash: id,
	});
	const story = { id: 'story-1', title: 'Same', materialIds: ['m1', 'm2'], occurrenceIds: [], firstSeenAt: now, latestAt: now };
	const ranked = rankHeat(heatFacts([material('m1', 'alpha'), material('m2', 'beta')], [editorial, isolated], {}, [story], now), now);
	assert.equal(ranked.length, 0);
	const again = rankHeat(heatFacts([material('m1', 'alpha'), { ...material('m2', 'beta'), sourceId: 'gamma' }], [editorial, source({ id: 'gamma' })], {}, [story], now), now);
	assert.equal(again.length, 1);
	assert.equal(again[0]?.index, 20);
});
