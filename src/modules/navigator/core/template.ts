// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { addDays, addMonths, formatDate, startOfWeek, type FormatOptions, type WeekStart } from './moment-format';

/** Everything the built-in template engine can fill in. */
export interface TemplateContext {
	/** File name of the new note without extension. */
	title: string;
	/** Name of the folder that holds the note. */
	folder: string;
	/** Vault path of the note. */
	path: string;
	/** The date the note stands for: the start of its period for periodic notes, otherwise today. */
	noteDate: Date;
	/** Format `{{date}}`, `{{yesterday}}`, ... use when none is given: the file name pattern for periodic notes, else the date format setting. */
	dateFormat: string;
	/** Format `{{today}}` uses when none is given. */
	todayFormat: string;
	timeFormat: string;
	now: Date;
	weekStart: WeekStart;
	locale?: string;
	/** Periodic week notes list the seven days starting at their note date; others use the week that holds it. */
	weekDaysFromNoteDate?: boolean;
	/** Answers to `{{prompt:Label}}`, keyed by label. */
	values?: Readonly<Record<string, string>>;
	/** The sequence number of a note named from a `{{number}}` format; without it number tokens stay as written. */
	number?: number;
	/**
	 * Collect, instead of writing them, the values of the tokens inside the frontmatter: each is replaced by a marker
	 * (see `PROBE_MARK`) and its text pushed here. Used to check what the frontmatter really says after substitution.
	 */
	probe?: string[];
	/** Leave a marker where `{{number}}` goes (see `NUMBER_MARK`) instead of the token, so a name can be numbered after everything else is filled in. */
	numberPlaceholder?: boolean;
}

/** Private-use characters around the argument of a `{{number}}` token that `numberPlaceholder` leaves in the text. */
export const NUMBER_MARK = { open: '\uE000', close: '\uE001' } as const;
/** Private-use characters around the index of a value that `probe` collected. */
export const PROBE_MARK = { open: '\uE100', close: '\uE101' } as const;
const MARK_CHARS = /[\uE000\uE001\uE100\uE101]/g;

export interface RenderedTemplate {
	text: string;
	/** Offset in `text` where `{{cursor}}` stood (the first one), if any. */
	cursor?: number;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const NOW_FORMAT = 'YYYY-MM-DD[T]HH:mm:ssZ';
const TOKEN = /\{\{(!?)([a-zA-Z]+)([+-]\d+[yQMwdhms])?(?::([^{}]*))?\}\}/g;
const KNOWN = new Set(['title', 'folder', 'path', 'date', 'yesterday', 'tomorrow', 'time', 'today', 'now', 'cursor', 'prompt', 'value', 'number', ...WEEKDAYS]);
export const DEFAULT_PROMPT_LABEL = 'Value';

/** Labels asked for by `{{prompt:Label}}` / `{{value:Label}}` in the texts, once each, in order; escaped tokens are skipped. */
export function collectPromptLabels(...texts: string[]): string[] {
	const labels: string[] = [];
	for (const text of texts) {
		for (const match of text.matchAll(TOKEN)) {
			if (match[1] || (match[2] !== 'prompt' && match[2] !== 'value')) continue;
			const label = promptLabel(match[4]);
			if (!labels.includes(label)) labels.push(label);
		}
	}
	return labels;
}

const promptLabel = (argument: string | undefined) => (argument?.trim() ? argument.trim() : DEFAULT_PROMPT_LABEL);

/** Move a date by an offset such as `+1d`, `-2w`, `+3Q`. */
export function applyOffset(date: Date, offset: string | undefined): Date {
	if (!offset) return date;
	const amount = Number(offset.slice(0, -1));
	switch (offset.slice(-1)) {
		case 'y': return addMonths(date, amount * 12);
		case 'Q': return addMonths(date, amount * 3);
		case 'M': return addMonths(date, amount);
		case 'w': return addDays(date, amount * 7);
		case 'd': return addDays(date, amount);
		case 'h': return new Date(date.getTime() + amount * 3_600_000);
		case 'm': return new Date(date.getTime() + amount * 60_000);
		default: return new Date(date.getTime() + amount * 1000);
	}
}

/** True for the lines between the opening `---` of a note and its closing `---` / `...`. */
function frontmatterRange(text: string): { start: number; end: number } | undefined {
	const open = /^---[ \t]*\r?\n/.exec(text);
	if (!open) return undefined;
	const close = /\r?\n(---|\.\.\.)[ \t]*(\r?\n|$)/.exec(text.slice(open[0].length - 1));
	return { start: open[0].length, end: close ? open[0].length - 1 + close.index : text.length };
}

type Quote = 'double' | 'single' | undefined;

/**
 * The YAML quote style at position `to` of a frontmatter, found by reading it line by line from `from` with the
 * structure of YAML in mind: a quote only opens where a value (or a key) starts, which is after `: `, a `- ` list
 * marker, `[`, `{` or `,` in a flow collection, or at the start of a line, optionally after node properties (`&anchor`,
 * `!tag`). Quotes inside a plain scalar (`foo-'bar`), in a `#` comment or in a block scalar (`key: |`) are just text.
 * A quoted value may continue over several lines.
 */
function quoteAt(text: string, from: number, to: number): Quote {
	let quote: Quote;
	let blockParent: number | undefined;
	let flow = 0;
	let expect = true;
	let position = from;
	while (position < to) {
		const newline = text.indexOf('\n', position);
		const lineEnd = newline < 0 ? text.length : newline;
		const line = text.slice(position, lineEnd);
		const indent = line.length - line.trimStart().length;
		if (blockParent !== undefined && quote === undefined) {
			if (line.trim() === '' || indent > blockParent) {
				if (to <= lineEnd) return undefined;
				position = lineEnd + 1;
				continue;
			}
			blockParent = undefined;
		}
		if (quote === undefined && flow === 0) expect = true;
		let code = line;
		for (let index = 0; index < line.length; index++) {
			if (position + index >= to) return quote;
			const char = line[index]!;
			if (quote === 'double') {
				if (char === '\\') index++;
				else if (char === '"') { quote = undefined; expect = false; }
				continue;
			}
			if (quote === 'single') {
				if (char === "'") { if (line[index + 1] === "'") index++; else { quote = undefined; expect = false; } }
				continue;
			}
			if (char === ' ' || char === '\t') continue;
			if (char === '#' && (index === 0 || /\s/.test(line[index - 1]!))) {
				// A comment runs to the end of the line.
				if (to <= lineEnd) return undefined;
				code = line.slice(0, index);
				break;
			}
			const next = line[index + 1];
			const spaceAfter = next === undefined || next === ' ' || next === '\t';
			if (expect) {
				if (char === '"' || char === "'") { quote = char === '"' ? 'double' : 'single'; continue; }
				if (char === '-' && spaceAfter && flow === 0) continue;
				if (char === '&' || char === '!' || char === '*') {
					// node properties and aliases run to the next whitespace; a value still follows a property
					while (index + 1 < line.length && line[index + 1] !== ' ' && line[index + 1] !== '\t') index++;
					if (char === '*') expect = false;
					continue;
				}
				if (char === '[' || char === '{') { flow++; continue; }
				expect = false;
			} else if (char === ':' && (spaceAfter || flow > 0)) {
				expect = true;
				continue;
			}
			if (flow > 0) {
				if (char === ',') expect = true;
				else if (char === ']' || char === '}') { flow--; expect = false; }
			}
		}
		if (to <= lineEnd) return quote;
		if (quote === undefined && /(?::|-)[ \t]+[|>][+\-0-9]{0,2}[ \t]*$/.test(code)) blockParent = indent;
		position = lineEnd + 1;
	}
	return quote;
}

function escapeFor(quote: Quote, value: string): string {
	if (quote === 'double') return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');
	if (quote === 'single') return value.replace(/'/g, "''");
	return value;
}

/**
 * Fill the built-in `{{...}}` tokens of a template. Unknown tokens are left as written, `{{!date}}` keeps `{{date}}`
 * as text, and values written inside a quoted frontmatter value are escaped for that YAML quote style.
 */
export function renderTemplate(template: string, context: TemplateContext): RenderedTemplate {
	const options: FormatOptions = { locale: context.locale, weekStart: context.weekStart };
	const fm = frontmatterRange(template);
	let cursor: number | undefined;
	let out = '';
	let last = 0;
	const dateText = (date: Date, format: string | undefined, fallback: string) => formatDate(date, format?.trim() ? format : fallback, options);
	for (const match of template.matchAll(TOKEN)) {
		const [whole, bang = '', name = '', offset, argument] = match;
		const index = match.index ?? 0;
		out += template.slice(last, index);
		last = index + whole.length;
		if (!KNOWN.has(name)) { out += whole; continue; }
		if (bang) { out += whole.replace('{{!', '{{'); continue; }
		let value: string | undefined;
		switch (name) {
			case 'title': value = context.title; break;
			case 'folder': value = context.folder; break;
			case 'path': value = context.path; break;
			case 'date': value = dateText(applyOffset(context.noteDate, offset), argument, context.dateFormat); break;
			case 'yesterday': value = dateText(addDays(context.noteDate, -1), argument, context.dateFormat); break;
			case 'tomorrow': value = dateText(addDays(context.noteDate, 1), argument, context.dateFormat); break;
			case 'time': value = dateText(context.now, argument, context.timeFormat); break;
			case 'today': value = dateText(context.now, argument, context.todayFormat); break;
			case 'now': value = dateText(context.now, argument, NOW_FORMAT); break;
			case 'cursor':
				if (cursor === undefined) cursor = out.length;
				value = '';
				break;
			case 'prompt':
			case 'value': value = context.values?.[promptLabel(argument)] ?? ''; break;
			case 'number':
				if (context.number === undefined) {
					out += context.numberPlaceholder ? `${NUMBER_MARK.open}${argument ?? ''}${NUMBER_MARK.close}` : whole;
					continue;
				}
				value = String(context.number).padStart(argument?.trim().length ?? 0, '0');
				break;
			default: {
				const weekday = WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number]);
				const first = context.weekDaysFromNoteDate ? context.noteDate : startOfWeek(context.noteDate, context.weekStart);
				const days = (weekday - first.getDay() + 7) % 7;
				value = dateText(addDays(first, days), argument, context.todayFormat);
			}
		}
		value = value.replace(MARK_CHARS, '');
		if (fm && index >= fm.start && index < fm.end) {
			if (context.probe) { out += `${PROBE_MARK.open}${context.probe.push(value) - 1}${PROBE_MARK.close}`; continue; }
			value = escapeFor(quoteAt(template, fm.start, index), value);
		}
		out += value;
	}
	out += template.slice(last);
	return cursor === undefined ? { text: out } : { text: out, cursor };
}

/** Which engine fills a template: the setting, with Automatic picking Templater for templates that use `<%`. */
export function pickEngine(setting: 'auto' | 'builtin' | 'templater', raw: string, templaterAvailable: boolean): 'builtin' | 'templater' {
	if (!templaterAvailable) return 'builtin';
	if (setting === 'templater') return 'templater';
	return setting === 'auto' && raw.includes('<%') ? 'templater' : 'builtin';
}
