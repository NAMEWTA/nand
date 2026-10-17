// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { collectProperties } from './props';
import { SECTION_IDS, type SectionId } from './sections';
import type { Shortcut } from './shortcuts';
import { compareNames, contextKey, parentFolder, ROOT_FOLDER, baseName, type NavContext, type NoteEntry } from './types';

export type NavRowKind = 'section' | 'folder' | 'tag' | 'untagged' | 'property' | 'propertyValue' | 'shortcut' | 'recent';

export interface NavRow {
	/** Stable id: `folder:<path>`, `tag:<path>`, `untagged`, `property:<key>[=<value>]`, `section:<id>`, `shortcut:<id>` or `recent:<path>`. */
	key: string;
	kind: NavRowKind;
	depth: number;
	/** Folder path, tag path (lower-case), property key, note path, or section id. */
	path: string;
	label: string;
	count: number;
	hasChildren: boolean;
	expanded: boolean;
	/** Tag rows: the tag path as first written in the notes (same letters as `Tag/Sub`), for icon lookups. */
	display?: string;
	/** Which root section the row sits in. */
	section?: SectionId;
	/** What clicking the row selects; rows of the main trees use it as their `key`. */
	context?: NavContext;
	shortcut?: Shortcut;
	/** Shortcut rows: what they point at no longer exists. */
	missing?: boolean;
	/** The row stands for something a hiding rule hides; it is shown only while hidden items are shown. */
	hidden?: boolean;
}

/** A shortcut as the service resolved it: label from its target, and whether the target still exists. */
export interface ShortcutRowInput {
	shortcut: Shortcut;
	label: string;
	missing: boolean;
	hidden?: boolean;
}

export interface NavTreeInput {
	/** Every folder path in the vault, '/' included. */
	folders: readonly string[];
	notes: readonly NoteEntry[];
	expandedFolders: ReadonlySet<string>;
	expandedTags: ReadonlySet<string>;
	/** Property keys (lower-case) whose values are listed. */
	expandedProperties?: ReadonlySet<string>;
	showRoot: boolean;
	showTags: boolean;
	showUntagged: boolean;
	showProperties?: boolean;
	/** Property keys the browser is limited to; empty means every key. */
	propertyKeys?: readonly string[];
	/** Folder and tag counts include notes of descendants. */
	countDescendants: boolean;
	/** Order of the root sections; default is `SECTION_IDS`. */
	sections?: readonly SectionId[];
	collapsed?: ReadonlySet<SectionId>;
	shortcuts?: readonly ShortcutRowInput[];
	recent?: ReadonlyArray<{ path: string; label: string; hidden?: boolean }>;
	/** Section titles, so core stays free of i18n. */
	labels: { folders: string; tags: string; untagged: string; root: string; shortcuts?: string; recent?: string; properties?: string };
}

export interface NavTree {
	rows: NavRow[];
	indexByKey: Map<string, number>;
}

const tagKey = (tag: string): string => tag.toLowerCase();

/** The prefixes of a tag path: `a/b/c` gives `a`, `a/b`, `a/b/c`. */
export function tagAncestry(tag: string): string[] {
	const parts = tag.split('/').filter(Boolean);
	return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
}

interface FolderNode { path: string; children: string[]; direct: number; total: number }

function buildFolderNodes(folders: readonly string[], notes: readonly NoteEntry[]): Map<string, FolderNode> {
	const nodes = new Map<string, FolderNode>();
	const ensure = (path: string): FolderNode => {
		let node = nodes.get(path);
		if (node) return node;
		node = { path, children: [], direct: 0, total: 0 };
		nodes.set(path, node);
		if (path !== ROOT_FOLDER) ensure(parentFolder(path)).children.push(path);
		return node;
	};
	ensure(ROOT_FOLDER);
	for (const folder of folders) ensure(folder === '' ? ROOT_FOLDER : folder);
	for (const note of notes) ensure(note.folder).direct++;
	const total = (node: FolderNode): number => {
		node.total = node.direct;
		for (const child of node.children) node.total += total(nodes.get(child)!);
		return node.total;
	};
	total(nodes.get(ROOT_FOLDER)!);
	for (const node of nodes.values()) node.children.sort((a, b) => compareNames(baseName(a), baseName(b)));
	return nodes;
}

interface TagNode { path: string; label: string; full: string; children: Set<string>; notes: Set<string>; own: Set<string> }

function buildTagNodes(notes: readonly NoteEntry[]): { nodes: Map<string, TagNode>; roots: string[]; untagged: number } {
	const nodes = new Map<string, TagNode>();
	const roots = new Set<string>();
	let untagged = 0;
	for (const note of notes) {
		if (!note.tags.length) { untagged++; continue; }
		for (const tag of note.tags) {
			let parent: TagNode | undefined;
			for (const prefix of tagAncestry(tag)) {
				const key = tagKey(prefix);
				let node = nodes.get(key);
				if (!node) {
					node = { path: key, label: prefix.slice(prefix.lastIndexOf('/') + 1), full: prefix, children: new Set(), notes: new Set(), own: new Set() };
					nodes.set(key, node);
				}
				node.notes.add(note.path);
				if (prefix === tag) node.own.add(note.path);
				if (parent) parent.children.add(key); else roots.add(key);
				parent = node;
			}
		}
	}
	const sorted = (keys: Iterable<string>) => [...keys].sort((a, b) => compareNames(nodes.get(a)!.label, nodes.get(b)!.label));
	return { nodes, roots: sorted(roots), untagged };
}

/** Flatten the root sections into the rows the navigation pane virtualizes. */
export function buildNavTree(input: NavTreeInput): NavTree {
	const rows: NavRow[] = [];
	const collapsed = input.collapsed ?? new Set<SectionId>();
	const section = (id: SectionId, label: string, count = 0): boolean => {
		const open = !collapsed.has(id);
		rows.push({ key: `section:${id}`, kind: 'section', depth: 0, path: id, label, count, hasChildren: false, expanded: open, section: id });
		return open;
	};

	const folderRows = () => {
		const countOf = (node: FolderNode) => (input.countDescendants ? node.total : node.direct);
		const folders = buildFolderNodes(input.folders, input.notes);
		const walkFolder = (path: string, depth: number) => {
			const node = folders.get(path)!;
			const expanded = input.expandedFolders.has(path);
			rows.push({ key: `folder:${path}`, kind: 'folder', depth, path, label: path === ROOT_FOLDER ? input.labels.root : baseName(path), count: countOf(node), hasChildren: node.children.length > 0, expanded, section: 'folders', context: { kind: 'folder', key: path } });
			if (expanded) for (const child of node.children) walkFolder(child, depth + 1);
		};
		const root = folders.get(ROOT_FOLDER)!;
		if (input.showRoot) walkFolder(ROOT_FOLDER, 0);
		else for (const child of root.children) walkFolder(child, 0);
	};

	const tagRows = (tags: ReturnType<typeof buildTagNodes>) => {
		const walkTag = (key: string, depth: number) => {
			const node = tags.nodes.get(key)!;
			const expanded = input.expandedTags.has(key);
			rows.push({ key: `tag:${key}`, kind: 'tag', depth, path: key, label: node.label, count: input.countDescendants ? node.notes.size : node.own.size, hasChildren: node.children.size > 0, expanded, display: node.full, section: 'tags', context: { kind: 'tag', key } });
			if (expanded) for (const child of [...node.children].sort((a, b) => compareNames(tags.nodes.get(a)!.label, tags.nodes.get(b)!.label))) walkTag(child, depth + 1);
		};
		for (const rootTag of tags.roots) walkTag(rootTag, 0);
		if (input.showUntagged && tags.untagged) rows.push({ key: 'untagged', kind: 'untagged', depth: 0, path: 'untagged', label: input.labels.untagged, count: tags.untagged, hasChildren: false, expanded: false, section: 'tags', context: { kind: 'untagged' } });
	};

	for (const id of input.sections ?? SECTION_IDS) {
		if (id === 'shortcuts') {
			const list = input.shortcuts ?? [];
			if (!list.length) continue;
			if (!section(id, input.labels.shortcuts ?? 'Shortcuts', list.length)) continue;
			for (const entry of list) {
				rows.push({ key: `shortcut:${entry.shortcut.id}`, kind: 'shortcut', depth: 0, path: entry.shortcut.key, label: entry.label, count: 0, hasChildren: false, expanded: false, section: 'shortcuts', shortcut: entry.shortcut, missing: entry.missing, hidden: entry.hidden });
			}
		} else if (id === 'recent') {
			const list = input.recent ?? [];
			if (!list.length) continue;
			if (!section(id, input.labels.recent ?? 'Recent', list.length)) continue;
			for (const entry of list) rows.push({ key: `recent:${entry.path}`, kind: 'recent', depth: 0, path: entry.path, label: entry.label, count: 0, hasChildren: false, expanded: false, section: 'recent', hidden: entry.hidden });
		} else if (id === 'folders') {
			if (section(id, input.labels.folders)) folderRows();
		} else if (id === 'tags') {
			if (!input.showTags) continue;
			const tags = buildTagNodes(input.notes);
			if (!tags.roots.length && !(input.showUntagged && tags.untagged)) continue;
			if (section(id, input.labels.tags)) tagRows(tags);
		} else if (input.showProperties) {
			const keys = collectProperties(input.notes, input.propertyKeys ?? []);
			if (!keys.length) continue;
			if (!section(id, input.labels.properties ?? 'Properties', keys.length)) continue;
			for (const node of keys) {
				const expanded = input.expandedProperties?.has(node.key) ?? false;
				const context: NavContext = { kind: 'property', key: node.key };
				rows.push({ key: contextKey(context), kind: 'property', depth: 0, path: node.key, label: node.label, count: node.count, hasChildren: node.values.length > 0, expanded, section: 'properties', context });
				if (!expanded) continue;
				for (const value of node.values) {
					const valueContext: NavContext = { kind: 'property', key: node.key, value: value.value };
					rows.push({ key: contextKey(valueContext), kind: 'propertyValue', depth: 1, path: node.key, label: value.label, count: value.count, hasChildren: false, expanded: false, section: 'properties', context: valueContext });
				}
			}
		}
	}
	const indexByKey = new Map<string, number>();
	rows.forEach((row, index) => indexByKey.set(row.key, index));
	return { rows, indexByKey };
}

/** Folder paths from the root down to `path`'s parent: what must be expanded to show `path`. */
export function folderAncestors(path: string): string[] {
	const result: string[] = [ROOT_FOLDER];
	const parts = path.split('/').filter(Boolean);
	for (let i = 1; i < parts.length; i++) result.push(parts.slice(0, i).join('/'));
	return result;
}

/** The nav row key for the parent of `key` (a collapsed child jumps to it with the Left key). */
export function parentRowKey(row: NavRow, showRoot: boolean): string | undefined {
	if (row.kind === 'folder') {
		if (row.path === ROOT_FOLDER) return undefined;
		const parent = parentFolder(row.path);
		return parent === ROOT_FOLDER && !showRoot ? undefined : `folder:${parent}`;
	}
	if (row.kind === 'tag') {
		const index = row.path.lastIndexOf('/');
		return index < 0 ? undefined : `tag:${row.path.slice(0, index)}`;
	}
	if (row.kind === 'propertyValue') return contextKey({ kind: 'property', key: row.path });
	return undefined;
}

/** The spelling of tag path `key` (lower-case) as it first appears in the notes, for writing it to a note. */
export function canonicalTag(notes: readonly NoteEntry[], key: string): string {
	for (const note of notes) for (const tag of note.tags) {
		const prefix = tagAncestry(tag).find((candidate) => tagKey(candidate) === key);
		if (prefix) return prefix;
	}
	return key;
}
