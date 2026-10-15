import { afterEach, expect, test, vi } from 'vitest';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
import { RssStore, RSS_PATH } from './rss-store';
import { refreshFeeds, resolveArticleMarkdown } from './rss-service';
import { saveRssArticle } from './rss-note';
import { emptyFile } from '../../core/rss/rss-model';
const active: RssStore[] = [];
afterEach(async () => {
	for (const s of active.splice(0)) await s.destroy().catch(() => {});
	vi.restoreAllMocks();
});
const store = (vault: ReturnType<typeof memoryVault>) => {
	const s = new RssStore(vault.app);
	active.push(s);
	return s;
};
test('hiding a window releases RSS timers and prevents late writes or further queued requests', async () => {
	const s = store(memoryVault({}, window));
	await s.load();
	let finish!: (value: string) => void;
	const fetcher = vi.fn(
		() =>
			new Promise<string>((resolve) => {
				finish = resolve;
			}),
	);
	const controller = new AbortController();
	const clear = vi.spyOn(window, 'clearTimeout');
	const pending = refreshFeeds(
		s,
		Array.from({ length: 8 }, (_, i) => ({ url: `https://fixture.test/${i}` })),
		{ fetcher, signal: controller.signal, ownerWindow: window },
	);
	expect(fetcher).toHaveBeenCalledTimes(4);
	controller.abort();
	await pending;
	expect(clear).toHaveBeenCalledTimes(4);
	finish('<rss><channel><title>Late</title><item><title>Late</title><guid>late</guid></item></channel></rss>');
	await Promise.resolve();
	expect(s.feedEntry('https://fixture.test/3')).toBeUndefined();
	expect(fetcher).toHaveBeenCalledTimes(4);
});
test('RSS reads, saved paths and cache survive restart; separate writers merge unrelated GUIDs', async () => {
	const vault = memoryVault({ [RSS_PATH]: JSON.stringify(emptyFile()) }, window),
		a = store(vault),
		b = store(vault);
	await Promise.all([a.load(), b.load()]);
	a.markRead('a');
	b.markRead('b');
	await Promise.all([a.flush(), b.flush()]);
	const c = store(vault);
	await c.load();
	expect(c.isRead('a')).toBe(true);
	expect(c.isRead('b')).toBe(true);
	c.setSaved('a', '.nand/content/News/A.md');
	c.setCachedWeb('a', 'Article');
	await c.flush();
	const d = store(vault);
	await d.load();
	expect(d.savedPath('a')).toBe('.nand/content/News/A.md');
	expect(d.cachedWeb('a')).toBe('Article');
});
test('corrupt RSS state is preserved and failed saves retain a recoverable draft', async () => {
	const vault = memoryVault({ [RSS_PATH]: '{broken' }, window),
		s = store(vault);
	await expect(s.load()).rejects.toThrow();
	s.markRead('a');
	await expect(s.flush()).rejects.toThrow();
	expect(vault.contents.get(RSS_PATH)).toBe('{broken');
	expect([...vault.contents.keys()].some((p) => p.startsWith('.nand/recovery/drafts/'))).toBe(true);
});
test('feed TTL avoids requests, force refresh updates, failed feed retains old articles', async () => {
	const vault = memoryVault({}, window),
		s = store(vault);
	await s.load();
	const xml =
			'<rss><channel><title>News</title><item><guid>a</guid><title>A</title><link>https://example.com/a</link></item></channel></rss>',
		fetcher = vi.fn(async () => xml),
		sources = [{ url: 'https://example.com/rss' }];
	await refreshFeeds(s, sources, { fetcher });
	await refreshFeeds(s, sources, { fetcher });
	expect(fetcher).toHaveBeenCalledTimes(1);
	await refreshFeeds(s, sources, {
		fetcher: async () => {
			throw Error('offline');
		},
		force: true,
	});
	expect(s.feedEntry(sources[0]!.url)?.items[0]?.guid).toBe('a');
	expect(s.feedEntry(sources[0]!.url)?.error).toBe('offline');
});
test('article resolution prioritizes full feed then cached web, falls back to summary offline', async () => {
	const s = store(memoryVault({}, window));
	await s.load();
	const feed = { title: 'News', link: 'https://example.com' },
		item = {
			guid: 'a',
			title: 'A',
			link: 'https://example.com/a',
			contentHtml: `<p>${'Article '.repeat(100)}</p>`,
		},
		fetcher = vi.fn(async () => {
			throw Error('offline');
		});
	expect((await resolveArticleMarkdown(s, feed, item, { fetcher })).source).toBe('feed');
	expect(fetcher).not.toHaveBeenCalled();
	s.setCachedWeb('a', 'Cached');
	expect((await resolveArticleMarkdown(s, feed, { ...item, contentHtml: undefined }, { fetcher })).markdown).toBe(
		'Cached',
	);
	expect(
		(
			await resolveArticleMarkdown(
				s,
				feed,
				{ ...item, guid: 'b', contentHtml: undefined, summaryHtml: '<p>Summary</p>' },
				{ fetcher },
			)
		).markdown,
	).toBe('Summary');
});
test('article downloads remain in managed content and choose a unique filename', async () => {
	const vault = memoryVault({}, window),
		opts = {
			folder: 'News',
			feedTitle: 'Feed',
			item: { guid: 'a', title: 'Article', link: 'https://example.com/a', pubDate: 1760443200000 },
			markdown: '# Body',
		};
	const a = await saveRssArticle(vault.app, opts),
		b = await saveRssArticle(vault.app, opts);
	expect(a.path).toMatch(/^\.nand\/content\/News\//);
	expect(b.path).not.toBe(a.path);
	expect(vault.contents.get(a.path)).toContain('来源: Feed');
});
