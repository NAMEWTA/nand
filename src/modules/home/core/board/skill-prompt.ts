/** One-pass `{{name}}` substitution. Unknown names stay visible. Inserted values are not expanded again. */
export function fillTemplate(template: string, vars: Readonly<Record<string, string>>): string {
	return template.replace(/\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g, (token, name: string) =>
		Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : token,
	);
}

/** Claude Code skills use `/`. Codex skills use `$`. Other agents are not given a guessed prefix. */
export function skillInvocation(agent: string, name: string): string {
	if (!/^[\w.-]+$/.test(name)) return '';
	if (agent === 'claude-code') return `/${name}`;
	if (agent === 'codex') return `$${name}`;
	return name;
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
	const prompt = [skillInvocation(input.agent, input.skill), fillTemplate(input.template, input.vars)].filter(Boolean).join('\n');
	if (input.sessionId) return { mode: 'paste', sessionId: input.sessionId, prompt, submit: false, reportedSuccess: false };
	return { mode: 'new-session', prompt, submit: false, reportedSuccess: false };
}
