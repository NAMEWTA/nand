import { expect, test } from 'vitest';
import { buildAgentPrompt } from './agent-prompt';

test('all context variables expand once while literal replacements and unknown names survive', () => {
	const spec = { skillName: 'review', promptTemplate: '{{path}}|{{title}}|{{stage}}|{{folder}}|{{paths}}|{{input}}|{{missing}}|{{toString}}' };
	const variables = { path: 'A.md', title: 'A {{path}}', stage: 'Ready', folder: 'Work', paths: 'A.md\nB.md', input: '$& {{stage}}' };
	expect(buildAgentPrompt(spec, variables, { prefix: '$' })).toEqual({ ok: true, prompt: '$review\nA.md|A {{path}}|Ready|Work|A.md\nB.md|$& {{stage}}|{{missing}}|{{toString}}' });
});

test('documented skill tokens remain separate from ordinary prompts', () => {
	expect(buildAgentPrompt({ skillName: 'review', promptTemplate: '' }, {}, { prefix: '/' })).toEqual({ ok: true, prompt: '/review' });
	expect(buildAgentPrompt({ skillName: 'plugin:review', promptTemplate: 'Draft' }, {}, { prefix: '/', namespaces: true })).toEqual({ ok: true, prompt: '/plugin:review\nDraft' });
	expect(buildAgentPrompt({ skillName: '', promptTemplate: '  Keep {{input}}\n' }, { input: 'whitespace' })).toEqual({ ok: true, prompt: '  Keep whitespace\n' });
	expect(buildAgentPrompt({ skillName: 'review', promptTemplate: 'Draft' }, {})).toEqual({ ok: false, error: 'unsupported-skill' });
	expect(buildAgentPrompt({ skillName: 'plugin:review', promptTemplate: '' }, {}, { prefix: '$' })).toEqual({ ok: false, error: 'unsupported-skill' });
});

test.each(['../review', '/review', '$review', 'two words', 'x\nnext', 'x\u001b[201~', 'x;cmd', 'plugin:', '..', 'x'.repeat(129)])('invalid skill %j is rejected instead of silently dropping the invocation', skillName => {
	expect(buildAgentPrompt({ skillName, promptTemplate: 'Draft' }, {}, { prefix: '/' })).toEqual({ ok: false, error: 'invalid-skill' });
});
