import { parse, serialize } from '../src/modules/home/core/board/parser';
// Retained baseline logic assertions; renderer behavior is verified against the current React components.
import { strict as assert } from 'node:assert';
import { runHomeReactChecks } from './run-home-react-checks';
import { managedNotes } from './fixtures/managed-notes';
import {
	buildNewNoteProps,
	createNoteWithProps,
	yamlFrontmatter,
} from '../src/modules/home/ui/library/library-new-note';
import type { LibraryConfig } from '../src/modules/home/core/board/types';

const config = (filters: LibraryConfig['filters']): LibraryConfig => ({
	filters,
	viewMode: 'grid',
	sortBy: 'modified',
	sortDesc: true,
});

// Default operator is equals; the first value is written.
{
	const { props, skipped } = buildNewNoteProps(config([{ property: 'status', values: ['进行中', '已完成'] }]));
	assert.deepEqual(props, { status: '进行中' }, 'equals default writes values[0]');
	assert.deepEqual(skipped, [], 'nothing skipped');
}

// contains writes the full value (a substring check passes on the full string).
{
	const { props } = buildNewNoteProps(config([{ property: 'title', values: ['project'], operator: 'contains' }]));
	assert.deepEqual(props, { title: 'project' }, 'contains writes the full value');
}

// notEquals cannot be satisfied by any invented value.
{
	const { props, skipped } = buildNewNoteProps(
		config([{ property: 'status', values: ['已归档'], operator: 'notEquals' }]),
	);
	assert.deepEqual(props, {}, 'notEquals writes nothing');
	assert.deepEqual(skipped, ['status'], 'notEquals reported in skipped');
}

// tags collects into a list; two tags filters merge (each contributes
// values[0]; duplicates are not re-added).
{
	const { props } = buildNewNoteProps(
		config([
			{ property: 'tags', values: ['book'] },
			{ property: 'tags', values: ['reading', 'book'] },
		]),
	);
	assert.deepEqual(props, { tags: ['book', 'reading'] }, 'tags filters merge deduped');
}

// Pseudo-properties with values are skipped (no frontmatter can satisfy them);
// dateRange skips even without values (a fixed window cannot include "now").
{
	const { props, skipped } = buildNewNoteProps(
		config([
			{ property: 'path', values: ['Projects/'] },
			{ property: 'modified', values: [] },
			{ property: 'created', values: [], dateRange: { start: '2024-01-01', end: '2024-12-31' } },
		]),
	);
	assert.deepEqual(props, {}, 'pseudo-properties write nothing');
	assert.deepEqual(skipped, ['path', 'created'], 'path skipped, dateRange skipped');
}

// Empty values without a dateRange are match-all: ignored, not reported.
{
	const { props, skipped } = buildNewNoteProps(
		config([
			{ property: 'status', values: [] },
			{ property: '', values: ['x'] },
		]),
	);
	assert.deepEqual(props, {}, 'match-all and unnamed filters ignored');
	assert.deepEqual(skipped, [], 'match-all not reported');
}

// Duplicate property: the first filter wins; when the picked value cannot
// satisfy the second filter the property is reported (the AND of both would
// otherwise silently keep the note out of the section).
{
	const { props, skipped } = buildNewNoteProps(
		config([
			{ property: 'rating', values: ['5'] },
			{ property: 'rating', values: ['4'] },
		]),
	);
	assert.deepEqual(props, { rating: '5' }, 'first duplicate property wins');
	assert.deepEqual(skipped, ['rating'], 'conflicting duplicate reported');
}

// A duplicate the picked value already satisfies stays quiet (equals OR and
// contains-substring both hold).
{
	const equalsOk = buildNewNoteProps(
		config([
			{ property: 'rating', values: ['5'] },
			{ property: 'rating', values: ['5', '4'] },
		]),
	);
	assert.deepEqual(equalsOk, { props: { rating: '5' }, skipped: [] }, 'satisfied equals duplicate quiet');
	const containsOk = buildNewNoteProps(
		config([
			{ property: 'title', values: ['project'] },
			{ property: 'title', values: ['roj'], operator: 'contains' },
		]),
	);
	assert.deepEqual(containsOk, { props: { title: 'project' }, skipped: [] }, 'satisfied contains duplicate quiet');
}

// Missing config entirely.
{
	assert.deepEqual(buildNewNoteProps(undefined), { props: {}, skipped: [] }, 'no config → empty');
}

console.log('buildNewNoteProps mapping: PASS');

// ---------- 2. yamlFrontmatter ----------

assert.equal(yamlFrontmatter({}), '', 'empty props → empty string');
assert.equal(
	yamlFrontmatter({ status: '进行中', tags: ['book', 'reading'] }),
	['---', '"status": "进行中"', '"tags":', '  - "book"', '  - "reading"', '---', ''].join('\n'),
	'scalar + list rendering with fences',
);
assert.equal(
	yamlFrontmatter({ note: 'he said "hi" \\ done' }),
	'---\n"note": "he said \\"hi\\" \\\\ done"\n---\n',
	'quotes and backslashes escaped',
);
assert.equal(
	yamlFrontmatter({ multiline: 'a\nb\r\nc' }),
	'---\n"multiline": "a b c"\n---\n',
	'newlines flattened to spaces',
);
assert.equal(yamlFrontmatter({ tags: [] }), '---\n"tags": []\n---\n', 'empty list renders inline');

console.log('yamlFrontmatter escaping: PASS');

const makeVaultApp = (existing: Set<string>) => managedNotes({}, existing);
async function verifyCreation() {
	// Parser round-trip: templatePath persists through serialize → parse.
	{
		const md = [
			'---',
			'columns:',
			'  - name: 文案写作',
			'    color: "#6366f1"',
			'    type: folder',
			'    library:',
			'      viewMode: kanban',
			'      sortBy: modified',
			'      sortDesc: true',
			'      templatePath: "Templates/note.md"',
			'---',
			'',
			'## 文案写作',
		].join('\n');
		const parsed = parse(md).columns[0]!.libraryConfig!;
		assert.equal(parsed.templatePath, 'Templates/note.md', 'templatePath parses out of the library block');
		const round = parse(serialize({ ...parse(md), columns: parse(md).columns })).columns[0]!.libraryConfig!;
		assert.equal(round.templatePath, 'Templates/note.md', 'templatePath survives the serialize round-trip');
	}
	{
		const { app, created, mkdirs } = makeVaultApp(new Set());
		const file = await createNoteWithProps(app, ' /Notes/Sub/ ', 'My Note', { status: '进行中' });
		assert.equal(file.path, '.nand/content/Notes/Sub/My Note.md', 'leading/trailing slashes trimmed, .md appended');
		assert.deepEqual(
			mkdirs,
			[
				'.nand',
				'.nand/content',
				'.nand/content/Notes',
				'.nand/content/Notes/Sub',
				'.nand/recovery',
				'.nand/recovery/content-creates',
			],
			'missing folders created in order',
		);
		assert.equal(created.length, 1, 'one vault.create call');
		assert.equal(created[0]!.content, yamlFrontmatter({ status: '进行中' }), 'content is the frontmatter block');
	}

	// Collision appends -2 (base exists, candidate does not).
	{
		const { app, created } = makeVaultApp(new Set(['Notes/T.md']));
		const file = await createNoteWithProps(app, 'Notes', 'T', {});
		assert.equal(file.path, '.nand/content/Notes/T-2.md', 'collision suffixed with -2');
		assert.equal(created[0]!.content, '', 'no props → bare note, no fences');
	}

	// Root folder: no mkdir, file at vault root.
	{
		const { app, created, mkdirs } = makeVaultApp(new Set());
		const file = await createNoteWithProps(app, '', 'Root', {});
		assert.equal(file.path, '.nand/content/Root.md', 'empty folder → vault root');
		assert.deepEqual(
			mkdirs,
			['.nand', '.nand/content', '.nand/recovery', '.nand/recovery/content-creates'],
			'empty preference uses the managed content root',
		);
		assert.equal(created.length, 1, 'created once');
	}

	// Illegal filename characters stripped; empty-after-sanitize title throws.
	{
		const { app, created } = makeVaultApp(new Set());
		const file = await createNoteWithProps(app, 'N', 'a/b:c*', {});
		assert.equal(file.path, '.nand/content/N/abc.md', 'illegal characters stripped');
		await assert.rejects(() => createNoteWithProps(app, 'N', '///', {}), /empty/i, 'blank title rejected');
		assert.equal(created.length, 1, 'rejected title created nothing');
	}

	const makeTplVaultApp = (templates: Record<string, string>) => managedNotes(templates);

	// Template body seeds the note, {{title}} substituted; the template's own
	// frontmatter now MERGES under the filter props (props win collisions).
	{
		const { app, created } = makeTplVaultApp({
			'Templates/note.md':
				'---\ncustom: from-template\nstatus: template-value\n---\n\n# {{title}}\n\n- [ ] first',
		});
		await createNoteWithProps(app, 'N', '新笔记', { status: '进行中' }, 'Templates/note.md');
		assert.equal(
			created[0]!.content,
			'---\n"status": "进行中"\ncustom: from-template\n---\n# 新笔记\n\n- [ ] first\n',
			'body applied + vars substituted, template fm merged (props win)',
		);
	}

	// Real-world shapes: flow-style lists and block values survive byte-for-byte
	// when the props do not touch their keys.
	{
		const { app, created } = makeTplVaultApp({
			'T.md': [
				'---',
				'title: LME 周度工作安排',
				'tags: [LME, 内容生产, 带货视频]',
				'desc: |',
				'  line one',
				'',
				'  line three',
				'---',
				'',
				'Body {{title}}',
			].join('\n'),
		});
		await createNoteWithProps(app, 'N', 'X', { status: '进行中' }, 'T.md');
		assert.equal(
			created[0]!.content,
			[
				'---',
				'"status": "进行中"',
				'title: LME 周度工作安排',
				'tags: [LME, 内容生产, 带货视频]',
				'desc: |',
				'  line one',
				'',
				'  line three',
				'---',
				'Body X',
				'',
			].join('\n'),
			'flow list + block value kept verbatim, blank line inside block preserved',
		);
	}

	// No props + template: the template's frontmatter stands on its own.
	{
		const { app, created } = makeTplVaultApp({ 'T.md': '---\nstatus: draft\n---\nBody {{title}}' });
		await createNoteWithProps(app, 'N', 'X', {}, 'T.md');
		assert.equal(created[0]!.content, '---\nstatus: draft\n---\nBody X\n', 'template fm kept without props');
	}

	// Body-only template (no frontmatter): plain body, no fences.
	{
		const { app, created } = makeTplVaultApp({ 'T.md': 'Body {{title}}' });
		await createNoteWithProps(app, 'N', 'X', {}, 'T.md');
		assert.equal(created[0]!.content, 'Body X\n', 'body-only template, no fences');
	}

	// Extension-less path resolves via the .md fallback; a missing template
	// rejects (view.ts catches and falls back to a bare note + notice).
	{
		const { app, created } = makeTplVaultApp({ 'Templates/note.md': 'b' });
		await createNoteWithProps(app, 'N', 'X', {}, 'Templates/note');
		assert.equal(created.length, 1, 'path without .md resolves the .md file');
		const missing = makeTplVaultApp({});
		await assert.rejects(
			() => createNoteWithProps(missing.app, 'N', 'X', {}, 'nope.md'),
			/Template not found/,
			'missing template rejects',
		);
	}

	// REGRESSION (folder sections): the config saved after FolderConfigModal
}
void verifyCreation()
	.then(() => {
		runHomeReactChecks(['ui/sections/library.dom.test.tsx']);
	})
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
