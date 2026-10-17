// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

import { plainEqual } from './plain-yaml';

/** One note going into a merge: its name and its text after the frontmatter. */
export interface MergeInput {
	name: string;
	body: string;
}

export type Properties = Record<string, unknown>;

/** Tags of a `tags` / `tag` property as a clean list (leading `#` removed, blanks dropped). */
function tagList(value: unknown): string[] {
	const items = Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(/[,\s]+/) : [];
	return items.map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean);
}


export interface MergedProperties {
	/** The first note's properties, plus what the other notes add. */
	properties: Properties;
	/** Properties the other notes have with a different value; the first note's value is kept and theirs is not carried over. */
	conflicts: string[];
}

/**
 * Properties of the merged note, from the notes' own YAML (every key is a user property, whatever its name). The
 * first note's properties are kept as they are; `tags` (and the singular `tag`) from every note are combined; list
 * properties such as `aliases` are combined; a property only a later note has is added; a scalar that differs from the
 * first note's keeps the first note's value and is reported in `conflicts`. Keys are looked up as own properties only,
 * so names like `constructor`, `toString` or `__proto__` are ordinary properties.
 */
export function mergeProperties(list: readonly Properties[]): MergedProperties {
	const merged = new Map<string, unknown>();
	const conflicts: string[] = [];
	const tags: string[] = [];
	let hasTags = false;
	const addTags = (value: unknown) => {
		hasTags = true;
		for (const tag of tagList(value)) if (!tags.some((known) => known.toLowerCase() === tag.toLowerCase())) tags.push(tag);
	};
	list.forEach((source, index) => {
		for (const key of Object.keys(source)) {
			const value = source[key];
			if (key === 'tags' || key === 'tag') { addTags(value); continue; }
			if (!merged.has(key)) { merged.set(key, Array.isArray(value) ? [...(value as unknown[])] : value); continue; }
			if (index === 0) continue;
			const current = merged.get(key);
			if (Array.isArray(current) && Array.isArray(value)) {
				for (const item of value as unknown[]) if (!current.some((known) => plainEqual(known, item))) current.push(item);
			} else if (!plainEqual(current, value) && !conflicts.includes(key)) conflicts.push(key);
		}
	});
	if (hasTags) merged.set('tags', tags);
	// fromEntries defines own properties, so even a `__proto__` key stays an ordinary property.
	return { properties: Object.fromEntries(merged), conflicts };
}

/** The merged note's body: each note's text under a heading with its name, separated by blank lines. */
export function mergeNotes(inputs: readonly MergeInput[]): string {
	const sections = inputs.map((input) => {
		const body = input.body.replace(/^\s*\n/, '').trimEnd();
		return body ? `# ${input.name}\n\n${body}` : `# ${input.name}`;
	});
	return `${sections.join('\n\n')}\n`;
}

/** Name for the merged note: the first note's name with a suffix, unique among `taken` names. */
export function mergedName(firstName: string, suffix: string, taken: (name: string) => boolean): string {
	const base = `${firstName} ${suffix}`;
	let name = base;
	for (let n = 2; taken(name); n++) name = `${base} ${n}`;
	return name;
}
