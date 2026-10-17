// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { getFrontMatterInfo, parseYaml } from 'obsidian';
import { isPlainMapping } from '../core/plain-yaml';

export type Properties = Record<string, unknown>;

/** A note split where Obsidian says its frontmatter ends: the block with its fences, and everything after it. */
export function splitNote(content: string): { head: string; body: string } {
	const info = getFrontMatterInfo(content);
	return info.exists ? { head: content.slice(0, info.contentStart), body: content.slice(info.contentStart) } : { head: '', body: content };
}

/**
 * The properties of a note, parsed by Obsidian from the text itself: `{}` for a note without frontmatter, undefined
 * when they cannot be handled safely (see `isPlainMapping`: invalid YAML, a root that is not a plain mapping, or a value
 * of a type that is not plain).
 */
export function readProperties(content: string): Properties | undefined {
	const info = getFrontMatterInfo(content);
	if (!info.exists) return {};
	if (!info.frontmatter.trim()) return {};
	try {
		const parsed: unknown = parseYaml(info.frontmatter);
		if (parsed === null || parsed === undefined) return {};
		// The root must be a plain mapping: a date, list, set, map or scalar is never "a note with no properties".
		return isPlainMapping(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}
