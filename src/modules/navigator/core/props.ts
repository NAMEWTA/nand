// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { compareNames, type NoteEntry } from './types';

/** Built-in properties that duplicate other navigator features; shown only when listed explicitly. */
export const DEFAULT_HIDDEN_PROPERTY_KEYS: ReadonlySet<string> = new Set(['tags', 'tag', 'aliases', 'alias', 'cssclasses', 'cssclass', 'position']);

/** A property with many distinct values (dates, ids) shows only the first of them. */
export const MAX_PROPERTY_VALUES = 300;

export interface PropertyValueNode {
	/** Lower-case value, as stored in contexts and shortcuts. */
	value: string;
	/** The value as first written. */
	label: string;
	count: number;
}

export interface PropertyKeyNode {
	/** Lower-case key, as stored in contexts and shortcuts. */
	key: string;
	label: string;
	/** Notes that have the property. */
	count: number;
	values: PropertyValueNode[];
	/** Distinct values beyond `MAX_PROPERTY_VALUES` that are not listed. */
	hiddenValues: number;
}

/**
 * The property browser's data: keys, then values, with the number of notes for each. `keys` limits the browser
 * to those keys (case-insensitive); empty means every key except the built-in ones.
 */
export function collectProperties(notes: readonly NoteEntry[], keys: readonly string[]): PropertyKeyNode[] {
	const only = keys.length ? new Set(keys.map((key) => key.trim().toLowerCase()).filter(Boolean)) : undefined;
	interface Acc { label: string; notes: Set<string>; values: Map<string, { label: string; notes: Set<string> }> }
	const found = new Map<string, Acc>();
	for (const note of notes) {
		if (!note.props) continue;
		for (const [name, list] of Object.entries(note.props)) {
			const key = name.toLowerCase();
			if (only ? !only.has(key) : DEFAULT_HIDDEN_PROPERTY_KEYS.has(key)) continue;
			let entry = found.get(key);
			if (!entry) { entry = { label: name, notes: new Set(), values: new Map() }; found.set(key, entry); }
			entry.notes.add(note.path);
			for (const text of list) {
				const value = text.trim();
				if (!value) continue;
				const lower = value.toLowerCase();
				let node = entry.values.get(lower);
				if (!node) { node = { label: value, notes: new Set() }; entry.values.set(lower, node); }
				node.notes.add(note.path);
			}
		}
	}
	return [...found.entries()]
		.map(([key, entry]): PropertyKeyNode => {
			const values = [...entry.values.entries()]
				.map(([value, node]): PropertyValueNode => ({ value, label: node.label, count: node.notes.size }))
				.sort((a, b) => compareNames(a.label, b.label));
			return { key, label: entry.label, count: entry.notes.size, values: values.slice(0, MAX_PROPERTY_VALUES), hiddenValues: Math.max(0, values.length - MAX_PROPERTY_VALUES) };
		})
		.sort((a, b) => compareNames(a.label, b.label));
}
