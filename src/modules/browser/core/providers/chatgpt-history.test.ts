// Minimal current-branch shape adapted from MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { chatGptHistoryEndpoint, projectChatGptHistory } from './chatgpt-history';

const node = (id: string, parent: string | null, role: string, parts: unknown[], extra: Record<string, unknown> = {}) =>
	({ id, parent, message: { id, author: { role }, content: { content_type: 'text', parts }, status: 'finished_successfully', end_turn: true, ...extra } });
const fixture = () => ({ conversation_id: 'conversation', current_node: 'answer', access_token: 'fixture-secret', mapping: {
	root: { id: 'root', parent: null, message: null },
	user: node('user', 'root', 'user', ['Question']),
	old: node('old', 'user', 'assistant', ['Inactive branch secret']),
	analysis: node('analysis', 'user', 'assistant', ['Private reasoning'], { channel: 'analysis' }),
	tool: node('tool', 'analysis', 'tool', ['Private tool output']),
	answer: node('answer', 'tool', 'assistant', ['# Heading\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n$x^2$', 'Repeat', 'Repeat'], { channel: 'final', recipient: 'all' }),
} });

test('ChatGPT endpoint identity is anchored to the official HTTPS conversation path', () => {
	const url = 'https://chatgpt.com/backend-api/conversation/conversation';
	assert.equal(chatGptHistoryEndpoint(new URL(url)), 'conversation');
	for (const value of [url + '/account', url.replace('chatgpt.com', 'chatgpt.com.other.test'), url.replace('https:', 'http:'),
		url.replace('https://', 'https://user:secret@'), url.replace('/conversation/conversation', '/conversation')])
		assert.equal(chatGptHistoryEndpoint(new URL(value)), undefined);
});

test('only current ChatGPT branch public messages are projected, with proven public ancestry and repeated Markdown preserved', () => {
	const history = projectChatGptHistory(fixture(), 'conversation')!;
	assert.deepEqual(history.branch, ['user', 'answer']); assert.deepEqual(history.reasons, []);
	assert.deepEqual(history.messages.map(row => [row.id, row.parentId, row.parentKnown]), [['user', undefined, true], ['answer', 'user', true]]);
	assert.match(history.messages[1]!.markdown, /Repeat\n\nRepeat$/);
	assert.match(history.messages[1]!.markdown, /\| A \| B \|/);
	assert.deepEqual(history.terminalEvidence, ['provider-message-finished', 'provider-end-turn']);
	assert.doesNotMatch(JSON.stringify(history), /Private|Inactive|fixture-secret/);
	const old = projectChatGptHistory({ ...fixture(), current_node: 'old' }, 'conversation')!;
	assert.deepEqual(old.branch, ['user', 'old']); assert.doesNotMatch(JSON.stringify(old), /Repeat/);
});

test('missing or hidden current nodes never fall back to unrelated or prior ChatGPT answers', () => {
	for (const current_node of [undefined, 'missing', 'analysis', 'tool']) {
		const result = projectChatGptHistory({ ...fixture(), current_node }, 'conversation')!;
		assert.ok(result.reasons.includes('active-branch-unverified')); assert.equal(result.currentMessageId, undefined);
		assert.equal(result.terminalEvidence.length, 0);
		assert.doesNotMatch(JSON.stringify(result), /Inactive|Private/);
	}
});

test('unfinished, stopped or missing end-turn evidence cannot certify ChatGPT completion', () => {
	for (const extra of [{ status: 'in_progress' }, { status: 'finished_partial' }, { status: undefined }, { end_turn: false }, { end_turn: undefined }]) {
		const raw = fixture(); Object.assign(raw.mapping.answer.message, extra);
		const result = projectChatGptHistory(raw, 'conversation')!;
		assert.ok(result.reasons.includes('unfinished-assistant')); assert.equal(result.terminalEvidence.length, 0);
	}
});

test('broken parents, cycles, identities and truncated history retain explicit incompleteness', () => {
	const missing = fixture(); missing.mapping.user.parent = 'absent';
	const partial = projectChatGptHistory(missing, 'conversation')!;
	assert.ok(partial.reasons.includes('missing-parent-message')); assert.equal(partial.messages[0]!.parentKnown, false);
	const unknownRoot = fixture(); delete (unknownRoot.mapping.root as { parent?: null }).parent;
	assert.ok(projectChatGptHistory(unknownRoot, 'conversation')!.reasons.includes('parent-identity-unverified'));
	const cyclic = fixture(); cyclic.mapping.user.parent = 'answer';
	assert.ok(projectChatGptHistory(cyclic, 'conversation')!.reasons.includes('cyclic-parent-chain'));
	const conflict = fixture(); conflict.mapping.answer.message.id = 'other';
	assert.equal(projectChatGptHistory(conflict, 'conversation'), undefined);
	assert.equal(projectChatGptHistory({ ...fixture(), conversation_id: 'other' }, 'conversation'), undefined);
	assert.ok(projectChatGptHistory({ ...fixture(), is_truncated: true }, 'conversation')!.reasons.includes('pagination-unverified'));
});

test('hidden channels, tool recipients and structured private parts are excluded instead of guessed as public text', () => {
	for (const extra of [{ channel: 'analysis' }, { recipient: 'python' }, { metadata: { is_visually_hidden_from_conversation: true } },
		{ content: { content_type: 'reasoning', parts: ['Private hidden content'] } }]) {
		const raw = fixture(); Object.assign(raw.mapping.answer.message, extra);
		const result = projectChatGptHistory(raw, 'conversation')!;
		assert.equal(result.currentMessageId, undefined); assert.doesNotMatch(JSON.stringify(result), /Private|Repeat/);
	}
	const raw = fixture(); raw.mapping.answer.message.content.parts = ['Public text', { text: 'Private structured content' }];
	const result = projectChatGptHistory(raw, 'conversation')!;
	assert.equal(result.messages.at(-1)!.markdown, 'Public text');
	assert.ok(result.reasons.includes('unsupported-public-content'));
	const missingPublic = fixture(); missingPublic.mapping.user.message.content.parts = [];
	assert.equal(projectChatGptHistory(missingPublic, 'conversation')!.messages.at(-1)!.parentKnown, false);
});
