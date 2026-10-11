import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';
import { test, vi } from 'vitest';
import { parseFeed } from './feed-reader';

vi.stubGlobal('DOMParser', DOMParser);

test('feed language inherits from RSS channel, Atom xml:lang and JSON feed with item overrides', () => {
	const rss = parseFeed('<rss><channel><language>zh-CN</language><item><title>Title</title><link>https://example.com/rss</link></item></channel></rss>', 'rss');
	assert.equal(rss[0]?.language, 'zh-CN');
	const atom = parseFeed('<feed xml:lang="en"><entry xml:lang="fr"><title>Title</title><link href="https://example.com/atom"/></entry><entry><title>Next</title><link href="https://example.com/next"/></entry></feed>', 'atom');
	assert.deepEqual(atom.map(item => item.language), ['fr', 'en']);
	const json = parseFeed(JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', language: 'en', items: [{ id: 'one', url: 'https://example.com/one', content_text: 'One', language: 'ja' }, { id: 'two', url: 'https://example.com/two', content_text: 'Two' }] }), 'json');
	assert.deepEqual(json.map(item => item.language), ['ja', 'en']);
});

test('RSS comments, namespaced CDATA and entities preserve source text in document order', () => {
	const rows = parseFeed(`<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
		<channel><!-- publisher comment --><item><title>A &amp; B</title><guid isPermaLink="false">stable-id</guid>
		<link>/article?a=1&amp;b=2</link><description><![CDATA[<p>First <b>bold</b> end.</p><p>Second &amp; third.</p>]]></description>
		<content:encoded><![CDATA[<p>Full <em>body</em> after.</p><script>doNotRun()</script>]]></content:encoded><dc:creator>Author</dc:creator>
		</item></channel></rss>`, 'source', 'https://example.com/feed');
	assert.equal(rows.length, 1);
	assert.equal(rows[0]?.title, 'A & B');
	assert.equal(rows[0]?.sourceItemId, 'stable-id');
	assert.equal(rows[0]?.url, 'https://example.com/article?a=1&b=2');
	assert.equal(rows[0]?.summary, 'First bold end. Second & third.');
	assert.equal(rows[0]?.body, 'Full body after.');
	assert.equal(rows[0]?.author, 'Author');
});

test('Atom resolves nested xml:base and typed text constructs without treating content links as entry links', () => {
	const [row] = parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.com/root/">
		<entry xml:base="entries/"><id>tag:example.com,2026:one</id><title type="html">A &lt;b&gt;bold&lt;/b&gt; title</title>
		<content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Before <b>bold</b> after</p><p>Next</p></div></content>
		<link rel="self" href="self.xml"/><link rel="alternate" xml:base="../articles/" href="one"/>
		<author><name>Writer</name><uri>https://example.com/writer</uri></author><updated>2026-10-10T12:00:00Z</updated><published>2026-10-09T08:00:00Z</published>
		</entry></feed>`, 'atom', 'https://fallback.example/feed');
	assert.equal(row?.url, 'https://example.com/root/articles/one');
	assert.equal(row?.title, 'A bold title');
	assert.equal(row?.body, 'Before bold after Next');
	assert.equal(row?.author, 'Writer');
	assert.equal(row?.publishedAt, Date.parse('2026-10-09T08:00:00Z'));
});

test('JSON Feed 1.1 accepts titleless items, decodes HTML and inherits authors while rejecting invalid content and links', () => {
	const rows = parseFeed(JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', title: 'Feed', home_page_url: 'https://example.com/', authors: [{ name: 'Feed author' }], items: [
		{ id: 'one', url: '/one', content_html: '<p>A &amp; B</p><p>Second</p>', summary: 'A summary' },
		{ id: 'two', content_text: 'No title or item URL', authors: [{ name: 'First' }, { name: 'Second' }] },
		{ id: 'invalid', url: '/invalid', title: 'No content' },
		{ id: 'unsafe', url: 'javascript:alert(1)', content_text: 'Unsafe' },
	] }), 'json', 'https://example.com/feed.json');
	assert.equal(rows.length, 2);
	assert.equal(rows[0]?.title, 'A & B Second');
	assert.equal(rows[0]?.body, 'A & B Second');
	assert.equal(rows[0]?.summary, 'A summary');
	assert.equal(rows[0]?.author, 'Feed author');
	assert.equal(rows[1]?.sourceItemId, 'two');
	assert.equal(rows[1]?.author, 'First, Second');
	assert.equal(rows[1]?.publishedAt, undefined);
});
