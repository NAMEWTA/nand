import type { PipelineConfig, PipelineNote, PipelineSkill } from './model';
import { pipelinePath, resolvePipelineStage, selectPipelineNotes } from './rules';
import { buildSkillContext, type SkillContext } from '../skills/context';

export function pipelineSkillApplies(skill: PipelineSkill, stageValue: string): boolean {
	return !skill.stages.length || skill.stages.some(value => value.trim().toLocaleLowerCase() === stageValue.trim().toLocaleLowerCase());
}
/** The supplied notes are current snapshots; a stage uses all matching files, before the UI cap. */
export function pipelineSkillContext(boardPath: string, sectionId: string, config: PipelineConfig, skill: PipelineSkill, notes: readonly PipelineNote[], stageId: string, path?: string, input = ''): SkillContext {
	const stage = config.stages.find(item => item.id === stageId);
	if (!stage || !pipelineSkillApplies(skill, stage.value)) throw new Error('home.pipeline.contextChanged');
	const candidates = selectPipelineNotes(config, notes).filter(note => resolvePipelineStage(config, note.frontmatter[config.statusField])?.id === stageId);
	if (skill.scope === 'card') {
		const note = candidates.find(item => item.path === path);
		if (!note) throw new Error('home.pipeline.contextChanged');
		return buildSkillContext({ source: { kind: 'dashboard', path: boardPath, id: `${sectionId}:card:${note.path}:${skill.id}` }, path: note.path, title: note.title, stage: stage.value.trim(), input, files: [note.path] });
	}
	return buildSkillContext({ source: { kind: 'dashboard', path: boardPath, id: `${sectionId}:stage:${stage.id}:${skill.id}` }, title: stage.label, stage: stage.value.trim(),
		folder: pipelinePath(config.rootFolder)! + (stage.folder ? `/${pipelinePath(stage.folder)!}` : ''), input, files: candidates.map(note => note.path) });
}
