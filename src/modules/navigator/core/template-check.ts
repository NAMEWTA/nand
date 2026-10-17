// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { isPlainMapping, plainEqual } from './plain-yaml';
import { PROBE_MARK } from './template';

/** `invalid`: the output is not valid YAML; `different`: it says something else than the template; `unverifiable`: it cannot be proven either way. */
export type FrontmatterCheck = { ok: true } | { ok: false; reason: 'invalid' | 'different' | 'unverifiable' };

export interface CheckHost {
	/** Obsidian's YAML parser; throws on invalid YAML. */
	parse: (yaml: string) => unknown;
	/** A note's frontmatter YAML (undefined when it has none) and the text after the frontmatter block. */
	split: (text: string) => { yaml: string | undefined; body: string };
}

/** What the template says before any value is put in. */
export interface TemplateShape {
	/** The template text itself. */
	raw: string;
	/** The template's text after its literal frontmatter (or all of it), filled in on its own: what must follow the frontmatter of the output. */
	expectedBody: string;
}

const PLACEHOLDER = /\{\{[^}]*\}\}/;

const MARKS = new RegExp(`${PROBE_MARK.open}(\\d+)${PROBE_MARK.close}`, 'g');
const WHOLE = new RegExp(`^${PROBE_MARK.open}(\\d+)${PROBE_MARK.close}$`);

const substitute = (text: string, values: readonly string[]) => text.replace(MARKS, (_all, index: string) => values[Number(index)] ?? '');

/** An unquoted value is read by YAML as a number, boolean, null or date: it matches when it reads back as the text that was written. */
function looseEqual(actual: unknown, written: string): boolean {
	if (actual === written) return true;
	if (actual === null) return written === '' || written === 'null' || written === '~' || written === 'Null' || written === 'NULL';
	if (actual instanceof Date) return !Number.isNaN(Date.parse(written)) && Date.parse(written) === actual.getTime();
	return typeof actual === 'number' || typeof actual === 'boolean' ? String(actual).toLowerCase() === written.toLowerCase() || Number(written) === actual : false;
}

function matches(actual: unknown, probe: unknown, values: readonly string[]): boolean {
	if (typeof probe === 'string') {
		const whole = WHOLE.exec(probe);
		return whole ? looseEqual(actual, values[Number(whole[1])] ?? '') : actual === substitute(probe, values);
	}
	if (Array.isArray(probe)) return Array.isArray(actual) && actual.length === probe.length && probe.every((item, index) => matches(actual[index], item, values));
	if (probe && typeof probe === 'object') {
		if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
		const expected = Object.entries(probe as Record<string, unknown>).map(([key, value]) => [substitute(key, values), value] as const);
		const keys = Object.keys(actual);
		return keys.length === expected.length && expected.every(([key, value]) => Object.prototype.hasOwnProperty.call(actual, key) && matches((actual as Record<string, unknown>)[key], value, values));
	}
	return plainEqual(actual, probe);
}

/** An empty frontmatter reads as null; anything else must be a plain mapping. */
const emptyOrPlain = (parsed: unknown) => parsed === null || parsed === undefined || isPlainMapping(parsed);

const ANY_MARK = new RegExp(`${PROBE_MARK.open}\\d+${PROBE_MARK.close}`);

/** True when a marker sits inside an anchor (`&name`), alias (`*name`) or type tag (`!tag`): what it stands for cannot be observed there. */
function markerInNodeProperty(yaml: string): boolean {
	for (const match of yaml.matchAll(new RegExp(PROBE_MARK.open, 'g'))) {
		let start = match.index ?? 0;
		while (start > 0 && !/[\s,[\]{}]/.test(yaml[start - 1]!)) start--;
		if ('&*!'.includes(yaml[start]!)) return true;
	}
	return false;
}

function markerInKey(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(markerInKey);
	if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).some(([key, item]) => ANY_MARK.test(key) || markerInKey(item));
	return false;
}

/**
 * Check what a template's frontmatter says after its tokens were filled in, and only accept what can be proven.
 * The real output must always parse. `probed` is the same template with every value in the frontmatter replaced by
 * a marker (`values` holds what each marker stands for): parsed, it tells the structure the template means, and the
 * output must parse to the same structure with each marker's value in place, so a value that breaks the YAML or turns
 * into a different value or structure is caught whatever the quoting looks like. Whenever that proof is not
 * possible the answer is a refusal, never `ok`: the probe does not parse (an alias whose anchor name is a value,
 * for instance), or a value stands in an anchor, alias, type tag or key name.
 */
export function checkFrontmatter(rendered: string, probed: string, values: readonly string[], host: CheckHost, template: TemplateShape): FrontmatterCheck {
	const written = host.split(template.raw);
	const output = host.split(rendered);
	const probe = host.split(probed);
	// The frontmatter must come from the template's own opening fence: a value that produces `---` (or removes it)
	// puts values where nothing tracks them.
	if (written.yaml === undefined) return output.yaml === undefined ? { ok: true } : { ok: false, reason: 'unverifiable' };
	if (output.yaml === undefined || probe.yaml === undefined) return { ok: false, reason: 'unverifiable' };
	// ...and it must end where the template's frontmatter ends: everything after the closing fence is the template's own text.
	if (output.body !== template.expectedBody) return { ok: false, reason: 'unverifiable' };
	let actual: unknown;
	try { actual = host.parse(output.yaml); } catch { return { ok: false, reason: 'invalid' }; }
	// Both trees must be made only of what this plugin can read in full (the shared whitelist); a set, map, date root
	// or class instance could hide content from the key and structure checks below, so it is never compared.
	if (!emptyOrPlain(actual)) return { ok: false, reason: 'unverifiable' };
	// Only a template frontmatter that has no placeholder at all has nothing to prove beyond being valid and plain.
	if (!PLACEHOLDER.test(written.yaml)) return { ok: true };
	if (markerInNodeProperty(probe.yaml)) return { ok: false, reason: 'unverifiable' };
	let expected: unknown;
	try { expected = host.parse(probe.yaml); } catch { return { ok: false, reason: 'unverifiable' }; }
	if (!emptyOrPlain(expected)) return { ok: false, reason: 'unverifiable' };
	if (markerInKey(expected)) return { ok: false, reason: 'unverifiable' };
	return matches(actual ?? null, expected ?? null, values) ? { ok: true } : { ok: false, reason: 'different' };
}
