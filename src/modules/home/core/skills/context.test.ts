import { expect, test } from 'vitest';
import { buildSkillContext } from './context';
import { dispatchSkillShortcut } from '../../services/skill-shortcuts';
import type { AgentDispatchRequest } from '../../../../shared/agent-dispatch';
import type { SkillShortcut } from '../board/types/model';

test('contexts snapshot exact local input and live path without expanding inserted variables', () => {
	const context = buildSkillContext({ source: { kind: 'dashboard', path: 'Board.md', id: 'card' }, path: 'Moved/新名.md', title: '新名', input: ' {{path}}\n', files: ['Moved/新名.md'] });
	expect(context.variables).toEqual({ path: 'Moved/新名.md', title: '新名', folder: 'Moved', input: ' {{path}}\n', stage: '', paths: 'Moved/新名.md' });
	const unsaved = buildSkillContext({ source: context.source, title: 'Capture', input: 'draft', folder: 'Inbox' });
	expect(unsaved.files).toEqual([]); expect(unsaved.variables).toMatchObject({ path: '', folder: 'Inbox', paths: '', input: 'draft' });
});

test('stage preview subsets and direct sends derive only from this invocation, including an empty column', async () => {
	const skill: SkillShortcut = { id: 's', label: 'Stage', agentId: 'codex', skillName: 'review', promptTemplate: '{{stage}}\n{{paths}}', directSend: false, destination: { kind: 'fresh', cwd: '' } };
	const calls: AgentDispatchRequest[] = [];
	for (const [directSend, files] of [[false, ['A.md', 'B.md']], [true, ['A.md', 'B.md']], [true, []]] as const) {
		const context = buildSkillContext({ source: { kind: 'dashboard', path: 'Board.md', id: 'stage' }, title: 'Draft', stage: 'Draft', files });
		await dispatchSkillShortcut({ ...skill, directSend }, context, {
			dispatch: async () => ({ dispatch: async request => { calls.push(request); return { invocationId: request.invocationId, delivery: 'started' }; } }),
			preview: async (_, captured, draft) => { expect(captured.files).toEqual(files); return { ...draft, finalPrompt: 'Reviewed B only', files: ['B.md'] }; }, notify: () => {},
		});
	}
	expect(calls.map(call => [call.finalPrompt, call.files])).toEqual([['Reviewed B only', ['B.md']], ['$review\nDraft\nA.md\nB.md', ['A.md', 'B.md']], ['$review\nDraft\n', []]]);
});
