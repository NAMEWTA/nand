import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import type { TextStorage } from '../../../shared/storage/ports';
import type { AcceptedMessage, ProviderCapture, ProviderReadiness, ProviderSession, ProviderSubmission } from '../core/providers/contracts';
import { freezeTurn, retryContext, type WorkspaceTask } from '../core/workspace/model';
import { snapshotJson } from '../core/workspace/snapshot';
import { WorkspaceJournal } from '../platform/workspace-journal';
import { WorkspaceStore } from '../platform/workspace-store';
import { WorkspaceSender } from './workspace-sender';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function fixture(count = 2) {
	const files = new Map<string, string>(), events: string[] = [];
	let failWrite: (path: string, text: string) => boolean = () => false;
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => files.get(path)!, mkdir: async () => {},
		write: async (path, text) => { if (failWrite(path, text)) throw Error('read-only'); files.set(path, text); events.push(`write:${path}`); } };
	const store = new WorkspaceStore(storage, 'documents.json', () => {}), journal = new WorkspaceJournal(storage, 'journal.json', () => {});
	const task: WorkspaceTask = { id: 'task', title: 'Research', draft: 'Exact prompt', pinned: false, createdAt: 1, updatedAt: 1,
		targets: Array.from({ length: count }, (_, index) => ({ id: `target-${index}`, provider: 'deepseek', profileId: 'default', accountLabel: 'Personal',
			page: { pageId: `page-${index}`, profileId: 'default', generation: 'first' }, status: 'ready' })),
		selectedTargetIds: Array.from({ length: count }, (_, index) => `target-${index}`), visibleTargetIds: ['target-0'] };
	const turn = freezeTurn(task, 'turn', 1, task.draft, [], 2);
	await store.edit(data => { data.tasks.push(task); data.turns.push(turn); data.exchanges.push(...turn.targets.map((binding, index) => ({ id: `exchange-${index}`, turnId: turn.id,
		targetId: binding.id, attempts: [], submitState: 'idle' as const, acquisitionState: 'idle' as const, saveState: 'saved' as const, captures: [] }))); });
	let counter = 0, now = 10;
	const hooks: { stage?: (index: number, value: ProviderReadiness) => ProviderReadiness; commit?: (index: number, message: AcceptedMessage) => Promise<ProviderSubmission>;
		capture?: (index: number, value: ProviderCapture) => Promise<ProviderCapture>; inspect?: (index: number, value: ProviderReadiness) => Promise<ProviderReadiness> } = {};
	const factory = { connect: async (binding: typeof task.targets[number]): Promise<ProviderSession> => {
		const index = Number(binding.id.split('-').at(-1));
		const readiness: ProviderReadiness = { identity: { page: structuredClone(binding.page!), provider: binding.provider, url: 'https://chat.deepseek.com/', conversationId: binding.conversationId },
			state: 'ready', draft: '', messageIds: binding.conversationId ? [journal.list(`exchange-${index}`).findLast(row => row.outcome === 'accepted')?.acceptedMessageId ?? `user-${index}`, `answer-${index}`] : [], currentMessageId: binding.conversationId ? `answer-${index}` : undefined };
		return { target: structuredClone(binding.page!), inspect: async () => hooks.inspect ? hooks.inspect(index, structuredClone(readiness)) : structuredClone(readiness),
			newConversation: async () => { throw Error('Send must not create a conversation'); },
			stage: async prompt => { events.push(`stage:${index}`);
				assert.equal(new Set(journal.list().map(row => row.exchangeId)).size, count, 'Every recipient intent precedes the first stage');
				assert.equal(journal.list(`exchange-${index}`).at(-1)?.outcome, 'intent');
				readiness.draft = prompt; return hooks.stage ? hooks.stage(index, structuredClone(readiness)) : structuredClone(readiness); },
			commit: async prompt => { events.push(`commit:${index}`); assert.equal(journal.list(`exchange-${index}`).at(-1)?.outcome, 'dispatching');
				const attempt = journal.list(`exchange-${index}`).length;
				const message = { conversationId: binding.conversationId ?? `conversation-${index}`, messageId: `user-${index}` + (attempt > 1 ? `-${attempt}` : ''),
					parentId: readiness.currentMessageId, text: prompt };
				return hooks.commit ? hooks.commit(index, message) : { status: 'accepted', message }; },
			capture: async message => { events.push(`capture:${index}`);
				const value: ProviderCapture = { source: 'provider-api', adapterVersion: 'fixture-v1', conversationId: message.conversationId,
					messageId: `answer-${index}`, parentId: message.messageId, markdown: '# Answer\n\n| A | B |\n| --- | --- |\n| 1 | 2 |', complete: true, reasons: [], terminalEvidence: ['finished'] };
				return hooks.capture ? hooks.capture(index, value) : value; },
			rollback: async () => { events.push(`rollback:${index}`); }, dispose: () => { events.push(`dispose:${index}`); } };
	} };
	const sender = new WorkspaceSender({ store, journal, providers: factory, changed: () => {}, id: () => `id-${++counter}`, now: () => now++, hash: async () => 'a'.repeat(64) });
	return { store, journal, sender, files, storage, events, hooks, fail: (predicate: typeof failWrite) => { failWrite = predicate; },
		close: async () => { await sender.shutdown(); await store.shutdown(); await journal.shutdown(); } };
}

test('all intents precede native staging and all submissions precede long acquisition; receipts survive restart', async () => {
	const f = await fixture(); await f.sender.send('turn');
	assert.ok(f.events.indexOf('commit:1') < f.events.indexOf('capture:0'));
	assert.deepEqual(f.sender.data().exchanges.map(row => [row.submitState, row.acquisitionState, row.receipt?.conversationId]),
		[['submitted', 'complete', 'conversation-0'], ['submitted', 'complete', 'conversation-1']]);
	assert.equal(f.sender.data().tasks[0]!.targets[0]!.conversationId, 'conversation-0');
	await assert.rejects(f.sender.send('turn'), /retry_review/);
	assert.equal(f.events.filter(event => event.startsWith('commit:')).length, 2);
	await f.close();
	const restored = new WorkspaceStore(f.storage, 'documents.json', () => {}); await restored.ready;
	assert.equal(restored.data().exchanges[0]!.receipt?.messageId, 'user-0');
	assert.match(restored.data().exchanges[0]!.captures[0]!.markdown, /\| A \| B \|/); await restored.shutdown();
});

test('a fast answer is durable while another provider is still collecting', async () => {
	const f = await fixture(), entered = deferred<void>(), release = deferred<void>();
	f.hooks.capture = async (index, value) => { if (index === 1) { entered.resolve(); await release.promise; } return value; };
	const sending = f.sender.send('turn');
	try {
		await entered.promise;
		await vi.waitFor(() => assert.equal(JSON.parse(f.files.get('documents.json')!).exchanges[0].captures.length, 1));
		assert.equal(f.sender.busy('task'), true);
		assert.equal(JSON.parse(f.files.get('documents.json')!).exchanges[1].captures.length, 0);
	} finally { release.resolve(); await sending; await f.close(); }
});

test('later answers update the recovery draft after the first answer save fails', async () => {
	const f = await fixture(), entered = deferred<void>(), release = deferred<void>();
	f.hooks.capture = async (index, value) => { if (index === 1) { entered.resolve(); await release.promise; } return value; };
	f.fail((path, text) => path === 'documents.json' && JSON.parse(text).exchanges.some((row: { captures: unknown[] }) => row.captures.length));
	const sending = f.sender.send('turn'); void sending.catch(() => undefined);
	try {
		await entered.promise;
		await vi.waitFor(() => assert.ok([...f.files.keys()].some(path => path.startsWith('.nand/recovery/drafts/'))));
		assert.equal(f.sender.busy('task'), true);
		release.resolve(); await assert.rejects(sending, /read-only|save_pending/);
		const backups = [...f.files].filter(([path]) => path.startsWith('.nand/recovery/drafts/')).map(([, text]) => JSON.parse(text));
		const backup = backups.find(row => row.path === 'documents.json');
		assert.deepEqual(backup.draft.exchanges.map((row: { captures: unknown[] }) => row.captures.length), [1, 1]);
		assert.equal(f.events.filter(event => event.startsWith('commit:')).length, 2);
	} finally { release.resolve(); await sending.catch(() => undefined); f.fail(() => false); await f.sender.retrySave(); await f.close(); }
});

test('recollect is read-only, preserves human drafts and prior complete revisions, and makes the new partial current', async () => {
	const f = await fixture(); await f.sender.send('turn');
	const original = f.sender.data().exchanges[0]!, attempts = f.journal.list(), before = f.events.length;
	f.hooks.inspect = async (_index, value) => ({ ...value, draft: 'Human draft', state: 'generating' });
	f.hooks.capture = async (_index, value) => ({ ...value, markdown: 'New partial answer', complete: false, reasons: ['missing-page'] });
	await f.sender.recollect('exchange-0');
	const result = f.sender.data().exchanges[0]!;
	assert.deepEqual(f.journal.list(), attempts); assert.deepEqual(result.receipt, JSON.parse(JSON.stringify(original.receipt)));
	assert.deepEqual(result.captures[0], original.captures[0]); assert.equal(result.captures.length, 2);
	assert.equal(result.captures[1]!.revision, 2); assert.equal(result.currentCaptureId, result.captures[1]!.id);
	assert.equal(result.acquisitionState, 'incomplete'); assert.equal(result.saveState, 'saved');
	assert.deepEqual(f.events.slice(before).filter(event => !event.startsWith('write:')), ['capture:0', 'dispose:0']);
	assert.equal(f.sender.data().exchanges[1]!.captures.length, 1); await f.close();
});

test('recollect rejects unknown submission, missing original message and changed conversation without guessing by text', async () => {
	const f = await fixture(); f.hooks.commit = async (index, message) => index === 1 ? { status: 'unknown' } : { status: 'accepted', message };
	await f.sender.send('turn'); const before = f.events.length, attempts = f.journal.list();
	await assert.rejects(f.sender.recollect('exchange-1'), /submission_identity/);
	f.hooks.inspect = async (_index, value) => ({ ...value, messageIds: [], currentMessageId: undefined });
	await assert.rejects(f.sender.recollect('exchange-0'), /message_identity/);
	await f.store.edit(data => { data.tasks[0]!.targets[0]!.conversationId = 'another'; });
	await assert.rejects(f.sender.recollect('exchange-0'), /identity_changed/);
	assert.deepEqual(f.journal.list(), attempts);
	assert.equal(f.events.slice(before).some(event => /^(stage|commit|rollback|capture):/.test(event)), false); await f.close();
});

test('pause during recollect keeps the late capture partial and prevents concurrent collection', async () => {
	const f = await fixture(1); await f.sender.send('turn');
	const entered = deferred<void>(), response = deferred<void>(), before = f.events.length;
	f.hooks.capture = async (_index, value) => { entered.resolve(); await response.promise; return value; };
	const collecting = f.sender.recollect('exchange-0'); await entered.promise;
	await assert.rejects(f.sender.recollect('exchange-0'), /workspace_busy/); f.sender.pause('task'); response.resolve(); await collecting;
	const result = f.sender.data().exchanges[0]!;
	assert.equal(result.submitState, 'submitted'); assert.equal(result.attempts.length, 1);
	assert.equal(result.acquisitionState, 'incomplete'); assert.equal(result.captures.at(-1)!.complete, false);
	assert.ok(result.captures.at(-1)!.reasons.includes('interrupted'));
	assert.equal(f.events.slice(before).some(event => /^(stage|commit|rollback):/.test(event)), false); await f.close();
});

test('a recollected complete answer survives save failure and disk-only retry without another acquisition', async () => {
	const f = await fixture(1); await f.sender.send('turn');
	f.fail((path, text) => path === 'documents.json' && JSON.parse(text).exchanges[0].captures.length === 2);
	await assert.rejects(f.sender.recollect('exchange-0'), /read-only/);
	const result = f.sender.data().exchanges[0]!;
	assert.equal(result.acquisitionState, 'complete'); assert.equal(result.saveState, 'failed'); assert.equal(result.captures.length, 2);
	f.fail(() => false); const before = f.events.filter(event => !event.startsWith('write:'));
	await f.sender.retrySave(); assert.deepEqual(f.events.filter(event => !event.startsWith('write:')), before);
	assert.equal(f.sender.data().exchanges[0]!.saveState, 'saved'); await f.close();
});

test('explicit resend creates one new attempt, retains uncertainty and leaves successful recipients and the immutable turn untouched', async () => {
	const f = await fixture(); f.hooks.commit = async (index, message) => index === 0 ? { status: 'unknown' } : { status: 'accepted', message };
	await f.sender.send('turn'); const original = f.sender.data(), previous = f.journal.list('exchange-0')[0]!, before = f.events.length;
	f.hooks.commit = undefined;
	await f.sender.retrySend('exchange-0', snapshotJson(retryContext(f.sender.data(), 'exchange-0')));
	const after = f.sender.data();
	assert.deepEqual(after.turns, original.turns); assert.equal(snapshotJson(after.exchanges[1]), snapshotJson(original.exchanges[1]));
	assert.deepEqual(after.tasks[0]!.selectedTargetIds, original.tasks[0]!.selectedTargetIds);
	assert.deepEqual(after.tasks[0]!.visibleTargetIds, original.tasks[0]!.visibleTargetIds);
	assert.deepEqual(f.journal.list('exchange-0')[0], previous);
	assert.deepEqual(after.exchanges[0]!.attempts.map(row => row.outcome), ['unknown', 'accepted']);
	assert.equal(after.exchanges[0]!.acquisitionState, 'complete');
	assert.deepEqual(f.events.slice(before).filter(event => !event.startsWith('write:')), ['stage:0', 'commit:0', 'capture:0', 'dispose:0']);
	await assert.rejects(f.sender.retrySend('exchange-0', undefined), /retry_review/); await f.close();
});

test('resend validates reviewed identity, preserves human drafts and cannot mutate before a new intent is durable', async () => {
	const f = await fixture(1); f.hooks.commit = async () => ({ status: 'unknown' }); await f.sender.send('turn');
	const source = snapshotJson(retryContext(f.sender.data(), 'exchange-0')), before = f.events.length, attempts = f.journal.list();
	await f.store.edit(data => { const binding = data.tasks[0]!.targets[0]!; binding.page = { ...binding.page!, generation: 'reopened' }; });
	await assert.rejects(f.sender.retrySend('exchange-0', source), /preview_changed/);
	const fresh = snapshotJson(retryContext(f.sender.data(), 'exchange-0'));
	f.hooks.inspect = async (_index, value) => ({ ...value, draft: 'Human draft' });
	await assert.rejects(f.sender.retrySend('exchange-0', fresh), /draft_changed/);
	f.hooks.inspect = undefined; f.fail((path, text) => path === 'journal.json' && JSON.parse(text).attempts.length === 2);
	await assert.rejects(f.sender.retrySend('exchange-0', fresh), /read-only/);
	assert.deepEqual(f.journal.list(), attempts);
	assert.equal(f.events.slice(before).some(event => /^(stage|commit|rollback|capture):/.test(event)), false);
	f.fail(() => false); await f.sender.retrySave();
	assert.deepEqual(f.journal.list(), attempts);
	assert.equal(f.events.slice(before).some(event => /^(stage|commit|rollback|capture):/.test(event)), false); await f.close();
});

test('resend reloads newly durable acceptance and cannot dispatch from stale in-memory uncertainty', async () => {
	const f = await fixture(1); f.hooks.commit = async () => ({ status: 'unknown' }); await f.sender.send('turn');
	const source = snapshotJson(retryContext(f.sender.data(), 'exchange-0')), before = f.events.length;
	const journal = JSON.parse(f.files.get('journal.json')!);
	Object.assign(journal.attempts[0], { outcome: 'accepted', acceptedMessageId: 'remote-user', acceptedConversationId: 'remote-conversation' });
	f.files.set('journal.json', JSON.stringify(journal));
	await assert.rejects(f.sender.retrySend('exchange-0', source), /retry_review/);
	assert.equal(f.events.slice(before).some(event => /^(stage|commit|rollback|capture):/.test(event)), false);
	assert.equal(f.journal.list().length, 1); await f.close();
});

test('retry uses an explicitly rebound conversation without rewriting the original turn target', async () => {
	const f = await fixture(1); f.hooks.commit = async () => ({ status: 'not-sent' }); await f.sender.send('turn');
	const turn = f.sender.data().turns[0]!;
	await f.store.edit(data => { const binding = data.tasks[0]!.targets[0]!; binding.page = { ...binding.page!, generation: 'second' }; binding.conversationId = 'rebound'; });
	f.hooks.commit = undefined; await f.sender.retrySend('exchange-0', snapshotJson(retryContext(f.sender.data(), 'exchange-0')));
	const after = f.sender.data(); assert.deepEqual(after.turns[0], turn);
	assert.equal(after.exchanges[0]!.receipt!.conversationId, 'rebound');
	assert.equal(after.exchanges[0]!.receipt!.parentId, 'answer-0');
	assert.equal(after.exchanges[0]!.attempts[1]!.expectedTarget.generation, 'second');
	assert.equal(after.tasks[0]!.targets[0]!.officialUrl, 'https://chat.deepseek.com/a/chat/s/rebound');
	await f.close();
});

test('a failed intent flush causes zero input mutations, including rollback, on every selected target', async () => {
	const f = await fixture(); f.fail((path, text) => path === 'journal.json' && JSON.parse(text).attempts.length === 2);
	await assert.rejects(f.sender.send('turn'), /read-only/);
	assert.equal(f.events.some(event => /^(stage|commit|rollback):/.test(event)), false);
	assert.equal(f.events.filter(event => event.startsWith('dispose:')).length, 2);
	f.fail(() => false); await f.close();
});

test('a draft changed after review reports every untouched recipient as not sent without creating attempts', async () => {
	const f = await fixture(); f.hooks.inspect = async (index, value) => index === 1 ? { ...value, draft: 'Human draft' } : value;
	await assert.rejects(f.sender.send('turn'), /draft_changed/);
	assert.deepEqual(f.sender.data().exchanges.map(row => [row.submitState, row.lastError, row.attempts.length]),
		[['not-sent', 'browser_workspace_draft_changed', 0], ['not-sent', 'browser_workspace_draft_changed', 0]]);
	assert.equal(f.events.some(event => /^(stage|commit|rollback):/.test(event)), false); await f.close();
});

test('edited staged text rejects the whole batch before any submit and releases every session', async () => {
	const f = await fixture(); f.hooks.stage = (index, value) => index === 1 ? { ...value, draft: 'User edited draft' } : value;
	await assert.rejects(f.sender.send('turn'), /draft_changed/);
	assert.equal(f.events.some(event => event.startsWith('commit:')), false);
	assert.equal(f.events.filter(event => event.startsWith('rollback:')).length, 2);
	assert.ok(f.journal.list().every(row => row.outcome === 'not-sent')); await f.close();
});

test('uncertain dispatch is never retried and cannot erase another target success or become an accepted page-text change', async () => {
	const f = await fixture(); f.hooks.commit = async (index, message) => { if (index === 0) throw Error('Disconnected after click'); return { status: 'accepted', message }; };
	await f.sender.send('turn');
	assert.deepEqual(f.sender.data().exchanges.map(row => row.submitState), ['unknown', 'submitted']);
	assert.deepEqual(f.events.filter(event => event.startsWith('capture:')), ['capture:1']);
	await f.sender.retrySave(); assert.equal(f.events.filter(event => event.startsWith('commit:')).length, 2); await f.close();
});

test('a known accepted receipt survives a journal write failure; explicit save retry performs no native operation', async () => {
	const f = await fixture(); f.fail((path, text) => path === 'journal.json' && JSON.parse(text).attempts.some((row: { outcome: string }) => row.outcome === 'accepted'));
	await assert.rejects(f.sender.send('turn'), /read-only/);
	assert.equal(f.sender.data().exchanges[0]!.submitState, 'submitted');
	assert.equal(f.sender.data().exchanges[0]!.receipt?.conversationId, 'conversation-0');
	assert.equal(f.events.includes('commit:1'), false); assert.ok(f.events.includes('rollback:1'));
	f.fail(() => false); const before = f.events.filter(event => !event.startsWith('write:'));
	await f.sender.retrySave();
	assert.deepEqual(f.events.filter(event => !event.startsWith('write:')), before);
	assert.equal(f.journal.list('exchange-0')[0]!.acceptedConversationId, 'conversation-0'); await f.close();
});

test('failed Markdown writes retain later observed facts and a save retry cannot resend', async () => {
	const f = await fixture(); f.fail((path, text) => path === 'documents.json' && JSON.parse(text).exchanges.some((row: { receipt?: unknown }) => row.receipt));
	await assert.rejects(f.sender.send('turn'), /read-only/);
	assert.equal(f.store.hasPendingSave(), true); assert.equal(f.sender.data().exchanges[0]!.acquisitionState, 'incomplete');
	assert.equal(f.sender.data().exchanges[1]!.submitState, 'not-sent');
	f.fail(() => false); await f.sender.retrySave();
	assert.equal(f.store.data().exchanges[0]!.acquisitionState, 'incomplete');
	assert.equal(f.store.data().exchanges[1]!.submitState, 'not-sent');
	assert.deepEqual(f.events.filter(event => event.startsWith('commit:')), ['commit:0']); await f.close();
});

test('pause stops later targets and rollback mutations while preserving a late accepted receipt', async () => {
	const f = await fixture(), entered = deferred<void>(), response = deferred<ProviderSubmission>();
	f.hooks.commit = async (_index, message) => { entered.resolve(); const result = await response.promise; return { ...result, message }; };
	const sending = f.sender.send('turn'); await entered.promise;
	f.sender.pause('task'); response.resolve({ status: 'accepted' });
	await assert.rejects(sending, /paused/);
	assert.equal(f.sender.data().exchanges[0]!.submitState, 'submitted');
	assert.equal(f.sender.data().exchanges[1]!.submitState, 'paused');
	assert.equal(f.events.includes('capture:0'), false); assert.equal(f.events.includes('commit:1'), false);
	assert.equal(f.events.some(event => event.startsWith('rollback:')), false, 'A human takeover must not clear a staged draft after revoking mutation admission');
	assert.equal(f.events.filter(event => event.startsWith('dispose:')).length, 2); await f.close();
});

test('a failed answer document save preserves proven acquisition completion and reports only saving as failed', async () => {
	const f = await fixture(1); f.fail((path, text) => path === 'documents.json' && JSON.parse(text).exchanges.some((row: { captures: unknown[] }) => row.captures.length));
	await assert.rejects(f.sender.send('turn'), /read-only/);
	const exchange = f.sender.data().exchanges[0]!;
	assert.equal(exchange.submitState, 'submitted'); assert.equal(exchange.acquisitionState, 'complete');
	assert.equal(exchange.saveState, 'failed'); assert.equal(exchange.captures[0]!.complete, true);
	f.fail(() => false); await f.sender.retrySave();
	assert.equal(f.sender.data().exchanges[0]!.saveState, 'saved');
	assert.deepEqual(f.events.filter(event => event.startsWith('commit:')), ['commit:0']); await f.close();
});

test('a capture from the wrong parent or without terminal evidence cannot become a current complete answer', async () => {
	const f = await fixture(); f.hooks.capture = async (index, value) => index === 0 ? { ...value, parentId: 'old-user' } : { ...value, terminalEvidence: [] };
	await f.sender.send('turn');
	assert.ok(f.sender.data().exchanges.every(row => row.submitState === 'submitted' && row.acquisitionState === 'incomplete' && row.captures.length === 0));
	await f.close();
});

test('pause retains already observed answer content as partial without admitting a rollback mutation', async () => {
	const f = await fixture(1), entered = deferred<void>(), release = deferred<void>();
	f.hooks.capture = async (_index, value) => { entered.resolve(); await release.promise; return value; };
	const sending = f.sender.send('turn'); await entered.promise; f.sender.pause('task'); release.resolve(); await sending;
	const exchange = f.sender.data().exchanges[0]!;
	assert.equal(exchange.submitState, 'submitted'); assert.equal(exchange.acquisitionState, 'incomplete');
	assert.match(exchange.captures[0]!.markdown, /# Answer/); assert.ok(exchange.captures[0]!.reasons.includes('interrupted'));
	assert.equal(f.events.some(event => event.startsWith('rollback:')), false); await f.close();
});

test('recovering an interrupted dispatch records uncertainty without starting any native operation', async () => {
	const f = await fixture(1);
	await f.journal.reserve({ id: 'crashed-attempt', taskId: 'task', turnId: 'turn', exchangeId: 'exchange-0', target: { pageId: 'page-0', profileId: 'default', generation: 'first' }, promptHash: 'a'.repeat(64), at: 3 });
	await f.journal.staged('crashed-attempt'); await f.journal.dispatching('crashed-attempt', 4);
	await f.sender.recover();
	assert.equal(f.sender.data().exchanges[0]!.submitState, 'unknown');
	assert.ok(f.events.every(event => event.startsWith('write:'))); await assert.rejects(f.sender.send('turn'), /retry_review/); await f.close();
});
