// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { clampIndex, EMPTY_SELECTION, nextAfterRemoval, remapSelection, selectAll, selectOnly, selectRange, toggleSelected } from './selection';

const order = ['a', 'b', 'c', 'd', 'e'];

test('toggle adds and removes, range replaces from the anchor', () => {
	let selection = selectOnly('b');
	selection = toggleSelected(selection, 'd');
	expect(selection.paths).toEqual(['b', 'd']);
	selection = toggleSelected(selection, 'b');
	expect(selection.paths).toEqual(['d']);
	selection = selectRange(selectOnly('b'), order, 'd');
	expect(selection).toEqual({ paths: ['b', 'c', 'd'], anchor: 'b', cursor: 'd' });
	selection = selectRange(selection, order, 'a');
	expect(selection.paths).toEqual(['a', 'b']);
	expect(selectRange(EMPTY_SELECTION, order, 'c').paths).toEqual(['c']);
});

test('select all and clamped movement', () => {
	expect(selectAll(order, 'c').paths).toEqual(order);
	expect(clampIndex(-1, 1, 5)).toBe(0);
	expect(clampIndex(-1, -1, 5)).toBe(4);
	expect(clampIndex(4, 1, 5)).toBe(4);
	expect(clampIndex(0, -3, 5)).toBe(0);
	expect(clampIndex(0, 1, 0)).toBe(-1);
});

test('after removal the next row is chosen, else the previous', () => {
	expect(nextAfterRemoval(order, ['b'])).toBe('c');
	expect(nextAfterRemoval(order, ['b', 'c'])).toBe('d');
	expect(nextAfterRemoval(order, ['d', 'e'])).toBe('c');
	expect(nextAfterRemoval(order, order)).toBeUndefined();
});

test('remap follows renames', () => {
	const remapped = remapSelection({ paths: ['a', 'b'], anchor: 'a', cursor: 'b' }, new Map([['b', 'z']]));
	expect(remapped).toEqual({ paths: ['a', 'z'], anchor: 'a', cursor: 'z' });
});
