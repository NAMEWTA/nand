/** A stored wiki target keeps its exact source text; navigation separates the alias and subpath. */
export function documentLink(raw: string): { path: string; subpath?: string; alias?: string } {
	const separator = raw.indexOf('|');
	const target = separator < 0 ? raw : raw.slice(0, separator);
	const hash = target.indexOf('#');
	return { path: hash < 0 ? target : target.slice(0, hash), subpath: hash < 0 ? undefined : target.slice(hash), alias: separator < 0 ? undefined : raw.slice(separator + 1) };
}
