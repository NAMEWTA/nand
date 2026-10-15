import { expect, test } from 'vitest';
import { locateAcrossSegments, mapSourceRange } from './reading';
test('reading marks span inline nodes and normalize whitespace without moving sibling elements', () => {
	expect(locateAcrossSegments(['alpha ', 'target', '\n tail'], 'alpha target\n tail')).toEqual([{ index: 0, start: 0, end: 6 }, { index: 1, start: 0, end: 6 }, { index: 2, start: 0, end: 6 }]);
	expect(locateAcrossSegments(['same same'], 'same', 1)).toEqual([{ index: 0, start: 5, end: 9 }]);
});
test('source offsets project emphasis, link labels, escapes, entities and repeated text', () => {
	const source = '**same** same [same](https://example.com) and _hello_ **bold** &amp; \\*text\\* [[Note|alias]]';
	const segments = ['same', ' same ', 'same', ' and ', 'hello', ' ', 'bold', ' & *text* ', 'alias'];
	const decode = (text: string) => text.replace('&amp;', '&');
	const link = source.indexOf('[same]');
	expect(mapSourceRange(segments, source, link, link + '[same](https://example.com)'.length, decode)).toEqual([{ index: 2, start: 0, end: 4 }]);
	const from = source.indexOf('_hello_');
	const slices = mapSourceRange(segments, source, from, source.length, decode)!;
	expect(slices.map(slice => segments[slice.index]!.slice(slice.start, slice.end)).join('')).toBe('hello bold & *text* alias');
	const partial = source.indexOf('bold') + 1;
	expect(mapSourceRange(segments, source, partial, partial + 2, decode)).toEqual([{ index: 6, start: 1, end: 3 }]);
});
test('code and image source is excluded just like rendered code and image nodes', () => {
	const source = 'before `code` ![alt](image.png) **after**';
	expect(mapSourceRange(['before ', '  ', 'after'], source, source.indexOf('**'), source.length, value => value)).toEqual([{ index: 2, start: 0, end: 5 }]);
});
test('wikilink projection never restores labels excluded by the Markdown tree', () => {
	expect(mapSourceRange([' same same'], '`[[same]]` same same', 11, 15, value => value)).toEqual([{ index: 0, start: 1, end: 5 }]);
	expect(mapSourceRange([' ', 'same', ' same'], '`[[Note|same]]` **same** same', 18, 22, value => value)).toEqual([{ index: 1, start: 0, end: 4 }]);
	for (const hidden of ['`[[same]]`', '![ [[same]] ](image.png)', '```\n[[same]]\n```']) {
		const source = hidden + '\n**same** same', from = source.indexOf('**') + 2;
		expect(mapSourceRange(['same', ' same'], source, from, from + 4, value => value)).toEqual([{ index: 0, start: 0, end: 4 }]);
	}
});
