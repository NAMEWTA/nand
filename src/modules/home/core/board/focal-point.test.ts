import { expect, test } from 'vitest';
import { displayedFocalPoint, editImageFocal, focalPosition, formatFocalPoint, parseFocalPoint, renamedImagePath } from './focal-point';
import { parse, serialize } from './parser';

test('focal input clamps finite coordinates, uses center for malformed input and writes integer percentages', () => {
	expect(parseFocalPoint('140, -3')).toEqual({ x: 100, y: 0 });
	expect(parseFocalPoint('31.7, 60.1')).toEqual({ x: 32, y: 60 });
	for (const raw of [undefined, '', 'x,20', 'NaN,Infinity', { x: 20, y: 30 }]) expect(displayedFocalPoint(raw)).toEqual({ x: 50, y: 50 });
	expect(focalPosition('140,-3')).toBe('100% 0%');
	expect(formatFocalPoint({ x: 50, y: 50 })).toBeUndefined();
});

test('resource rename follows exact file and folder paths, never substrings or remote URLs', () => {
	expect(renamedImagePath('Images/A.png', 'Images/A.png', 'Images/B.png', false)).toBe('Images/B.png');
	expect(renamedImagePath('Images/A.png.bak', 'Images/A.png', 'Images/B.png', false)).toBe('Images/A.png.bak');
	expect(renamedImagePath('Images/A.png', 'Images', 'Pictures', true)).toBe('Pictures/A.png');
	expect(renamedImagePath('Images2/A.png', 'Images', 'Pictures', true)).toBe('Images2/A.png');
	expect(renamedImagePath('https://example.com/Images/A.png', 'Images/A.png', 'Images/B.png', false)).toBe('https://example.com/Images/A.png');
});

test('reading or editing another image preserves malformed focal values and author text', () => {
	const original = '---\r\nbanner:\r\n  image: Images/A.png\r\n  images: [Images/A.png, Images/B.png]\r\n  imagePos:\r\n    Images/A.png: "140,-3" # keep until edited\r\n    Images/B.png: "bad" # untouched\r\n    Missing.png: {future: retain}\r\ncustom: keep\r\n---\r\n## Projects\r\n### A\r\ncover: Images/A.png\r\ncoverPos: nonsense\r\nMy prose.\r\n';
	const board = parse(original);
	expect(serialize(board)).toBe(original);
	expect(focalPosition(board.banner.imagePos?.['Images/A.png'])).toBe('100% 0%');
	expect(focalPosition(board.columns[0]!.cards[0]!.coverPos)).toBe('50% 50%');
	board.banner.imagePos = editImageFocal(board.banner.imagePos, 'Images/A.png', { x: 20, y: 80 });
	const saved = serialize(board), restored = parse(saved);
	expect(restored.banner.imagePos).toEqual({ 'Images/A.png': '20,80', 'Images/B.png': 'bad', 'Missing.png': { future: 'retain' } });
	expect(saved).toContain('Images/B.png: "bad" # untouched');
	expect(saved).toContain('coverPos: nonsense\r\nMy prose.');
	restored.columns[0]!.cards[0]!.coverPos = '30,70';
	expect(serialize(restored)).toBe(saved.replace('coverPos: nonsense', 'coverPos: 30,70'));
	expect(editImageFocal(restored.banner.imagePos, 'Images/A.png', { x: 50, y: 50 })).toEqual({ 'Images/B.png': 'bad', 'Missing.png': { future: 'retain' } });
});
