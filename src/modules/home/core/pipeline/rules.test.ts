import { expect, test } from 'vitest';
import { emptyPipeline, type PipelineConfig, type PipelineNote } from './model';
import { pipelineConfigError, pipelineDestination, pipelineIncludes, pipelinePath, pipelineTasks, projectPipeline, togglePipelineTask } from './rules';

const config = (): PipelineConfig => ({ ...emptyPipeline(), rootFolder: 'Work', stages: [{ id: 'draft', label: 'Draft', value: 'Draft' }, { id: 'review', label: 'Review', value: 'Review', folder: 'Review' }], archiveFolder: 'Archive', excludeFolders: ['Work/Templates'] });
const note = (path = 'Work/A.md', status = ' Draft '): PipelineNote => ({ path, title: path.split('/').pop()!, mtime: 1, ctime: 1, frontmatter: { status } });

test('scope and preflight reject traversal/absolute roots, duplicate stages and unrelated notes', () => {
	const cfg = config();
	for (const path of ['../Work', '/Work', 'C:/Work', 'Work/../Outside', 'Work//Review', '.']) expect(pipelinePath(path)).toBeUndefined();
	expect(pipelineIncludes(cfg, note())).toBe(true);
	for (const other of [note('Else/A.md'), note('Work/Templates/A.md'), note('Work/A.md', 'unknown')]) expect(pipelineIncludes(cfg, other)).toBe(false);
	expect(pipelineDestination(cfg, 'Work/A.md', cfg.stages[0]!)).toBe('Work/A.md');
	expect(pipelineDestination(cfg, 'Work/A.md', cfg.stages[1]!)).toBe('Work/Review/A.md');
	expect(pipelineDestination(cfg, 'Work/A.md', 'archive')).toBe('Archive/A.md');
	expect(() => pipelineDestination(cfg, 'Else/A.md', cfg.stages[1]!)).toThrow();
	expect(pipelineConfigError({ ...cfg, stages: [...cfg.stages, { id: 'duplicate', label: 'Duplicate', value: ' draft ' }] })).toBe('stages');
	expect(() => pipelineDestination({ ...cfg, stages: [{ ...cfg.stages[0]!, folder: '../Else' }] }, 'Work/A.md', cfg.stages[0]!)).toThrow();
});

test('filter/sort precede global cap and each stage retains full matching counts', () => {
	const cfg = config(), notes = Array.from({ length: 550 }, (_, i) => ({ ...note(`Work/${i}.md`, i % 2 ? 'review' : 'draft'), mtime: i, frontmatter: { status: i % 2 ? 'review' : 'draft', channel: [i < 500 ? 'old' : 'recent'] } }));
	const projection = projectPipeline(cfg, notes);
	expect(projection.total).toBe(550); expect(projection.truncated).toBe(true);
	expect(projection.stages.map(row => row.total)).toEqual([275, 275]);
	expect(projection.stages.flatMap(row => row.notes)).toHaveLength(500);
	const filtered = projectPipeline({ ...cfg, filterFields: ['channel'], filters: { channel: 'RECENT' } }, notes);
	expect(filtered.total).toBe(50); expect(filtered.truncated).toBe(false);
	expect(filtered.stages[0]!.notes[0]!.path).toBe('Work/548.md');
});

test('task toggles re-find shifted text, preserve CRLF and refuse ambiguous/changed tasks', () => {
	const raw = '---\r\nstatus: Draft\r\n---\r\n```md\r\n- [ ] sample\r\n```\r\n# Note\r\n- [ ] Actual [due:: 2026-10-11]\r\n';
	const tasks = pipelineTasks(raw); expect(tasks).toHaveLength(1);
	const shifted = raw.replace('# Note', '# Changed\r\nNew text');
	expect(togglePipelineTask(shifted, tasks[0]!, true)).toBe(shifted.replace('- [ ] Actual', '- [x] Actual'));
	expect(() => togglePipelineTask(raw.replace('Actual', 'Edited'), tasks[0]!, true)).toThrow();
	expect(() => togglePipelineTask(raw + tasks[0]!.originalLine + '\n', tasks[0]!, true)).toThrow();
	const prefixed = '\uFEFF\r\n---\r\nexample: |\r\n  - [ ] Metadata\r\n---\r\n- [ ] Real task\r\n';
	const actual = pipelineTasks(prefixed); expect(actual).toHaveLength(1);
	expect(togglePipelineTask(prefixed, actual[0]!, true)).toBe(prefixed.replace('- [ ] Real task', '- [x] Real task'));
});
