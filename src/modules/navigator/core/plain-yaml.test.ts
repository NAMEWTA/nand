// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { parse } from 'yaml';
import { expect, test } from 'vitest';
import { isPlainMapping, isPlainValue, plainEqual } from './plain-yaml';

const read = (yaml: string) => parse(yaml, { schema: 'yaml-1.1' }) as unknown;

test('a root is accepted only when it is a plain mapping of plain values', () => {
	expect(isPlainMapping(read('title: x\nwhen: 2026-10-17\nlist: [1, a, null]\nnested: {k: [true]}'))).toBe(true);
	expect(isPlainMapping(Object.assign(Object.create(null) as object, { a: 1 }))).toBe(true);
	expect(isPlainMapping({})).toBe(true);
});

test('every other kind of root is refused, including a Date', () => {
	for (const yaml of ['!!timestamp 2026-10-17', '2026-10-17', '!!set {a: null}', '!!omap [a: 1]', '!!pairs [a: 1]', '!!binary aGk=', '[a, b]', 'text', '42', 'true', 'null']) {
		expect(isPlainMapping(read(yaml)), yaml).toBe(false);
	}
	expect(isPlainMapping(new Date())).toBe(false);
	expect(isPlainMapping(new Map())).toBe(false);
	expect(isPlainMapping(new Set())).toBe(false);
	expect(isPlainMapping(undefined)).toBe(false);
	expect(isPlainMapping(new (class Thing { a = 1; })())).toBe(false);
});

test('values: anything this plugin cannot read in full is refused, however deep', () => {
	expect(isPlainValue(read('a: !!set {k: null}'))).toBe(false);
	expect(isPlainValue(read('a: [1, !!omap [x: 1]]'))).toBe(false);
	expect(isPlainValue(read('a: {b: {c: !!binary aGk=}}'))).toBe(false);
	expect(isPlainValue([new Date(), 'x', 1, true, null, { y: [] }])).toBe(true);
	const cycle: Record<string, unknown> = {};
	cycle['self'] = cycle;
	expect(isPlainValue(cycle)).toBe(false);
	expect(isPlainValue({ a: undefined })).toBe(false);
	expect(isPlainValue({ a: 1n })).toBe(false);
	expect(isPlainValue({ [Symbol('s')]: 1 })).toBe(false);
});

test('non-finite numbers and invalid dates are not carried', () => {
	for (const yaml of ['a: .nan', 'a: .inf', 'a: -.inf', 'a: [1, .nan]']) expect(isPlainMapping(read(yaml)), yaml).toBe(false);
	expect(isPlainValue(Number.NaN)).toBe(false);
	expect(isPlainValue(Infinity)).toBe(false);
	expect(isPlainValue(new Date(Number.NaN))).toBe(false);
	expect(isPlainMapping(read('a: [1, 2.5, -3, 0]'))).toBe(true);
});

test('plainEqual keeps types apart: null, NaN, dates and strings never collide', () => {
	expect(plainEqual(null, Number.NaN)).toBe(false);
	expect(plainEqual(Number.NaN, Number.NaN)).toBe(false);
	expect(plainEqual(new Date('2026-10-17T00:00:00.000Z'), '2026-10-17T00:00:00.000Z')).toBe(false);
	expect(plainEqual('2026-10-17T00:00:00.000Z', new Date('2026-10-17T00:00:00.000Z'))).toBe(false);
	expect(plainEqual(new Date(5), new Date(5))).toBe(true);
	expect(plainEqual(new Date(5), new Date(6))).toBe(false);
	expect(plainEqual(1, '1')).toBe(false);
	expect(plainEqual(true, 'true')).toBe(false);
	expect(plainEqual(0, false)).toBe(false);
	expect(plainEqual('', null)).toBe(false);
	expect(plainEqual(undefined, null)).toBe(false);
	expect(plainEqual([1, null], [1, null])).toBe(true);
	expect(plainEqual([1, null], [1, 0])).toBe(false);
	expect(plainEqual([], [])).toBe(true);
	expect(plainEqual([1], [1, 2])).toBe(false);
	expect(plainEqual({ a: 1, b: [new Date(1)] }, { b: [new Date(1)], a: 1 })).toBe(true);
	expect(plainEqual({ a: undefined }, {})).toBe(false);
	expect(plainEqual({ a: null }, {})).toBe(false);
	expect(plainEqual({ a: 1 }, { a: 1, b: 1 })).toBe(false);
	expect(plainEqual({ a: {} }, { a: [] })).toBe(false);
	expect(plainEqual({ __proto__: null, a: 1 }, { a: 1 })).toBe(true);
});
