import type { PipelineConfig, PipelineSkill } from '../core/pipeline/model';
import { pipelineSkillContext } from '../core/pipeline/context';
import { PipelineVault } from '../platform/pipeline/vault';
import type { SkillContext } from '../core/skills/context';

/** Resolve material at the invocation boundary, independently of the UI's display cap. */
export async function resolvePipelineSkill(port: PipelineVault, boardPath: string, sectionId: string, config: PipelineConfig, skill: PipelineSkill, stageId: string, path?: string, input?: string, signal?: AbortSignal): Promise<SkillContext> {
	signal?.throwIfAborted();
	const paths = skill.scope === 'card' ? (path ? [path] : []) : port.scan(config).map(note => note.path);
	const notes = [];
	for (const path of paths) {
		signal?.throwIfAborted();
		notes.push((await port.read(path)).note);
	}
	signal?.throwIfAborted();
	return pipelineSkillContext(boardPath, sectionId, config, skill, notes, stageId, path, input);
}
