import { expect, test } from 'vitest';
import { effectiveBoardLayout } from './layout';
import { normalizeDashboardSettings } from './settings';
import { parse, serialize } from './parser/parse';
import { splitFrontmatter } from './parser/generate-default-markdown';

test('a saved choice overrides historical settings; phone projection leaves both unchanged', () => {
	const original = '---\r\n# Personal header\r\ncustom: [one, two]\r\nlayout: immersive\r\n---\r\n\r\n## Notes\r\n\r\n<!-- personal -->\r\n';
	const board = parse(original);
	const settings = normalizeDashboardSettings({ layoutMode: 'side' });
	expect(effectiveBoardLayout(board.layout, settings.layoutMode)).toBe('immersive');
	expect(effectiveBoardLayout(board.layout, settings.layoutMode, true)).toBe('side');
	expect(serialize(board)).toBe(original);
	expect(settings.layoutMode).toBe('side');
	for (const historical of ['side','stacked','immersive','invalid',undefined]) {
		expect(effectiveBoardLayout(undefined, historical)).toBe(historical === 'side' ? 'side' : 'stacked');
		expect(effectiveBoardLayout('stacked', historical)).toBe('stacked');
		expect(effectiveBoardLayout('side', historical)).toBe('side');
	}
});

test('explicit stacked persists over a historical side default without rebuilding user text', () => {
	const original = '---\ncustom: [one, two] # keep\n---\n\n# Notes\n\n<!-- personal -->\n';
	const board = parse(original);
	expect(effectiveBoardLayout(board.layout, 'side')).toBe('side');
	expect(serialize(board)).toBe(original);
	board.layout = 'stacked';
	const updated = serialize(board);
	expect(updated).toContain('layout: stacked\n');
	expect(splitFrontmatter(updated).frontmatter.custom).toEqual(['one', 'two']);
	expect(updated).toContain('# keep\n');
	expect(updated).toContain('# Notes\n\n<!-- personal -->\n');
	expect(effectiveBoardLayout(parse(updated).layout, 'side')).toBe('stacked');
});
