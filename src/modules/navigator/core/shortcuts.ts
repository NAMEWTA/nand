// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { contextKey, parseContextKey, type NavContext } from './types';

export type ShortcutKind = 'note' | 'folder' | 'tag' | 'property' | 'search';

/** A pinned entry of the navigation pane. `key` is a path, a lower-case tag, a property context key or a query. */
export interface Shortcut {
	id: string;
	kind: ShortcutKind;
	key: string;
	/** Own label; without it the entry is labelled from what it points at. */
	name?: string;
}

export const SHORTCUT_KINDS: readonly ShortcutKind[] = ['note', 'folder', 'tag', 'property', 'search'];
export const SHORTCUT_LIMIT = 200;

export function shortcutId(kind: ShortcutKind, key: string): string {
	return `${kind}:${key}`;
}

export function makeShortcut(kind: ShortcutKind, key: string, name?: string): Shortcut {
	return name ? { id: shortcutId(kind, key), kind, key, name } : { id: shortcutId(kind, key), kind, key };
}

/** The shortcut that pins a navigation selection (folder, tag or property); the untagged row cannot be pinned. */
export function shortcutForContext(context: NavContext): Shortcut | undefined {
	switch (context.kind) {
		case 'folder': return makeShortcut('folder', context.key);
		case 'tag': return makeShortcut('tag', context.key);
		case 'property': return makeShortcut('property', contextKey(context));
		default: return undefined;
	}
}

/** The navigation selection a shortcut stands for; notes and searches do not select one. */
export function shortcutContext(shortcut: Shortcut): NavContext | undefined {
	switch (shortcut.kind) {
		case 'folder': return { kind: 'folder', key: shortcut.key };
		case 'tag': return { kind: 'tag', key: shortcut.key };
		case 'property': {
			const context = parseContextKey(shortcut.key);
			return context?.kind === 'property' ? context : undefined;
		}
		default: return undefined;
	}
}

export function hasShortcut(list: readonly Shortcut[], candidate: Pick<Shortcut, 'kind' | 'key'>): boolean {
	return list.some((entry) => entry.kind === candidate.kind && entry.key === candidate.key);
}

/** Add a shortcut at the end, or remove it when it is already there. */
export function toggleShortcut(list: readonly Shortcut[], candidate: Shortcut): Shortcut[] {
	if (hasShortcut(list, candidate)) return list.filter((entry) => !(entry.kind === candidate.kind && entry.key === candidate.key));
	return [...list, candidate].slice(0, SHORTCUT_LIMIT);
}

/** Move `id` in front of `beforeId`, or to the end when `beforeId` is null. */
export function moveShortcut(list: readonly Shortcut[], id: string, beforeId: string | null): Shortcut[] {
	const moving = list.find((entry) => entry.id === id);
	if (!moving || id === beforeId) return [...list];
	const rest = list.filter((entry) => entry.id !== id);
	const at = beforeId === null ? rest.length : rest.findIndex((entry) => entry.id === beforeId);
	rest.splice(at < 0 ? rest.length : at, 0, moving);
	return rest;
}

/** Follow renamed files and folders (`oldPath` and everything below it). */
export function remapShortcuts(list: readonly Shortcut[], oldPath: string, newPath: string): Shortcut[] {
	const prefix = `${oldPath}/`;
	const map = (path: string) => (path === oldPath ? newPath : path.startsWith(prefix) ? newPath + path.slice(oldPath.length) : path);
	return list.map((entry) => {
		if (entry.kind !== 'note' && entry.kind !== 'folder') return entry;
		const key = map(entry.key);
		return key === entry.key ? entry : { ...entry, key, id: shortcutId(entry.kind, key) };
	});
}

/** Drop shortcuts to a deleted file or folder (and everything below it). */
export function dropShortcuts(list: readonly Shortcut[], path: string): Shortcut[] {
	const prefix = `${path}/`;
	return list.filter((entry) => !((entry.kind === 'note' || entry.kind === 'folder') && (entry.key === path || entry.key.startsWith(prefix))));
}

export function normalizeShortcuts(value: unknown): Shortcut[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const result: Shortcut[] = [];
	for (const raw of value) {
		if (!raw || typeof raw !== 'object') continue;
		const { kind, key, name } = raw as Record<string, unknown>;
		if (typeof key !== 'string' || !key || !SHORTCUT_KINDS.includes(kind as ShortcutKind)) continue;
		const id = shortcutId(kind as ShortcutKind, key);
		if (seen.has(id)) continue;
		seen.add(id);
		result.push(makeShortcut(kind as ShortcutKind, key.slice(0, 500), typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : undefined));
		if (result.length >= SHORTCUT_LIMIT) break;
	}
	return result;
}

/** Recently opened paths, newest first, without duplicates. */
export function pushRecent(list: readonly string[], path: string, limit: number): string[] {
	return [path, ...list.filter((entry) => entry !== path)].slice(0, limit);
}
