import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PageOwnership } from '../core/page-ownership';
import type { ProviderFactory, ProviderSession, ProviderSubmission } from '../core/providers/contracts';
import type { TargetBinding } from '../core/workspace/model';
import { ownedProviders } from './owned-providers';

const target = { pageId: 'page', profileId: 'default', generation: 'one' };
const binding: TargetBinding = { id: 'target', provider: 'deepseek', profileId: 'default', accountLabel: 'Default', status: 'ready', page: target };
const readiness = { identity: { page: target, provider: 'deepseek' as const, url: 'https://chat.deepseek.com' }, state: 'ready' as const, draft: '', messageIds: [] };
function setup(connect: ProviderFactory['connect']) {
	const ownership = new PageOwnership(), abort = new AbortController();
	const providers = ownedProviders({ connect }, (page, taskId, signal) => ownership.claim(page, { kind: 'workspace', id: taskId }, signal));
	return { ownership, abort, providers };
}
function native(dispose: () => void): ProviderSession {
	return { target, inspect: async () => readiness, stage: async () => readiness, newConversation: async () => readiness,
		commit: async () => ({ status: 'unknown' }), capture: async () => { throw Error('unexpected capture'); }, rollback: async () => {}, dispose };
}
test('cancellation while loading a provider disposes the late session and preserves the next page owner', async () => {
	let resolve!: (session: ProviderSession) => void, disposed = 0;
	const f = setup(() => new Promise(done => { resolve = done; }));
	const pending = f.providers.connect(binding, 'task', f.abort.signal);
	assert.equal(f.ownership.owner(target)?.id, 'task');
	f.abort.abort();
	const next = f.ownership.claim(target, { kind: 'control', id: 'human' }, new AbortController().signal);
	resolve(native(() => { disposed++; }));
	await assert.rejects(pending, /workspace_paused/);
	assert.equal(disposed, 1); next.admit(); assert.equal(f.ownership.owner(target)?.id, 'human'); next.release();
});
test('a dispatched known receipt survives takeover, while old calls and cleanup cannot mutate or free the next owner', async () => {
	let resolve!: (receipt: ProviderSubmission) => void, dispatchedSignal: AbortSignal | undefined, disposed = 0, inspections = 0;
	const session = native(() => { disposed++; });
	session.inspect = async () => { inspections++; return readiness; };
	session.commit = (_prompt, _before, signal) => { dispatchedSignal = signal; return new Promise(done => { resolve = done; }); };
	const f = setup(async () => session), owned = await f.providers.connect(binding, 'task', f.abort.signal);
	const pending = owned.commit('question', readiness, f.abort.signal);
	f.ownership.revoke(target); assert.equal(dispatchedSignal?.aborted, true);
	const next = f.ownership.claim(target, { kind: 'control', id: 'human' }, new AbortController().signal);
	const receipt: ProviderSubmission = { status: 'accepted', message: { conversationId: 'conversation', messageId: 'user', text: 'question' } };
	resolve(receipt); assert.deepEqual(await pending, receipt);
	assert.throws(() => owned.inspect(new AbortController().signal), /workspace_paused/); assert.equal(inspections, 0);
	owned.dispose(); assert.equal(disposed, 1); next.admit(); next.release();
});
test('failed provider connection releases its exclusive admission', async () => {
	const f = setup(async () => { throw Error('adapter unavailable'); });
	await assert.rejects(f.providers.connect(binding, 'task', f.abort.signal), /adapter unavailable/);
	assert.equal(f.ownership.owner(target), undefined);
});
