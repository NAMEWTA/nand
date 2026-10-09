// URL classification adapted from Orca d74388f (MIT, Copyright 2026 Lovecast Inc.).
export type SearchEngine = 'google' | 'bing' | 'duckduckgo';

/**
 * Turn address-bar input into an http(s) URL: local hosts and `host:port` get a scheme, bare domains get
 * https, and anything else becomes a search when `search` is given. Returns undefined for input that is
 * neither (file paths, other schemes, URLs with credentials).
 */
export function normalizeWebUrl(input: string, search?: SearchEngine): string | undefined {
	const raw = input.trim();
	if (!raw || raw === 'about:blank') return 'about:blank';
	const local = /^(?:localhost|[\w.-]+\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[[0-9a-f:]+\])(?::\d+)?(?:[/?#].*)?$/i.test(raw);
	const hostPort = /^[\w.-]+:\d+(?:[/?#].*)?$/.test(raw);
	let url: URL;
	try {
		if (local) url = new URL(`http://${raw}`);
		else if (hostPort) url = new URL(`https://${raw}`);
		else if (/^[a-z][a-z\d+.-]*:/i.test(raw)) url = new URL(raw);
		else if (/^[^\s/]+\.[^\s/]+(?:[/?#].*)?$/.test(raw)) url = new URL(`https://${raw}`);
		else if (search && !/^[\\/]|^[a-z]:[\\/]/i.test(raw)) {
			const prefix = { google: 'https://www.google.com/search?q=', bing: 'https://www.bing.com/search?q=', duckduckgo: 'https://duckduckgo.com/?q=' }[search];
			return prefix + encodeURIComponent(raw.replace(/^\?\s*/, ''));
		} else return undefined;
	} catch {
		return undefined;
	}
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
	return url.href;
}
