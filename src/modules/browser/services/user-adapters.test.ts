import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'vitest';
import type { TextStorage } from '../../../shared/storage/ports';
import type { ProviderFactory, ProviderReadiness } from '../core/providers/contracts';
import { adapterVersion, type AdapterDefinition } from '../core/providers/user-adapter';
import { WorkspaceStore } from '../platform/workspace-store';
import { WorkspaceJournal } from '../platform/workspace-journal';
import { UserAdapterStore } from '../platform/user-adapter-store';
import { Workspace } from './workspace';
import { UserAdapters } from './user-adapters';

const definition: AdapterDefinition = { title: 'Changed DOM', provider: 'deepseek', origin: 'https://chat.deepseek.com', profileScope: 'default', pathPattern: '/*',
	selectors: { composer: '#composer', submit: '#send', answer: '.answer' } };
const target = { pageId: 'page', profileId: 'default', generation: 'generation' };
async function fixture() {
	const files = new Map<string, string>(); let id = 0, commits = 0, currentMessageId: string | undefined, unknown = false, draft = '';
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => files.get(path)!, write: async (path, text) => { files.set(path, text); }, mkdir: async () => {} };
	const store = new UserAdapterStore(storage, 'rules.json', () => {}, 'recovery.json');
	let adapters!: UserAdapters;
	const providers: ProviderFactory = { connect: async (binding, taskId) => {
		const override = await adapters.resolve(binding, taskId);
		const ready = (): ProviderReadiness => ({ identity: { provider: binding.provider, page: target, url: definition.origin + '/a/chat/s/conversation', conversationId: 'conversation', adapterVersion: override && adapterVersion(override.rule) },
			state: 'ready', draft, messageIds: currentMessageId ? [currentMessageId] : [], currentMessageId });
		return { target, inspect: async () => { override?.admit(); return ready(); }, newConversation: async () => ready(),
			stage: async prompt => { draft = prompt; return ready(); },
			commit: async prompt => { override?.commit(); commits++; draft = ''; return unknown ? { status: 'unknown' } : { status: 'accepted', message: { conversationId: 'conversation', messageId: 'user', parentId: currentMessageId, text: prompt } }; },
			capture: async () => { currentMessageId = 'answer'; return { adapterVersion: override ? adapterVersion(override.rule) + '-dom-v1' : 'builtin', conversationId: 'conversation',
				messageId: 'answer', parentId: 'user', source: 'scoped-dom', markdown: 'Selected answer', complete: false, reasons: ['scoped-dom-coverage-unverified'], terminalEvidence: ['observed-generation-ended'] }; },
			rollback: async () => { draft = ''; }, dispose: () => {} };
	} };
	const workspace = new Workspace({ store: new WorkspaceStore(storage, 'workspace.json', () => {}), journal: new WorkspaceJournal(storage, 'journal.json', () => {}), providers,
		target: () => target, id: () => `id-${++id}`, now: () => 100, hash: async text => createHash('sha256').update(text).digest('hex') });
	adapters = new UserAdapters({ store, workspace: async () => workspace, page: () => ({ url: definition.origin + '/a/chat/s/conversation', accountLabel: 'Personal' }),
		enabled: () => true, id: () => `id-${++id}`, now: () => 100 });
	await Promise.all([store.ready, workspace.ready]);
	const binding = { id: 'target', provider: 'deepseek' as const, profileId: 'default', accountLabel: 'Personal', status: 'ready' as const, page: target };
	return { adapters, workspace, store, binding, files, commits: () => commits, unknown: () => { unknown = true; }, changeAnswer: () => { currentMessageId = 'another-answer'; },
		close: async () => { await adapters.shutdown(); await workspace.shutdown(); } };
}
test('candidate uses the real workspace journal and one consumed send; current-answer confirmation enables and withdrawal restores built-in', async () => {
	const f = await fixture(), rule = await f.adapters.save(definition);
	assert.equal(await f.adapters.resolve(f.binding, 'ordinary'), undefined);
	const review = await f.adapters.preview(rule.id, target, 'Question', 'Changed composer and answer containers');
	assert.equal(f.commits(), 0); assert.equal(f.workspace.data().turns.length, 0);
	await assert.rejects(f.adapters.enable(review.id), /adapter_review/);
	const result = await f.adapters.send(review.id); assert.equal(f.commits(), 1);
	assert.equal(result.capture.complete, false); assert.ok(f.files.get('journal.json')?.includes('accepted'));
	await assert.rejects(f.adapters.send(review.id), /adapter_review/);
	assert.equal(await f.adapters.resolve(f.binding, 'ordinary'), undefined);
	await f.adapters.enable(review.id);
	const active = await f.adapters.resolve(f.binding, 'ordinary'); assert.equal(active?.rule.id, rule.id); active!.admit();
	await f.adapters.disable(rule.id); assert.throws(() => active!.admit(), /preview_changed/);
	assert.equal(await f.adapters.resolve(f.binding, 'ordinary'), undefined); assert.equal(f.commits(), 1);
	await f.close();
});
test('unknown submission cannot enable or replay; editing invalidates prior candidate previews', async () => {
	const f = await fixture(), rule = await f.adapters.save(definition);
	let review = await f.adapters.preview(rule.id, target, 'Question', 'Unknown acceptance'); f.unknown();
	await assert.rejects(f.adapters.send(review.id), /adapter_answer/);
	await assert.rejects(f.adapters.send(review.id), /adapter_review/);
	await assert.rejects(f.adapters.enable(review.id), /adapter_review/);
	assert.equal((await f.adapters.list())[0]!.state, 'candidate'); assert.equal(f.commits(), 1);
	review = await f.adapters.preview(rule.id, target, 'Question', 'Changed definition');
	const next = await f.adapters.save({ ...definition, selectors: { ...definition.selectors, answer: '.new-answer' } }, rule.id);
	assert.equal(next.version, 2); assert.equal(next.verification, undefined);
	await assert.rejects(f.adapters.send(review.id), /adapter_review/); assert.equal(f.commits(), 1);
	await f.close();
});
test('confirmation rejects a later website answer and profile escape without changing the rule', async () => {
	const f = await fixture(), rule = await f.adapters.save(definition);
	await assert.rejects(f.adapters.preview(rule.id, { ...target, profileId: 'other' }, 'Question', 'Wrong account'), /adapter_scope/);
	const review = await f.adapters.preview(rule.id, target, 'Question', 'Current answer'); await f.adapters.send(review.id); f.changeAnswer();
	await assert.rejects(f.adapters.enable(review.id), /adapter_answer/);
	assert.equal((await f.adapters.list())[0]!.state, 'candidate'); assert.equal(f.commits(), 1); await f.close();
});
