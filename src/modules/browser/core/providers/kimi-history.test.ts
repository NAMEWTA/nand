// Minimal two-page message shape from MAIW b6b83ca90f0f67fbf25a676e7a8f6b8b34327800, MIT.
// Copyright (c) 2026 NAMEWTA. See docs/third-party/maiw-LICENSE.txt.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { kimiHistory, kimiHistoryEndpoint, projectKimiPage, projectKimiRequest } from './kimi-history';

const message = (id: string, parentId: string, role: 'USER' | 'ASSISTANT', text: string, status = 'MESSAGE_STATUS_FINISHED') =>
	({ id, parentId, role: 'ROLE_' + role, status, blocks: [{ text: { content: text } }] });
const earlier = { messages: [message('a1', 'u1', 'ASSISTANT', 'Earlier answer'), message('u1', '', 'USER', 'Repeated question')], nextPageToken: '', totalCount: 4 };
const latest = { messages: [message('a2', 'u2', 'ASSISTANT', 'Latest answer'), message('u2', 'a1', 'USER', 'Repeated question')], nextPageToken: 'older', totalCount: 4 };
const page = (raw: unknown, cursor?: string, conversationId = 'conversation') =>
	projectKimiPage(raw, conversationId, { conversationId, cursor })!;

test('Kimi allowlist and POST identity projection exclude arbitrary hosts, credentials and unrelated body fields', () => {
	const endpoint = 'https://www.kimi.com/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages';
	assert.equal(kimiHistoryEndpoint(new URL(endpoint)), true);
	for (const url of [endpoint.replace('https:', 'http:'), endpoint.replace('www.kimi.com', 'www.kimi.com.other.test'),
		endpoint.replace('https://', 'https://user:secret@'), endpoint.replace('ListMessages', 'Account')]) assert.equal(kimiHistoryEndpoint(new URL(url)), false);
	assert.deepEqual(projectKimiRequest('{"chat_id":"conversation","page_token":"cursor+/=","token":"secret","headers":{"authorization":"secret"}}', 'POST'),
		{ conversationId: 'conversation', cursor: 'cursor+/=' });
	for (const raw of ['{"chat_id":"../escape"}', '{"chat_id":"conversation","page_token":{}}', '{"chat_id":"conversation","page_token":"\\u0000"}', '[]', 'broken'])
		assert.equal(projectKimiRequest(raw, 'POST'), undefined);
	assert.equal(projectKimiRequest('{"chat_id":"conversation"}', 'GET'), undefined);
	assert.equal(projectKimiRequest(' '.repeat(16385), 'POST'), undefined);
});

test('observed two-page Kimi chain selects the current repeated question and requires current-branch evidence', () => {
	const pages = [page(latest), page(earlier, 'older')], result = kimiHistory(pages, 'conversation', 'a2')!;
	assert.deepEqual(result.branch, ['u1', 'a1', 'u2', 'a2']); assert.deepEqual(result.reasons, []);
	assert.deepEqual(result.terminalEvidence, ['provider-message-finished']);
	assert.equal(result.messages.find(row => row.id === result.currentMessageId)?.markdown, 'Latest answer');
	assert.ok(kimiHistory(pages, 'conversation')!.reasons.includes('active-branch-unverified'));
	assert.equal(kimiHistory(pages, 'different', 'a2'), undefined);
	assert.ok(kimiHistory([pages[0]!], 'conversation', 'a2')!.reasons.includes('missing-page'));
	assert.ok(kimiHistory([pages[1]!], 'conversation', 'a1')!.reasons.includes('initial-page-missing'));
});

test('public Kimi blocks preserve repetitions and Markdown while unfinished status and missing parents stay unverified', () => {
	const markdown = '# Heading\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n$x^2$';
	const raw = { messages: [message('u', '', 'USER', 'Question'), { ...message('a', 'u', 'ASSISTANT', 'unused', 'MESSAGE_STATUS_UNFINISHED'),
		blocks: [{ think: { content: 'Private reasoning' } }, { text: { content: markdown } }, { text: { content: 'Repeat' } },
			{ text: { content: 'Repeat' } }, { type: 'reasoning', markdown: 'Private reasoning in generic field' }] }], nextPageToken: '' };
	const parsed = page({ ...raw, access_token: 'secret' });
	assert.equal(parsed.messages[1]!.markdown, markdown + '\n\nRepeat\n\nRepeat');
	assert.equal(parsed.messages[1]!.finished, false);
	assert.doesNotMatch(JSON.stringify(parsed), /Private|secret/);
	assert.ok(kimiHistory([parsed], 'conversation', 'a')!.reasons.includes('unfinished-assistant'));
	const missing = page({ ...raw, messages: [{ id: 'u', role: 'ROLE_USER', content: 'Question' }, message('a', 'u', 'ASSISTANT', 'Answer')] });
	assert.ok(kimiHistory([missing], 'conversation', 'a')!.reasons.includes('parent-identity-unverified'));
	assert.equal(projectKimiPage(raw, 'conversation'), undefined, 'Response URL alone cannot establish POST conversation identity');
	assert.equal(projectKimiPage({ ...raw, chatId: 'foreign' }, 'conversation', { conversationId: 'conversation' }), undefined);
});

test('pagination loops, conflicting identities, absent cursor and inconsistent counts cannot certify a Kimi answer', () => {
	assert.equal(page({ messages: [message('same', '', 'USER', 'A'), message('same', '', 'USER', 'B')], nextPageToken: '' }), undefined);
	const conflict = page({ ...earlier, messages: [...earlier.messages, message('a2', 'u2', 'ASSISTANT', 'Conflicting answer')] }, 'older');
	assert.ok(kimiHistory([page(latest), conflict], 'conversation', 'a2')!.reasons.includes('conflicting-message'));
	assert.ok(kimiHistory([page(latest), page({ ...earlier, nextPageToken: 'older' }, 'older')], 'conversation', 'a2')!.reasons.includes('duplicate-cursor'));
	const noCursor = page({ messages: earlier.messages, totalCount: 2 });
	assert.ok(kimiHistory([noCursor], 'conversation', 'a1')!.reasons.includes('pagination-unverified'));
	const countMismatch = page({ ...earlier, totalCount: 10 });
	assert.ok(kimiHistory([countMismatch], 'conversation', 'a1')!.reasons.includes('message-count-mismatch'));
	const contradictory = page({ ...earlier, hasMore: true });
	assert.ok(kimiHistory([contradictory], 'conversation', 'a1')!.reasons.includes('pagination-unverified'));
});

test('a new first page replaces older observations and cannot borrow stale pagination to appear complete', () => {
	const pages = [page(latest), page(earlier, 'older'), page(latest)];
	const result = kimiHistory(pages, 'conversation', 'a2')!;
	assert.ok(result.reasons.includes('missing-page'));
	assert.ok(result.reasons.includes('message-count-mismatch'));
	assert.deepEqual(result.messages.map(message => message.id), ['a2', 'u2']);
});
