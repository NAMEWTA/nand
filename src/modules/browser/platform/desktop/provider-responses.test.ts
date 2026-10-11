import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'vitest';
import type { GuestContents } from './electron-api';
import { ProviderResponses } from './provider-responses';

const tick = async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); };
const response = (native: EventEmitter, id: string, url = 'https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=conversation') => {
	native.emit('message', {}, 'Network.responseReceived', { requestId: id, response: { url, status: 200, mimeType: 'application/json', headers: { 'set-cookie': 'fixture-secret-cookie' } } });
	native.emit('message', {}, 'Network.loadingFinished', { requestId: id, encodedDataLength: 120 });
};
test('passive provider capture ignores foreign endpoints, projects bounded data, and removes only its listeners', async () => {
	const native = new EventEmitter(), abort = new AbortController(), read: string[] = [];
	const unrelated = () => {}; native.on('message', unrelated);
	const capture = new ProviderResponses(nativeGuest(native), { signal: abort.signal, admit: () => {},
		allow: url => url.origin === 'https://chat.deepseek.com' && url.pathname === '/api/v0/chat/history_messages' ? url.searchParams.get('chat_session_id') ?? undefined : undefined,
		readBody: async id => { read.push(id); return { body: JSON.stringify({ message: id, access_token: 'fixture-secret-token', headers: { authorization: 'fixture-secret-bearer' } }), base64Encoded: false }; },
		project: (value, conversationId) => ({ conversationId, message: (value as { message: string }).message }) });
	response(native, 'foreign', 'https://example.com/api/v0/chat/history_messages?chat_session_id=conversation');
	response(native, 'credentials', 'https://chat.deepseek.com/api/v0/account');
	for (let index = 0; index < 12; index++) { response(native, `message-${index}`); await tick(); }
	assert.equal(read.length, 12); assert.equal(capture.values().length, 8);
	assert.equal(capture.values().at(-1)!.message, 'message-11'); assert.equal(JSON.stringify(capture.values()).includes('fixture-secret'), false);
	abort.abort(); assert.equal(capture.values().length, 0);
	assert.deepEqual(native.listeners('message'), [unrelated]); assert.equal(native.listenerCount('detach'), 0);
	response(native, 'closed'); await tick(); assert.equal(read.length, 12); capture.dispose();
});

test('late responses cannot cross disposal or generation changes and acquisition order survives slow older responses', async () => {
	const native = new EventEmitter(), abort = new AbortController();
	const pending = new Map<string, (value: unknown) => void>(); let current = true;
	const capture = new ProviderResponses(nativeGuest(native), { signal: abort.signal, admit: () => { if (!current) throw Error('stale'); }, allow: () => 'conversation',
		readBody: id => new Promise(resolve => { pending.set(id, resolve); }), project: value => value as { message: string } });
	response(native, 'old'); response(native, 'new');
	pending.get('new')!({ body: '{"message":"new"}' }); await tick(); pending.get('old')!({ body: '{"message":"old"}' }); await tick();
	assert.deepEqual(capture.values().map(value => value.message), ['old', 'new']);
	response(native, 'late'); current = false; pending.get('late')!({ body: '{"message":"wrong-generation"}' }); await tick();
	assert.equal(capture.values().some(value => value.message === 'wrong-generation'), false);
	native.emit('detach'); assert.deepEqual(capture.values(), []); assert.equal(native.listenerCount('message'), 0);
	const aborted = new AbortController(); aborted.abort();
	const closed = new ProviderResponses(nativeGuest(native), { signal: aborted.signal, admit: () => {}, allow: () => 'conversation', readBody: async () => ({}), project: () => undefined });
	assert.deepEqual(closed.values(), []); assert.equal(native.listenerCount('message'), 0);
});

test('POST observation retains only projected conversation/cursor and requires a matching allowlisted request', async () => {
	const native = new EventEmitter(), abort = new AbortController(), reads: string[] = [], projected: string[] = [];
	const endpoint = 'https://www.kimi.com/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages';
	const capture = new ProviderResponses(nativeGuest(native), { signal: abort.signal, admit: () => {},
		allow: url => url.href === endpoint,
		requestIdentity: (body, method) => {
			projected.push(method); const request = JSON.parse(body) as { chat_id: string; page_token?: string };
			return method === 'POST' ? { conversationId: request.chat_id, cursor: request.page_token } : undefined;
		},
		readBody: async id => { reads.push(id); return { body: '{"message":"public","access_token":"secret"}' }; },
		project: (_raw, conversationId, request) => ({ conversationId, cursor: request?.cursor }) });
	const request = (id: string, url = endpoint, body = '{"chat_id":"conversation","page_token":"older","token":"secret"}') =>
		native.emit('message', {}, 'Network.requestWillBeSent', { requestId: id, request: { url, method: 'POST', postData: body, headers: { authorization: 'secret' } } });
	response(native, 'missing-request', endpoint);
	request('foreign', 'https://other.test'); response(native, 'foreign', endpoint);
	request('large', endpoint, 'x'.repeat(16385)); response(native, 'large', endpoint);
	request('redirect'); request('redirect', 'https://other.test'); response(native, 'redirect', endpoint);
	request('valid'); response(native, 'valid', endpoint); await tick();
	assert.deepEqual(reads, ['valid']); assert.deepEqual(projected, ['POST', 'POST']);
	assert.deepEqual(capture.values(), [{ conversationId: 'conversation', cursor: 'older' }]);
	assert.equal(JSON.stringify(capture.values()).includes('secret'), false);
	request('unanswered'); abort.abort(); response(native, 'unanswered', endpoint); await tick();
	assert.deepEqual(reads, ['valid']); assert.deepEqual(capture.values(), []); assert.equal(native.listenerCount('message'), 0);
});

function nativeGuest(events: EventEmitter): GuestContents { return { debugger: events } as unknown as GuestContents; }
