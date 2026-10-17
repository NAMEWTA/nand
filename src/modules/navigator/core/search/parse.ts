// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { parseDateExpression, type DateContext, type DateRange } from './dates';

/** One condition of a search; `text`, `key` and `value` are lower-case. */
export type Term =
	| { type: 'name'; text: string; negate: boolean }
	/** `tag` null means "has any tag" (or, negated, "has none"). */
	| { type: 'tag'; tag: string | null; negate: boolean }
	| { type: 'prop'; key: string; value: string | null; negate: boolean }
	| { type: 'task'; negate: boolean }
	| { type: 'folder'; value: string; exact: boolean; negate: boolean }
	| { type: 'ext'; value: string; negate: boolean }
	| { type: 'date'; range: DateRange; field: 'created' | 'modified'; negate: boolean };

export interface Token {
	/** Source text of the token, quotes included. */
	raw: string;
	start: number;
	end: number;
	term?: Term;
	operator?: 'AND' | 'OR';
}

export interface ParsedQuery {
	tokens: Token[];
	/** AND/OR are operators (the query holds only tag and property terms); otherwise they are name words. */
	operators: boolean;
}

export interface ParseOptions extends DateContext {
	/** The date field `@...` uses without `c:`/`m:`; it follows the list's sort order. */
	defaultField: 'created' | 'modified';
}

/** Split on whitespace; a double quote keeps the text up to its closing quote in one token. */
export function splitTokens(query: string): Array<{ raw: string; start: number; end: number }> {
	const tokens: Array<{ raw: string; start: number; end: number }> = [];
	let index = 0;
	while (index < query.length) {
		while (index < query.length && /\s/.test(query[index]!)) index++;
		if (index >= query.length) break;
		const start = index;
		let quoted = false;
		while (index < query.length && (quoted || !/\s/.test(query[index]!))) {
			if (query[index] === '"') quoted = !quoted;
			index++;
		}
		tokens.push({ raw: query.slice(start, index), start, end: index });
	}
	return tokens;
}

/** Text with its quotes removed: `"a b"c` becomes `a bc`; an unclosed quote runs to the end. */
function unquote(text: string): string {
	return text.replace(/"/g, '');
}

/** Read a possibly quoted piece from `body` at `from` up to one of `stops` (outside quotes). */
function readPiece(body: string, from: number, stops: string): { text: string; next: number } {
	let quoted = false;
	let index = from;
	let text = '';
	while (index < body.length) {
		const char = body[index]!;
		if (char === '"') { quoted = !quoted; index++; continue; }
		if (!quoted && stops.includes(char)) break;
		text += char;
		index++;
	}
	return { text, next: index };
}

function parseProperty(body: string, negate: boolean): Term | undefined {
	const key = readPiece(body, 1, '=');
	if (!key.text) return undefined;
	const lowerKey = key.text.toLowerCase();
	if (body[key.next] !== '=') return { type: 'prop', key: lowerKey, value: null, negate };
	const value = readPiece(body, key.next + 1, '').text;
	return { type: 'prop', key: lowerKey, value: value ? value.toLowerCase() : null, negate };
}

function parseTerm(raw: string, options: ParseOptions): Term | undefined | 'operator-word' {
	let body = raw;
	let negate = false;
	if (body.length > 1 && body[0] === '-') { negate = true; body = body.slice(1); }
	const name = (text: string): Term | undefined => (text ? { type: 'name', text: text.toLowerCase(), negate } : undefined);

	// A term that opens with a quote is plain text, whatever it contains.
	if (body[0] === '"') return name(unquote(body));
	if (body[0] === '#') {
		const tag = unquote(body.slice(1)).replace(/^#+/, '').toLowerCase();
		return { type: 'tag', tag: tag || null, negate };
	}
	if (body[0] === '.' && body.length > 1) return parseProperty(body, negate) ?? name(unquote(body));
	const lower = body.toLowerCase();
	if (lower.startsWith('has:')) {
		return unquote(lower.slice(4)) === 'task' ? { type: 'task', negate } : name(unquote(body));
	}
	if (lower.startsWith('folder:')) {
		const value = unquote(body.slice(7));
		if (!value) return undefined;
		if (value.startsWith('/')) return { type: 'folder', value: value.replace(/^\/+|\/+$/g, '').toLowerCase(), exact: true, negate };
		return { type: 'folder', value: value.toLowerCase(), exact: false, negate };
	}
	if (lower.startsWith('ext:')) {
		const value = unquote(lower.slice(4)).replace(/^\./, '');
		return value ? { type: 'ext', value, negate } : undefined;
	}
	if (body[0] === '@') {
		let expression = unquote(body.slice(1));
		let field = options.defaultField;
		const prefix = /^([cm]):/i.exec(expression);
		if (prefix) {
			field = prefix[1]!.toLowerCase() === 'c' ? 'created' : 'modified';
			expression = expression.slice(2);
		}
		if (!expression) return undefined;
		const range = parseDateExpression(expression, options);
		return range ? { type: 'date', range, field, negate } : name(unquote(body));
	}
	if (!negate && (body === 'AND' || body === 'OR')) return 'operator-word';
	return name(unquote(body));
}

/** Tokenize and parse a search query. Unknown or unfinished filters never throw; they match as text or are ignored. */
export function parseQuery(query: string, options: ParseOptions): ParsedQuery {
	const tokens: Token[] = [];
	for (const piece of splitTokens(query)) {
		const term = parseTerm(piece.raw, options);
		if (term === 'operator-word') tokens.push({ ...piece, operator: piece.raw as 'AND' | 'OR' });
		else tokens.push(term ? { ...piece, term } : piece);
	}
	const terms = tokens.flatMap((token) => token.term ?? []);
	const operators = tokens.some((token) => token.operator) && terms.every((term) => term.type === 'tag' || term.type === 'prop');
	if (!operators) {
		// Outside tag/property-only queries AND and OR are ordinary words.
		for (const token of tokens) {
			if (token.operator) {
				token.term = { type: 'name', text: token.operator.toLowerCase(), negate: false };
				delete token.operator;
			}
		}
	}
	return { tokens, operators };
}
