import assert from 'node:assert/strict';
import { test } from 'vitest';
import { analysisRow } from '../../../../test/news/analysis';
import { buildDailyEdition, editionImportance, editionMemory, localDay } from './edition';
import { emptyEvents } from './grouping';
import { heatFacts } from './heat';
import { normalizeNewsSource, type NewsAnalysis, type NewsEdition, type NewsMaterial } from './model';
import { acceptScore } from './scoring';
import { DEFAULT_EDITION_RULES, type EditionRules } from './editorial-rules';

const HOUR = 3_600_000, now = +new Date(2026, 9, 9, 12);
function fixture() {
	const materials: NewsMaterial[] = [], analyses: NewsAnalysis[] = [], events = emptyEvents();
	const sources = Array.from({ length: 30 }, (_, index) => normalizeNewsSource({ id: `s${index}`, name: `s${index}`, url: `https://example.com/${index}`, type: 'rss', participation: 'editorial', tier: 'T2', enabled: true })!);
	const previous: NewsEdition[] = [];
	function add(storyId: string, occurrenceId: string, sourceIndex = 0, score = 80, at = now - HOUR) {
		const id = `m${materials.length}`;
		const material: NewsMaterial = { id, sourceId: `s${sourceIndex}`, sourceItemId: id, originalUrl: `https://example.com/${id}`, canonicalKey: id, title: storyId, bodyExcerpt: `${storyId} released model`, discoveredAt: at, publishedAt: at, contentHash: id, revision: 1 };
		const analysis = acceptScore(material, analysisRow(id, { scope: 'single', subject: storyId, frame: { title: storyId, subject: storyId, action: 'released', object: 'model', occurredAt: null, evidence: material.bodyExcerpt, conditions: [] } }), { version: 'test', tier: 'T2', groupConfirmed: true, now: at });
		Object.assign(analysis, { score, target: score >= 76 ? 'featured' : 'brief' });
		materials.push(material); analyses.push(analysis);
		let story = events.stories.find(item => item.id === storyId);
		if (!story) { story = { id: storyId, title: storyId, materialIds: [], occurrenceIds: [], firstSeenAt: at, latestAt: at, rootOccurrenceId: occurrenceId }; events.stories.push(story); }
		story.materialIds.push(id);
		let occurrence = events.occurrences.find(item => item.id === occurrenceId);
		if (!occurrence) { occurrence = { id: occurrenceId, materialIds: [], storyId, firstSeenAt: at, latestAt: at, kind: 'report', frame: analysis.frame! }; events.occurrences.push(occurrence); story.occurrenceIds.push(occurrenceId); }
		occurrence.materialIds.push(id);
		return { material, analysis, story, occurrence };
	}
	function build(at = now, rules?: EditionRules) { return buildDailyEdition({ materials, analyses, events, sources, previous, rules, evidence: heatFacts(materials, sources, {}, events.stories, at, analyses) }, at); }
	return { materials, analyses, events, sources, previous, add, build };
}

test('importance formula, twelve main, ten flashes and two main reports per source', () => {
	assert.equal(editionImportance(undefined, 3, true, true), 59);
	const f = fixture(); for (let i = 0; i < 30; i++) f.add(`story${i}`, `occ${i}`, i);
	const edition = f.build(); assert.equal(edition.main.length, 12); assert.equal(edition.flashes.length, 10);
	assert.equal(new Set(edition.storyIds).size, 22);
	const one = fixture(); for (let i = 0; i < 8; i++) one.add(`story${i}`, `occ${i}`);
	assert.equal(one.build().main.length, 2); assert.equal(one.build().flashes.length, 6);
	assert.deepEqual(f.build(), edition);
});

test('edited edition caps and memory apply to the same analysis without modifying it', () => {
	const f = fixture(); for (let i = 0; i < 12; i++) f.add(`story${i}`, `occ${i}`, i % 3);
	const saved = JSON.stringify(f.analyses);
	const rules = { ...DEFAULT_EDITION_RULES, mainLimit: 4, flashLimit: 2, perSourceLimit: 1 };
	assert.equal(f.build(now, rules).main.length, 3); assert.equal(f.build(now, rules).flashes.length, 2);
	assert.equal(f.build(now, { ...rules, perSourceLimit: 4, flashLimit: 0 }).main.length, 4);
	assert.equal(f.build(now, { ...rules, flashLimit: 0 }).flashes.length, 0);
	assert.equal(JSON.stringify(f.analyses), saved);
	const past = fixture(); past.add('repeat', 'occ', 0, 90, now - 2 * 24 * HOUR);
	past.previous.push(past.build(now - 2 * 24 * HOUR)); past.add('repeat', 'occ', 1);
	assert.equal(past.build(now, { ...rules, memoryDays: 3 }).main.length, 0);
	assert.equal(past.build(now, { ...rules, memoryDays: 1 }).main.length, 1);
});

test('local natural-day boundaries and reliable release dates exclude old, future and backfill records', () => {
	const day = localDay(now); assert.equal(day.date, '2026-10-09'); assert.equal(day.startAt, +new Date(2026, 9, 9)); assert.equal(day.endAt, +new Date(2026, 9, 10));
	assert.ok(day.timeZone); assert.equal(day.offsetMinutes, new Date(day.startAt).getTimezoneOffset());
	const f = fixture();
	f.add('today', 'one', 0, 80, day.startAt);
	f.add('released-today', 'two', 1, 80, day.startAt - HOUR).analysis.createdAt = now;
	f.add('too-old', 'three', 2, 80, day.startAt - 25 * HOUR).analysis.createdAt = now;
	f.add('tomorrow', 'four', 3, 80, day.endAt);
	f.add('initial', 'five', 4).material.backfillReason = 'initial-import';
	delete f.add('unknown', 'six', 5).material.publishedAt;
	assert.deepEqual(new Set(f.build().storyIds), new Set(['today', 'released-today']));
});

test('memory suppresses repeated occurrences, follows regrouped identities and expires after seven days', () => {
	const f = fixture(); f.add('old', 'first', 0, 90, now - 24 * HOUR);
	f.previous.push(f.build(now - 24 * HOUR));
	f.add('old', 'first', 1, 80);
	assert.equal(f.build().main.length, 0);
	f.events.stories[0]!.id = 'merged'; f.events.stories[0]!.aliases = ['old']; f.events.occurrences[0]!.storyId = 'merged';
	f.add('merged', 'second', 2);
	const edition = f.build(); assert.equal(edition.main[0]?.followUp, localDay(now - 24 * HOUR).date);
	assert.deepEqual(edition.main[0]?.occurrenceIds, ['second']);
	assert.equal(editionMemory(f.previous, now + 6 * 24 * HOUR).length, 1);
	assert.equal(editionMemory(f.previous, now + 7 * 24 * HOUR).length, 0);
});

test('follow-ups need a party action or four new-fact sources; all-follow-up days may still have main entries', () => {
	const f = fixture(); for (let i = 0; i < 4; i++) f.add(`old${i}`, `original${i}`, i, 80, now - 24 * HOUR);
	f.previous.push(f.build(now - 24 * HOUR));
	f.add('old0', 'next0', 4);
	const official = f.add('old1', 'next1', 5); f.sources[5]!.ownerEntityId = 'old1'; f.sources[5]!.publisherRole = 'organization';
	for (let i = 6; i < 10; i++) f.add('old2', 'next2', i);
	const commentary = f.add('old3', 'next3', 10); f.sources[10]!.tier = 'T1'; commentary.analysis.itemType = 'opinion_analysis';
	f.add('new', 'new', 11);
	const edition = f.build(); assert.deepEqual(new Set(edition.main.map(item => item.storyId)), new Set(['old1', 'old2', 'new']));
	assert.deepEqual(new Set(edition.flashes.map(item => item.storyId)), new Set(['old0', 'old3']));
	assert.equal(edition.main.find(item => item.storyId === 'old1')?.materialId, official.material.id);
	const only = fixture(); only.add('old', 'original', 0, 80, now - 24 * HOUR); only.previous.push(only.build(now - 24 * HOUR)); only.add('old', 'new', 1);
	assert.equal(only.build().main.length, 1);
});

test('official unselected facts need three independent participants; the most important mentioned event hosts a roundup', () => {
	const f = fixture(); f.sources[0]!.tier = 'T1';
	f.add('missed', 'missed', 0, 55); f.add('missed', 'missed', 1, 55); f.add('missed', 'missed', 2, 55);
	assert.equal(f.build().main[0]?.fillIn, true);
	f.sources[1]!.ownerEntityId = f.sources[2]!.ownerEntityId = 'same-owner'; assert.equal(f.build().main.length, 0);
	const g = fixture(); g.add('important', 'first', 0, 95); g.add('other', 'second', 1, 80);
	const roundup = g.add('loose', 'roundup', 2); roundup.analysis.scope = 'composite'; roundup.analysis.groupConfirmed = false; roundup.analysis.target = 'brief';
	roundup.analysis.samples[0]!.axes = { sig: 9, nov: 9, cred: 9, reson: 9, act: 9 };
	g.events.mentions.push({ materialId: roundup.material.id, occurrenceId: 'first' }, { materialId: roundup.material.id, occurrenceId: 'second' });
	const edition = g.build(); assert.deepEqual(edition.main.map(item => item.storyId), ['important', 'other']);
	assert.deepEqual(edition.main[0]?.relatedIds, [roundup.material.id]);
	assert.deepEqual(edition.main[1]?.relatedIds, []);
});
