import assert from 'node:assert/strict';
import { test } from 'vitest';
import { answerContentReasons } from './quality';

test('empty, confirmed conversation-title-only and status-only content cannot supply complete answer evidence', () => {
	assert.deepEqual(answerContentReasons(' \n '), ['empty-answer']);
	assert.deepEqual(answerContentReasons('# Research question', 'Research question'), ['title-only']);
	assert.deepEqual(answerContentReasons('Thinking…'), ['status-only']);
	assert.deepEqual(answerContentReasons('正在生成……'), ['status-only']);
	assert.deepEqual(answerContentReasons('Done'), ['status-only']);
});
test('short genuine answers and structured or repeated prose are not rejected by a length heuristic', () => {
	for (const value of ['Yes.', '42', '# Heading\n\nAnswer', '```text\nThinking\n```', '$x^2$', '| A | B |\n|---|---|\n|1|2|', 'Repeat\n\nRepeat'])
		assert.deepEqual(answerContentReasons(value, 'Unrelated title'), []);
});
