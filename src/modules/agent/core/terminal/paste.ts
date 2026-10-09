/** Text pasted or dropped into a terminal. */

/** Remove ESC and other C0/C1 controls except tab, line feed and carriage return; newlines become CR. */
export function sanitizePaste(text: string): string {
	let out = '';
	for (const char of text) {
		const code = char.codePointAt(0)!;
		if (code === 9 || code === 10 || code === 13) out += char;
		else if (code < 32 || code === 127 || (code >= 0x80 && code <= 0x9f)) continue;
		else out += char;
	}
	return out.replace(/\r?\n/g, '\r');
}

/** The bytes a paste sends: sanitized, and bracketed when the application asked for it (DECSET 2004). */
export function pasteSequence(text: string, bracketed: boolean): string {
	const clean = sanitizePaste(text);
	return bracketed ? `\x1b[200~${clean}\x1b[201~` : clean;
}

/** Quote a path for a POSIX shell or PowerShell/cmd when it contains whitespace or quotes. */
export function quotePath(path: string, platform: string): string {
	if (!/[\s'"$`]/.test(path)) return path;
	if (platform === 'win32') return `"${path.replace(/"/g, '""')}"`;
	return /'/.test(path) ? `"${path.replace(/(["\\$`])/g, '\\$1')}"` : `"${path}"`;
}

/** Dropped files as one line of space-separated (quoted when needed) absolute paths. */
export function droppedPaths(paths: readonly string[], platform: string): string {
	return paths.map((path) => quotePath(path, platform)).join(' ');
}
