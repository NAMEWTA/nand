// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { NUMBER_MARK, renderTemplate, type TemplateContext } from './template';

const NUMBER_TOKEN = /\{\{number(?::([^{}]*))?\}\}/g;
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/g;

/** Make generated text usable as a file name: forbidden characters go, and so do leading/trailing dots and spaces. */
export function sanitizeFileName(name: string): string {
	return name.replace(FORBIDDEN, '').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '');
}

export const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const hasNumberToken = (format: string): boolean => /\{\{number(?::[^{}]*)?\}\}/.test(format);

/** The next sequence number for a file name format whose other tokens are already filled in. */
export interface NameSequence { number: number; width: number }

/**
 * Next `{{number}}` for a name pattern (`Note {{number:00}}`): one above the highest number used by an existing
 * name that matches the rest of the pattern, or 1. `width` is the zero padding of the first number token.
 */
export function nextNumber(partlyRendered: string, existingNames: readonly string[]): NameSequence {
	const tokens = [...partlyRendered.matchAll(NUMBER_TOKEN)];
	if (!tokens.length) return { number: 1, width: 0 };
	let pattern = '';
	let last = 0;
	tokens.forEach((token, position) => {
		pattern += escapeRegExp(partlyRendered.slice(last, token.index));
		pattern += position === 0 ? '(\\d+)' : '\\d+';
		last = (token.index ?? 0) + token[0].length;
	});
	pattern += escapeRegExp(partlyRendered.slice(last));
	const regex = new RegExp(`^${pattern}$`);
	let highest = 0;
	for (const name of existingNames) {
		const found = regex.exec(name);
		if (found) highest = Math.max(highest, Number(found[1]));
	}
	return { number: highest + 1, width: tokens[0]?.[1]?.trim().length ?? 0 };
}

export interface GeneratedName { name: string; number?: number }

const MARKED = new RegExp(`${NUMBER_MARK.open}([^${NUMBER_MARK.close}]*)${NUMBER_MARK.close}`);

/**
 * The file name (without extension) a create-note command produces. Everything but `{{number}}` is filled in
 * once, then only the number is added: escaped tokens and answers that look like tokens stay as written.
 * `existingNames` are the names (without extension) already in the target folder.
 */
export function generateName(format: string, context: TemplateContext, existingNames: readonly string[]): GeneratedName {
	const rendered = renderTemplate(format, { ...context, number: undefined, numberPlaceholder: true }).text;
	// split() with a capture group alternates literal text and the arguments of the number tokens.
	const parts = rendered.split(MARKED);
	if (parts.length === 1) return { name: sanitizeFileName(rendered) };
	const literals: string[] = [];
	const widths: number[] = [];
	parts.forEach((part, index) => { if (index % 2 === 0) literals.push(sanitizeLiteral(part)); else widths.push(part.trim().length); });
	// The ends are trimmed exactly as the final name is, so the match sees the names that really exist.
	literals[0] = literals[0]!.replace(/^[\s.]+/, '');
	literals[literals.length - 1] = literals[literals.length - 1]!.replace(/[\s.]+$/, '');
	const pattern = literals.map((literal, index) => escapeRegExp(literal) + (index < widths.length ? (index === 0 ? '(\\d+)' : '\\d+') : '')).join('');
	const regex = new RegExp(`^${pattern}$`);
	let highest = 0;
	for (const name of existingNames) {
		const found = regex.exec(name);
		if (found) highest = Math.max(highest, Number(found[1]));
	}
	const number = highest + 1;
	const name = literals.map((literal, index) => literal + (index < widths.length ? String(number).padStart(widths[index]!, '0') : '')).join('');
	return { name, number };
}

const sanitizeLiteral = (text: string) => text.replace(FORBIDDEN, '').replace(/\s+/g, ' ');
