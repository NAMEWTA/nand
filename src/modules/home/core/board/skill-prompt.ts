import { buildAgentPrompt } from '../../../../shared/agent-prompt';
import { agentSkillCapability } from '../../../../shared/agent-skill-capabilities';
export { fillAgentTemplate as fillTemplate } from '../../../../shared/agent-prompt';

export class SkillPromptError extends Error {
	constructor(readonly code: 'invalid-skill' | 'unsupported-skill') { super(code); }
}

export interface SkillDispatchPlan {
	mode: 'new-session' | 'paste';
	sessionId?: string;
	prompt: string;
	/** Paste and new-session plans never press Enter. */
	submit: false;
	/** The plan is not a model result. */
	reportedSuccess: false;
}

export function planSkillDispatch(input: {
	agent: string;
	skill: string;
	template: string;
	vars: Readonly<Record<string, string>>;
	sessionId?: string;
}): SkillDispatchPlan {
	const result = buildAgentPrompt({ skillName: input.skill, promptTemplate: input.template }, input.vars,
		agentSkillCapability(input.agent));
	if (!result.ok) throw new SkillPromptError(result.error);
	const prompt = result.prompt;
	if (input.sessionId) return { mode: 'paste', sessionId: input.sessionId, prompt, submit: false, reportedSuccess: false };
	return { mode: 'new-session', prompt, submit: false, reportedSuccess: false };
}
