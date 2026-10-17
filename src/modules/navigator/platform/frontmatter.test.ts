// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test, vi } from 'vitest';
import { isPlainValue } from '../core/plain-yaml';
import { readProperties } from './frontmatter';

// Obsidian's reader returns real Set/Map/typed-array values for YAML 1.1 types; the yaml package does the same here.
vi.mock('obsidian', async (importOriginal) => {
	const { parse } = await import('yaml');
	const { getSimpleFrontMatterInfo } = await import('./simple-yaml');
	return { ...(await importOriginal<Record<string, unknown>>()), parseYaml: (text: string) => parse(text, { schema: 'yaml-1.1' }) as unknown, getFrontMatterInfo: getSimpleFrontMatterInfo };
});

const note = (yaml: string) => `---\n${yaml}\n---\nbody`;

test('ordinary properties are read: strings, numbers, booleans, null, dates, lists and nested mappings', () => {
	const read = readProperties(note('title: Hello\nrating: 3\nflag: true\nempty:\nwhen: 2026-10-15\naliases: [a, b]\nnested:\n  list:\n    - 1\n    - {k: v}'));
	expect(read).toMatchObject({ title: 'Hello', rating: 3, flag: true, empty: null, aliases: ['a', 'b'], nested: { list: [1, { k: 'v' }] } });
	expect(read?.['when']).toBeInstanceOf(Date);
	expect(readProperties('no frontmatter')).toEqual({});
	expect(readProperties('---\n---\nbody')).toEqual({});
});

test('a mapping root of any other YAML type is unreadable, never "no properties"', () => {
	expect(readProperties(note('!!set {important: null}'))).toBeUndefined();
	expect(readProperties(note('!!omap [a: 1, b: 2]'))).toBeUndefined();
	expect(readProperties(note('!!pairs [a: 1]'))).toBeUndefined();
	expect(readProperties(note('- a\n- b'))).toBeUndefined();
	expect(readProperties(note('just text'))).toBeUndefined();
	expect(readProperties(note('42'))).toBeUndefined();
	// a timestamp root is a Date, not a mapping
	expect(readProperties(note('!!timestamp 2026-10-17'))).toBeUndefined();
	expect(readProperties(note('2026-10-17'))).toBeUndefined();
});

test('a value of an unknown type anywhere inside is unreadable too', () => {
	expect(readProperties(note('title: x\nextra: !!set {a: null}'))).toBeUndefined();
	expect(readProperties(note('list:\n  - 1\n  - !!omap [a: 1]'))).toBeUndefined();
	expect(readProperties(note('deep:\n  deeper:\n    blob: !!binary aGk='))).toBeUndefined();
});

test('invalid YAML is unreadable', () => {
	expect(readProperties(note('title: [unclosed'))).toBeUndefined();
	expect(readProperties(note('a: *missing'))).toBeUndefined();
});

test('shared (aliased) data is fine, a cycle or class instance is not', () => {
	expect(readProperties(note('base: &b {x: 1}\ncopy: *b'))).toMatchObject({ copy: { x: 1 } });
	const cycle: Record<string, unknown> = {};
	cycle['self'] = cycle;
	expect(isPlainValue(cycle)).toBe(false);
	expect(isPlainValue({ a: new Set() })).toBe(false);
	expect(isPlainValue({ a: new Map() })).toBe(false);
	expect(isPlainValue({ a: new (class Custom {})() })).toBe(false);
	expect(isPlainValue({ a: undefined })).toBe(false);
	expect(isPlainValue({ a: 1n })).toBe(false);
	expect(isPlainValue({ [Symbol('s')]: 1 })).toBe(false);
	expect(isPlainValue(Object.create(null))).toBe(true);
	expect(isPlainValue([new Date(), 'x', null, 1, false, { y: [] }])).toBe(true);
});
