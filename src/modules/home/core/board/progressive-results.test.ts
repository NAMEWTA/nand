import { expect, test } from 'vitest';
import { moreGroupItems, progressiveGroup, sectionCandidates } from './progressive-results';

const items = Array.from({ length: 501 }, (_, id) => ({ id: String(id), group: id < 400 ? 'A' : 'B' }));
const key = (item: (typeof items)[number]) => item.id;

test('one section cap is applied after caller filtering and sorting, before grouping', () => {
	const first = sectionCandidates(items),
		ids = new Set(first.items.map(key));
	expect(first.total).toBe(501);
	expect(first.limited).toBe(true);
	expect(first.items).toHaveLength(500);
	const group = progressiveGroup(
		items.filter((item) => item.group === 'B'),
		key,
		ids,
	);
	expect(group).toMatchObject({ total: 101, available: 100, shown: 50 });
	expect(group.items).toHaveLength(50);
	const narrowed = sectionCandidates(items.filter((item) => item.id === '500'));
	expect(narrowed.items.map(key)).toEqual(['500']);
	expect(narrowed.limited).toBe(false);
	const reversed = sectionCandidates([...items].reverse());
	expect(reversed.items[0]!.id).toBe('500');
	expect(reversed.items.at(-1)!.id).toBe('1');
});

test('each group grows in batches of 50, keeps prior items and stops at available candidates', () => {
	const ids = new Set(sectionCandidates(items).items.map(key));
	const first = progressiveGroup(items, key, ids),
		next = progressiveGroup(items, key, ids, moreGroupItems(undefined, 500));
	expect(first.shown).toBe(50);
	expect(next.shown).toBe(100);
	expect(next.items.slice(0, 50)).toEqual(first.items);
	expect(progressiveGroup(items, key, ids, 1000)).toMatchObject({ total: 501, available: 500, shown: 500 });
	expect(moreGroupItems(500, 500)).toBe(500);
	expect(moreGroupItems(50, 51)).toBe(51);
	expect(progressiveGroup(items.slice(0, 49), key, ids, 100)).toMatchObject({ total: 49, shown: 49 });
	expect(progressiveGroup([], key, ids)).toMatchObject({ total: 0, available: 0, shown: 0 });
});
