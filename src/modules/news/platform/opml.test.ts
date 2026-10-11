import { expect, test } from 'vitest';
import { opmlInBrowser } from '../../../../test/news/xml-browser';
import { normalizeNewsSource } from '../core/model';
import { exportOpml, type OpmlImport } from './opml';

test('OPML decodes XML entities, ignores commented/include outlines and never replaces existing source ownership', async () => {
	const existing = normalizeNewsSource({ id: 'first', name: 'Reader name', url: 'https://example.com/a?x=1&y=2', type: 'atom', tier: 'T1', participation: 'signal', groupId: 'group', ownerEntityId: 'owner', enabled: false })!;
	const xml = `<opml version="2.0"><body><outline text="Group">
		<outline type="RSS" text="Changed" xmlUrl="https://EXAMPLE.com:443/a?x=1&amp;y=2"/>
		<outline type="rss" text="A &amp; B &quot;Feed&quot;" xmlUrl="https://example.com/b?x=1&amp;y=2"/>
		<outline type="include" text="Do not fetch" url="https://example.com/other.opml"/>
		<outline isComment="true"><outline type="rss" xmlUrl="https://example.com/comment"/></outline>
		<outline type="rss" text="Unsafe" xmlUrl="javascript:alert(1)"/>
	</outline></body></opml>`;
	const imported = await opmlInBrowser(`NandOpml.importOpml(${JSON.stringify(xml)}, ${JSON.stringify([existing])})`) as OpmlImport;
	expect(imported.sources[0]).toEqual(existing);
	expect(imported.added).toBe(1);
	expect(imported.sources[1]?.name).toBe('A & B "Feed"');
	expect(imported.sources[1]?.url).toBe('https://example.com/b?x=1&y=2');
	expect(imported.invalid).toBeGreaterThan(0);
	expect(imported.skipped).toBeGreaterThan(0);
	await expect(opmlInBrowser('NandOpml.importOpml("<html><body/></html>")')).rejects.toThrow('news.opml.invalid');
}, 30_000);

test('OPML export and reimport preserve supported configurations without duplicates', async () => {
	const sources = ['rss', 'atom', 'jsonfeed', 'web-list'].map((type, i) => normalizeNewsSource({ id: `feed-${i}`, name: `Feed ${i} & <quoted>`, type, url: `https://example.com/${i}`, tier: 'T1', participation: 'signal', participantStrategy: 'group', groupId: 'release-group', ownerEntityId: 'publisher', publisherRole: 'company', intervalMinutes: 120, enabled: false, selectors: { item: '.release > article', link: 'a.title', title: 'h2', date: 'time', preserveFragment: true } })!);
	const encoded = exportOpml(sources);
	const decoded = await opmlInBrowser(`NandOpml.importOpml(${JSON.stringify(encoded)})`) as OpmlImport;
	expect(decoded.sources).toEqual(sources);
	expect(await opmlInBrowser(`NandOpml.importOpml(${JSON.stringify(encoded)}, ${JSON.stringify(decoded.sources)})`)).toEqual({ sources, added: 0, skipped: 4, invalid: 0 });
	expect(encoded).not.toContain('type="undefined"');
}, 30_000);
