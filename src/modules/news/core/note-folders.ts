import { contentPath } from '../../../shared/storage/content-paths';
export const DEFAULT_FAVORITE_FOLDER = contentPath('NAND/新闻/收藏');
export const DEFAULT_EDITION_FOLDER = contentPath('NAND/新闻/日报');
export interface NewsNoteFolders { favoriteFolder?: string; editionFolder?: string; }

/** Configurable content folders always stay under the vault-owned content root. */
export function newsFolder(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const normalized = value.trim().replace(/\\/g, '/').replace(/\/$/, '');
	if (!normalized || normalized.length > 400) return undefined;
	try { return contentPath(normalized); } catch { return undefined; }
}
export const favoriteFolder = (folders: NewsNoteFolders): string => newsFolder(folders.favoriteFolder) ?? DEFAULT_FAVORITE_FOLDER;
export const editionFolder = (folders: NewsNoteFolders): string => newsFolder(folders.editionFolder) ?? DEFAULT_EDITION_FOLDER;
