import type { AgentSkillCapability } from './agent-prompt';

/** Official explicit invocation syntax, checked 2026-10-10. Sources: Home review-skill-capabilities.json. */
export function agentSkillCapability(agent: string): AgentSkillCapability | undefined {
	switch (agent) {
		case 'claude-code': case 'grok': return { prefix: '/', namespaces: true };
		case 'codex': return { prefix: '$' };
		case 'pi': return { prefix: '/skill:' };
		// Gemini and OpenCode expose model-selected skill tools, with no documented user prefix.
		default: return undefined;
	}
}
