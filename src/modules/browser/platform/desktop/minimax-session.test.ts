import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { TargetBinding } from '../../core/workspace/model';
import type { BrowserPage } from './page';
import type { ProviderDom } from './provider-dom';
import { minimaxProviderFactory } from './minimax-session';

function fixture(url = 'https://agent.minimax.io/') {
	const abort = new AbortController(), target = { pageId: 'page', profileId: 'account', generation: 'one' };
	const binding: TargetBinding = { id: 'target', provider: 'minimax', profileId: 'account', accountLabel: 'Account', status: 'ready', page: target };
	const dom: ProviderDom = { url, composer: { selector: '#composer', value: '' }, messages: [], messageRootCount: 0, messageIdentitiesComplete: true,
		generating: false, loginRequired: false, challenge: false, interrupted: false };
	let reads = 0;
	const page = { state: { id: 'page', url }, profileId: 'account', generation: 'one', disposed: false,
		guest: { get debugger(): never { throw Error('DOM-only session must not attach a response observer'); } },
		automation: { queue: { abort }, readProviderDom: async () => { reads++; return structuredClone(dom); } } } as unknown as BrowserPage;
	const factory = minimaxProviderFactory({ enabled: () => true, page: () => page, activate: async () => {} });
	return { abort, binding, dom, page, reads: () => reads, connect: () => factory.connect(binding, 'task', abort.signal) };
}

test('MiniMax accepts either official host without accessing a network response observer', async () => {
	for (const host of ['agent.minimax.io', 'chat.minimax.io', 'agent.minimax.cn']) {
		const f = fixture('https://' + host + '/'), session = await f.connect();
		assert.equal((await session.inspect(f.abort.signal)).state, 'ready'); session.dispose();
		await assert.rejects(session.inspect(new AbortController().signal), /workspace_paused/);
	}
	for (const url of ['http://agent.minimax.io/', 'https://agent.minimax.io.other.test/', 'https://user:secret@agent.minimax.io/'])
		await assert.rejects(fixture(url).connect(), /identity_changed/);
});

test('changing MiniMax hosts invalidates an existing session before reading or staging any content', async () => {
	const f = fixture(); f.binding.officialUrl = 'https://agent.minimax.io/';
	const session = await f.connect(); f.page.state.url = 'https://chat.minimax.io/'; f.dom.url = f.page.state.url;
	await assert.rejects(session.inspect(f.abort.signal), /identity_changed/); assert.equal(f.reads(), 0); session.dispose();
	await assert.rejects(f.connect(), /identity_changed/); f.binding.officialUrl = undefined;
	const fresh = await f.connect(); assert.equal((await fresh.inspect(f.abort.signal)).state, 'ready'); fresh.dispose();
});

test('visible messages without conversation identity cannot become a ready MiniMax target', async () => {
	const f = fixture(), session = await f.connect(); f.dom.messageRootCount = 1;
	f.dom.messages = [{ id: 'user', role: 'user', parentKnown: true, text: 'Question', html: 'Question', partial: false }];
	assert.equal((await session.inspect(f.abort.signal)).state, 'unsupported'); f.dom.conversationId = 'conversation';
	assert.equal((await session.inspect(f.abort.signal)).state, 'ready'); session.dispose();
});
