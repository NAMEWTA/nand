import { describe, expect, test } from 'vitest';
import { createAnchor, locateAnchor, selectionIsCommentable } from './anchor';
import { boundedLevenshtein } from './fuzzy';
import { hashString } from './hash';
for (const kind of ['range', 'line'] as const) describe(kind, () => {
	const original = 'Leading context has fifty characters to identify this.\nabcdefghij\nFollowing context has fifty characters after this line.';
	const from = original.indexOf('abcdefghij'), anchor = createAnchor(original, from, from + 10, kind);
	test('unchanged', () => expect(locateAnchor(original, anchor)).toEqual({ start: from, end: from + 10 }));
	test('200 lines inserted above', () => { const prefix = 'a new line\n'.repeat(200); expect(locateAnchor(prefix + original, anchor)).toEqual({ start: prefix.length + from, end: prefix.length + from + 10 }); });
	test('20 percent changed, with context', () => expect(locateAnchor(original.replace('abcdefghij', 'abXYefghij'), anchor)).toEqual({ start: from, end: from + 10 }));
	test('20 percent changed, fuzzy without context', () => expect(locateAnchor('abXYefghij', anchor)).toEqual({ start: 0, end: 10 }));
	test('deleted', () => expect(locateAnchor(original.replace('abcdefghij\n', ''), anchor)).toBeNull());
	test('duplicate matches choose best context', () => { const changed = 'abcdefghij\n' + 'new\n'.repeat(200) + original; expect(locateAnchor(changed, anchor)?.start).toBe(changed.lastIndexOf('abcdefghij')); });
});
test('line exact matching never accepts partial lines and fuzzy respects window', () => {
	const anchor = createAnchor('TARGET', 0, 0); expect(locateAnchor('prefix TARGET suffix', anchor, 0.1)).toBeNull();
	const far = { ...createAnchor('abcdefghij', 0, 10), lineHint: 500 }; expect(locateAnchor('abXYefghij', far)).toBeNull();
});
test('frontmatter and both fenced-code forms are refused', () => {
	expect(selectionIsCommentable('---\ntitle: a\n---\ntext', 4, 8)).toBe(false);
	expect(selectionIsCommentable('```\ncode\n```', 4, 8)).toBe(false);
	expect(selectionIsCommentable('~~~\ncode\n~~~', 4, 8)).toBe(false);
});
test('bounded Levenshtein and stable hashes', () => {
	for (const [a, b, max, distance] of [['kitten', 'sitting', 3, 3], ['alpha', 'omega', 1, 2], ['', 'abc', 2, 3], ['same', 'same', 0, 0]] as const) expect(boundedLevenshtein(a, b, max)).toBe(distance);
	expect(hashString('中文')).toHaveLength(16); expect(hashString('中文')).not.toBe(hashString('文中'));
});
test('fuzzy endpoints cover the full quote beyond the former 120-character prefix', () => {
	const original = 'abcdefghijklmnopqrstuvwxyz'.repeat(5) + 'ENDING';
	const changed = original.slice(0, 128) + 'XX' + original.slice(128);
	expect(locateAnchor(changed + 'Z', createAnchor(original, 0, original.length), 0.1)).toEqual({ start: 0, end: changed.length });
});
test('range fuzzy search includes line hint +200 and excludes +201', () => {
	const anchor = createAnchor('abcdefghij', 0, 10);
	const prefix = 'zz\n'.repeat(200);
	expect(locateAnchor(prefix + 'abefghijXYZ', anchor, 0.2)).toEqual({ start: prefix.length, end: prefix.length + 8 });
	expect(locateAnchor('zz\n' + prefix + 'abefghijXYZ', anchor, 0.2)).toBeNull();
});

test('full-quote fuzzy search keeps the rendering thread responsive without context', () => {
	const quote = 'A reviewer checks the selected paragraph and preserves its exact location when nearby notes are edited. '.repeat(10).slice(0, 500);
	const edited = [...quote].map((char, index) => index % 5 === 2 ? 'X' : char).join('');
	const filler = 'This unrelated note describes the build process, pending release work and the status of integration tests.\n';
	const doc = filler.repeat(50) + edited + '\n' + filler.repeat(50);
	const anchor = { ...createAnchor(quote, 0, quote.length), lineHint: 51 };
	const started = performance.now();
	const result = locateAnchor(doc, anchor);
	const elapsed = performance.now() - started;
	expect(result).toEqual({ start: filler.length * 50, end: filler.length * 50 + edited.length });
	// The quadratic per-start search took ~5s here; leave headroom for loaded CI workers.
	expect(elapsed).toBeLessThan(300);
});
test('range fuzzy search includes line hint -200 and excludes -201', () => {
	const anchor = { ...createAnchor('abcdefghij', 0, 10), lineHint: 201 };
	expect(locateAnchor('abefghijXYZ', anchor, 0.2)).toEqual({ start: 0, end: 8 });
	expect(locateAnchor('abefghijXYZ', { ...anchor, lineHint: 202 }, 0.2)).toBeNull();
});
test('fuzzy whole-quote matching preserves UTF-16 offsets', () => {
	const quote = '甲😀乙😀丙😀丁😀戊';
	const edited = quote.replace('丙', '己');
	expect(locateAnchor('前\n' + edited + '\n后', createAnchor(quote, 0, quote.length), 0.2)).toEqual({ start: 2, end: 2 + edited.length });
});
