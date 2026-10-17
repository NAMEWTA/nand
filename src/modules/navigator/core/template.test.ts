// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import '../../../../scripts/navigator-test-moment';
import { expect, test } from 'vitest';
import { collectPromptLabels, renderTemplate, type TemplateContext } from './template';

const context = (extra: Partial<TemplateContext> = {}): TemplateContext => ({
	title: 'Weekly sync',
	folder: 'Meetings',
	path: 'Meetings/Weekly sync.md',
	noteDate: new Date(2026, 9, 15),
	dateFormat: 'YYYY-MM-DD',
	todayFormat: 'YYYY-MM-DD',
	timeFormat: 'HH:mm',
	now: new Date(2026, 9, 15, 9, 30, 5),
	weekStart: 1,
	locale: 'en',
	...extra,
});
const render = (template: string, extra?: Partial<TemplateContext>) => renderTemplate(template, context(extra)).text;

test('title, folder and path', () => {
	expect(render('{{title}} in {{folder}} at {{path}}')).toBe('Weekly sync in Meetings at Meetings/Weekly sync.md');
});

test('date tokens with formats and offsets', () => {
	expect(render('{{date}}')).toBe('2026-10-15');
	expect(render('{{date:dddd, MMMM D}}')).toBe('Thursday, October 15');
	expect(render('{{date+1d}} {{date-2w:YYYY-MM-DD}} {{date+1M}} {{date-1y}} {{date+1Q:MM}}')).toBe('2026-10-16 2026-10-01 2026-11-15 2025-10-15 01');
	expect(render('{{date+36h:YYYY-MM-DD HH}}')).toBe('2026-10-16 12');
	expect(render('{{yesterday}} {{tomorrow:DD}}')).toBe('2026-10-14 16');
});

test('periodic notes format {{date}} with their pattern', () => {
	expect(render('{{date}}', { dateFormat: 'gggg-[W]ww', noteDate: new Date(2026, 9, 12) })).toBe('2026-W42');
});

test('weekday tokens use the week of the note date', () => {
	expect(render('{{monday}} {{sunday:DD}} {{thursday:ddd}}')).toBe('2026-10-12 18 Thu');
	expect(render('{{sunday}}', { weekStart: 0 })).toBe('2026-10-11');
});

test('weekly notes list seven days starting at the note date', () => {
	const weekly = { noteDate: new Date(2026, 9, 12), weekDaysFromNoteDate: true, weekStart: 0 as const };
	expect(render('{{monday}} {{sunday}}', weekly)).toBe('2026-10-12 2026-10-18');
});

test('time, today and now', () => {
	expect(render('{{time}} {{time:h:mm a}}')).toBe('09:30 9:30 am');
	expect(render('{{today}} {{today:YYYY}}')).toBe('2026-10-15 2026');
	expect(render('{{now:YYYY-MM-DD[T]HH:mm}}')).toBe('2026-10-15T09:30');
	expect(render('{{now}}')).toMatch(/^2026-10-15T09:30:05[+-]\d\d:\d\d$/);
});

test('cursor is removed and its offset reported', () => {
	const result = renderTemplate('- [ ] {{cursor}}\n\nend', context());
	expect(result.text).toBe('- [ ] \n\nend');
	expect(result.cursor).toBe(6);
	expect(renderTemplate('plain', context()).cursor).toBeUndefined();
});

test('prompt and value tokens use the answers, with Value as default label', () => {
	expect(render('{{prompt:Title}} / {{value:Title}} / {{prompt}}', { values: { Title: 'Sync', Value: 'x' } })).toBe('Sync / Sync / x');
	expect(render('{{prompt:Missing}}', { values: {} })).toBe('');
});

test('collects each prompt label once, skipping escaped tokens', () => {
	expect(collectPromptLabels('{{prompt:Title}} {{value:Title}} {{prompt:Project}}', '{{!prompt:Hidden}} {{prompt}}')).toEqual(['Title', 'Project', 'Value']);
});

test('number tokens pad to the length of the format and stay when no number is known', () => {
	expect(render('{{number}} {{number:000}}', { number: 7 })).toBe('7 007');
	expect(render('Note {{number:00}}')).toBe('Note {{number:00}}');
});

test('unknown tokens stay as written and {{!token}} keeps the token as text', () => {
	expect(render('{{unknown}} {{foo:bar}} {{ date }} {{!date}} {{!date:YYYY}} {{!bogus}}')).toBe('{{unknown}} {{foo:bar}} {{ date }} {{date}} {{date:YYYY}} {{!bogus}}');
});

test('frontmatter values are escaped for their quote style', () => {
	const values = { Title: 'He said "hi" \\ it\'s' };
	expect(render('---\ntitle: "{{prompt:Title}}"\n---\n', { values })).toBe('---\ntitle: "He said \\"hi\\" \\\\ it\'s"\n---\n');
	expect(render("---\ntitle: '{{prompt:Title}}'\n---\n", { values })).toBe("---\ntitle: 'He said \"hi\" \\ it''s'\n---\n");
	expect(render('---\ntitle: {{prompt:Title}}\n---\n', { values })).toBe('---\ntitle: He said "hi" \\ it\'s\n---\n');
	expect(render('---\naliases:\n  - "{{title}}"\n---\n', { title: 'a"b' })).toBe('---\naliases:\n  - "a\\"b"\n---\n');
});

test('values in the body are not escaped, and a closed quote ends the quoted span', () => {
	expect(render('"{{prompt:Title}}"', { values: { Title: 'a"b' } })).toBe('"a"b"');
	expect(render('---\nk: "x" {{title}}\n---', { title: 'a"b' })).toBe('---\nk: "x" a"b\n---');
});

test('weekday tokens use the general date format, not the file name pattern of a weekly note', () => {
	const weekly = { noteDate: new Date(2026, 9, 12), dateFormat: 'GGGG-[W]WW', todayFormat: 'YYYY-MM-DD', weekDaysFromNoteDate: true };
	expect(render('{{monday}} {{sunday}} {{date}} {{monday:DD}}', weekly)).toBe('2026-10-12 2026-10-18 2026-W42 12');
});

test('a quoted YAML value that continues on the next line is escaped on every line', () => {
	const values = { Title: 'a"b\\c' };
	expect(render('---\ntitle: "prefix\n  {{prompt:Title}}"\nnext: "{{prompt:Title}}"\n---\n', { values })).toBe('---\ntitle: "prefix\n  a\\"b\\\\c"\nnext: "a\\"b\\\\c"\n---\n');
	expect(render("---\ntitle: 'one\n  {{prompt:Title}}'\n---\n", { values: { Title: "it's" } })).toBe("---\ntitle: 'one\n  it''s'\n---\n");
	// a list item and a flow sequence
	expect(render('---\naliases:\n  - "{{prompt:Title}}"\ntags: ["x", "{{prompt:Title}}"]\n---\n', { values: { Title: 'q"' } })).toBe('---\naliases:\n  - "q\\""\ntags: ["x", "q\\""]\n---\n');
	// after the quote closes the text is plain again, also across lines
	expect(render('---\nk: "x"\nplain: {{prompt:Title}}\n---\n', { values: { Title: 'a"b' } })).toBe('---\nk: "x"\nplain: a"b\n---\n');
});

test('values never contain the number marker characters', () => {
	expect(render('{{prompt:Title}}', { values: { Title: 'a\uE000b\uE001' } })).toBe('ab');
});

test('YAML comments and block scalars do not change how a value is escaped', () => {
	const values = { Title: 'a"b' };
	// a quote inside a comment is not a quote
	expect(render('---\n# comment: "\ntitle: "{{prompt:Title}}"\n---\n', { values })).toBe('---\n# comment: "\ntitle: "a\\"b"\n---\n');
	expect(render('---\ntitle: "x" # it\'s "fine\nnext: "{{prompt:Title}}"\n---\n', { values })).toBe('---\ntitle: "x" # it\'s "fine\nnext: "a\\"b"\n---\n');
	// a quote inside a block scalar is text
	expect(render('---\nexample: |\n  "\n  more\ntitle: "{{prompt:Title}}"\n---\n', { values })).toBe('---\nexample: |\n  "\n  more\ntitle: "a\\"b"\n---\n');
	expect(render('---\nlist:\n  - >-\n    it\'s\ntitle: "{{prompt:Title}}"\n---\n', { values })).toBe('---\nlist:\n  - >-\n    it\'s\ntitle: "a\\"b"\n---\n');
	// text written in a comment or a block scalar is not escaped, because it is not a quoted value
	expect(render('---\nnote: |\n  {{prompt:Title}}\n# {{prompt:Title}}\n---\n', { values })).toBe('---\nnote: |\n  a"b\n# a"b\n---\n');
	// a # inside a quoted value or glued to a word is not a comment
	expect(render('---\ntitle: "a # {{prompt:Title}}"\nurl: x#y "{{prompt:Title}}"\n---\n', { values })).toBe('---\ntitle: "a # a\\"b"\nurl: x#y "a"b"\n---\n');
});

test('quotes only open where a YAML value starts: anchors, type tags and plain scalars are handled', () => {
	const values = { Title: 'a"b' };
	expect(render('---\ntitle: &keep "{{prompt:Title}}"\n---\n', { values })).toBe('---\ntitle: &keep "a\\"b"\n---\n');
	expect(render('---\ntitle: !!str "{{prompt:Title}}"\n---\n', { values })).toBe('---\ntitle: !!str "a\\"b"\n---\n');
	expect(render("---\nexample: foo-'bar\ntitle: \"{{prompt:Title}}\"\n---\n", { values })).toBe("---\nexample: foo-'bar\ntitle: \"a\\\"b\"\n---\n");
	expect(render("---\nnote: it, 'x'\ntitle: \"{{prompt:Title}}\"\n---\n", { values })).toBe("---\nnote: it, 'x'\ntitle: \"a\\\"b\"\n---\n");
	expect(render('---\nlist: [one, "{{prompt:Title}}", {k: "{{prompt:Title}}"}]\n---\n', { values })).toBe('---\nlist: [one, "a\\"b", {k: "a\\"b"}]\n---\n');
	// text inside a plain scalar is not a quoted value, so nothing is escaped there
	expect(render("---\nplain: x'{{prompt:Title}}'\n---\n", { values })).toBe("---\nplain: x'a\"b'\n---\n");
});
