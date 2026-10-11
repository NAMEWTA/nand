import assert from 'node:assert/strict';
import { test } from 'vitest';
import { deepseekHistoryEndpoint, projectDeepSeekHistory } from './deepseek-history';

test('DeepSeek history projects exact public text and the selected parent chain without credentials or reasoning', () => {
	const markdown = '# Heading\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```ts\nconst a = 1;\n```\n\n$x^2$';
	const result = projectDeepSeekHistory({ data: { biz_data: { access_token: 'fixture-secret', chat_session: { id: 'conversation', current_message_id: 5 },
		has_more: false, total_count: 5, chat_messages: [
			{ message_id: 1, parent_id: null, fragments: [{ type: 'REQUEST', content: 'Earlier prompt' }] },
			{ message_id: 2, parent_id: 1, fragments: [{ type: 'RESPONSE', content: 'Earlier answer' }] },
			{ message_id: 3, parent_id: 2, fragments: [{ type: 'REQUEST', content: 'Same prompt' }] },
			{ message_id: 4, parent_id: 3, fragments: [{ type: 'RESPONSE', content: 'Unselected branch' }] },
			{ message_id: 5, parent_id: 3, fragments: [{ type: 'THINK', content: 'Private reasoning' }, { type: 'RESPONSE', content: markdown },
				{ type: 'RESPONSE', content: 'Repeated' }, { type: 'RESPONSE', content: 'Repeated' }, { type: 'TOOL', content: 'Private tool result' }] },
		] } } }, 'conversation')!;
	assert.deepEqual(result.branch, ['1', '2', '3', '5']); assert.deepEqual(result.reasons, []);
	assert.equal(result.messages.at(-1)!.markdown, `${markdown}\n\nRepeated\n\nRepeated`);
	assert.doesNotMatch(JSON.stringify(result), /fixture-secret|Private reasoning|Private tool result/);
	assert.equal('complete' in result, false, 'An exhausted history branch is not generation completion evidence');
});

test('legacy history without active-branch or pagination proof retains those limits explicitly', () => {
	const result = projectDeepSeekHistory({ biz_data: { messages: [
		{ id: 'user', role: 'human', content: 'Question' },
		{ id: 'answer', parentId: 'user', role: 'model', content: [{ type: 'reasoning', text: 'Excluded' }, { type: 'markdown', markdown: 'Public **answer**' }] },
	] } }, 'conversation')!;
	assert.deepEqual(result.branch, ['user', 'answer']); assert.equal(result.messages[1]!.markdown, 'Public **answer**');
	assert.deepEqual(result.reasons, ['parent-identity-unverified', 'active-branch-unverified', 'pagination-unverified']);
});

test('invalid identity, broken branch, conflicting pagination and message counts cannot be treated as complete history', () => {
	assert.equal(projectDeepSeekHistory({ messages: [{ role: 'user', content: 'Missing ID' }] }, 'conversation'), undefined);
	assert.equal(projectDeepSeekHistory({ messages: [{ id: 'same', role: 'user', content: 'A' }, { id: 'same', role: 'assistant', content: 'B' }] }, 'conversation'), undefined);
	assert.equal(projectDeepSeekHistory({ chat_session_id: 'different', messages: [] }, 'conversation'), undefined);
	const broken = projectDeepSeekHistory({ current_message_id: 'answer', has_more: false, next_cursor: 'more', total_count: 10,
		messages: [{ id: 'answer', parent_id: 'missing', role: 'assistant', content: 'Partial' }] }, 'conversation')!;
	assert.deepEqual(broken.reasons, ['missing-parent-message', 'pagination-unverified', 'message-count-mismatch']);
	const cycle = projectDeepSeekHistory({ current_message_id: 'answer', messages: [{ id: 'answer', parent_id: 'answer', role: 'assistant', content: 'Cycle' }] }, 'conversation')!;
	assert.ok(cycle.reasons.includes('cyclic-parent-chain'));
	const noRootProof = projectDeepSeekHistory({ current_message_id: 'answer', has_more: false, messages: [
		{ id: 'user', role: 'user', content: 'Question' }, { id: 'answer', parentId: 'user', role: 'assistant', content: 'Answer' },
	] }, 'conversation')!;
	assert.deepEqual(noRootProof.reasons, ['parent-identity-unverified'], 'A missing parent field is not evidence of a root message');
	assert.equal(noRootProof.messages[0]!.parentKnown, false, 'Submission acceptance also needs explicit root/parent evidence');
});

test('DeepSeek response allowlist matches only the exact HTTPS origin, history path and stable conversation parameter', () => {
	assert.equal(deepseekHistoryEndpoint(new URL('https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=session-1')), 'session-1');
	for (const value of ['http://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=session-1',
		'https://chat.deepseek.com.attacker.example/api/v0/chat/history_messages?chat_session_id=session-1',
		'https://chat.deepseek.com/api/v0/account?chat_session_id=session-1', 'https://user:secret@chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=session-1',
		'https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=../other']) assert.equal(deepseekHistoryEndpoint(new URL(value)), undefined);
});
