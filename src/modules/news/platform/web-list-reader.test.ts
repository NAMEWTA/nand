import { DOMParser } from 'linkedom';
import { expect, test, vi } from 'vitest';
import { parseStaticList } from './web-list-reader';

vi.stubGlobal('DOMParser', DOMParser);

test('static selectors handle nested classes, attributes, dates, entities and independent URL fragments', () => {
	const html = `<section class="release"><article data-kind="stable"><header><h2>A &amp; B</h2></header><a class="title" href="../releases#one">Read</a><time datetime="2026-10-09T10:00:00Z">today</time><script>throw Error('must not execute')</script></article>
	<article data-kind="beta"><h2>Ignore</h2><a href="/bad">No</a></article>
	<article data-kind="stable"><h2>C</h2><a class="title" href="../releases#two">Read</a></article>
	<article data-kind="stable"><h2>Unsafe</h2><a class="title" href="javascript:alert(1)">No</a></article></section>`;
	const result = parseStaticList(html, 'source', 'https://example.com/news/list', { item: '.release > article[data-kind="stable"]', link: 'a.title', title: 'header h2, h2', date: 'time', preserveFragment: true });
	expect(result.error).toBeUndefined();
	expect(result.items.map(item => item.url)).toEqual(['https://example.com/releases#one', 'https://example.com/releases#two']);
	expect(result.items[0]?.title).toBe('A & B');
	expect(result.items[0]?.publishedAt).toBe(Date.parse('2026-10-09T10:00:00Z'));
	expect(result.items[0]?.body).not.toContain('must not execute');
	expect(result.items[1]?.publishedAt).toBeUndefined();
	expect(parseStaticList(html, 'source', 'https://example.com', { item: '.missing', link: 'a', title: 'h2' }).error).toBe('no_matches');
	expect(parseStaticList(html, 'source', 'https://example.com', { item: '.missing', link: '[', title: 'h2' }).error).toBe('invalid_selector');
});
