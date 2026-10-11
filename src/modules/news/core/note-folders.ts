export const DEFAULT_FAVORITE_FOLDER = 'NAND/新闻/收藏';
export const DEFAULT_EDITION_FOLDER = 'NAND/新闻/日报';
export interface NewsNoteFolders { favoriteFolder?: string; editionFolder?: string; }

/** Visible, vault-relative folder only; no hidden/private segments or platform-special names. */
export function newsFolder(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const normalized = value.trim().replace(/\\/g, '/').replace(/\/$/, '');
	return normalized.length > 0 && normalized.length <= 400 && normalized.split('/').every(part =>
		!!part && !part.startsWith('.') && !/[. ]$/.test(part) && !/[:*?"<>|]/.test(part) && [...part].every(char => char.codePointAt(0)! >= 32)
		&& !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) ? normalized : undefined;
}
export const favoriteFolder = (folders: NewsNoteFolders): string => newsFolder(folders.favoriteFolder) ?? DEFAULT_FAVORITE_FOLDER;
export const editionFolder = (folders: NewsNoteFolders): string => newsFolder(folders.editionFolder) ?? DEFAULT_EDITION_FOLDER;
