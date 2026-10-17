// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** Longest preview kept per note: five lines of a narrow pane. */
export const PREVIEW_CHARS = 360;

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']);

export function isImageExtension(ext: string): boolean {
	return IMAGE_EXTENSIONS.has(ext.toLowerCase());
}

/** Split off a leading YAML frontmatter block; `body` is the rest. */
export function splitFrontmatter(text: string): { frontmatter: string; body: string } {
	const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
	return match ? { frontmatter: match[1] ?? '', body: text.slice(match[0].length) } : { frontmatter: '', body: text };
}

/**
 * Plain text for a list row: no frontmatter, code blocks, comments, HTML, embeds or Markdown syntax.
 * A leading heading equal to `title` is dropped because the row already shows it.
 */
export function cleanPreview(text: string, title = '', limit = PREVIEW_CHARS): string {
	let body = splitFrontmatter(text).body;
	body = body
		.replace(/```[\s\S]*?(?:```|$)/g, ' ')
		.replace(/~~~[\s\S]*?(?:~~~|$)/g, ' ')
		.replace(/%%[\s\S]*?(?:%%|$)/g, ' ')
		.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
		.replace(/\$\$[\s\S]*?\$\$/g, ' ');
	const lines: string[] = [];
	let dropTitle = title !== '';
	for (const raw of body.split(/\r?\n/)) {
		let line = raw.trim();
		if (!line) continue;
		if (/^(?:[-*_]\s*){3,}$/.test(line) || /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$/.test(line)) continue;
		const heading = /^#{1,6}\s+(.*)$/.exec(line);
		if (dropTitle) {
			dropTitle = false;
			if (heading && heading[1]!.trim().toLowerCase() === title.trim().toLowerCase()) continue;
		}
		line = line
			.replace(/^#{1,6}\s+/, '')
			.replace(/^>+\s?/, '')
			.replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '')
			.replace(/!\[\[[^\]]*\]\]/g, '')
			.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
			.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
			.replace(/\[\[([^\]#]*)(?:#[^\]]*)?\]\]/g, '$1')
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/<\/?[a-zA-Z][^>]*>/g, '')
			.replace(/\[\^[^\]]*\]/g, '')
			.replace(/`([^`]*)`/g, '$1')
			.replace(/(\*\*|__)(.*?)\1/g, '$2')
			.replace(/(\*|_)(.*?)\1/g, '$2')
			.replace(/~~(.*?)~~/g, '$1')
			.replace(/==(.*?)==/g, '$1')
			.replace(/\|/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
		if (line) lines.push(line);
		if (lines.join(' ').length >= limit) break;
	}
	const joined = lines.join(' ');
	return joined.length > limit ? joined.slice(0, limit) : joined;
}

export type ImageRef = { kind: 'link'; link: string };

/** First embedded local image of a note body (`![[x.png]]` or `![](x.png)`); remote URLs are ignored. */
export function firstImageLink(text: string): ImageRef | undefined {
	const body = splitFrontmatter(text).body.replace(/```[\s\S]*?(?:```|$)/g, ' ');
	const pattern = /!\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]|!\[[^\]]*\]\(\s*<?([^)>\s]+)>?(?:\s+"[^"]*")?\s*\)/g;
	for (let match = pattern.exec(body); match; match = pattern.exec(body)) {
		const raw = (match[1] ?? match[2] ?? '').trim();
		if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
		let link = raw;
		try { link = decodeURIComponent(raw); } catch { /* keep the raw text */ }
		const ext = link.slice(link.lastIndexOf('.') + 1);
		if (isImageExtension(ext)) return { kind: 'link', link };
	}
	return undefined;
}

/** A frontmatter image value (`cover: [[a.png]]`, `image: a.png`) as a link, or undefined. */
export function imageFromProperty(value: unknown): string | undefined {
	const first: unknown = Array.isArray(value) ? value[0] : value;
	if (typeof first !== 'string') return undefined;
	const wiki = /^\[\[([^\]|#]+)/.exec(first.trim());
	const link = (wiki?.[1] ?? first).trim();
	if (!link || /^[a-z][a-z0-9+.-]*:/i.test(link)) return undefined;
	return isImageExtension(link.slice(link.lastIndexOf('.') + 1)) ? link : undefined;
}
