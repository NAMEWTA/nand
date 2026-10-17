// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { cleanPreview, firstImageLink, imageFromProperty, splitFrontmatter } from './preview';

test('strips frontmatter, code, comments, html and markdown syntax', () => {
	const text = [
		'---', 'tags: [a]', 'cover: x.png', '---',
		'# Title', '', '> **Bold** and *italic* with `code` and ==mark==', '',
		'- [x] done [[Page|alias]] and [[Other#Head]]', '1. [link](https://e.com) ![alt](img.png) ![[pic.png]]',
		'```js', 'secret()', '```', '%% hidden %%', '<!-- c --> <b>tag</b> text[^1]', '| a | b |', '|---|---|',
	].join('\n');
	expect(cleanPreview(text, 'Title')).toBe('Bold and italic with code and mark done alias and Other link tag text a b');
});

test('keeps a first heading that differs from the title and truncates to the limit', () => {
	expect(cleanPreview('# Different\nbody', 'Title')).toBe('Different body');
	expect(cleanPreview('word '.repeat(200), '', 50)).toHaveLength(50);
});

test('empty and syntax-only notes give an empty preview', () => {
	expect(cleanPreview('---\na: 1\n---\n')).toBe('');
	expect(cleanPreview('***\n---\n```\nx\n```')).toBe('');
});

test('frontmatter is only taken from the very start', () => {
	expect(splitFrontmatter('a\n---\nb: 1\n---\n').frontmatter).toBe('');
	expect(splitFrontmatter('---\r\nb: 1\r\n---\r\nrest').body).toBe('rest');
});

test('finds the first local image, skipping remote ones and code blocks', () => {
	expect(firstImageLink('![[a/pic.PNG|200]] ![](b.png)')?.link).toBe('a/pic.PNG');
	expect(firstImageLink('```\n![[no.png]]\n```\n![x](https://e.com/r.png) ![y](my%20pic.jpg)')?.link).toBe('my pic.jpg');
	expect(firstImageLink('![[doc.pdf]] text')).toBeUndefined();
});

test('image properties accept links, strings and lists', () => {
	expect(imageFromProperty('[[cover.png]]')).toBe('cover.png');
	expect(imageFromProperty(['pics/a.jpg', 'b.png'])).toBe('pics/a.jpg');
	expect(imageFromProperty('https://e.com/a.png')).toBeUndefined();
	expect(imageFromProperty(12)).toBeUndefined();
});
