/** Max tags per media file — keeps the per-file chip UI readable. */
export const MEDIA_TAG_MAX_PER_FILE = 10;
/** Max characters per tag. */
export const MEDIA_TAG_MAX_LEN = 40;

/** Normalize a tag list: trim, drop empty/overlong entries, dedupe, sort. */
export function normalizeTags(tags: readonly string[]): string[] {
	const seen = new Set<string>();
	for (const raw of tags) {
		if (typeof raw !== 'string') continue;
		const tag = raw.trim();
		if (!tag || tag.length > MEDIA_TAG_MAX_LEN) continue;
		seen.add(tag);
	}
	return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Sanitize the raw mediaTags value loaded from the settings file into a plain
 *  Record<path, string[]>; anything malformed is dropped. */
export function sanitizeMediaTags(raw: unknown): Record<string, string[]> {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const out: Record<string, string[]> = {};
	for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!Array.isArray(value)) continue;
		const tags = normalizeTags(value.filter((v): v is string => typeof v === 'string'));
		if (tags.length > 0) out[path] = tags;
	}
	return out;
}
