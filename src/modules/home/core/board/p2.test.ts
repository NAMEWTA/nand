import { expect, test } from 'vitest';
import { parse, serialize } from './parser/parse';
import { parseFeedXml } from '../rss/rss-xml';
import { htmlToMarkdown } from '../rss/html-md';
import { buildOpml, parseOpml } from '../rss/rss-opml';
import { tzDayNum, fromTzInputs, tzParts } from '../ticktick/ticktick-tz';
import { computeSortOrder } from '../ticktick/task-order';
import { homeSettings } from '../../settings';
test('Apex P2 frontmatter survives edits and preserves author text', () => {
	const raw =
		'---\ncustom: keep # author\ncolumns:\n - name: Feeds\n   type: rss\n   rss: {feeds: [{name: News, url: "https://example.com/rss", group: Tech}], downloadFolder: News, groups: [Tech], groupBy: feed, pageSize: 50}\n - name: Tasks\n   type: ticktick\n   ticktick: {view: lists, hiddenProjects: [secret], projectWidths: {inbox: 320}}\n - name: Books\n   type: weread\n   weread: {widgets: [{id: w1, view: shelf, groupBy: notes}]}\n---\n## Feeds\nAuthor prose.\n## Tasks\n## Books\n';
	const data = parse(raw);
	expect(data.columns[0]!.rssConfig?.feeds).toHaveLength(1);
	expect(data.columns[1]!.ticktickConfig?.projectWidths).toEqual({ inbox: 320 });
	data.columns[0]!.rssConfig!.pageSize = 10;
	data.columns[1]!.ticktickConfig!.view = 'today';
	const next = serialize(data);
	expect(next).toContain('custom: keep # author');
	expect(next).toContain('Author prose.');
	const round = parse(next);
	expect(round.columns[0]!.rssConfig?.pageSize).toBe(10);
	expect(round.columns[1]!.ticktickConfig?.view).toBe('today');
	expect(serialize(round)).toBe(next);
});
test('RSS and Atom retain identity, dates, HTML, author and escaped titles', () => {
	const rss = parseFeedXml(
		'<rss><channel><title>Feed</title><link>https://example.com</link><item><guid>a</guid><title>A &amp; B</title><link>https://example.com/a</link><author>Author</author><pubDate>Tue, 14 Oct 2025 12:00:00 GMT</pubDate><content:encoded><![CDATA[<p>Hello</p>]]></content:encoded></item></channel></rss>',
	);
	expect(rss?.items[0]).toMatchObject({
		guid: 'a',
		title: 'A & B',
		author: 'Author',
		contentHtml: '<p>Hello</p>',
		pubDate: 1760443200000,
	});
	const atom = parseFeedXml(
		'<feed><title>Atom</title><entry><id>b</id><title>B</title><link href="https://example.com/b"/><author><name>Author</name></author><content type="html">&lt;p&gt;Body&lt;/p&gt;</content></entry></feed>',
	);
	expect(atom?.items[0]).toMatchObject({ guid: 'b', link: 'https://example.com/b', author: 'Author' });
});
test('OPML groups and entities round trip; duplicates and invalid schemes do not become sources', () => {
	const config = {
		feeds: [{ url: 'https://example.com/feed?a=1&b=2', name: 'A & B', group: 'Tech' }],
		groups: ['Tech'],
		downloadFolder: '',
	};
	const parsed = parseOpml(buildOpml(config));
	expect(parsed.feeds).toEqual(config.feeds);
	expect(parsed.groups).toContain('Tech');
	const bad = parseOpml(
		'<opml><body><outline xmlUrl="javascript:alert(1)"/><outline xmlUrl="https://example.com/a"/><outline xmlUrl="https://example.com/a"/></body></opml>',
	);
	expect(bad.feeds).toHaveLength(1);
});
test('article HTML removes executable content and resolves relative links', () => {
	const md = htmlToMarkdown(
		'<article><script>alert(1)</script><h2>Title</h2><p>Hello <strong>world</strong> <a href="/note">read</a></p></article>',
		{ baseUrl: 'https://example.com/post' },
	);
	expect(md).toContain('## Title');
	expect(md).toContain('**world**');
	expect(md).toContain('https://example.com/note');
	expect(md).not.toContain('alert(1)');
});
test('TickTick date arithmetic crosses month and year boundaries in the configured timezone', () => {
	expect(
		tzDayNum(new Date('2026-01-01T00:00:00Z'), 'Asia/Shanghai') -
			tzDayNum(new Date('2025-12-31T00:00:00Z'), 'Asia/Shanghai'),
	).toBe(1);
	const date = new Date(fromTzInputs('2026-10-14', '09:30', 'America/New_York'));
	expect(tzParts(date, 'America/New_York')).toMatchObject({ year: 2026, month: 10, day: 14, hour: 9, minute: 30 });
});
test('task reorder computes an order between remaining neighbours', () => {
	const items = [
		{ id: 'a', sortOrder: 300 },
		{ id: 'b', sortOrder: 200 },
		{ id: 'c', sortOrder: 100 },
	];
	expect(computeSortOrder('c', 'b', items)).toBeGreaterThan(200);
	expect(computeSortOrder('c', 'b', items)).toBeLessThan(300);
});
test('service credentials persist only in device settings', () => {
	const s = homeSettings.normalize({ ticktickCookie: 'token', ticktickCsrf: 'csrf', wereadApiKey: 'key' });
	expect(homeSettings.pick(s, 'vault')).not.toHaveProperty('ticktickCookie');
	expect(homeSettings.pick(s, 'vault')).not.toHaveProperty('wereadApiKey');
	expect(homeSettings.pick(s, 'device')).toMatchObject({
		ticktickCookie: 'token',
		ticktickCsrf: 'csrf',
		wereadApiKey: 'key',
	});
});
