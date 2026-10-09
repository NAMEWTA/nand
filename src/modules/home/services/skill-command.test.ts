import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { runSkillCommand } from './skill-command';

describe('skill commands use agent dispatch', () => {
	test('a skill pastes into a new session and does not report success', async () => {
		const calls: string[] = [];
		const result = await runSkillCommand('skill:claude-code:review', async () => ({
			start: async (prompt) => {
				calls.push(prompt);
				return { id: 's1', submitted: false as const };
			},
			paste: async () => ({ submitted: false as const }),
		}), () => calls.push('notify'));
		assert.equal(result?.submitted, false);
		assert.equal(calls.length, 1);
		assert.match(calls[0]!, /^\/review/);
		const notices: string[] = [];
		const missing = await runSkillCommand('skill:codex:review', async () => undefined, (message) => notices.push(message));
		assert.equal(missing, undefined);
		assert.equal(notices.length, 1);
	});
});
