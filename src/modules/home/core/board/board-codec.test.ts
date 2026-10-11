import { expect, test } from 'vitest';

import { readBoardMembers, readBoardTiles } from './board-codec';
import { parse, serialize } from './parser/parse';
import { splitFrontmatter } from './parser/generate-default-markdown';
import { withStableSectionIds } from './section-identity';

test('invalid saved geometry is diagnosed without changing the original bytes', () => {
	const source = '---\r\nlayout: immersive\r\nimmersive: [{id: external, w: 99, cap: -2, x: -1, y: 0}]\r\n---\r\n';
	const data = parse(source);
	expect(data.layoutNeedsRepair).toBe(true);
	expect(data.immersive).toEqual([{ id: 'external', w: 12, cap: 3 }]);
	expect(serialize(data)).toBe(source);
});
test('old coarse heights stay byte-stable on read and migrate once on an explicit geometry edit', () => {
	const source = '---\ncustom: keep\nimmersive:\n  - id: unknown-provider\n    w: 14\n    h: 2\n    x: 0\n    y: 7\n    note: keep this\n  - id: fine\n    w: 2\n    cap: 3\n---\n\n<!-- personal body -->\n';
	const data = parse(source);
	expect(data.immersive).toEqual([{ id: 'unknown-provider', w: 12, cap: 20, x: 0, y: 7 }, { id: 'fine', w: 2, cap: 3 }]);
	expect(serialize(data)).toBe(source);
	data.banner.quote = 'Unrelated content edit';
	const contentOnly = serialize(data);
	expect((splitFrontmatter(contentOnly).frontmatter.immersive as Array<Record<string, unknown>>)[0]?.h).toBe(2);
	data.layout = 'stacked';
	const updated = serialize(data);
	const raw = splitFrontmatter(updated).frontmatter.immersive as Array<Record<string, unknown>>;
	expect(raw[0]).toEqual({ id: 'unknown-provider', w: 12, cap: 20, x: 0, y: 7, note: 'keep this' });
	expect(raw[1]?.cap).toBe(3);
	expect(updated).toContain('<!-- personal body -->\n');
	expect(parse(updated).immersive).toEqual(data.immersive);
	expect(serialize(parse(updated))).toBe(updated);
});

test('member identity preserves unknown per-instance properties while reordering and retains missing providers', () => {
	const source = '---\nwidgets:\n  - memberId: first\n    provider: missing\n    kind: custom\n    instanceId: shared\n    private: alpha\n  - memberId: second\n    provider: home\n    kind: calendar\n    instanceId: default\n    private: beta\n---\n';
	const data = parse(source);
	expect(serialize(data)).toBe(source);
	data.widgets?.reverse();
	const members = splitFrontmatter(serialize(data)).frontmatter.widgets as Array<Record<string, unknown>>;
	expect(members.map(m => [m.memberId, m.private])).toEqual([['second', 'beta'], ['first', 'alpha']]);
	expect(readBoardMembers([])).toEqual([]);
});

test('tile bounds reject partial/non-finite coordinates without deleting the tile', () => {
	expect(readBoardTiles([{ id: 'a', w: Infinity, cap: 0, x: 1 }, { id: 'b', w: 0, cap: 999, x: 2, y: Infinity }, { id: 'c', w: 2, cap: 3, x: 0, y: 0, fixed: true }])).toEqual([
		{ id: 'a', w: 3, cap: 3 }, { id: 'b', w: 1, cap: 240 }, { id: 'c', w: 2, cap: 3, x: 0, y: 0, fixed: true },
	]);
});

test('the first layout edit allocates section identities; rename and reload keep placements', () => {
	const source = '---\nimmersive: [{id: "section:Notes", w: 6, cap: 40}]\n---\n\n## Notes\n\n### Personal card\nid: card-one\ntype: generic\nKeep this body.\n';
	const parsed = parse(source);
	expect(parsed.columns[0]?.id).toBeUndefined();
	let serial = 0;
	const edited = withStableSectionIds(parsed, () => `section-${++serial}`);
	edited.layout = 'stacked';
	expect(edited.immersive?.[0]?.id).toBe('section-1');
	expect(withStableSectionIds(edited, () => `section-${++serial}`).columns[0]?.id).toBe('section-1');
	expect(serial).toBe(1);
	const reloaded = parse(serialize(edited));
	reloaded.columns[0]!.name = 'Renamed';
	const renamed = parse(serialize(reloaded));
	expect(renamed.columns[0]?.id).toBe('section-1');
	expect(renamed.immersive?.[0]?.id).toBe('section-1');
	expect(renamed.columns[0]?.cards[0]?.title).toBe('Personal card');
});

test('new section identities cannot consume IDs already used by later sections or other tiles', () => {
	const data = parse('## New\n\n## Existing\n');
	data.columns[1]!.id = 'section-1';
	data.widgets = [{ memberId: 'section-2', provider: 'home', kind: 'calendar', instanceId: 'default' }];
	let serial = 0;
	const edited = withStableSectionIds(data, () => `section-${++serial}`);
	expect(edited.columns.map(column => column.id)).toEqual(['section-3', 'section-1']);
});
