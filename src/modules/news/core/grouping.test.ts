import { expect, test } from 'vitest';
import { analysisRow } from '../../../../test/news/analysis';
import type { NewsAnalysis, NewsMaterial, NewsRelation } from './model';
import { groupMaterials, groupingConfirmed, resolveStory } from './grouping';
import { upsertMaterial } from './materials';
import { acceptScore } from './scoring';
import { lexicalSimilarity, recallCandidates } from './recall';
import { DEFAULT_GROUPING_RULES } from './editorial-rules';

const now = Date.parse('2026-10-10T10:00:00Z');
const material = async (id: string, at = now): Promise<NewsMaterial> => ({ ...await upsertMaterial(undefined, { sourceId: id, url: `https://example.com/${id}`, title: '模型甲正式发布', body: '公司发布模型甲，支持图片。', publishedAt: at }, now), id });
const fact = (item: NewsMaterial, relations: NewsRelation[] = []): NewsAnalysis => acceptScore(item, analysisRow(item.id, { titleZh: item.title, summaryZh: item.body!, scope: 'single', subject: '公司', frame: { title: item.title, subject: '公司', action: '发布', object: '模型甲', occurredAt: null, evidence: item.body!, conditions: [] }, relations }), { version: 'fixture', now, tier: 'T1' });
const tie = (targetId: string, kind: NewsRelation['kind'] = 'SAME_OCCURRENCE', confidence = 0.8): NewsRelation => ({ targetId, kind, confidence });

test('saved relation threshold governs new memberships and recall settings bound retained candidates', async () => {
	const a = await material('a'), b = await material('b'), rows = [fact(a), { ...fact(b, [tie(a.id, 'SAME_OCCURRENCE', 0.7)]), groupingConfidence: 0.6 }];
	const grouped = groupMaterials([a, b], rows); expect(grouped.stories).toHaveLength(1); expect(groupingConfirmed(grouped, b.id)).toBe(true);
	expect(groupingConfirmed(groupMaterials([a, b], [rows[0]!, { ...rows[1]!, groupingConfidence: 0.8 }]), b.id)).toBe(false);
	expect(groupMaterials([a, b], [rows[0]!, { ...rows[1]!, groupingConfidence: 0.9 }], grouped).stories).toHaveLength(1);
	const old = { ...await material('old'), title: 'abcde', body: 'abCDE', bodyExcerpt: 'abCDE', discoveredAt: now - 20 * 86_400_000 };
	const query = { ...await material('query'), title: 'abXYZ', body: 'XYZa', bodyExcerpt: 'XYZa' };
	const analysis = fact(old), events = groupMaterials([old], [analysis]);
	expect(recallCandidates([query], [old, query], [analysis], events, now).get(query.id)).toHaveLength(0);
	expect(recallCandidates([query], [old, query], [analysis], events, now, { ...DEFAULT_GROUPING_RULES, recallDays: 30, similarityPercent: 0 }).get(query.id)).toHaveLength(1);
	expect(recallCandidates([query], [old, query], [analysis], events, now, { ...DEFAULT_GROUPING_RULES, recallDays: 30, similarityPercent: 100 }).get(query.id)).toHaveLength(0);
});

test('raw title overlap never merges; same-batch reports fold, developments attach only to a root', async () => {
	const items = await Promise.all(['launch', 'report', 'review', 'chain', 'independent'].map((id, i) => material(id, now + i)));
	expect(groupMaterials(items).stories).toEqual([]);
	const result = groupMaterials(items, [fact(items[0]!), fact(items[1]!, [tie('launch')]), fact(items[2]!, [tie('report', 'SAME_STORY')]), fact(items[3]!, [tie('review', 'SAME_STORY')]), fact(items[4]!, [tie('launch', 'UNRELATED', 1)])]);
	expect(result.stories).toHaveLength(3);
	const launch = result.stories.find(story => story.materialIds.includes('launch'))!;
	expect(launch.materialIds).toEqual(['launch', 'report', 'review']);
	expect(launch.occurrenceIds).toHaveLength(2);
	expect(result.occurrences.find(item => item.id === launch.rootOccurrenceId)?.materialIds).toEqual(['launch', 'report']);
	expect(groupingConfirmed(result, 'review')).toBe(true);
	expect(groupingConfirmed(result, 'chain')).toBe(false);
});

test('a composite cannot bridge events, even when the model mistakenly calls it the same occurrence', async () => {
	const a = await material('a'), b = await material('b'), roundup = await material('roundup');
	const composite = { ...fact(roundup, [tie('a'), tie('b', 'ROUNDUP')]), scope: 'composite' as const, frame: null };
	const result = groupMaterials([a, b, roundup], [fact(a), fact(b), composite]);
	expect(result.stories).toHaveLength(2);
	expect(result.mentions).toHaveLength(2);
	expect(result.proposals).toEqual([]);
	expect(result.stories.flatMap(story => story.materialIds)).not.toContain('roundup');
	expect(groupingConfirmed(result, 'roundup')).toBe(false);
});

test('ties below 0.8 stay unconfirmed; an independent root review at 0.75 preserves old links', async () => {
	const a = await material('a', now - 1), b = await material('b'), weak = await material('weak'), bridge = await material('bridge');
	const first = groupMaterials([a, b, weak], [fact(a), fact(b), fact(weak, [tie('a', 'SAME_OCCURRENCE', 0.799)])]);
	expect(first.stories).toHaveLength(3);
	expect(groupingConfirmed(first, weak.id)).toBe(false);
	const originalB = first.stories.find(story => story.materialIds.includes(b.id))!.id;
	const all = [a, b, weak, bridge];
	const proposed = groupMaterials(all, [fact(bridge, [tie('a'), tie('b')])], first);
	expect(proposed.stories).toHaveLength(3);
	expect(groupingConfirmed(proposed, bridge.id)).toBe(false);
	const proposalId = proposed.proposals[0]!.id;
	const low = groupMaterials(all, [], { ...proposed, reviews: [{ proposalId, kind: 'SAME_OCCURRENCE', confidence: 0.749 }] });
	expect(low.stories).toHaveLength(3);
	const merged = groupMaterials(all, [], { ...proposed, reviews: [{ proposalId, kind: 'SAME_OCCURRENCE', confidence: 0.75 }] });
	expect(merged.stories).toHaveLength(2);
	expect(resolveStory(merged.stories, originalB)?.materialIds).toEqual(expect.arrayContaining(['a', 'b', 'bridge']));
	expect(groupingConfirmed(merged, bridge.id)).toBe(true);
	expect(groupMaterials(all, [], merged)).toEqual(merged);
	const rejected = groupMaterials(all, [], { ...proposed, reviews: [{ proposalId, kind: 'ROUNDUP', confidence: 1 }] });
	expect(rejected.stories).toHaveLength(3);
});

test('reanalysis can remove a composite from identity evidence without deleting the other reports', async () => {
	const a = await material('a'), b = await material('b');
	const first = groupMaterials([a, b], [fact(a), fact(b, [tie('a')])]);
	const changed = { ...fact(a), createdAt: now + 1, scope: 'composite' as const, frame: null };
	const result = groupMaterials([a, b], [changed], first);
	expect(result.stories[0]?.materialIds).toEqual(['b']);
	expect(groupingConfirmed(result, 'a')).toBe(false);
	const split = groupMaterials([a, b], [{ ...fact(a), createdAt: now + 1 }], first);
	expect(new Set(split.stories.map(item => item.id)).size).toBe(2);
	expect(new Set(split.occurrences.map(item => item.id)).size).toBe(2);
});

test('a changed candidate revision cannot silently authorize a new membership', async () => {
	const a = await material('a'), b = await material('b');
	const first = groupMaterials([a], [fact(a)]);
	const changed = { ...a, revision: 2, contentHash: 'changed' };
	const result = groupMaterials([changed, b], [fact(b, [tie('a')])], first);
	expect(groupingConfirmed(result, 'a')).toBe(false);
	expect(groupingConfirmed(result, 'b')).toBe(false);
	expect(result.stories).toHaveLength(2);
});

test('recall uses discovery time, Chinese character bigrams, best report per occurrence, ten candidates and batch peers', async () => {
	expect(lexicalSimilarity('甲 乙 丙', '甲乙丙丁戊己')).toBe(1);
	expect(lexicalSimilarity('abcde', 'abXYZ')).toBe(0.25);
	expect(lexicalSimilarity('a', 'abc')).toBe(0);
	const items = await Promise.all(Array.from({ length: 12 }, (_, i) => material(`source${i}`, now - i)));
	const old = { ...await material('old'), discoveredAt: now - 14 * 86_400_000 };
	const ancient = await material('ancient', now - 365 * 86_400_000);
	const duplicate = await material('duplicate');
	const pool = [...items, old, ancient, duplicate];
	const events = groupMaterials(pool, [...pool.slice(0, -1).map(item => fact(item)), fact(duplicate, [tie('source0')])]);
	const query = await material('query'), peer = await material('peer');
	const candidates = recallCandidates([query, peer], pool, [], events, now);
	expect(candidates.get(query.id)).toHaveLength(10);
	expect(candidates.get(query.id)?.some(item => item.id === 'old')).toBe(false);
	expect(candidates.get(query.id)?.some(item => item.id === 'ancient')).toBe(true);
	expect(candidates.get(query.id)?.filter(item => ['source0', 'duplicate'].includes(item.id))).toHaveLength(1);
	expect(recallCandidates([query, peer], [], [], groupMaterials([]), now).get(peer.id)?.[0]?.id).toBe(query.id);
});
