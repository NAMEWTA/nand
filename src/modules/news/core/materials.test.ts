import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { isTodayMaterial, upsertMaterial } from './materials';

test('SHA-256 distinguishes known FNV collisions for both stable IDs and content revisions', async () => {
	const sourceId = 'source', url = 'https://example.com/article';
	const [left, right] = await Promise.all(['item-1ppgtvf', 'item-rx6lxj'].map(value => upsertMaterial(undefined, { sourceId, sourceItemId: value, url, title: value })));
	assert.notEqual(left!.id, right!.id);
	assert.notEqual(left!.contentHash, right!.contentHash);
	assert.equal(left!.contentHash, createHash('sha256').update('item-1ppgtvf\u0001\u0001').digest('hex'));
	assert.equal(left!.id, `source:${createHash('sha256').update('item-1ppgtvf').digest('hex')}`);
	const revised = await upsertMaterial(left, { sourceId, sourceItemId: 'item-1ppgtvf', url, title: 'item-rx6lxj' });
	assert.equal(revised.id, left!.id); assert.equal(revised.revision, 2);
	const rotated = await upsertMaterial(revised, { sourceId, sourceItemId: 'item-1ppgtvf', url, title: 'item-1ppgtvf' });
	assert.equal(rotated.revision, 2); assert.equal(rotated.contentHash, revised.contentHash); assert.equal(rotated.title, revised.title);
	assert.deepEqual(rotated.seenContentHashes, [left!.contentHash, revised.contentHash]);
});

test('whitespace and missing fields do not erase content or revise it; another source cannot overwrite the owner', async () => {
	const input = { sourceId: 'owner', url: 'https://example.com/story', title: ' News\t title ', body: 'Full\nbody', summary: 'Short  summary' };
	const first = await upsertMaterial(undefined, input, 1);
	assert.equal(first.contentHash, createHash('sha256').update('News title\u0001Full body\u0001Short summary').digest('hex'));
	const again = await upsertMaterial(first, { sourceId: 'owner', url: input.url, title: 'News title' }, 2);
	assert.equal(again.revision, 1); assert.equal(again.body, 'Full body'); assert.equal(again.summary, 'Short summary');
	assert.deepEqual(await upsertMaterial(again, { ...input, sourceId: 'mirror', title: 'Mirror title', body: 'Mirror body' }, 3), again);
	const cleared = await upsertMaterial(again, { ...input, body: '', summary: '' }, 4);
	assert.equal(cleared.revision, 2); assert.equal(cleared.body, ''); assert.equal(cleared.summary, '');
});

test('initial imports remain archived, while filling a missing date uses first discovery time', async () => {
	const now = Date.parse('2026-10-09T12:00:00Z');
	const input = { sourceId: 'source', url: 'https://example.com/article', title: 'Article', body: 'Body' };
	const initial = await upsertMaterial(undefined, { ...input, publishedAt: now, initialImport: true }, now);
	assert.equal(initial.backfillReason, 'initial-import');
	assert.equal(isTodayMaterial(initial, now), false);
	const unknown = await upsertMaterial(undefined, input, now);
	const filled = await upsertMaterial(unknown, { ...input, publishedAt: now - 1000 }, now + 72 * 3_600_000);
	assert.equal(filled.discoveredAt, now);
	assert.equal(filled.backfillReason, undefined);
	assert.equal(filled.revision, 2);
	const stale = await upsertMaterial(unknown, { ...input, publishedAt: now - 48 * 3_600_000 - 1 }, now + 72 * 3_600_000);
	assert.equal(stale.backfillReason, 'older-than-window');
	const future = await upsertMaterial(undefined, { ...input, publishedAt: now + 3_600_001 }, now);
	assert.equal(future.publishedAt, undefined);
	assert.equal(future.claimedAt, now + 3_600_001);
	assert.equal(future.backfillReason, 'future-date');
});
