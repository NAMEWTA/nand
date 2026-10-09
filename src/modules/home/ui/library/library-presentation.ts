import { App, Platform, TFile } from 'obsidian';
import { resolveCoverAsObjectUrl } from '../../platform/reading/book-service';
import { getRenderContext } from '../renderer/render-context';
import { attachNoteHover } from '../ui/hover-preview';
import { str } from './library-file-result';

export function openFile(app: App, file: TFile, owner: HTMLElement): void {
	const opener = getRenderContext(owner).noteOpener;
	if (!Platform.isMobile && opener) {
		opener(file);
	} else {
		void app.workspace.getLeaf(false).openFile(file);
	}
}

export function attachItemHover(app: App, el: HTMLElement, file: TFile): void {
	const hoverParent = getRenderContext(el).hoverParent;
	if (!Platform.isMobile && hoverParent) {
		attachNoteHover(app, el, file, hoverParent);
	}
}

export async function trashLibraryFile(app: App, file: TFile): Promise<void> {
	await app.fileManager.trashFile(file);
}

export function omitFrontmatterKey(frontmatter: Record<string, unknown>, key: string): Record<string, unknown> {
	if (!(key in frontmatter)) return frontmatter;
	const next: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(frontmatter)) {
		if (k !== key) next[k] = v;
	}
	return next;
}

export interface CoverCandidate {
	/** The frontmatter key the reference came from (to drop it from badges). */
	key: string;
	/** Normalized reference string ready for {@link resolveLibraryCover}. */
	value: string;
}

export const IMAGE_REF_RE = /\.(png|jpe?g|webp|gif|avif|bmp|svg)(?:[?#]|$)/i;

export function isImageRef(value: string): boolean {
	return value.startsWith('data:image/') || IMAGE_REF_RE.test(value);
}

export function normalizeCoverValue(value: unknown): string | null {
	if (value == null || value instanceof Date) return null;
	if (Array.isArray(value)) {
		for (const item of value) {
			const normalized = normalizeCoverValue(item);
			if (normalized && isImageRef(normalized)) return normalized;
		}
		return null;
	}
	if (typeof value === 'object') return null;
	let s = str(value).trim();
	if (!s) return null;
	s = s.replace(/^["']+|["']+$/g, '').trim();
	const wikilink = /^!?\[\[([^[\]]+)\]\]$/.exec(s);
	if (wikilink) {
		s = wikilink[1]!.split('|')[0]!.trim();
	} else {
		const mdImage = /^!\[[^\]]*\]\(([^()]+)\)$/.exec(s);
		if (mdImage) {
			s = mdImage[1]!.trim();
		} else {
			const imgTag = /^<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(s);
			if (imgTag) s = imgTag[1]!.trim();
		}
	}
	return s.length > 0 ? s : null;
}

export function extractCoverValue(frontmatter: Record<string, unknown>): CoverCandidate | null {
	for (const [key, value] of Object.entries(frontmatter)) {
		if (key !== '封面' && key.toLowerCase() !== 'cover') continue;
		const normalized = normalizeCoverValue(value);
		if (normalized) return { key, value: normalized };
	}
	for (const [key, value] of Object.entries(frontmatter)) {
		if (key === 'tags' || key === 'position') continue;
		const normalized = normalizeCoverValue(value);
		if (normalized && isImageRef(normalized)) return { key, value: normalized };
	}
	return null;
}

export async function resolveLibraryCover(raw: string, file: TFile, app: App): Promise<string> {
	if (/^(https?:|data:|file:)/i.test(raw) || /^[a-zA-Z]:[\\/]/.test(raw)) {
		return resolveCoverAsObjectUrl(raw, app);
	}
	const dest = app.metadataCache.getFirstLinkpathDest(raw, file.path);
	if (dest) return resolveCoverAsObjectUrl(dest.path, app);
	return resolveCoverAsObjectUrl(raw, app);
}

export function selectBadgeKeys(
	frontmatter: Record<string, unknown>,
	visibleProperties: readonly string[] | undefined,
	autoLimit: number,
): string[] {
	const showable = (key: string, value: unknown): boolean =>
		key !== 'tags' && key !== 'position' && formatBadgeValue(value) !== null;

	const picks = visibleProperties ?? [];
	const hits = picks.filter((key) => key in frontmatter && showable(key, frontmatter[key]));
	if (hits.length > 0) return hits;

	const auto: string[] = [];
	for (const [key, value] of Object.entries(frontmatter)) {
		if (auto.length >= autoLimit) break;
		if (showable(key, value)) auto.push(key);
	}
	return auto;
}

export function formatBadgeValue(value: unknown): string | null {
	if (value == null) return null;
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	if (Array.isArray(value)) {
		const items = value
			.map((v) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)))
			.filter((v) => v.length > 0);
		return items.length > 0 ? items.join(', ') : null;
	}
	if (typeof value === 'object') {
		try {
			const s = JSON.stringify(value).replace(/"/g, '').trim();
			return s.length > 0 && s.length <= 60 ? s : null;
		} catch {
			return null;
		}
	}
	const s = str(value).trim();
	return s.length > 0 ? s : null;
}

export function parentOf(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	return normalized.includes('/') ? normalized.slice(0, normalized.lastIndexOf('/')) : '';
}

export function scanRootMatch(filePath: string, scanFolders: string[]): { root: string; rel: string } | null {
	const parent = parentOf(filePath);
	for (const root of scanFolders) {
		const r = root.trim().replace(/\\/g, '/').replace(/\/+$/, '');
		if (!r) continue;
		// Case-insensitive prefix match, same rule the scanner uses.
		const rel = parent.toLowerCase().startsWith(r.toLowerCase() + '/')
			? parent.slice(r.length + 1)
			: parent.toLowerCase() === r.toLowerCase()
				? ''
				: null;
		if (rel !== null) return { root: r, rel };
	}
	return null;
}

export function folderGroupKey(filePath: string, scanFolders: string[]): string | undefined {
	const m = scanRootMatch(filePath, scanFolders);
	if (m) {
		if (m.rel === '') {
			// Directly inside the scan folder: the folder itself is the group.
			return m.root.split('/').filter(Boolean).pop() ?? m.root;
		}
		return m.rel.split('/')[0] ?? '';
	}
	const parent = parentOf(filePath);
	if (parent === '') return undefined;
	return parent.split('/')[0] ?? undefined;
}
