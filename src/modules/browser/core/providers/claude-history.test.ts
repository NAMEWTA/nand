import assert from 'node:assert/strict';
import { test } from 'vitest';
import { claudeHistory, claudeHistoryEndpoint, projectClaudeConversation } from './claude-history';

const fixture = () => ({ uuid: 'conversation', name: 'Research', current_leaf_message_uuid: 'answer', chat_messages: [
	{ uuid: 'user', sender: 'human', parent_message_uuid: null, content: [{ type: 'text', text: 'Question' }] },
	{ uuid: 'answer', sender: 'assistant', parent_message_uuid: 'user', stop_reason: 'end_turn', content: [
		{ type: 'thinking', text: 'Private reasoning' }, { type: 'tool_use', text: 'Private tool' },
		{ type: 'text', text: '# Heading\n\n| A |\n| --- |\n| B |\n\n```ts\nconst a=1;\n```\n\n$x^2$' },
		{ type: 'text', text: 'Repeated paragraph' }, { type: 'text', text: 'Repeated paragraph' },
	] },
	{ uuid: 'other', sender: 'assistant', parent_message_uuid: 'user', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Inactive branch' }] },
] });

test('Claude projects explicit current ancestry and repeated rich text without retaining private fields', () => {
	const history = claudeHistory(projectClaudeConversation({ ...fixture(), access_token: 'secret' }, 'conversation')!, 'answer');
	assert.deepEqual(history.branch, ['user', 'answer']); assert.deepEqual(history.reasons, []);
	assert.equal(history.messages[1]!.markdown.match(/Repeated paragraph/g)?.length, 2);
	assert.ok(history.messages[1]!.markdown.includes('$x^2$')); assert.deepEqual(history.terminalEvidence, ['provider-end-turn']);
	assert.doesNotMatch(JSON.stringify(history), /Private|Inactive|secret/);
	assert.equal(claudeHistoryEndpoint(new URL('https://claude.ai/api/organizations/org/chat_conversations/conversation/?tree=true')), 'conversation');
	for (const url of ['https://claude.ai/api/organizations/org/chat_conversations', 'https://evil.test/api/organizations/org/chat_conversations/conversation', 'https://u:p@claude.ai/api/organizations/org/chat_conversations/conversation', 'https://claude.ai/api/organizations/org/chat_conversations/conversation/completion'])
		assert.equal(claudeHistoryEndpoint(new URL(url)), undefined);
});

test('Claude rejects missing/duplicate identity and never invents parents from timestamps or array order', () => {
	const missing = fixture(); delete (missing.chat_messages[0] as { uuid?: string }).uuid;
	assert.equal(projectClaudeConversation(missing, 'conversation'), undefined);
	const duplicate = fixture(); duplicate.chat_messages[1]!.uuid = 'user'; assert.equal(projectClaudeConversation(duplicate, 'conversation'), undefined);
	assert.equal(projectClaudeConversation(fixture(), 'another'), undefined);
	const unlinked = fixture(); delete (unlinked.chat_messages[1] as { parent_message_uuid?: string }).parent_message_uuid;
	const history = claudeHistory(projectClaudeConversation(unlinked, 'conversation')!, 'answer');
	assert.ok(history.reasons.includes('parent-identity-unverified')); assert.equal(history.messages[0]!.parentKnown, false);
	const cyclic = fixture(); cyclic.chat_messages[0]!.parent_message_uuid = 'answer';
	assert.ok(claudeHistory(projectClaudeConversation(cyclic, 'conversation')!).reasons.includes('cyclic-parent-chain'));
});

test('Claude requires end-turn, complete pagination and an explicit active tip', () => {
	const unfinished = fixture(); unfinished.chat_messages[1]!.stop_reason = 'max_tokens';
	assert.ok(claudeHistory(projectClaudeConversation(unfinished, 'conversation')!).reasons.includes('unfinished-assistant'));
	assert.ok(claudeHistory(projectClaudeConversation({ ...fixture(), has_more: true }, 'conversation')!).reasons.includes('pagination-unverified'));
	const noTip = fixture(); delete (noTip as { current_leaf_message_uuid?: string }).current_leaf_message_uuid;
	assert.ok(claudeHistory(projectClaudeConversation(noTip, 'conversation')!).reasons.includes('active-branch-unverified'));
	assert.deepEqual(claudeHistory(projectClaudeConversation(noTip, 'conversation')!, 'answer').branch, ['user', 'answer']);
	assert.ok(claudeHistory(projectClaudeConversation(fixture(), 'conversation')!, 'other').reasons.includes('active-branch-unverified'));
	const missing = fixture(); missing.chat_messages.shift();
	assert.ok(claudeHistory(projectClaudeConversation(missing, 'conversation')!).reasons.includes('missing-parent-message'));
});
