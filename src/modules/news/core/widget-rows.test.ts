import assert from 'node:assert/strict';
import { test } from 'vitest';
import { analysisRow } from '../../../../test/news/analysis';
import { upsertMaterial } from './materials';
import { acceptScore } from './scoring';
import { defaultNewsWidgets, normalizeNewsWidgets } from './home-widgets';
import { newsWidgetRows } from './widget-rows';
import type { NewsStory } from './model';

test('widget normalization keeps independent identities, explicit empty settings and valid bounds', () => {
	assert.deepEqual(normalizeNewsWidgets(undefined), defaultNewsWidgets());
	assert.deepEqual(normalizeNewsWidgets([]), []);
	assert.deepEqual(normalizeNewsWidgets([
		{ id: 'a', mode: 'view', viewId: 'gone', name: ' Saved ', count: 100, staleMinutes: 1, showSummary: false },
		{ id: 'b', mode: 'view', viewId: 'second', count: 2, staleMinutes: 120 },
		{ id: 'a', mode: 'hot' }, { id: 'invalid', mode: 'raw' }, null,
	]), [
		{ id: 'a', mode: 'view', viewId: 'gone', name: 'Saved', count: 50, staleMinutes: 15, showSummary: false },
		{ id: 'b', mode: 'view', viewId: 'second', name: '', count: 2, staleMinutes: 120, showSummary: true },
	]);
});

test('featured and saved widgets filter before event deduplication and limits, keeping exact material links', async () => {
	const materials = await Promise.all(['one', 'two', 'three', 'hidden', 'withdrawn'].map(async (name, index) => ({ ...await upsertMaterial(undefined, { sourceId: name, url: `https://example.com/${name}`, title: name }, index), id: name })));
	materials[4]!.withdrawn = true;
	const analyses = materials.map(item => ({ ...acceptScore(item, analysisRow('m0'), { version: 'test' }), target: 'featured' as const, titleZh: `Written ${item.id}`, summaryZh: `Summary ${item.id}` }));
	const story: NewsStory = { id: 'event', title: 'Event', materialIds: ['one', 'two'], representativeId: 'two', occurrenceIds: [], firstSeenAt: 0, latestAt: 1 };
	const service = { materials: () => materials, analyses: () => analyses, isHidden: (id: string) => id === 'hidden', stories: () => [story], story: () => story,
		views: () => [{ id: 'first', name: 'First', sourceIds: ['one'] }, { id: 'second', name: 'Second', sourceIds: ['three'] }], hot: () => [] };
	assert.deepEqual(newsWidgetRows(service, { ...defaultNewsWidgets()[0]!, count: 2 }).map(row => row.id), ['three', 'two']);
	assert.deepEqual(newsWidgetRows(service, { ...defaultNewsWidgets()[0]!, mode: 'view', viewId: 'first' }), [{ id: 'one', title: 'Written one', summary: 'Summary one' }]);
	assert.deepEqual(newsWidgetRows(service, { ...defaultNewsWidgets()[0]!, mode: 'view', viewId: 'second' }).map(row => row.id), ['three']);
	assert.deepEqual(newsWidgetRows(service, { ...defaultNewsWidgets()[0]!, mode: 'view', viewId: 'deleted' }), []);
});
