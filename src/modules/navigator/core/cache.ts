// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** Bump when the shape or the cleaning rules of cached previews change; older records are then rebuilt. */
export const CACHE_VERSION = 1;

/** What the cache keeps per note. Each processor remembers the file mtime it last ran for. */
export interface CacheRecord {
	path: string;
	version: number;
	/** File mtime when the preview text was produced. */
	contentMtime: number;
	/** File mtime and settings signature when the feature image was found. */
	imageMtime: number;
	imageSig: string;
	preview: string;
	/** Vault path of the feature image, or null. */
	image: string | null;
}

export interface StaleProcessors {
	content: boolean;
	image: boolean;
}

/** Which processors must run again for a file whose mtime is `mtime` under the current image settings. */
export function staleProcessors(record: CacheRecord | undefined, mtime: number, imageSig: string): StaleProcessors {
	if (!record || record.version !== CACHE_VERSION) return { content: true, image: true };
	return { content: record.contentMtime !== mtime, image: record.imageMtime !== mtime || record.imageSig !== imageSig };
}

export function isFresh(record: CacheRecord | undefined, mtime: number, imageSig: string): record is CacheRecord {
	const stale = staleProcessors(record, mtime, imageSig);
	return !stale.content && !stale.image;
}

/** A record for a file renamed from `oldPath`: previews do not depend on the path. */
export function renamedRecord(record: CacheRecord, path: string): CacheRecord {
	return { ...record, path };
}
