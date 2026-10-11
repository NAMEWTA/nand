import assert from 'node:assert/strict';
import { test } from 'vitest';
import { analysisRow } from '../../../../test/news/analysis';
import { upsertMaterial } from './materials';
import { acceptScore } from './scoring';
import { filterView, normalizeNewsView } from './views';

test('saved views filter current analysis category/tags and written titles with combined source and score constraints', async () => {
	const item = await upsertMaterial(undefined, { sourceId: 'alpha', url: 'https://example.com/one', title: 'Original', summary: 'raw' }, 1);
	const analysis = acceptScore(item, analysisRow('m0', { category: 'Research', tags: ['agents'], titleZh: 'Agent evidence', summaryZh: 'New experiments' }), { version: 'test' });
	const filter = { category: 'Research', tags: ['agents'], minScore: 60, sourceIds: ['alpha'], query: 'Ｅｖｉｄｅｎｃｅ' };
	assert.deepEqual(filterView(filter, [item], [analysis]), [item]);
	for (const changed of [{ category: 'Other' }, { tags: ['other'] }, { sourceIds: ['beta'] }, { minScore: 100 }, { query: 'undefined' }]) assert.equal(filterView({ ...filter, ...changed }, [item], [analysis]).length, 0);
	assert.equal(filterView(filter, [{ ...item, revision: 2 }], [analysis]).length, 0);
	assert.deepEqual(filterView({}, [item], []), [item]);
});

test('saved views keep stable IDs and bound persisted filters', () => {
	assert.equal(normalizeNewsView({ id: '../outside', name: 'View' }), undefined);
	assert.equal(normalizeNewsView({ id: 'stable', name: '   ' }), undefined);
	const raw = { id: 'stable', name: ' View ', category: 2, tags: ['agents', 'agents', 1], sourceIds: 'alpha', minScore: 200, query: 'q'.repeat(1000) };
	const value = normalizeNewsView(raw)!;
	assert.equal(value.id, 'stable'); assert.equal(value.name, 'View'); assert.deepEqual(value.tags, ['agents']); assert.deepEqual(value.sourceIds, []); assert.equal(value.minScore, 100); assert.equal(value.query?.length, 500);
	assert.deepEqual(normalizeNewsView(value), value);
});
