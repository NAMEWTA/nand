import { expect, test } from 'vitest';
import { parse, serialize } from './parser/parse';
import { splitFrontmatter } from './parser/generate-default-markdown';
import { boardTileSources, boardTiles, persistedBoardTiles } from './board-tiles';
import { readPmConfig, readSkillsConfig } from './p1-config';
import { DEFAULT_DASHBOARD_SETTINGS } from './types/model';
import { parseProjectBody, insertProjectTask, projectBodyTemplate, removeProjectTask } from '../pm/body';
import { togglePipelineTask } from '../pipeline/rules';

test('apex P1 columns keep unknown YAML and personal body while updating project settings', () => {
	const source =
		'---\n# personal\ncustom: preserved\ncolumns:\n  - name: Projects\n    type: pm\n    pm: {rootFolder: Projects, stages: [{label: Design}], unknown: retained}\n  - name: Skills\n    type: skills\n    skills: {pinned: [one], groups: [{id: g, name: Group}], assignments: {one: g}}\n  - name: Flow\n    type: pipeline\n    pipeline: {rootFolder: Notes, statusField: status, stages: [{value: draft, label: Draft, color: "#abcdef"}]}\n---\n\n## Projects\n\n## Skills\n\n## Flow\n\n<!-- keep me -->\n';
	const data = parse(source);
	expect(data.columns.map((c) => c.sectionType)).toEqual(['pm', 'skills', 'pipeline']);
	expect(data.columns[0]?.pmConfig?.stages).toEqual([{ label: 'Design', color: undefined }]);
	expect(data.columns[1]?.skillsConfig?.assignments).toEqual({ one: 'g' });
	expect(data.columns[2]?.pipelineConfig?.stages[0]?.color).toBe('#abcdef');
	expect(serialize(data)).toBe(source);
	data.columns[0]!.pmConfig!.sortMode = 'keyDate';
	const saved = serialize(data),
		raw = splitFrontmatter(saved).frontmatter;
	expect(saved).toContain('# personal');
	expect(saved).toContain('<!-- keep me -->');
	expect(raw.custom).toBe('preserved');
	expect((raw.columns as Array<{ pm?: Record<string, unknown> }>)[0]?.pm?.unknown).toBe('retained');
	expect(parse(saved).columns[0]?.pmConfig?.sortMode).toBe('keyDate');
});

test('apex presentation keys identify a widget, section and standalone sticky card exactly once', () => {
	const data = parse(
		'---\nlayout: immersive\ncolumns: [{name: Sticky, type: sticky}, {name: Data, type: dataview}]\nimmersive: [{id: "widget:weather", w: 3, cap: 20, x: 0, y: 0}, {id: "section:Data", w: 6, cap: 40, x: 3, y: 0}, {id: "card:c1", w: 3, cap: 20, x: 9, y: 0}]\n---\n\n## Sticky\n\n### Memo\nid: c1\nbody\n\n## Data\n',
	);
	const members = [{ memberId: 'private-id', provider: 'home', kind: 'weather', instanceId: 'default' }];
	const sources = boardTileSources(data, members);
	expect(sources.map((s) => s.id)).toEqual(['widget:weather', 'card:c1', 'section:Data']);
	expect(sources.some((s) => s.type === 'missing')).toBe(false);
	const saved = persistedBoardTiles(boardTiles(data, sources));
	expect(saved.find((t) => t.id === 'section:Data')).toMatchObject({ x: 3, y: 0, w: 6, cap: 40 });
});

test('project milestones and todos preserve line identity and refuse stale task toggles', () => {
	const raw =
		'---\ntype: project\n---\n\n' +
		projectBodyTemplate(['Design', 'Acceptance']) +
		'\n- [ ] Finish\n\n## Personal\nUntouched\n';
	const body = parseProjectBody(raw);
	expect(body.milestones).toHaveLength(2);
	expect(body.todos).toHaveLength(1);
	const toggled = togglePipelineTask(raw, body.milestones[0]!, true);
	expect(parseProjectBody(toggled).milestones[0]?.checked).toBe(true);
	expect(() => togglePipelineTask(raw.replace('Design', 'External edit'), body.milestones[0]!, true)).toThrow();
	const added = insertProjectTask(toggled, 'todo', 'Review');
	expect(parseProjectBody(added).todos.map((t) => t.text)).toEqual(['Finish', 'Review']);
	expect(added).toContain('## Personal\nUntouched');
	expect(removeProjectTask(added, 0)).toBe(added);
});

test('P1 config readers bound settings and reject malformed collection entries', () => {
	expect(
		readPmConfig({ stages: [null, { label: 'Build' }, {}], skills: [false], excludeFolders: ['private', 10] }),
	).toMatchObject({ stages: [{ label: 'Build' }], skills: [], excludeFolders: ['private'] });
	expect(
		readSkillsConfig({
			pageSize: 1e6,
			groups: [{}, null, { id: 'a', name: 'A' }],
			assignments: { one: 'a', two: false },
		}),
	).toMatchObject({ pageSize: 50, groups: [{ id: 'a', name: 'A' }], assignments: { one: 'a' } });
});
