import { App } from 'obsidian';
import type { MediaTagService } from '../../../platform/obsidian/media/media-tags';
import { isUnderExcludedFolder, normalizeExcludeFolders } from '../../../shared/exclude-folders';
import { t } from '../../../shared/i18n/index';
import { folderGroupKey } from '../library/library-presentation';
import { type MediaFileResult } from './media-presentation';

/** Image file extensions shown in an images section (excludes pdf). */
export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);

export const VIDEO_EXTS = new Set(['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v']);

export const PAGE_SIZE_OPTIONS = [20, 50, 100];

export type MediaViewMode = 'grid' | 'list';

export type ThumbSize = 'small' | 'medium' | 'large';

export const THUMB_SIZE_STORAGE_KEY = 'nand.dashboard.media-thumb-size';

export function readStoredThumbSize(app: App): ThumbSize {
	const stored = app.loadLocalStorage(THUMB_SIZE_STORAGE_KEY) as string | null;
	return stored === 'small' || stored === 'large' ? stored : 'medium';
}

export type MediaGroupMode = 'none' | 'folder' | 'tag';

export interface MediaGroup {
	key: string;
	items: MediaFileResult[];
	offset: number;
}

export function groupMediaResults(results: MediaFileResult[], mode: MediaGroupMode): MediaGroup[] {
	if (mode === 'none') return [];
	const buckets = new Map<string, MediaFileResult[]>();
	const notSet: MediaFileResult[] = [];
	for (const r of results) {
		if (mode === 'folder') {
			const key = folderGroupKey(r.path, []);
			if (key === undefined) {
				notSet.push(r);
				continue;
			}
			const list = buckets.get(key) ?? [];
			list.push(r);
			buckets.set(key, list);
		} else {
			const tags = r.tags;
			if (tags.length === 0) {
				notSet.push(r);
				continue;
			}
			for (const tag of tags) {
				const list = buckets.get(tag) ?? [];
				list.push(r);
				buckets.set(tag, list);
			}
		}
	}
	const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
	const groups: MediaGroup[] = [];
	let offset = 0;
	for (const [key, items] of sorted) {
		groups.push({ key, items, offset });
		offset += items.length;
	}
	if (notSet.length > 0) groups.push({ key: t('library.notSet'), items: notSet, offset });
	return groups;
}

export function extsFor(sectionType: string): Set<string> | null {
	if (sectionType === 'images') return IMAGE_EXTS;
	if (sectionType === 'videos') return VIDEO_EXTS;
	return null;
}

export function isMediaSection(sectionType: string): boolean {
	return sectionType === 'images' || sectionType === 'videos';
}

export function queryMediaFiles(
	app: App,
	exts: Set<string>,
	excludeFolders: string[],
	includeFolders: string[],
	tagService?: MediaTagService,
): MediaFileResult[] {
	const excluded = normalizeExcludeFolders(excludeFolders);
	// Display scope: normalized lowercase prefixes; a file qualifies when its
	// path equals a scope folder or lives under it. Empty scope = whole vault.
	const includes = includeFolders.map((f) => f.trim().toLowerCase().replace(/\/+$/, '')).filter(Boolean);
	const inScope = (path: string): boolean => {
		if (includes.length === 0) return true;
		const p = path.toLowerCase();
		return includes.some((inc) => p === inc || p.startsWith(inc + '/'));
	};
	const results: MediaFileResult[] = [];
	for (const file of app.vault.getFiles()) {
		if (file.path.startsWith('.')) continue;
		if (!inScope(file.path)) continue;
		if (isUnderExcludedFolder(file.path, excluded)) continue;
		if (!exts.has(file.extension)) continue;
		results.push({
			file,
			basename: file.basename,
			path: file.path,
			mtime: file.stat.mtime,
			ctime: file.stat.ctime,
			ext: file.extension,
			size: file.stat.size,
			tags: tagService?.getTags(file.path) ?? [],
		});
	}
	return results;
}

export function sortMedia(results: MediaFileResult[], sortBy: string, desc: boolean): void {
	results.sort((a, b) => {
		let cmp = 0;
		if (sortBy === 'name') {
			cmp = a.basename.localeCompare(b.basename);
		} else if (sortBy === 'created') {
			cmp = a.ctime - b.ctime;
		} else {
			cmp = a.mtime - b.mtime;
		}
		return desc ? -cmp : cmp;
	});
}
