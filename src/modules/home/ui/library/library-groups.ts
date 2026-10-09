import { t } from '../../../../shared/i18n/index';
import { LibraryFileResult, str } from './library-file-result';
import { folderGroupKey, parentOf, scanRootMatch } from './library-presentation';

export function folderGroupPath(filePath: string, scanFolders: string[]): string | undefined {
	const m = scanRootMatch(filePath, scanFolders);
	if (m) {
		const parent = parentOf(filePath);
		if (m.rel === '') return parent;
		const trueRoot = parent.slice(0, parent.length - m.rel.length - 1);
		return `${trueRoot}/${m.rel.split('/')[0]}`;
	}
	const parent = parentOf(filePath);
	if (parent === '') return undefined;
	return parent.split('/')[0] ?? undefined;
}

export function buildKanbanGroupFolders(results: LibraryFileResult[], scanFolders: string[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const result of results) {
		const key = folderGroupKey(result.file.path, scanFolders);
		if (key === undefined || map.has(key)) continue;
		const folder = folderGroupPath(result.file.path, scanFolders);
		if (folder !== undefined) map.set(key, folder);
	}
	return map;
}

export function ancestorGroupKeys(groupFolders: Map<string, string>): Set<string> {
	const paths = [...groupFolders.values()].map((p) => p.toLowerCase().replace(/\/+$/, ''));
	const suppressed = new Set<string>();
	for (const [key, path] of groupFolders) {
		const lp = path.toLowerCase().replace(/\/+$/, '');
		if (paths.some((other) => other !== lp && other.startsWith(lp + '/'))) suppressed.add(key);
	}
	return suppressed;
}

export interface LibraryResultGroup {
	/** Collapse-set identity. The not-set bucket uses a control-character
	 * sentinel so it can never collide with a real folder/property value. */
	key: string;
	/** Header text. */
	label: string;
	/** The missing-value bucket — rendered last with muted styling. */
	isNoGroup: boolean;
	items: LibraryFileResult[];
}

export function groupLibraryResults(
	results: LibraryFileResult[],
	mode: 'folder' | 'property',
	propKey: string | undefined,
	scanFolders: string[],
): LibraryResultGroup[] {
	const groups = new Map<string, LibraryFileResult[]>();
	const noGroup: LibraryFileResult[] = [];
	for (const result of results) {
		if (mode === 'folder') {
			const key = folderGroupKey(result.file.path, scanFolders);
			if (key === undefined) {
				noGroup.push(result);
				continue;
			}
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(result);
			continue;
		}
		const value = result.frontmatter[propKey ?? ''];
		if (value == null) {
			noGroup.push(result);
			continue;
		}
		if (Array.isArray(value)) {
			for (const v of value) {
				const key = String(v);
				if (!groups.has(key)) groups.set(key, []);
				groups.get(key)!.push(result);
			}
		} else {
			const key = str(value);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(result);
		}
	}
	if (mode === 'folder') {
		const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
		groups.clear();
		for (const entry of sorted) groups.set(entry[0], entry[1]);
	}
	const out: LibraryResultGroup[] = [...groups.entries()].map(([key, items]) => ({
		key,
		label: key,
		isNoGroup: false,
		items,
	}));
	if (noGroup.length > 0)
		out.push({ key: '\u0000__nogroup__', label: t('library.notSet'), isNoGroup: true, items: noGroup });
	return out;
}

export function nextGroupPropertyValue(current: unknown, targetValue: string, fromKey: string | null): unknown {
	if (Array.isArray(current)) {
		const kept = current.filter((v) => fromKey === null || String(v) !== fromKey);
		if (!kept.some((v) => String(v) === targetValue)) kept.push(targetValue);
		// Member-wise (not positional) no-op check: dropping a multi-value card
		// back on its own column must not reorder-and-rewrite the array.
		const unchanged =
			kept.length === current.length && current.every((v) => kept.some((k) => String(k) === String(v)));
		return unchanged ? undefined : kept;
	}
	if (current == null) return targetValue;
	// Only scalar YAML values can match a group name; a nested map/list in
	// the slot falls through to the overwrite (String() on it would be
	// "[object Object]" garbage anyway).
	if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
		if (String(current) === targetValue) return undefined;
	}
	return targetValue;
}
