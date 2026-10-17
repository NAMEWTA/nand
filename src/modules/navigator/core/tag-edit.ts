// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** Tags without the leading `#`, trimmed. */
export const cleanTag = (tag: string): string => tag.trim().replace(/^#+/, '').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');

/** True when `tag` is `parent` or lives below it (`a/b` is below `a`), ignoring case. */
export function isTagOrChild(tag: string, parent: string): boolean {
	const a = tag.toLowerCase();
	const b = parent.toLowerCase();
	return a === b || a.startsWith(`${b}/`);
}

/** A tag Obsidian accepts: letters, digits, `_`, `-`, `/`, and at least one non-digit. */
export function validTagName(tag: string): boolean {
	return /^[\p{L}\p{N}_/-]+$/u.test(tag) && /[^\p{N}/]/u.test(tag) && !tag.startsWith('/') && !tag.endsWith('/') && !tag.includes('//');
}

/** What happens to a tag: kept as is, replaced by another, or removed (null). */
export type TagMapper = (tag: string) => string | null;

/** Mapper that renames `from` and its children to `to`. */
export const renameMapper = (from: string, to: string): TagMapper => (tag) => (tag.toLowerCase() === from.toLowerCase() ? to : isTagOrChild(tag, from) ? `${to}${tag.slice(from.length)}` : tag);

/** Mapper that removes `target`; with `withChildren` its children go too. */
export const removeMapper = (target: string, withChildren: boolean): TagMapper => (tag) => (withChildren ? (isTagOrChild(tag, target) ? null : tag) : tag.toLowerCase() === target.toLowerCase() ? null : tag);

/** Apply a mapper to a frontmatter tag list, dropping removed tags and duplicates (case-insensitive), keeping order. */
export function mapTagList(tags: readonly string[], mapper: TagMapper): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of tags) {
		const clean = cleanTag(raw);
		const mapped = mapper(clean);
		if (mapped === null || mapped === '') continue;
		const key = mapped.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(mapped);
	}
	return result;
}

/** One inline tag as Obsidian's metadata cache reports it: the `#tag` text and where it stands in the note. */
export interface TagPosition {
	/** As written, with the leading `#`. */
	tag: string;
	start: number;
	end: number;
}

export interface TagRewrite {
	/** The note text with the tags changed; the original when `stale`. */
	text: string;
	/** The reported positions do not match the text (the cache is behind the file): nothing was changed. */
	stale: boolean;
	changed: boolean;
}

/**
 * Change inline tags at exactly the places Obsidian found them. Nothing is guessed from the text: each position must
 * hold the reported `#tag` or the whole rewrite is refused (`stale`), and every byte outside the reported
 * ranges stays as it is. A removed tag takes one preceding space or tab with it.
 */
export function rewriteTagsAt(text: string, tags: readonly TagPosition[], mapper: TagMapper): TagRewrite {
	const ordered = [...tags].sort((a, b) => a.start - b.start);
	let previousEnd = 0;
	for (const entry of ordered) {
		if (entry.start < previousEnd || entry.end > text.length || entry.end <= entry.start || text.slice(entry.start, entry.end) !== entry.tag) {
			return { text, stale: true, changed: false };
		}
		previousEnd = entry.end;
	}
	let out = '';
	let from = 0;
	let changed = false;
	for (const entry of ordered) {
		const mapped = mapper(entry.tag.replace(/^#/, ''));
		if (mapped === entry.tag.replace(/^#/, '')) continue;
		changed = true;
		let cut = entry.start;
		if (mapped === null && cut > from && (text[cut - 1] === ' ' || text[cut - 1] === '\t')) cut--;
		out += text.slice(from, cut) + (mapped === null ? '' : `#${mapped}`);
		from = entry.end;
	}
	return { text: changed ? out + text.slice(from) : text, stale: false, changed };
}

/** A fast 53-bit string hash, used to tell whether a note's text is still what an edit left behind. */
export function hashText(text: string): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index);
		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return `${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}:${text.length}`;
}
