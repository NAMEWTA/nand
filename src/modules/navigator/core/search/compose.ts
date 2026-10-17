// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { parseQuery, type ParseOptions } from './parse';

/** Quote a piece of a filter when it holds whitespace or quotes. */
function quoted(text: string): string {
	return /[\s"]/.test(text) ? `"${text.replace(/"/g, '')}"` : text;
}

export function tagTerm(tag: string): string {
	return `#${tag.replace(/^#/, '')}`;
}

export function propertyTerm(key: string, value?: string): string {
	return value === undefined || value === '' ? `.${quoted(key)}` : `.${quoted(key)}=${quoted(value)}`;
}

/**
 * Add `term` to a query, or remove it when it is already there (clicking a tag twice toggles it). In a query of
 * only tags and properties `mode` picks AND or OR; anywhere else the term is ANDed implicitly.
 */
export function toggleFilter(query: string, term: string, mode: 'and' | 'or', options: ParseOptions): string {
	const parsed = parseQuery(query, options);
	const wanted = term.toLowerCase();
	const at = parsed.tokens.findIndex((token) => token.raw.toLowerCase() === wanted);
	if (at >= 0) {
		const tokens = parsed.tokens.map((token) => token.raw);
		// Take the operator that joined the term with it; the first term takes the operator after it.
		if (parsed.tokens[at - 1]?.operator) tokens.splice(at - 1, 2);
		else if (parsed.tokens[at + 1]?.operator) tokens.splice(at, 2);
		else tokens.splice(at, 1);
		return tokens.join(' ');
	}
	if (!parsed.tokens.length) return term;
	const onlyFilters = parsed.tokens.every((token) => token.operator || token.term?.type === 'tag' || token.term?.type === 'prop');
	const explicit = parsed.operators || mode === 'or';
	if (onlyFilters && explicit) return `${query.trim()} ${mode === 'or' ? 'OR' : 'AND'} ${term}`;
	return `${query.trim()} ${term}`;
}
