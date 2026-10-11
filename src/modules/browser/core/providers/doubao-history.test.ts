// Minimal chain shapes from MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800 (MIT).
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { doubaoHistory, doubaoHistoryEndpoint, projectDoubaoPage, projectDoubaoRequest } from './doubao-history';

const message = (id: string, parent: string | null, role: number, content: unknown, status = 'finished') =>
	({ message_id: id, parent_id: parent, sender_type: role, content, status });
const earlier = { has_more: false, message_count: 4, messages: [message('u1', null, 1, 'Repeated question'), message('a1', 'u1', 2, 'Earlier answer')] };
const latest = { has_more: true, next_index_in_conv: 2, total_count: 4, messages: [message('u2', 'a1', 1, '{"text":"Repeated question"}'),
	{ ...message('a2', 'u2', 2, ''), content_block: JSON.stringify([{ block_type: 'reasoning', text: 'Private reasoning' },
		{ block_type: 'markdown', markdown: '# Answer\n\n$x^2$' }, { kind: 'paragraph', text: 'Repeat' }, { kind: 'paragraph', text: 'Repeat' }]) }] };
const page = (body: unknown, anchor = '4') => projectDoubaoPage(body, 'conversation', { conversationId: 'conversation', cursor: anchor })!;

test('Doubao observes only its chain endpoint and projects bounded request identity without credentials', () => {
	const endpoint = 'https://www.doubao.com/im/chain/single';
	assert.equal(doubaoHistoryEndpoint(new URL(endpoint)), true);
	for (const url of [endpoint.replace('https:', 'http:'), endpoint.replace('.com/', '.com.other.test/'), endpoint + '/other', endpoint.replace('https://', 'https://name:secret@')])
		assert.equal(doubaoHistoryEndpoint(new URL(url)), false);
	assert.deepEqual(projectDoubaoRequest('{"conversation_id":"conversation","anchor":4,"direction":1,"token":"secret"}', 'POST'), { conversationId: 'conversation', cursor: '4' });
	for (const body of ['{"conversation_id":"../escape"}', '{"conversation_id":"conversation","anchor":-1}', '{"conversation_id":"conversation","anchor":{}}',
		'{"conversation_id":"conversation","direction":2}', 'broken', ' '.repeat(16385)]) assert.equal(projectDoubaoRequest(body, 'POST'), undefined);
	assert.equal(projectDoubaoRequest('{"conversation_id":"conversation"}', 'GET'), undefined);
	assert.equal(projectDoubaoPage(latest, 'conversation'), undefined);
	assert.equal(projectDoubaoPage(latest, 'conversation', { conversationId: 'other' }), undefined);
	assert.equal(page({ ...latest, conversation_id: 'other' }), undefined);
});

test('observed Doubao pages retain repeated public blocks and bind the active parent chain without positional IDs', () => {
	const first = page({ downlink_body: { pull_singe_chain_downlink_body: latest }, access_token: 'secret' });
	const second = page({ pull_single_chain_downlink_body: earlier }, '2');
	const result = doubaoHistory([first, second], 'conversation', 'a2')!;
	assert.deepEqual(result.reasons, []); assert.deepEqual(result.branch, ['u1', 'a1', 'u2', 'a2']);
	assert.equal(result.messages[3]!.markdown, '# Answer\n\n$x^2$\n\nRepeat\n\nRepeat');
	assert.deepEqual(result.terminalEvidence, ['provider-message-finished']); assert.doesNotMatch(JSON.stringify(result), /Private|secret/);
	assert.equal(doubaoHistory([first, second], 'other', 'a2'), undefined);
	assert.ok(doubaoHistory([first, second], 'conversation')!.reasons.includes('active-branch-unverified'));
	assert.ok(doubaoHistory([first], 'conversation', 'a2')!.reasons.includes('missing-page'));
	assert.ok(doubaoHistory([first, second, first], 'conversation', 'a2')!.reasons.includes('missing-page'), 'New current page cannot reuse older cursor observations');
});

test('exhausted pagination without explicit roots or message end states cannot certify a Doubao answer', () => {
	const raw = { has_more: false, messages: [{ message_id: 'u', role: 'user', content: 'Question' }, { message_id: 'a', parent_id: 'u', role: 'assistant', content: 'Answer' }] };
	const result = doubaoHistory([page(raw)], 'conversation', 'a')!;
	for (const reason of ['parent-identity-unverified', 'history-beginning-unverified', 'unfinished-assistant', 'terminal-message-unverified']) assert.ok(result.reasons.includes(reason));
	const explicit = { has_more: false, messages: [message('u', null, 1, 'Question'), message('a', 'u', 2, 'Answer', 'unfinished')] };
	assert.ok(doubaoHistory([page(explicit)], 'conversation', 'a')!.reasons.includes('unfinished-assistant'));
	assert.ok(page({ ...explicit, has_more: undefined }).reasons.includes('pagination-unverified'));
	assert.ok(page({ ...explicit, next_index_in_conv: 3 }).reasons.includes('pagination-unverified'));
	assert.ok(doubaoHistory([page({ ...explicit, message_count: 3 })], 'conversation', 'a')!.reasons.includes('message-count-mismatch'));
	const cycle = { ...explicit, messages: [message('u', 'a', 1, 'Question'), message('a', 'u', 2, 'Answer')] };
	assert.ok(doubaoHistory([page(cycle)], 'conversation', 'a')!.reasons.includes('cyclic-parent-chain'));
});

test('Doubao pagination loops, identity conflicts and missing message identities stay incomplete', () => {
	const conflict = page({ ...earlier, messages: [...earlier.messages, message('u2', 'a1', 1, 'Changed question')] }, '2');
	assert.ok(doubaoHistory([page(latest), conflict], 'conversation', 'a2')!.reasons.includes('conflicting-message'));
	assert.ok(doubaoHistory([page(latest), page({ ...earlier, has_more: true, next_index_in_conv: 4 }, '2')], 'conversation', 'a2')!.reasons.includes('duplicate-cursor'));
	assert.equal(page({ ...earlier, messages: [message('same', null, 1, 'A'), message('same', null, 2, 'B')] }), undefined);
	assert.equal(page({ ...earlier, messages: [{ index_in_conv: 1, role: 'user', content: 'A' }] }), undefined);
	assert.equal(page({ ...earlier, messages: [{ message_id: 'same', role: 'unknown' }, message('same', null, 1, 'A')] }), undefined);
});
