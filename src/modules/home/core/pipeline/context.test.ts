import { expect, test } from 'vitest';
import { emptyPipeline, type PipelineNote, type PipelineSkill } from './model';
import { pipelineSkillContext } from './context';

test('stage scope uses the entire applicable column; moved cards use only their current file', () => {
	const cfg = { ...emptyPipeline(), rootFolder: 'Work', stages: [{ id: 'draft', label: 'Drafts', value: 'Draft' }, { id: 'review', label: 'Review', value: 'Review' }] };
	const skill: PipelineSkill = { id: 'review', label: 'Review', agentId: 'codex', skillName: 'review', promptTemplate: '{{paths}}', directSend: true, destination: { kind: 'fresh', cwd: '' }, scope: 'stage', stages: [] };
	const notes: PipelineNote[] = Array.from({ length: 520 }, (_, i) => ({ path: `Work/${i}.md`, title: String(i), mtime: i, ctime: i, frontmatter: { status: 'draft' } }));
	expect(pipelineSkillContext('Board.md', 'flow', cfg, skill, notes, 'draft').files).toHaveLength(520);
	expect(pipelineSkillContext('Board.md', 'flow', cfg, skill, notes, 'review').files).toEqual([]);
	const moved = { ...notes[0]!, path: 'Work/Review/Renamed.md', title: 'Renamed', frontmatter: { status: 'Review' } };
	const context = pipelineSkillContext('Board.md', 'flow', cfg, { ...skill, scope: 'card' }, [moved], 'review', moved.path);
	expect(context.files).toEqual([moved.path]); expect(context.variables).toMatchObject({ path: moved.path, title: 'Renamed', folder: 'Work/Review', stage: 'Review' });
	expect(() => pipelineSkillContext('Board.md', 'flow', cfg, { ...skill, scope: 'card' }, [moved], 'draft', notes[0]!.path)).toThrow();
});
