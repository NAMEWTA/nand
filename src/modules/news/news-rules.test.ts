import { analysisAnswer, analysisRow } from '../../../test/news/analysis';
import { memoryNotes } from '../../../test/news/notes';
import { DOMParser } from 'linkedom';
import { vi } from 'vitest';
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { TextStorage } from '../../shared/storage/ports';
import { runMaterialAnalysis } from './core/analysis-run';
import { groupMaterials } from './core/grouping';
import { rankHeat } from './core/heat';
import { canonicalNewsUrl, isTodayMaterial, upsertMaterial } from './core/materials';
import { normalizeNewsSource, type NewsSource } from './core/model';
import { effectivePromptVersion } from './core/prompts';
import { chooseRepresentative } from './core/representative';
import { acceptScore } from './core/scoring';
import { sourceDue } from './core/source-schedule';
import { filterView } from './core/views';
import { parseFeed } from './platform/feed-reader';
import { favoritePath, refreshFavoriteNote, serializeMaterial } from './platform/notes';
import { importOpml } from './platform/opml';
import { parseStaticList } from './platform/web-list-reader';
import { NewsService } from './services/news-service';

const memory = (): TextStorage & { files: Map<string, string> } => {
	const files = new Map<string, string>();
	return {
		files,
		async exists(path) {
			return files.has(path);
		},
		async read(path) {
			const value = files.get(path);
			if (value === undefined) throw new Error(`missing ${path}`);
			return value;
		},
		async write(path, content) {
			files.set(path, content);
		},
		async mkdir() {},
	};
};

const source = (id: string, url: string): NewsSource => normalizeNewsSource({ id, name: id, url, type: 'rss', enabled: true, tier: 'T1', participation: 'editorial', intervalMinutes: 30 })!;

describe('news feed, today, analysis and favorites', () => {
	test('aliases collapse, old and dateless items stay out of today, and a body change is one revision', async () => {
		const now = Date.parse('2026-10-09T12:00:00Z');
		const left = canonicalNewsUrl('https://WWW.Example.com/story/?utm_source=x');
		const right = canonicalNewsUrl('http://example.com/story');
		assert.equal(left, right);
		assert.notEqual(canonicalNewsUrl('https://example.com/story#a', true), canonicalNewsUrl('https://example.com/story#b', true));
		const anchored = await upsertMaterial(undefined, { sourceId: 'alpha', url: 'https://example.com/story#a', title: 'A', publishedAt: now }, now, true);
		const otherAnchor = await upsertMaterial(undefined, { sourceId: 'alpha', url: 'https://example.com/story#b', title: 'B', publishedAt: now }, now, true);
		assert.notEqual(anchored.id, otherAnchor.id);
		assert.equal(anchored.originalUrl, 'https://example.com/story#a');
		const first = await upsertMaterial(undefined, { sourceId: 'alpha', url: 'https://www.example.com/story?utm_source=x', title: 'Story', summary: 'One', publishedAt: now - 60 * 60 * 1000 }, now);
		const again = await upsertMaterial(first, { sourceId: 'alpha', url: 'https://example.com/story', title: 'Story', summary: 'One' }, now);
		assert.equal(again.id, first.id);
		assert.equal(again.revision, 1);
		const edited = await upsertMaterial(again, { sourceId: 'alpha', url: 'https://example.com/story', title: 'Story', summary: 'Two' }, now);
		assert.equal(edited.revision, 2);
		const old = await upsertMaterial(undefined, { sourceId: 'alpha', url: 'https://example.com/old', title: 'Old', publishedAt: now - 49 * 60 * 60 * 1000 }, now);
		assert.equal(old.backfillReason, 'older-than-window');
		assert.equal(old.publishedAt, now - 49 * 60 * 60 * 1000);
		assert.equal(isTodayMaterial(old, now), false);
		const unknown = await upsertMaterial(undefined, { sourceId: 'alpha', url: 'https://example.com/unknown', title: 'Unknown' }, now);
		assert.equal(unknown.publishedAt, undefined);
		assert.equal(unknown.backfillReason, 'unknown-date');
		assert.equal(isTodayMaterial(unknown, now), false);
		assert.equal(isTodayMaterial(first, now), true);
	});

	test('rss, atom, json, opml and a static list share one pipeline', () => {
		const rss = parseFeed('<rss><channel><item><title>Hello</title><link>https://example.com/hello</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>', 'alpha', 'https://example.com/feed');
		assert.equal(rss.length, 1);
		assert.equal(rss[0]?.title, 'Hello');
		const atom = parseFeed('<feed><entry><title>Atom</title><link href="https://example.com/atom"/><id>atom-1</id><updated>2026-10-09T10:00:00Z</updated></entry></feed>', 'alpha', 'https://example.com/atom');
		assert.equal(atom[0]?.sourceItemId, 'atom-1');
		const json = parseFeed(JSON.stringify({ version: 'https://jsonfeed.org/version/1', items: [{ id: 'j1', url: 'https://example.com/json', title: 'JSON', content_text: 'body' }] }), 'alpha', 'https://example.com');
		assert.equal(json[0]?.title, 'JSON');
		const html = '<ul><li><a href="/one">One</a></li><script>alert(1)</script></ul>';
		const list = parseStaticList(html, 'alpha', 'https://example.com/list', { item: 'li', link: 'a', title: 'a' });
		assert.equal(list.error, undefined);
		assert.equal(list.items[0]?.url, 'https://example.com/one');
		assert.equal(list.items.some((item) => (item.body ?? '').includes('alert')), false);
		const existing = source('alpha', 'https://example.com/a.xml');
		existing.tier = 'T1';
		const imported = importOpml(`<opml><body><outline xmlUrl="https://example.com/a.xml" title="Other" /><outline xmlUrl="https://example.com/b.xml" title="Bee" /></body></opml>`, [existing]);
		assert.equal(imported.sources[0]?.tier, 'T1');
		assert.equal(imported.sources.length, 2);
		assert.equal(imported.skipped, 1);
	});

	test('one failed source does not blank another, and a favorite note survives refresh and cache clear', async () => {
		const store = memory();
		const alpha = source('alpha', 'https://example.com/a.xml');
		const beta = source('beta', 'https://example.com/b.xml');
		const service = new NewsService(store, memoryNotes(store), () => ({ enabled: true, sources: [alpha, beta], views: [], analysisEnabled: true }), {
			async fetch(item) {
				if (item.id === 'beta') throw new Error('news.http.503');
				return { status: 200, text: '<rss><channel><item><title>Kept</title><link>https://example.com/kept</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate><description>Body</description></item></channel></rss>' };
			},
		});
		await service.refresh();
		assert.equal(service.materials().length, 1);
		assert.equal(service.materials()[0]?.title, 'Kept');
		assert.ok((service.health('beta')?.failureCount ?? 0) > 0);
		const material = service.materials()[0]!;
		await service.saveFavorite(material, 'my annotation');
		await service.refresh('alpha');
		assert.match(store.files.get(favoritePath(material)) ?? '', /my annotation/);
		await service.clearCache();
		assert.equal(service.materials().length, 0);
		assert.equal(await service.favoriteNotes(material.id), 'my annotation');
		await service.shutdown();
	});

	test('device files keep a version envelope, retention leaves favorite identity, and a bad read is not wiped', async () => {
		const store = memory();
		const directory = '.nand/news/device-1';
		const old = await upsertMaterial(undefined, { sourceId: 'alpha', url: 'https://example.com/old-story', title: 'Old', summary: 'secret body' }, Date.parse('2020-01-01T00:00:00Z'));
		store.files.set(`${directory}/materials.json`, JSON.stringify({ version: 1, items: [old] }));
		const service = new NewsService(store, memoryNotes(store), () => ({ enabled: true, sources: [source('alpha', 'https://example.com/a.xml')], views: [], analysisEnabled: true }), {
			async fetch() {
				return { status: 200, text: '<rss><channel><item><title>Fresh</title><link>https://example.com/fresh</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate><description>Now</description></item></channel></rss>' };
			},
		}, directory);
		await service.ready;
		await service.saveFavorite(old, 'my annotation');
		await service.refresh();
		const kept = service.materials().find((item) => item.id === old.id);
		assert.equal(kept?.bodyExcerpt, '');
		assert.equal(kept?.summary, undefined);
		assert.equal(service.materials().some((item) => item.title === 'Fresh'), true);
		for (const name of ['materials', 'analyses', 'events', 'heat', 'runs', 'reader-state']) {
			const parsed = JSON.parse(store.files.get(`${directory}/${name}.json`) ?? '') as { version?: number };
			assert.equal(parsed.version, 1);
		}
		assert.equal(store.files.has('.nand/news/state.json'), false);
		assert.equal(await service.favoriteNotes(old.id), 'my annotation');
		await service.clearCache();
		assert.equal(await service.favoriteNotes(old.id), 'my annotation');
		await service.shutdown();

		const broken = memory();
		const bad = '.nand/news/device-bad/materials.json';
		broken.files.set(bad, '{');
		const failed = new NewsService(broken, memoryNotes(broken), () => ({ enabled: true, sources: [], views: [] }), undefined, '.nand/news/device-bad');
		await assert.rejects(() => failed.ready);
		assert.equal(broken.files.get(bad), '{');
		assert.equal([...broken.files.keys()].filter((path) => path.endsWith('.json')).length, 1);
		await failed.shutdown();
	});

	test('analysis stops at the budget, repairs once, and does not treat a truncated tail as the answer', async () => {
		const now = Date.parse('2026-10-09T12:00:00Z');
		const material = await upsertMaterial(undefined, { sourceId: 'alpha', url: 'https://example.com/story', title: 'Story', summary: 'x'.repeat(300), publishedAt: now }, now);
		const row = analysisRow();
		let calls = 0;
		const repaired = await runMaterialAnalysis([material], [], {
			async run() {
				calls += 1;
				return calls === 1 ? { status: 'succeeded', text: 'not json', terminalId: 'owned-test' } : { status: 'succeeded', text: analysisAnswer([row]) };
			},
		}, 2, 0, now);
		assert.equal(repaired.status, 'complete');
		assert.equal(repaired.calls, 2);
		const again = await runMaterialAnalysis([material], repaired.analyses, { async run() { throw new Error('called'); } }, 2, repaired.spent, now);
		assert.equal(again.calls, 0);
		assert.equal(again.analyses[0]?.version, await effectivePromptVersion());
		const truncated = await runMaterialAnalysis([{ ...material, id: 'other', contentHash: 'new' }], [], { async run() { return { status: 'failed', errorCode: 'answerTooLarge', text: '' }; } }, 2);
		assert.equal(truncated.status, 'failed');
		assert.equal(truncated.calls, 1);
		const budget = await runMaterialAnalysis([material], [], { async run() { return { status: 'succeeded', text: '[]' }; } }, 0);
		assert.equal(budget.status, 'budget');
		assert.equal(budget.calls, 0);
		const failed = await runMaterialAnalysis([material], [], { async run() { return { status: 'failed', text: '' }; } }, 2);
		assert.equal(failed.status, 'failed');
		const grouped = groupMaterials([material, { ...material, id: 'follow', title: material.title, contentHash: 'b' }]);
		assert.equal(grouped.stories.length, 0);
		const scored = acceptScore(material, row, { version: 'fixture' });
		const story = { id: 'fixture-story', title: material.title, materialIds: [material.id], occurrenceIds: [], firstSeenAt: now, latestAt: now };
		assert.equal(chooseRepresentative(story, [material], [source('alpha', 'https://example.com/a.xml')]), material.id);
		const ranked = rankHeat([
			{ eventId: 'e', participantId: 'a', editorial: true, at: now, sourceId: 'alpha', addedAt: 0, stale: false },
			{ eventId: 'e', participantId: 'b', editorial: true, at: now - 24 * 3_600_000, sourceId: 'beta', addedAt: 0, stale: false },
		], now);
		assert.equal(ranked[0]?.index, 15);
		assert.equal(sourceDue({ nextDue: now + 1000 }, now), false);
		assert.equal(filterView({ minScore: 90 }, [material], [{ ...scored, score: 10 }]).length, 0);
		const note = refreshFavoriteNote(serializeMaterial(material, 'keep me'), { ...material, title: 'Next' });
		assert.match(note, /keep me/);
		assert.match(note, /Next/);
	});
});

vi.stubGlobal('DOMParser', DOMParser);
