// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { propertyEntries, type NoteEntry } from '../types';
import { parseQuery, type ParseOptions, type ParsedQuery, type Term } from './parse';

export interface CompiledSearch {
	/** False for an empty query or one made only of unfinished filters: everything matches. */
	active: boolean;
	matches: (note: NoteEntry) => boolean;
}

interface Folded {
	name: string;
	aliases: string[];
	tags: string[];
}

function fold(note: NoteEntry): Folded {
	return { name: note.name.toLowerCase(), aliases: (note.aliases ?? []).map((alias) => alias.toLowerCase()), tags: note.tags.map((tag) => tag.toLowerCase()) };
}

function termMatches(term: Term, note: NoteEntry, folded: Folded): boolean {
	switch (term.type) {
		case 'name':
			return folded.name.includes(term.text) || folded.aliases.some((alias) => alias.includes(term.text));
		case 'tag':
			if (term.tag === null) return folded.tags.length > 0;
			return folded.tags.some((tag) => tag === term.tag || tag.startsWith(`${term.tag}/`));
		case 'prop': {
			const key = term.key;
			if (!note.props) return false;
			for (const name of Object.keys(note.props)) {
				const lower = name.toLowerCase();
				// `.key` matches any key that starts with it; `.key=value` looks at the key of exactly that name.
				if (term.value === null ? !lower.startsWith(key) : lower !== key) continue;
				if (term.value === null) return true;
				if (note.props[name]!.some((value) => value.toLowerCase().includes(term.value!))) return true;
			}
			return false;
		}
		case 'task':
			return note.hasTask === true;
		case 'folder': {
			const folder = note.folder === '/' ? '' : note.folder.toLowerCase();
			if (term.exact) return folder === term.value;
			return folder.split('/').some((segment) => segment.includes(term.value));
		}
		case 'ext':
			return note.ext.toLowerCase() === term.value;
		case 'date': {
			const time = term.field === 'created' ? note.ctime : note.mtime;
			return time >= term.range.start && time < term.range.end;
		}
	}
}

/** Terms joined by AND, or (in a tag/property-only query) groups of ANDed terms joined by OR. */
function groupsOf(parsed: ParsedQuery): Term[][] {
	const groups: Term[][] = [[]];
	for (const token of parsed.tokens) {
		if (token.operator === 'OR') groups.push([]);
		else if (token.term) groups[groups.length - 1]!.push(token.term);
	}
	return groups.filter((group) => group.length > 0);
}

export function compileParsed(parsed: ParsedQuery): CompiledSearch {
	const groups = groupsOf(parsed);
	if (!groups.length) return { active: false, matches: () => true };
	return {
		active: true,
		matches(note) {
			const folded = fold(note);
			return groups.some((group) => group.every((term) => termMatches(term, note, folded) !== term.negate));
		},
	};
}

/** Compile a filter-search query into a predicate over notes. */
export function compileSearch(query: string, options: ParseOptions): CompiledSearch {
	return compileParsed(parseQuery(query, options));
}

/** True when `note` has property `lowerKey` with a value equal (ignoring case) to `value`, or any value when omitted. */
export function noteHasProperty(note: NoteEntry, lowerKey: string, value?: string): boolean {
	const lists = propertyEntries(note, lowerKey);
	if (!lists.length) return false;
	return value === undefined || lists.some((list) => list.some((entry) => entry.toLowerCase() === value));
}
