// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

const MAX_DEPTH = 64;

function isPlainObject(value: object): boolean {
	const prototype = Object.getPrototypeOf(value) as unknown;
	return (prototype === Object.prototype || prototype === null) && Object.getOwnPropertySymbols(value).length === 0;
}

/**
 * The one list of what this plugin can carry from a note's YAML, shared by everything that reads properties or
 * checks a template's frontmatter. A value is plain when it is a string, number, boolean, null, a Date, a list of plain
 * values or a plain mapping (prototype `Object.prototype` or none) of plain values. Sets, maps, binary data, class
 * instances, `undefined`, bigints and anything unknown are not plain, so nothing that this plugin cannot read in
 * full is ever mistaken for "an object with no entries".
 */
export function isPlainValue(value: unknown, seen: Set<object> = new Set(), depth = 0): boolean {
	if (depth > MAX_DEPTH) return false;
	if (value === null) return true;
	switch (typeof value) {
		case 'string':
		case 'boolean':
			return true;
		// NaN and the infinities have no faithful JSON/text form and collide with other values, so they are not carried.
		case 'number': return Number.isFinite(value);
		case 'object': break;
		default: return false;
	}
	if (value instanceof Date) return !Number.isNaN(value.getTime());
	if (seen.has(value)) return false;
	seen.add(value);
	try {
		if (Array.isArray(value)) return value.every((item) => isPlainValue(item, seen, depth + 1));
		if (!isPlainObject(value)) return false;
		return Object.keys(value).every((key) => isPlainValue((value as Record<string, unknown>)[key], seen, depth + 1));
	} finally {
		seen.delete(value);
	}
}

/** True for a frontmatter root this plugin can handle: a plain mapping (not a Date, list, set, map, class instance or scalar) whose values are all plain. */
export function isPlainMapping(root: unknown): root is Record<string, unknown> {
	return typeof root === 'object' && root !== null && !Array.isArray(root) && !(root instanceof Date) && isPlainObject(root) && isPlainValue(root);
}

/**
 * Deep equality for plain values that keeps types apart: strings, numbers, booleans and null only equal themselves
 * (the string "1" is not the number 1, null is not NaN), a Date only equals a Date with the same time (never a
 * string), lists compare item by item, and mappings compare their own keys (a missing key is not a key with a null
 * value). Use this, never JSON text, to compare or de-duplicate properties.
 */
export function plainEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
	if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => plainEqual(item, b[index]));
	if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
		const left = Object.keys(a);
		const right = Object.keys(b);
		const has = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key);
		return left.length === right.length && left.every((key) => has(b, key) && plainEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
	}
	return false;
}
