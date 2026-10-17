// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
/** Test stand-in for Obsidian's `parseYaml`. Parse a simple YAML mapping (scalars, flow lists, block lists): what the adapters' tests need from `parseYaml`. */
export function parseSimpleYaml(yaml: string): Record<string, unknown> {
	const lines = yaml.split('\n');
	const fm: Record<string, unknown> = {};
	for (let index = 0; index < lines.length; index++) {
		const keyed = /^(?:"([^"]+)"|'([^']+)'|([\w-]+)):[ \t]*(.*)$/.exec(lines[index]!);
		if (!keyed) continue;
		const key = keyed[1] ?? keyed[2] ?? keyed[3]!;
		const value = keyed[4]!.trim();
		if (value.startsWith('[')) fm[key] = value.slice(1, -1).split(',').map((item) => item.trim()).filter(Boolean);
		else if (value === 'null' || value === '~') fm[key] = null;
		else if (value) fm[key] = value.replace(/^"(.*)"$/, '$1');
		else {
			const list: string[] = [];
			while (/^\s+- /.test(lines[index + 1] ?? '')) list.push(lines[++index]!.replace(/^\s+- /, '').trim());
			// a bare key with nothing under it is an empty (null) value, like in YAML
			fm[key] = list.length ? list : null;
		}
	}
	return fm;
}

/** Test stand-in for Obsidian's `getFrontMatterInfo`. */
export function getSimpleFrontMatterInfo(content: string): { exists: boolean; frontmatter: string; from: number; to: number; contentStart: number } {
	const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(content);
	if (!match) return { exists: false, frontmatter: '', from: 0, to: 0, contentStart: 0 };
	const from = content.indexOf('\n') + 1;
	return { exists: true, frontmatter: match[1]!, from, to: from + match[1]!.length, contentStart: match[0].length };
}
