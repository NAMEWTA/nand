// Minimal detail/alternate/partial shapes from MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800, MIT.
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { projectQwenHistory, qwenHistoryEndpoint } from './qwen-history';

const message = (id: string, parent: string | null, role: string, content: unknown) => ({ id, parent_id: parent, role, content, status: 'finished' });
const detail = () => ({ success: true, data: { chat: { id: 'conversation', title: 'Research', history: { current_id: 'answer', has_more: false, message_count: 3, messages: {
	user: message('user', null, 'user', 'Question'), answer: message('answer', 'user', 'assistant', [
		{ type: 'reasoning', text: 'Private reasoning' }, { type: 'markdown', markdown: '# Heading\n\n| A |\n| --- |\n| B |\n\n```ts\nconst a=1;\n```\n\n$x^2$' },
		{ type: 'text', text: 'Repeated paragraph' }, { type: 'text', text: 'Repeated paragraph' },
	]), other: message('other', 'user', 'assistant', 'Inactive branch'),
} } } } });

test('Qwen detail maps and alternate arrays preserve only the explicit current branch and repeated public content', () => {
	const history = projectQwenHistory({ ...detail(), access_token: 'secret' }, 'conversation')!;
	assert.deepEqual(history.branch, ['user', 'answer']); assert.deepEqual(history.reasons, []);
	assert.equal(history.messages[1]!.markdown.match(/Repeated paragraph/g)?.length, 2); assert.ok(history.messages[1]!.markdown.includes('$x^2$'));
	assert.doesNotMatch(JSON.stringify(history), /Private|Inactive|secret/);
	const encoded = detail(); encoded.data.chat.history.messages.answer.content = JSON.stringify([{ type: 'reasoning', text: 'Private encoded thought' }, { type: 'text', text: 'Visible' }, { type: 'text', text: 'Visible' }]);
	assert.equal(projectQwenHistory(encoded, 'conversation')!.messages[1]!.markdown, 'Visible\n\nVisible');
	encoded.data.chat.history.messages.answer.content = '{"example":1}';
	assert.equal(projectQwenHistory(encoded, 'conversation')!.messages[1]!.markdown, '{"example":1}');
	const alternate = { ok: true, result: { has_more: false, message_count: 2, conversation: { id: 'conversation', current_message_id: 'a', messages: [
		{ message_id: 'u', parent_message_id: null, role: 'human', content: { text: 'Question' } },
		{ message_id: 'a', parent_message_id: 'u', role: 'model', status: 'completed', content: [{ phase: 'think', content: 'Private' }, { type: 'markdown', markdown: '**Answer**' }] },
	] } } };
	const other = projectQwenHistory(alternate, 'conversation')!; assert.deepEqual(other.reasons, []); assert.equal(other.messages[1]!.markdown, '**Answer**');
	assert.equal(qwenHistoryEndpoint(new URL('https://www.qianwen.com/api/v2/conversation/conversation')), 'conversation');
	for (const url of ['https://www.qianwen.com/api/v2/conversation/conversation/send', 'https://user:secret@www.qianwen.com/api/v2/conversation/conversation', 'https://other.test/api/v2/conversation/conversation'])
		assert.equal(qwenHistoryEndpoint(new URL(url)), undefined);
});

test('Qwen missing root proof, progressive prefixes, unfinished messages and pagination stay incomplete', () => {
	const unknownRoot = detail(); delete (unknownRoot.data.chat.history.messages.user as { parent_id?: string | null }).parent_id;
	assert.ok(projectQwenHistory(unknownRoot, 'conversation')!.reasons.includes('parent-identity-unverified'));
	const progressive = detail(); progressive.data.chat.history.messages.answer.content = [{ phase: 'answer', content: 'First' }, { phase: 'answer', content: 'First\nLast' }];
	const result = projectQwenHistory(progressive, 'conversation')!;
	assert.equal(result.messages[1]!.markdown, 'First\n\nFirst\nLast'); assert.ok(result.reasons.includes('ambiguous-public-content'));
	const incomplete = detail(); incomplete.data.chat.history.has_more = true; incomplete.data.chat.history.messages.answer.status = 'unfinished';
	assert.ok(projectQwenHistory(incomplete, 'conversation')!.reasons.includes('pagination-unverified'));
	assert.ok(projectQwenHistory(incomplete, 'conversation')!.reasons.includes('unfinished-assistant'));
	const generic = { data: { has_more: true, messages: [message('u', null, 'user', 'Question'), message('a', 'u', 'assistant', 'Partial')] } };
	assert.ok(projectQwenHistory(generic, 'conversation')!.reasons.includes('active-branch-unverified'));
	assert.ok(projectQwenHistory(generic, 'conversation')!.reasons.includes('pagination-unverified'));
});

test('Qwen never creates synthetic identities or borrows mismatched conversation and tree evidence', () => {
	assert.equal(projectQwenHistory(detail(), 'another'), undefined);
	assert.equal(projectQwenHistory({ ...detail(), success: false }, 'conversation'), undefined);
	assert.equal(projectQwenHistory({ ...detail(), code: 500 }, 'conversation'), undefined);
	const mismatch = detail(); mismatch.data.chat.history.messages.user.id = 'different'; assert.equal(projectQwenHistory(mismatch, 'conversation'), undefined);
	const missing = { data: { messages: [{ role: 'assistant', content: 'Anonymous answer' }] } }; assert.equal(projectQwenHistory(missing, 'conversation'), undefined);
	const duplicate = { data: { messages: [{ id: 'same', role: 'unknown' }, message('same', null, 'user', 'Question')] } };
	assert.equal(projectQwenHistory(duplicate, 'conversation'), undefined);
	const cyclic = detail(); cyclic.data.chat.history.messages.user.parent_id = 'answer'; assert.ok(projectQwenHistory(cyclic, 'conversation')!.reasons.includes('cyclic-parent-chain'));
	const missingParent = detail(); missingParent.data.chat.history.messages.answer.parent_id = 'missing'; assert.ok(projectQwenHistory(missingParent, 'conversation')!.reasons.includes('missing-parent-message'));
	const count = detail(); count.data.chat.history.message_count = 9; assert.ok(projectQwenHistory(count, 'conversation')!.reasons.includes('message-count-mismatch'));
});
