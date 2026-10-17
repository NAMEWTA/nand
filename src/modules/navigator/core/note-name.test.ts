// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import '../../../../scripts/navigator-test-moment';
import { expect, test } from 'vitest';
import { generateName, nextNumber, sanitizeFileName } from './note-name';
import type { TemplateContext } from './template';

const context = (values: Record<string, string> = {}): TemplateContext => ({
	title: '',
	folder: 'Notes',
	path: '',
	noteDate: new Date(2026, 8, 16),
	dateFormat: 'YYYY-MM-DD',
	todayFormat: 'YYYY-MM-DD',
	timeFormat: 'HH:mm',
	now: new Date(2026, 8, 16, 10),
	weekStart: 1,
	locale: 'en',
	values,
});

test('sanitizes generated names', () => {
	expect(sanitizeFileName('  a/b:c*d?"e"<f>|g#h^i[j]k  ')).toBe('abcdefghijk');
	expect(sanitizeFileName('.hidden. ')).toBe('hidden');
	expect(sanitizeFileName('a    b')).toBe('a b');
});

test('numbers continue after the highest used one', () => {
	expect(nextNumber('Note {{number:00}}', [])).toEqual({ number: 1, width: 2 });
	expect(nextNumber('Note {{number:00}}', ['Note 01', 'Note 02', 'Note 10', 'Other 99', 'Note 3x'])).toEqual({ number: 11, width: 2 });
	// a gap is left alone, the highest number is reused after deleting it
	expect(nextNumber('Note {{number}}', ['Note 1', 'Note 5'])).toEqual({ number: 6, width: 0 });
	expect(nextNumber('Note {{number}}', ['Note 1'])).toEqual({ number: 2, width: 0 });
	expect(nextNumber('plain', ['plain'])).toEqual({ number: 1, width: 0 });
});

test('regex characters in the pattern are literal', () => {
	expect(nextNumber('Task (a.b) {{number}}', ['Task (a.b) 4', 'Task (aXb) 9'])).toEqual({ number: 5, width: 0 });
});

test('names with prompts, dates and numbers', () => {
	const result = generateName('{{date:YYYYMMDD}} {{prompt:Title}}', context({ Title: 'Weekly sync' }), []);
	expect(result).toEqual({ name: '20260916 Weekly sync' });
	expect(generateName('Note {{number:00}}', context(), ['Note 01', 'Note 02'])).toEqual({ name: 'Note 03', number: 3 });
});

test('each prompt value keeps its own sequence', () => {
	const existing = ['Alpha 001', 'Alpha 002', 'Beta 001'];
	expect(generateName('{{prompt:Project}} {{number:000}}', context({ Project: 'Alpha' }), existing)).toEqual({ name: 'Alpha 003', number: 3 });
	expect(generateName('{{prompt:Project}} {{number:000}}', context({ Project: 'Beta' }), existing)).toEqual({ name: 'Beta 002', number: 2 });
	expect(generateName('{{prompt:Project}} {{number:000}}', context({ Project: 'Gamma' }), existing)).toEqual({ name: 'Gamma 001', number: 1 });
});

test('forbidden characters from prompts do not break the sequence match', () => {
	expect(generateName('{{prompt:Project}} {{number}}', context({ Project: 'A/B' }), ['AB 1', 'AB 2'])).toEqual({ name: 'AB 3', number: 3 });
});

test('an escaped token in a numbered name stays as written', () => {
	expect(generateName('{{!date}} {{number:00}}', context(), [])).toEqual({ name: '{{date}} 01', number: 1 });
	expect(generateName('{{!date}} {{number:00}}', context(), ['{{date}} 01'])).toEqual({ name: '{{date}} 02', number: 2 });
});

test('an answer that looks like a token is not interpreted, with or without a number', () => {
	expect(generateName('{{prompt:Title}} {{number}}', context({ Title: '{{date}}' }), [])).toEqual({ name: '{{date}} 1', number: 1 });
	expect(generateName('{{prompt:Title}}', context({ Title: '{{date}}' }), [])).toEqual({ name: '{{date}}' });
	expect(generateName('{{prompt:Title}} {{number}}', context({ Title: '{{number:00}}' }), [])).toEqual({ name: '{{number00}} 1', number: 1 });
});

test('the sequence is matched against the names exactly as they are written to disk', () => {
	// a leading space in the answer disappears from the file name, so the existing "Note 02" counts
	expect(generateName('{{prompt:P}} {{number:00}}', context({ P: ' Note' }), ['Note 01', 'Note 02'])).toEqual({ name: 'Note 03', number: 3 });
	expect(generateName('{{prompt:P}}.{{number}}', context({ P: 'Name.' }), ['Name..4'])).toEqual({ name: 'Name..5', number: 5 });
	expect(generateName('{{number}} {{prompt:P}} ', context({ P: 'x' }), ['3 x'])).toEqual({ name: '4 x', number: 4 });
});
