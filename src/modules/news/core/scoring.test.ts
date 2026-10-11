import { expect, test } from 'vitest';
import { analysisRow } from '../../../../test/news/analysis';
import { upsertMaterial } from './materials';
import type { NewsScoreSample } from './model';
import { acceptScore, DEFAULT_WEIGHTS, ITEM_TYPES, qualityAxes, recomputeAnalysis, sampleScore, scoreSelection } from './scoring';

const sample = (score: number): NewsScoreSample => {
	const base = Math.floor(score / 10);
	return { itemType: 'model_release', axes: { sig: base, nov: base, cred: base, reson: base, act: base + score % 10 }, qualityFlags: [] };
};

test('all seven types use their integer weighted sum', () => {
	const axes = { sig: 3, nov: 4, cred: 5, reson: 6, act: 7 };
	expect(ITEM_TYPES.map(itemType => sampleScore({ itemType, axes, qualityFlags: [] }))).toEqual([46, 52, 56, 39, 47, 51, 58]);
});

test('configured summary floor uses the unrounded mean and never removes tier-qualified material', () => {
	expect(scoreSelection([sample(60), sample(60)], 'unlisted', undefined, undefined, 60).understand).toBe(false);
	expect(scoreSelection([sample(60), sample(61)], 'unlisted', undefined, undefined, 60)).toMatchObject({ score: 60, understand: true });
	expect(scoreSelection([sample(60)], 'T1', undefined, undefined, 100)).toMatchObject({ eligible: true, understand: true });
});

test('tier eligibility uses the sum, display floors the mean, and understand is strictly greater than 50', () => {
	const boundaries = [
		{ tier: 'T1' as const, floor: 60, axes: { sig: 6, nov: 6, cred: 6, reson: 6, act: 6 } },
		{ tier: 'T1_5' as const, floor: 65, axes: { sig: 7, nov: 7, cred: 6, reson: 6, act: 6 } },
		{ tier: 'T2' as const, floor: 76, axes: { sig: 9, nov: 7, cred: 7, reson: 7, act: 7 } },
	];
	for (const { tier, floor, axes } of boundaries) {
		const at: NewsScoreSample = { itemType: 'model_release', axes, qualityFlags: [] };
		const below: NewsScoreSample = { ...at, axes: { ...axes, act: axes.act - 1 } };
		expect(scoreSelection([at, at], tier)).toMatchObject({ eligible: true, score: floor });
		expect(scoreSelection([below, at], tier)).toMatchObject({ eligible: false, score: floor - 1 });
	}
	expect(scoreSelection([sample(60)], 'T1').eligible).toBe(true);
	expect(scoreSelection([sample(60)], 'unlisted').eligible).toBe(false);
	expect(scoreSelection([sample(50), sample(50)], 'T1')).toMatchObject({ understand: false, score: 50 });
	expect(scoreSelection([sample(50), sample(51)], 'T1')).toMatchObject({ understand: true, score: 50 });
});

test('quality caps survive reweighting without overwriting original axes', () => {
	const axes = { sig: 10, nov: 10, cred: 10, reson: 10, act: 10 };
	const value: NewsScoreSample = { itemType: 'model_release', axes, qualityFlags: ['preview', 'narrow_research'] };
	expect(qualityAxes(value)).toEqual({ sig: 4, nov: 3, cred: 4, reson: 3, act: 10 });
	expect(value.axes).toEqual(axes);
	expect(sampleScore({ ...value, qualityFlags: ['title_conflict'] }, { ...DEFAULT_WEIGHTS, model_release: { sig: 0, nov: 0, cred: 0, reson: 0, act: 10 } })).toBe(30);
	expect(qualityAxes({ ...value, qualityFlags: ['marketing'] }).sig).toBe(2);
	expect(qualityAxes({ ...value, qualityFlags: ['routine_update'] }).sig).toBe(3);
});

test('short factual material is not length-capped; writing, relevance and grouping gate featured', async () => {
	const material = await upsertMaterial(undefined, { sourceId: 'test', url: 'https://example.com/a', title: 'A', summary: 'One fact.' });
	const row = analysisRow('m0', { axes: { sig: 10, nov: 10, cred: 10, reson: 10, act: 10 } });
	const pending = acceptScore(material, row, { version: 'test', tier: 'T1' });
	expect(pending).toMatchObject({ score: 100, target: 'brief' });
	const confirmed = { ...pending, groupConfirmed: true };
	expect(recomputeAnalysis(confirmed, 'T1').target).toBe('featured');
	expect(recomputeAnalysis({ ...confirmed, relevance: 'BLOCK' }, 'T1').target).toBe('ignore');
	expect(recomputeAnalysis({ ...confirmed, relevance: 'UNKNOWN' }, 'T1').accepted).toBe(false);
	expect(recomputeAnalysis({ ...confirmed, summaryZh: '' }, 'T1').accepted).toBe(false);
	expect(recomputeAnalysis(confirmed, 'unlisted').target).toBe('brief');
});
