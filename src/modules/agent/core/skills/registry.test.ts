import { expect, test } from 'vitest';
import { buildAgentPrompt } from '../../../../shared/agent-prompt';
import { agentSkillCapability } from '../../../../shared/agent-skill-capabilities';
import { readSkillName, mergeSkills } from './registry';

test('only YAML frontmatter names override the directory fallback', () => {
	expect(readSkillName('---\nname: "frontmatter-name"\n---\nname: body-name\n', 'folder')).toBe('frontmatter-name');
	expect(readSkillName('# Skill\nname: body-name\n', 'fallback')).toBe('fallback');
	expect(readSkillName('---\ndescription: "name: ignored"\n---\n', 'fallback')).toBe('fallback');
	expect(readSkillName('---\nname: [bad]\n---\n', 'fallback')).toBeUndefined();
	expect(readSkillName('---\nname: "bad name"\n---\n', 'fallback')).toBeUndefined();
	expect(() => readSkillName('---\nname: [broken\n---\n', 'fallback')).toThrow();
});

test('merging preserves every distinct source without mutating input', () => {
	const entries = [{ name: 'review', sources: [{ kind: 'vault' as const, path: '.agents/skills/review/SKILL.md' }] }];
	const merged = mergeSkills([...entries, ...entries, { name: 'review', sources: [{ kind: 'remembered', path: 'codex' }] }]);
	expect(merged).toEqual([{ name: 'review', sources: [{ kind: 'vault', path: '.agents/skills/review/SKILL.md' }, { kind: 'remembered', path: 'codex' }] }]);
	expect(entries[0]?.sources).toHaveLength(1);
});

test('all six CLI mappings follow documented explicit syntax; ordinary prompts remain available', () => {
	for (const [agent, prefix] of [['claude-code', '/'], ['codex', '$'], ['grok', '/'], ['pi', '/skill:']] as const) {
		expect(buildAgentPrompt({ skillName: 'review', promptTemplate: '{{input}}' }, { input: '{{path}}' }, agentSkillCapability(agent))).toEqual({ ok: true, prompt: `${prefix}review\n{{path}}` });
	}
	for (const agent of ['opencode', 'gemini', 'unknown']) {
		expect(buildAgentPrompt({ skillName: 'review', promptTemplate: '' }, {}, agentSkillCapability(agent))).toEqual({ ok: false, error: 'unsupported-skill' });
		expect(buildAgentPrompt({ skillName: '', promptTemplate: '  plain\n' }, {}, agentSkillCapability(agent))).toEqual({ ok: true, prompt: '  plain\n' });
	}
});
