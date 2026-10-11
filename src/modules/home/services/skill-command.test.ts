import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { runSkillCommand } from './skill-command';
import type { AgentDispatchRequest } from '../../agent/api';

const options = { source: { kind: 'widget' as const, path: 'A.md', id: 'skill-button' }, preview: async (prompt: string) => prompt };

describe('skill commands use agent dispatch', () => {
	test('invalid or unsupported skill commands cannot acquire or launch a target', async () => {
		let acquired = 0;
		const notices: string[] = [];
		for (const command of ['skill:codex:bad name', 'skill:unknown:review']) {
			await runSkillCommand(command, async () => { acquired++; return undefined; }, value => notices.push(value), options);
		}
		assert.equal(acquired, 0); assert.equal(notices.length, 2);
	});
	test('a confirmed edited draft goes unchanged to the selected agent and reports delivery only', async () => {
		const calls: AgentDispatchRequest[] = [];
		const result = await runSkillCommand('skill:claude-code:review', async () => ({
			dispatch: async (request) => {
				calls.push(request);
				return { invocationId: request.invocationId, delivery: 'started' as const, runId: 'r1', terminalId: 't1' };
			},
		}), () => assert.fail('started is not a completed model result'), { ...options, preview: async prompt => { assert.equal(prompt, '/review'); return '  Edited {{literal}}\n'; } });
		assert.equal(result?.delivery, 'started');
		assert.equal(calls.length, 1);
		assert.equal(calls[0]!.finalPrompt, '  Edited {{literal}}\n');
		assert.equal(calls[0]!.agentId, 'claude-code');
		assert.deepEqual(calls[0]!.source, options.source);
		const notices: string[] = [];
		const missing = await runSkillCommand('skill:codex:review', async () => undefined, (message) => notices.push(message), options);
		assert.equal(missing, undefined);
		assert.equal(notices.length, 1);
	});
	test('cancelling a preview causes no dispatch', async () => {
		await runSkillCommand('skill:codex:review', async () => ({ dispatch: async () => assert.fail('cancelled') }), () => assert.fail('notice'), { ...options, preview: async () => null });
	});
});
