import { App, TFile } from 'obsidian';

/** Shape shared by the grid/list/table media views. */
export interface MediaFileResult {
	file: TFile;
	basename: string;
	path: string;
	mtime: number;
	ctime: number;
	ext: string;
	size: number;
	/** User-defined tags for this file (empty array when untagged). */
	tags: string[];
}

export type MediaKind = 'image' | 'video';

export type ThumbSize = 'small' | 'medium' | 'large';

/** Notes that link to or embed the given media file (backlinks via resolvedLinks). */
export function getMediaBacklinks(app: App, file: TFile): TFile[] {
	const target = file.path;
	const out: TFile[] = [];
	const resolved = app.metadataCache.resolvedLinks;
	for (const [srcPath, targets] of Object.entries(resolved)) {
		if (targets[target]) {
			const src = app.vault.getFileByPath(srcPath);
			if (src) out.push(src);
		}
	}
	out.sort((a, b) => a.basename.localeCompare(b.basename));
	return out;
}

/** Human-readable file size for the static video placeholder badge. */
export function formatFileSize(bytes: number): string {
	if (!bytes || bytes <= 0) return '';
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB'];
	let val = bytes / 1024;
	let i = 0;
	while (val >= 1024 && i < units.length - 1) {
		val /= 1024;
		i++;
	}
	return `${val.toFixed(val >= 10 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(ts: number): string {
	const d = new Date(ts);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}
