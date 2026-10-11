export interface AgentSkillCapability {
	prefix: '/' | '$' | '/skill:';
	/** Claude Code plugin skills may use a namespace, such as plugin:review. */
	namespaces?: boolean;
}

export type AgentPromptResult = { ok: true; prompt: string } | { ok: false; error: 'invalid-skill' | 'unsupported-skill' };

export function validSkillName(name: string): boolean {
	return name.length > 0 && name.length <= 128 && /^[\w.-]+(?::[\w.-]+)*$/.test(name) && !name.split(':').some(part => part === '.' || part === '..');
}

/** Only the original template is expanded. Replacement text and unknown variables remain literal. */
export function fillAgentTemplate(template: string, variables: Readonly<Record<string, string>>): string {
	return template.replace(/\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g, (token, name: string) =>
		Object.prototype.hasOwnProperty.call(variables, name) ? variables[name]! : token);
}

/** Build a draft; consumers submit the user's final edited text without calling this again. */
export function buildAgentPrompt(
	spec: { skillName: string; promptTemplate: string },
	variables: Readonly<Record<string, string>>,
	capability?: AgentSkillCapability,
): AgentPromptResult {
	const name = spec.skillName;
	if (name && !validSkillName(name)) {
		return { ok: false, error: 'invalid-skill' };
	}
	if (name && (!capability || (name.includes(':') && !capability.namespaces))) return { ok: false, error: 'unsupported-skill' };
	const body = fillAgentTemplate(spec.promptTemplate, variables);
	return { ok: true, prompt: [name ? `${capability!.prefix}${name}` : '', body].filter(Boolean).join('\n') };
}
