// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import '../../../../scripts/navigator-test-moment';
import { parse } from 'yaml';
import { expect, test } from 'vitest';
import { checkFrontmatter } from './template-check';
import { renderTemplate, type TemplateContext } from './template';

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const host = {
	parse: (text: string) => parse(text) as unknown,
	split: (text: string) => { const found = FRONT.exec(text); return found ? { yaml: found[1]!, body: text.slice(found[0].length) } : { yaml: undefined, body: text }; },
};

/** What the factory computes: the template's own text after its frontmatter, filled in on its own. */
const shapeOf = (template: string, filled: TemplateContext) => ({ raw: template, expectedBody: renderTemplate(`\n${host.split(template).body}`, filled).text.slice(1) });

const context = (values: Record<string, string>, extra: Partial<TemplateContext> = {}): TemplateContext => ({
	title: 'Note', folder: 'F', path: 'F/Note.md', noteDate: new Date(2026, 9, 15), dateFormat: 'YYYY-MM-DD', todayFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm', now: new Date(2026, 9, 15, 9, 30), weekStart: 1, locale: 'en', values, ...extra,
});

/** Render a template the way the factory does and report whether its frontmatter would be accepted. */
function verdict(template: string, values: Record<string, string>) {
	const filled = context(values);
	const rendered = renderTemplate(template, filled).text;
	const probe: string[] = [];
	const probed = renderTemplate(template, { ...filled, probe }).text;
	return { rendered, check: checkFrontmatter(rendered, probed, probe, host, shapeOf(template, filled)) };
}

const ok = (template: string, values: Record<string, string>) => expect(verdict(template, values).check).toEqual({ ok: true });
const refused = (template: string, values: Record<string, string>) => expect(verdict(template, values).check.ok).toBe(false);

test('common quoted values are escaped and accepted, whatever the answer holds', () => {
	for (const answer of ['plain', 'a"b', "it's", 'back\\slash', 'both "x" and \'y\'', 'colon: here', 'hash # here', '- dash', '[x]', '{y}', '', '  spaced  ', '日本語']) {
		ok('---\ntitle: "{{prompt:Title}}"\n---\nbody', { Title: answer });
		ok("---\ntitle: '{{prompt:Title}}'\n---\nbody", { Title: answer });
	}
});

test('the shapes found in review are handled: anchors, type tags, plain scalars with quotes, comments, block scalars', () => {
	const answer = { Title: 'a"b' };
	ok('---\ntitle: &keep "{{prompt:Title}}"\n---\n', answer);
	ok('---\ntitle: !!str "{{prompt:Title}}"\n---\n', answer);
	ok("---\nexample: foo-'bar\ntitle: \"{{prompt:Title}}\"\n---\n", answer);
	ok('---\n# comment: "\ntitle: "{{prompt:Title}}"\n---\n', answer);
	ok('---\nexample: |\n  "\ntitle: "{{prompt:Title}}"\n---\n', answer);
	ok('---\ntitle: "x" # it\'s "fine\nnext: "{{prompt:Title}}"\n---\n', answer);
	ok('---\ntitle: "prefix\n  {{prompt:Title}}"\n---\n', answer);
	ok('---\naliases:\n  - "{{prompt:Title}}"\ntags: ["x", "{{prompt:Title}}"]\n---\n', answer);
});

test('values that stay plain scalars are accepted when they read back as written', () => {
	ok('---\nid: {{prompt:Id}}\nwhen: {{today:YYYY-MM-DD}}\nflag: {{prompt:Flag}}\n---\n', { Id: '42', Flag: 'true' });
	ok('---\nfrom: {{folder}}\npath: {{path}}\n---\n', {});
	ok('---\nempty: {{prompt:Empty}}\n---\n', { Empty: '' });
});

test('a value that would break or change the YAML is refused instead of being written', () => {
	// unquoted: a colon starts a mapping, a quote starts a string, a line break ends the value
	refused('---\ntitle: {{prompt:Title}}\n---\n', { Title: 'a: b' });
	refused('---\ntitle: {{prompt:Title}}\n---\n', { Title: '"unterminated' });
	refused('---\ntitle: {{prompt:Title}}\n---\n', { Title: 'line one\nextra: injected' });
	refused('---\ntitle: {{prompt:Title}}\n---\n', { Title: '- a\n- b' });
	// a value that forms a different structure in a flow sequence
	refused('---\ntags: [{{prompt:Tag}}, other]\n---\n', { Tag: 'a, b' });
	// a comment marker turning the rest of the line into a comment
	refused('---\ntitle: x {{prompt:Title}} y\n---\n', { Title: '#' });
	// injecting a second key through a line break inside a quoted value is escaped, so this one is fine
	ok('---\ntitle: "{{prompt:Title}}"\n---\n', { Title: 'line one\nextra: injected' });
});

test('invalid output is reported as invalid, a different meaning as different', () => {
	expect(verdict('---\ntitle: {{prompt:T}}\n---\n', { T: '"x' }).check).toEqual({ ok: false, reason: 'invalid' });
	expect(verdict('---\ntitle: {{prompt:T}}\n---\n', { T: 'x # y' }).check).toEqual({ ok: false, reason: 'different' });
	expect(verdict('---\ntitle: {{prompt:T}}\n---\n', { T: 'a: b' }).check).toEqual({ ok: false, reason: 'invalid' });
});

test('a frontmatter that does not parse is always refused, even when nothing was substituted in it', () => {
	expect(verdict('---\n: [broken {{prompt:T}}\n---\n', { T: 'x' }).check.ok).toBe(false);
	expect(verdict('---\nbroken: [one\n---\nbody', {}).check).toEqual({ ok: false, reason: 'invalid' });
	// no frontmatter at all, and text outside the frontmatter, never matter
	ok('no frontmatter {{prompt:T}}', { T: 'a"b: c' });
	ok('---\ntitle: "x"\n---\n{{prompt:T}} "quotes" : colons', { T: 'a"b: c' });
	// valid frontmatter without any substitution is fine
	ok('---\ntitle: fixed\n---\nbody', {});
});

test('values in key names, anchors, aliases and type tags cannot be proven and are refused', () => {
	for (const template of ['---\n"{{prompt:K}}": 1\n---\n', '---\n{{prompt:K}}: 1\n---\n', '---\nbase: &{{prompt:K}} original\nother: 1\n---\n', '---\nbase: !{{prompt:K}} original\n---\n', '---\nbase: !!{{prompt:K}} original\n---\n']) {
		expect(verdict(template, { K: 'safe' }).check, template).toMatchObject({ ok: false, reason: 'unverifiable' });
	}
});

test('an alias named by a value is refused whether the answer is safe or not (the probe cannot keep the anchor)', () => {
	const template = '---\nbase: &keep original\nalias: *{{prompt:A}}\ntitle: {{prompt:T}}\n---\nBody';
	expect(verdict(template, { A: 'keep', T: 'safe' }).check).toMatchObject({ ok: false, reason: 'unverifiable' });
	// an unsafe title is refused too, not waved through
	expect(verdict(template, { A: 'keep', T: 'a: b' }).check.ok).toBe(false);
	expect(verdict(template, { A: 'keep', T: 'important # retained' }).check.ok).toBe(false);
	// the same prompt used for the anchor and for the alias is asked once but marked twice: still refused
	const matched = '---\nbase: &{{prompt:A}} original\nalias: *{{prompt:A}}\ntitle: {{prompt:T}}\n---\nBody';
	expect(verdict(matched, { A: 'keep', T: 'safe' }).check).toMatchObject({ ok: false, reason: 'unverifiable' });
	expect(verdict(matched, { A: 'keep', T: 'important # retained' }).check.ok).toBe(false);
});

test('an alias that is written in the template itself, with its values elsewhere, still works', () => {
	ok('---\nbase: &keep original\nalias: *keep\ntitle: "{{prompt:T}}"\n---\nBody', { T: 'a"b' });
	refused('---\nbase: &keep original\nalias: *keep\ntitle: {{prompt:T}}\n---\nBody', { T: 'a: b' });
	refused('---\nbase: &keep original\nalias: *keep\ntitle: {{prompt:T}}\n---\nBody', { T: 'important # retained' });
});

// The reader Obsidian uses returns real Set/Map/Date values for YAML 1.1 types; so does the yaml package with this schema.
const host11 = { ...host, parse: (text: string) => parse(text, { schema: 'yaml-1.1' }) as unknown };
function verdict11(template: string, values: Record<string, string>) {
	const filled = context(values);
	const rendered = renderTemplate(template, filled).text;
	const probe: string[] = [];
	const probed = renderTemplate(template, { ...filled, probe }).text;
	return checkFrontmatter(rendered, probed, probe, host11, shapeOf(template, filled));
}

test('a set, map or date anywhere in either tree is never compared as "an object with no entries": unverifiable', () => {
	// a key built from a value inside a set: safe answer, and an answer that turns one entry into two
	expect(verdict11('---\nitems: !!set { {{prompt:T}}: null }\n---\n', { T: 'safe' })).toEqual({ ok: false, reason: 'unverifiable' });
	expect(verdict11('---\nitems: !!set { {{prompt:T}}: null }\n---\n', { T: 'a: null, b' })).toEqual({ ok: false, reason: 'unverifiable' });
	// a value in an ordered map cut short by a comment marker
	expect(verdict11('---\nitems: !!omap\n  - name: {{prompt:T}}\n---\nBody', { T: 'important # retained' })).toEqual({ ok: false, reason: 'unverifiable' });
	expect(verdict11('---\nitems: !!omap\n  - name: {{prompt:T}}\n---\nBody', { T: 'safe' })).toEqual({ ok: false, reason: 'unverifiable' });
	// a timestamp root and a set root are refused with or without substitutions
	expect(verdict11('---\n!!timestamp 2026-10-17\n---\nBody', {})).toEqual({ ok: false, reason: 'unverifiable' });
	expect(verdict11('---\n!!set {important: null}\n---\nBody', {})).toEqual({ ok: false, reason: 'unverifiable' });
	expect(verdict11('---\n!!timestamp {{prompt:T}}\n---\nBody', { T: '2026-10-17' })).toEqual({ ok: false, reason: 'unverifiable' });
	// a plain mapping with a date value is still fine
	expect(verdict11('---\nwhen: {{today:YYYY-MM-DD}}\ntitle: "{{prompt:T}}"\n---\nBody', { T: 'a"b' })).toEqual({ ok: true });
});

test('the output tree is checked as well as the probe tree', () => {
	// the template reads as plain data with the markers, but the real output turns into a set
	expect(verdict11('---\nitems: {{prompt:T}}\n---\n', { T: '!!set {a: null}' })).toMatchObject({ ok: false });
});

test('a frontmatter that a value creates or moves is refused: the template must open and close it itself', () => {
	// the values make the fence: the template has no literal frontmatter, the output does
	const dynamic = '{{prompt:Start}}\ntitle: {{prompt:T}}\n---\nBody';
	expect(verdict(dynamic, { Start: '---', T: 'important # retained' }).check).toEqual({ ok: false, reason: 'unverifiable' });
	expect(verdict(dynamic, { Start: '---', T: 'safe' }).check).toEqual({ ok: false, reason: 'unverifiable' });
	expect(verdict('{{prompt:Start}}\n"{{prompt:K}}": fixed\n---\nBody', { Start: '---', K: 'safe' }).check).toEqual({ ok: false, reason: 'unverifiable' });
	// without the opening fence nothing is a frontmatter and nothing needs checking
	expect(verdict(dynamic, { Start: 'x', T: 'whatever' }).check).toEqual({ ok: true });
	// a value that removes the opening fence
	expect(verdict('{{prompt:A}}---\ntitle: x\n---\nBody', { A: 'x' }).check).toEqual({ ok: true });
	expect(verdict('---\ntitle: x\n---\nBody', {}).check).toEqual({ ok: true });
	// a value that moves the closing fence (a block scalar can hold line breaks)
	expect(verdict('---\nnote: |\n  {{prompt:T}}\n---\nBody', { T: 'x\n---\nextra: injected' }).check).toEqual({ ok: false, reason: 'unverifiable' });
	expect(verdict('---\nnote: |\n  {{prompt:T}}\n---\nBody {{prompt:T}}', { T: 'plain' }).check).toEqual({ ok: true });
	// controls: with the literal fence the same answers are judged on their merits
	expect(verdict('---\ntitle: {{prompt:T}}\n---\nBody', { T: 'important # retained' }).check).toEqual({ ok: false, reason: 'different' });
	expect(verdict('---\ntitle: "{{prompt:T}}"\n---\nBody', { T: 'important # retained' }).check).toEqual({ ok: true });
});

test('only a template frontmatter without any placeholder skips the comparison, not an empty list of values', () => {
	// an unknown token is left as written: it is a placeholder in the frontmatter, so the output is compared with the probe
	expect(verdict('---\ntitle: {{unknown}}\n---\nBody', {}).check).toEqual({ ok: true });
	expect(verdict('---\ntitle: fixed\n---\nBody {{prompt:T}}', { T: 'a: b' }).check).toEqual({ ok: true });
});
