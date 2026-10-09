import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createAgentDispatch, createPromptRunner } from './prompt-port';

test('dispatch pastes without submitting and the runner returns the session text', async () => {
	const pasted: string[] = [];
	let entered = false;
	const dispatch = createAgentDispatch({
		async openShell() {
			return { id: 'shell-1', paste: (text) => pasted.push(text) };
		},
		paste(id, text) {
			pasted.push(`${id}:${text}`);
			return true;
		},
	});
	const started = await dispatch.start('review this');
	assert.equal(started.submitted, false);
	assert.equal(started.id, 'shell-1');
	assert.deepEqual(pasted, ['review this']);
	const existing = await dispatch.paste('s1', 'again');
	assert.equal(existing.submitted, false);
	assert.equal(entered, false);
	const runner = createPromptRunner({
		async run(request) {
			entered = request.prompt === 'score';
			return { status: 'complete', text: '[]' };
		},
	});
	const result = await runner.run({ prompt: 'score', purpose: 'news' });
	assert.equal(result.status, 'complete');
	assert.equal(result.text, '[]');
	assert.equal(entered, true);
});
