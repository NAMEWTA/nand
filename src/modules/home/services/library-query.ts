// Adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/library-section.ts
import type { App } from 'obsidian';
import { contentFiles, type ContentFile } from '../../../host/obsidian/storage/content-files';
import { CONTENT_ROOT, contentPath, isContentPath } from '../../../shared/storage/content-paths';
import { readMarkdownDocument } from '../../../shared/storage/markdown-document';
import { isUnderExcludedFolder, normalizeExcludeFolders } from '../../../shared/exclude-folders';
import type { LibraryConfig, PropertyFilter } from '../core/board/types/model';
export interface LibraryFileResult {
	file: ContentFile;
	basename: string;
	mtime: number;
	ctime: number;
	frontmatter: Record<string, unknown>;
	preview: string;
	tags: string[];
}
export function queryVaultFiles(app: App, config: LibraryConfig): LibraryFileResult[] {
	const files = contentFiles(app).getMarkdownFiles();
	const results: LibraryFileResult[] = [];

	// Folder section: restrict to files under any configured folder (recursive, OR).
	const scanFolders = (config.folders ?? [])
		.map((f) => f.trim().replace(/^\/+|\/+$/g, ''))
		.filter((f) => f.length > 0)
		.flatMap((folder) => [folder, contentPath(folder)]);

	// Excluded folders: files inside them never reach the section (library scans
	// and folder sections alike).
	const excluded = normalizeExcludeFolders(config.excludeFolders ?? []);

	for (const file of files) {
		if (file.path.startsWith('.') && !isContentPath(file.path)) continue;
		if (
			isUnderExcludedFolder(file.path, excluded) ||
			isUnderExcludedFolder(file.path.replace(CONTENT_ROOT + '/', ''), excluded)
		)
			continue;

		if (scanFolders.length > 0) {
			const lp = file.path.toLowerCase();
			if (!scanFolders.some((f) => lp.startsWith(f.toLowerCase() + '/'))) continue;
		}

		const cache = contentFiles(app).getMetadata(file);
		const fm = cache?.frontmatter ?? {};

		// Apply filters (AND logic)
		let matches = true;
		for (const filter of config.filters) {
			if (!evaluateFilter(file, fm, filter, cache)) {
				matches = false;
				break;
			}
		}
		if (!matches) continue;

		const tags: string[] = [];
		if (cache?.tags) {
			for (const tag of cache.tags) tags.push(tag.tag);
		}

		results.push({
			file,
			basename: file.basename,
			mtime: file.stat.mtime,
			ctime: file.stat.ctime,
			frontmatter: fm,
			preview: '',
			tags,
		});
	}

	// Sort
	sortResults(results, config.sortBy, config.sortDesc);

	return results;
}
function evaluateFilter(
	file: ContentFile,
	fm: Record<string, unknown>,
	filter: PropertyFilter,
	cache: import('../../../host/obsidian/storage/content-files').ContentMetadata | null,
): boolean {
	if (filter.values.length === 0 && !filter.dateRange) return true;

	const prop = filter.property;
	const operator = filter.operator ?? 'equals';

	if (prop === 'tags') {
		const fileTags: string[] = [];
		if (fm.tags) {
			if (Array.isArray(fm.tags)) {
				fileTags.push(...fm.tags.map(String));
			} else {
				fileTags.push(str(fm.tags));
			}
		}
		if (cache?.tags) {
			for (const tag of cache.tags) fileTags.push(tag.tag);
		}
		if (operator === 'notEquals') return !fileTags.some((tag) => filter.values.includes(tag));
		if (operator === 'contains') return matchContains(fileTags, filter.values);
		return fileTags.some((tag) => filter.values.includes(tag));
	}

	if (prop === 'modified' || prop === 'created') {
		const ts = prop === 'modified' ? file.stat.mtime : file.stat.ctime;
		const dateStr = new Date(ts).toISOString().slice(0, 10);
		if (filter.dateRange) {
			if (filter.dateRange.start && dateStr < filter.dateRange.start) return false;
			if (filter.dateRange.end && dateStr > filter.dateRange.end) return false;
			return true;
		}
		return filter.values.includes(dateStr);
	}

	if (prop === 'path') {
		return filter.values.some((v) => file.path.toLowerCase().includes(v.toLowerCase()));
	}

	// Frontmatter property. A file without the property never matches, under
	// every operator — same convention as Dataview, where a missing field
	// satisfies no comparison.
	const value = fm[prop];
	if (value == null) return false;

	if (operator === 'notEquals') {
		if (Array.isArray(value)) return !value.some((item) => filter.values.includes(String(item)));
		return !filter.values.includes(str(value));
	}
	if (operator === 'contains') {
		const items = Array.isArray(value) ? value.map((item) => str(item)) : [str(value)];
		return matchContains(items, filter.values);
	}
	if (Array.isArray(value)) {
		return value.some((item) => filter.values.includes(String(item)));
	}

	return filter.values.includes(str(value));
}
function matchContains(items: string[], patterns: string[]): boolean {
	const lower = patterns.filter((p) => p.length > 0).map((p) => p.toLowerCase());
	if (lower.length === 0) return false;
	return items.some((s) => s.length > 0 && lower.some((p) => s.toLowerCase().includes(p)));
}
export function str(v: unknown): string {
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
	return '';
}
export function localDateKey(ts: number): string {
	const d = new Date(ts);
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${m}-${day}`;
}
export async function loadPreview(app: App, file: ContentFile): Promise<string> {
	const raw = await contentFiles(app).read(file);
	let body = raw;
	try {
		body = readMarkdownDocument(raw).body;
	} catch {
		/* Malformed properties must not hide readable body text. */
	}
	const lines = body.split('\n');
	const previewLines: string[] = [];
	for (let i = 0; i < lines.length && previewLines.length < 3; i++) {
		const line = lines[i]!.replace(/^#+\s*/, '').trim();
		if (line && !line.startsWith('---') && !line.startsWith('```')) previewLines.push(line);
	}
	return previewLines.join(' ').slice(0, 120);
}
function sortResults(results: LibraryFileResult[], sortBy: string, desc: boolean): void {
	results.sort((a, b) => {
		let cmp = 0;
		if (sortBy === 'name') {
			cmp = a.basename.localeCompare(b.basename);
		} else if (sortBy === 'modified') {
			cmp = a.mtime - b.mtime;
		} else if (sortBy === 'created') {
			cmp = a.ctime - b.ctime;
		} else {
			const aVal = a.frontmatter[sortBy];
			const bVal = b.frontmatter[sortBy];
			cmp = comparePropertyValues(aVal, bVal);
		}
		return desc ? -cmp : cmp;
	});
}
function comparePropertyValues(a: unknown, b: unknown): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	const sa = str(a);
	const sb = str(b);
	const na = Number(sa);
	const nb = Number(sb);
	if (!isNaN(na) && !isNaN(nb)) return na - nb;
	return sa.localeCompare(sb);
}
