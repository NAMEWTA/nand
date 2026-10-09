import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { NewsMaterial } from '../core/model';
import { briefPath, favoritePath, parseMaterialNote, refreshBriefNote, serializeBrief, serializeMaterial } from './notes';

const material = {
	id: 'story-1',
	sourceId: 'alpha',
	sourceItemId: 'story-1',
	originalUrl: 'https://example.com/story',
	canonicalKey: 'example.com/story',
	title: '标题',
	bodyExcerpt: '',
	discoveredAt: 1,
	revision: 1,
	contentHash: 'abc',
	summary: '摘要',
} as NewsMaterial;

test('a brief keeps its folder and the reader annotation, and a favorite stays a different note', () => {
	const body = '## 背景\n见 https://example.com/story\n## 影响\n继续\n## 时间线\n今天';
	const note = serializeBrief('story-1', '标题', body, '我的批注');
	assert.equal(briefPath('story-1'), 'NAND/新闻/简报/story-1.md');
	assert.notEqual(briefPath(material.id), favoritePath(material.id));
	assert.equal(parseMaterialNote(note).notes, '我的批注');
	const next = refreshBriefNote(note, 'story-1', '标题', '## 背景\n新\n## 影响\n继续\n## 时间线\n明天');
	assert.match(next, /我的批注/);
	assert.match(next, /新/);
	assert.doesNotMatch(next, /今天/);
	assert.match(serializeMaterial(material, 'keep'), /keep/);
});
