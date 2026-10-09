/** File references in terminal output: `path`, `path:line` or `path:line:column`. */

export interface FileReference {
	/** Text range in the line (UTF-16 offsets). */
	start: number;
	end: number;
	path: string;
	line?: number;
	column?: number;
}

// A path is either absolute (/x, ~/x, C:\x) or relative with at least one separator or an extension.
const REFERENCE = /(?:^|[\s"'`([{<=])((?:[A-Za-z]:[\\/]|~?\/|\.{1,2}\/)?(?:[\w.@+-]+[\\/])*[\w.@+-]*\.[A-Za-z0-9]{1,8}|(?:[A-Za-z]:[\\/]|~?\/|\.{1,2}\/)(?:[\w.@+-]+[\\/]?)+)(?::(\d+)(?::(\d+))?)?/g;

export function findFileReferences(text: string): FileReference[] {
	const found: FileReference[] = [];
	for (const match of text.matchAll(REFERENCE)) {
		const path = match[1];
		if (!path || /^\.+$/.test(path) || /^\d+(\.\d+)+$/.test(path)) continue;
		// Skip URLs; the web-link provider handles them.
		const before = text.slice(0, match.index + match[0].indexOf(path));
		if (/[a-z][a-z0-9+.-]*:\/*$/i.test(before)) continue;
		const start = before.length;
		const suffix = (match[2] ? `:${match[2]}` : '') + (match[3] ? `:${match[3]}` : '');
		found.push({
			start,
			end: start + path.length + suffix.length,
			path,
			...(match[2] ? { line: Number(match[2]) } : {}),
			...(match[3] ? { column: Number(match[3]) } : {}),
		});
	}
	return found;
}
