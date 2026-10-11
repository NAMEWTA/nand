import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PageOwnership } from '../core/page-ownership';
import type { ProviderSession } from '../core/providers/contracts';
import type { WorkspaceData } from '../core/workspace/model';
import { openWorkspaceSource } from './workspace-source';

function fixture() {
	const page = { pageId: 'source', profileId: 'original-account', generation: 'new' }, ownership = new PageOwnership(), abort = new AbortController();
	const events: unknown[] = [], unexpected = async () => { throw Error('Source navigation cannot acquire or mutate a prompt'); };
	const data: WorkspaceData = { version: 1, tasks: [], templates: [], syntheses: [], turns: [{ id: 'turn', taskId: 'task', sequence: 1, question: 'Q', finalPrompt: 'Q', templates: [], createdAt: 1,
		targets: [{ id: 'target', provider: 'chatgpt', profileId: page.profileId, accountLabel: 'Original', status: 'ready', officialUrl: 'https://untrusted.invalid/', conversationId: 'old' }] }],
		exchanges: [{ id: 'exchange', turnId: 'turn', targetId: 'target', submitState: 'submitted', acquisitionState: 'incomplete', saveState: 'saved', attempts: [],
			receipt: { attemptId: 'attempt', conversationId: 'conversation', messageId: 'user' }, currentCaptureId: 'capture', captures: [{ id: 'capture', exchangeId: 'exchange', revision: 1,
				conversationId: 'conversation', messageId: 'answer', parentId: 'user', source: 'scoped-dom', adapterVersion: 'fixture', markdown: 'Text is not identity', complete: false,
				reasons: ['scoped-dom-coverage-unverified'], terminalEvidence: [], capturedAt: 1 }] }] };
	let connected: (() => Promise<void>) | undefined;
	const session: ProviderSession = { target: page, inspect: unexpected, newConversation: unexpected, stage: unexpected, commit: unexpected, capture: unexpected, rollback: unexpected,
		reveal: async message => { events.push(['reveal', message]); }, dispose: () => { events.push('dispose'); } };
	const ports = { open: async (url: string, profileId: string) => { events.push(['open', url, profileId]); return page; },
		claim: () => ownership.claim(page, { kind: 'control' as const, id: 'source' }, abort.signal), providers: { connect: async () => { await connected?.(); return session; } } };
	return { data, ports, events, ownership, page, abort, connected: (hook: () => Promise<void>) => { connected = hook; } };
}

test('source navigation uses captured conversation and original profile, ignores stored URLs and leaves every task fact intact', async () => {
	const f = fixture(), before = structuredClone(f.data); await openWorkspaceSource(f.data, 'exchange', 'capture', f.ports);
	assert.deepEqual(f.events, [['open', 'https://chatgpt.com/c/conversation', 'original-account'], ['reveal', { conversationId: 'conversation', messageId: 'answer', parentId: 'user' }], 'dispose']);
	assert.deepEqual(f.data, before); assert.equal(f.ownership.owner(f.page), undefined);
});

test('wrong capture parent or account is rejected without revealing another page', async () => {
	const f = fixture(); f.data.exchanges[0]!.captures[0]!.parentId = 'another-user';
	await assert.rejects(openWorkspaceSource(f.data, 'exchange', 'capture', f.ports), /capture_identity/); assert.deepEqual(f.events, []);
	f.data.exchanges[0]!.captures[0]!.parentId = 'user';
	f.page.profileId = 'other-account'; await assert.rejects(openWorkspaceSource(f.data, 'exchange', 'capture', f.ports), /identity_changed/);
	assert.equal(f.events.some(event => Array.isArray(event) && event[0] === 'reveal'), false);
});

test('closing the source page during adapter loading releases its session without a late reveal', async () => {
	const f = fixture(); f.connected(async () => { f.abort.abort(); });
	await assert.rejects(openWorkspaceSource(f.data, 'exchange', 'capture', f.ports), /paused/);
	assert.deepEqual(f.events, [['open', 'https://chatgpt.com/c/conversation', 'original-account'], 'dispose']);
	assert.equal(f.ownership.owner(f.page), undefined);
});

test('a DOM-only provider reveals its exact captured page and never invents a permalink', async () => {
	for (const provider of ['coze', 'minimax'] as const) {
		const f = fixture(), target = f.data.turns[0]!.targets[0]!; target.provider = provider;
		await assert.rejects(openWorkspaceSource(f.data, 'exchange', 'capture', f.ports), /source_not_loaded/);
		assert.deepEqual(f.events, []); target.page = structuredClone(f.page);
		await openWorkspaceSource(f.data, 'exchange', 'capture', f.ports);
		assert.deepEqual(f.events, [['reveal', { conversationId: 'conversation', messageId: 'answer', parentId: 'user' }], 'dispose']);
		assert.equal(f.ownership.owner(f.page), undefined);
	}
});
