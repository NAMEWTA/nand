import assert from 'node:assert/strict';
import { test } from 'vitest';
import { analysisRow } from '../../../../test/news/analysis';
import { memoryNotes } from '../../../../test/news/notes';
import type { TextStorage } from '../../../shared/storage/ports';
import { emptyEvents } from '../core/grouping';
import { upsertMaterial } from '../core/materials';
import { acceptScore } from '../core/scoring';
import { normalizeNewsSource } from '../core/model';
import { editionPath, parseMaterialNote } from '../platform/notes';
import { NewsService } from './news-service';

test('edition reads make no writes; compiled memory survives restart and optional Markdown preserves annotations', async () => {
	const now = Date.now(), files = new Map<string, string>();
	const store: TextStorage & { files: Map<string, string> } = { files, exists: async path => files.has(path), read: async path => files.get(path)!, write: async (path, text) => { files.set(path, text); }, mkdir: async () => undefined };
	const source = normalizeNewsSource({ id: 'source', name: 'Source', url: 'https://example.com/feed', enabled: true, tier: 'T1' })!;
	const material = await upsertMaterial(undefined, { sourceId: source.id, url: 'https://example.com/one', title: 'Release', summary: 'Company released a model.', publishedAt: now }, now);
	const analysis = acceptScore(material, analysisRow(material.id, { scope: 'single', frame: { title: 'Release', subject: 'Company', action: 'released', object: 'model', occurredAt: null, evidence: material.bodyExcerpt, conditions: [] } }), { version: 'fixture', groupConfirmed: true, tier: 'T1', now });
	const events = emptyEvents();
	events.stories.push({ id: 'story', title: 'Release', materialIds: [material.id], occurrenceIds: ['occ'], firstSeenAt: now, latestAt: now });
	events.occurrences.push({ id: 'occ', storyId: 'story', materialIds: [material.id], kind: 'report', firstSeenAt: now, latestAt: now, frame: analysis.frame! });
	events.records.push({ materialId: material.id, revision: material.revision, contentHash: material.contentHash, version: analysis.version, analyzedAt: now, confirmed: true });
	for (const [name, items] of Object.entries({ materials: [material], analyses: [analysis], events })) files.set(`.nand/news/local/${name}.json`, JSON.stringify({ version: 1, items }));
	const config = { enabled: true, sources: [source], views: [], writeDailyNote: false };
	let service = new NewsService(store, memoryNotes(store), () => config); await service.ready;
	const before = new Map(files), edition = service.dailyEdition(now);
	assert.deepEqual(edition.materialIds, [material.id]); assert.deepEqual(files, before);
	await service.compileEdition(now); assert.ok(![...files.keys()].some(path => path.endsWith('.md')));
	await service.shutdown(); service = new NewsService(store, memoryNotes(store), () => config); await service.ready;
	assert.equal(service.dailyEdition(now).main.length, 1); // Same-day reads do not suppress themselves.
	config.writeDailyNote = true; await service.compileEdition(now);
	const path = editionPath(edition), original = files.get(path)!;
	files.set(path, original.replace('---\n', '---\ncustom: reader\n') + '\nMy annotation\n');
	await service.compileEdition(now);
	assert.match(files.get(path)!, /custom: reader/); assert.match(parseMaterialNote(files.get(path)!).notes, /My annotation/);
	const saved = files.get(path)!; files.set(path, saved.replace('Company', 'My correction'));
	// The generated Chinese summary is intentionally modified to exercise the managed-region guard.
	files.set(path, files.get(path)!.replace(analysis.summaryZh, 'Reader correction'));
	await assert.rejects(service.compileEdition(now), /news.note.edited/);
	assert.equal(service.callBudget().used, 0);
	await service.clearCache(); assert.ok(files.has(path));
	await service.shutdown();
});
