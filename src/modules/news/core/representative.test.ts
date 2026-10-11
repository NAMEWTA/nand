import { expect, test } from 'vitest';
import type { NewsMaterial, NewsOccurrence, NewsSource, NewsStory } from './model';
import { normalizeNewsSource } from './model';
import { upsertMaterial } from './materials';
import { chooseRepresentative, representativePriority } from './representative';

const material = async (id: string, time: number, body = ''): Promise<NewsMaterial> => ({ ...await upsertMaterial(undefined, { sourceId: id, url: `https://example.com/${id}`, title: id, body, publishedAt: time }, time), id });
const source = (id: string, options: Partial<NewsSource> = {}): NewsSource => normalizeNewsSource({ id, name: id, url: `https://example.com/${id}`, enabled: true, ...options })!;

test('T1 precedes verified institution and person; unrelated owner names confer no authority', () => {
	expect(representativePriority(source('tier', { tier: 'T1' }))).toBe(0);
	expect(representativePriority(source('org', { ownerEntityId: 'Company', publisherRole: 'organization' }), 'company、Person')).toBe(1);
	expect(representativePriority(source('person', { ownerEntityId: 'Person', publisherRole: 'person' }), 'Person')).toBe(2);
	expect(representativePriority(source('unknown', { ownerEntityId: 'Company', publisherRole: 'media' }), 'Company')).toBe(3);
	expect(representativePriority(source('wrong', { ownerEntityId: 'Other', publisherRole: 'organization' }), 'Company')).toBe(3);
});

test('most distinct sources wins the occurrence, then authority/fulltext/score/earlier time/id select its report', async () => {
	const items = [await material('leak', 1, 'long'), await material('official', 10), await material('media', 9, 'full'), await material('mirror', 11, 'full')];
	items[3]!.sourceId = 'media';
	const story: NewsStory = { id: 'story', title: '', materialIds: items.map(item => item.id), occurrenceIds: ['leak', 'launch'], firstSeenAt: 1, latestAt: 11 };
	const occurrences: NewsOccurrence[] = [{ id: 'leak', materialIds: ['leak'], storyId: story.id, firstSeenAt: 1, latestAt: 1, kind: 'report' }, { id: 'launch', materialIds: ['official', 'media', 'mirror'], storyId: story.id, firstSeenAt: 9, latestAt: 11, kind: 'follow-up' }];
	const sources = [source('leak', { tier: 'T1' }), source('official', { tier: 'T1' }), source('media', { tier: 'T2' })];
	expect(chooseRepresentative(story, items, sources, occurrences)).toBe('official');
	occurrences[1]!.materialIds = ['media', 'mirror'];
	expect(chooseRepresentative(story, items, sources, occurrences)).toBe('leak');
	const standalone = { ...story, materialIds: ['media', 'mirror'] };
	expect(chooseRepresentative(standalone, items, sources)).toBe('media');
	items[2]!.body = '';
	expect(chooseRepresentative(standalone, items, sources)).toBe('mirror');
});
