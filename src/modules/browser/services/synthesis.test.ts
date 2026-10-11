import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { AgentDispatchReceipt, AgentDispatchRequest, AgentPromptRequest, AgentPromptResult } from '../../agent/api';
import type { TextStorage } from '../../../shared/storage/ports';
import { emptyWorkspace, freezeTurn, type WorkspaceData } from '../core/workspace/model';
import { workspaceDocuments } from '../core/workspace/documents';
import { decodeWorkspaceRecovery, mergeWorkspaceRecovery } from '../core/workspace/recovery';
import { WorkspaceStore } from '../platform/workspace-store';
import { WorkspaceSynthesis, type SynthesisRequest } from './synthesis';

function sources(): WorkspaceData {
	const data = emptyWorkspace();
	const task = { id: 'task', title: 'Sources', draft: 'Selected question', pinned: false, createdAt: 1, updatedAt: 1,
		targets: [{ id: 'target', provider: 'deepseek' as const, profileId: 'default', accountLabel: 'Personal', status: 'ready' as const,
			page: { pageId: 'page', profileId: 'default', generation: 'generation' } }], selectedTargetIds: ['target'], visibleTargetIds: [] };
	data.tasks.push(task); data.turns.push(freezeTurn(task, 'turn', 1, 'Prompt', [], 1));
	data.exchanges.push({ id: 'exchange', turnId: 'turn', targetId: 'target', attempts: [], submitState: 'submitted', acquisitionState: 'complete', saveState: 'saved',
		captures: [1, 2].map(revision => ({ id: `capture-${revision}`, exchangeId: 'exchange', revision, source: 'provider-api', adapterVersion: 'fixture',
			conversationId: 'conversation', messageId: 'answer', markdown: revision === 1 ? 'Earlier selected answer' : 'Newest excluded answer', complete: revision === 2,
			reasons: revision === 1 ? ['incomplete'] : [], terminalEvidence: revision === 2 ? ['finished'] : [], capturedAt: revision })), currentCaptureId: 'capture-2' });
	return data;
}
async function fixture() {
	const files = new Map<string, string>([['documents', JSON.stringify(sources())]]), calls: AgentPromptRequest[] = [], dispatches: AgentDispatchRequest[] = [], opened: string[] = [];
	let fail = false, available = true, id = 0, now = 10;
	let respond: (request: AgentPromptRequest) => Promise<AgentPromptResult> = async () => ({ status: 'succeeded', text: 'Synthesis [S1]', usage: { input: 20, output: 5, cacheRead: 0, cacheWrite: 0, cost: null, known: true } });
	let deliver: (request: AgentDispatchRequest) => Promise<AgentDispatchReceipt> = async request => ({ invocationId: request.invocationId, delivery: 'pasted', terminalId: 'terminal' });
	const codec = workspaceDocuments('Workspace');
	const storage: TextStorage = { exists: async path => files.has(path), mkdir: async () => {}, read: async path => files.get(path)!,
		write: async (path, text) => { if (path === 'documents') { if (fail) throw Error('disk-full'); text = JSON.stringify(codec.decode(codec.encode(JSON.parse(text)))); } files.set(path, text); } };
	const store = new WorkspaceStore(storage, 'documents', () => {}, () => {}, '.nand/recovery/synthesis.json'); await store.ready;
	const ports = { store, id: () => `synthesis-${++id}`, now: () => ++now, changed: () => {}, agents: {
		directory: () => ({ list: () => available ? [{ id: 'codex' as const, title: 'Codex', enabled: true, installed: true }] : [] }),
		sessions: () => ({ list: async () => available ? [{ id: 'session', title: 'Existing session', agentId: 'codex' as const }] : [], attachMaterial: async () => {} }),
		runner: () => ({ run: async (request: AgentPromptRequest) => { calls.push(request); return respond(request); }, open: async (terminal: string) => { opened.push(terminal); } }),
		dispatch: () => ({ dispatch: async (request: AgentDispatchRequest) => { dispatches.push(request); return deliver(request); } }),
	} };
	const synthesis = new WorkspaceSynthesis(ports); await synthesis.recover();
	const request: SynthesisRequest = { taskId: 'task', references: [{ exchangeId: 'exchange', captureId: 'capture-1' }], title: 'Combined answer', instruction: 'Compare evidence', destination: { kind: 'automatic', agentId: 'codex' } };
	return { synthesis, request, store, storage, ports, files, calls, dispatches, opened, fail: (value: boolean) => { fail = value; }, available: (value: boolean) => { available = value; },
		respond: (fn: typeof respond) => { respond = fn; }, deliver: (fn: typeof deliver) => { deliver = fn; }, close: async () => { await synthesis.shutdown(); await store.shutdown(); } };
}

test('synthesis uses exactly the reviewed older version once and saves an independent Markdown result with citations', async () => {
	const f = await fixture(), original = f.store.data(), review = await f.synthesis.review(f.request);
	assert.equal(f.calls.length, 0); assert.equal(f.dispatches.length, 0); assert.equal(f.store.data().syntheses.length, 0);
	assert.equal(review.inputs[0]!.revision, 1); assert.equal(review.inputs[0]!.complete, false);
	assert.ok(review.prompt.includes('Earlier selected answer')); assert.ok(!review.prompt.includes('Newest excluded answer'));
	review.inputs[0]!.text = 'Mutating a returned preview cannot change authorization';
	const done = f.synthesis.start(review.id); await assert.rejects(f.synthesis.start(review.id), /preview_changed/); await done;
	assert.equal(f.calls.length, 1); assert.equal(f.dispatches.length, 0); assert.equal(f.calls[0]!.resultChannel, 'native'); assert.equal(f.calls[0]!.agentId, 'codex');
	const record = f.store.data().syntheses[0]!; assert.equal(record.status, 'succeeded'); assert.equal(record.text, 'Synthesis [S1]'); assert.equal(record.inputs[0]!.text, 'Earlier selected answer');
	assert.deepEqual(f.store.data().exchanges, original.exchanges); assert.deepEqual(f.store.data().turns, original.turns);
	const doc = workspaceDocuments('Workspace').encode(f.store.data()).find(row => row.id === record.id)!;
	assert.equal(doc.path, `Workspace/综合/${record.id}.md`); assert.equal(doc.sections?.result, record.text);
	await f.store.edit(data => { data.tasks = []; data.turns = []; data.exchanges = []; });
	assert.deepEqual(f.store.data().syntheses[0]!.inputs, record.inputs); await f.close();
});

test('changed material and unavailable agents invalidate authorization before any model call', async () => {
	const f = await fixture();
	await assert.rejects(f.synthesis.review({ ...f.request, references: [...f.request.references, ...f.request.references] }), /synthesis_scope/);
	let review = await f.synthesis.review(f.request); await f.store.edit(data => { data.exchanges[0]!.captures[0]!.markdown = 'Edited source'; });
	await assert.rejects(f.synthesis.start(review.id), /preview_changed/); assert.equal(f.calls.length, 0);
	review = await f.synthesis.review(f.request); f.available(false); await assert.rejects(f.synthesis.start(review.id), /synthesis_agent/);
	assert.equal(f.store.data().syntheses.length, 0); assert.equal(f.calls.length, 0); await f.close();
});

test('a newer capture does not replace or invalidate the explicitly selected older input', async () => {
	const f = await fixture(), review = await f.synthesis.review(f.request);
	await f.store.edit(data => { const exchange = data.exchanges[0]!; exchange.captures.push({ ...exchange.captures[1]!, id: 'capture-3', revision: 3, markdown: 'Still excluded' }); exchange.currentCaptureId = 'capture-3'; });
	await f.synthesis.start(review.id); assert.ok(!f.calls[0]!.prompt.includes('Still excluded')); assert.equal(f.store.data().syntheses[0]!.inputs[0]!.revision, 1); await f.close();
});

test('existing mode only dispatches a matching paste and never interprets started as model completion', async () => {
	const f = await fixture(), request: SynthesisRequest = { ...f.request, destination: { kind: 'existing', agentId: 'codex', sessionId: 'session', sessionTitle: 'Ignored client label' } };
	const review = await f.synthesis.review(request); assert.equal(review.destination.kind === 'existing' && review.destination.sessionTitle, 'Existing session');
	await f.synthesis.start(review.id); assert.equal(f.calls.length, 0); assert.equal(f.dispatches.length, 1);
	assert.equal(f.dispatches[0]!.finalPrompt, review.prompt); assert.deepEqual(f.dispatches[0]!.destination, { kind: 'existing', sessionId: 'session' });
	assert.equal(f.store.data().syntheses[0]!.status, 'pasted'); assert.equal(f.store.data().syntheses[0]!.text, '');
	f.deliver(async request => ({ invocationId: request.invocationId, delivery: 'started' }));
	await f.synthesis.start((await f.synthesis.review(request)).id); assert.equal(f.store.data().syntheses[1]!.status, 'failed'); assert.equal(f.calls.length, 0); await f.close();
});

test('failed intent writes execute nothing and disk retry cannot start the prepared request', async () => {
	const f = await fixture(), review = await f.synthesis.review(f.request); f.fail(true);
	await assert.rejects(f.synthesis.start(review.id), /disk-full/); assert.equal(f.calls.length, 0); assert.equal(f.synthesis.records()[0]!.status, 'failed');
	const recovery = decodeWorkspaceRecovery(JSON.parse(f.files.get('.nand/recovery/synthesis.json')!), 'documents'); assert.equal(recovery.draft.syntheses[0]!.status, 'failed');
	f.fail(false); await f.synthesis.retrySave(); assert.equal(f.calls.length, 0); assert.equal(f.store.data().syntheses[0]!.status, 'failed'); await f.close();
});

test('an owner cancellation receipt stays cancelled while a confirmed paste remains a delivery fact', async () => {
	const f = await fixture(), request: SynthesisRequest = { ...f.request, destination: { kind: 'existing', agentId: 'codex', sessionId: 'session', sessionTitle: 'Existing session' } };
	f.deliver(async request => ({ invocationId: request.invocationId, delivery: 'rejected', errorCode: 'cancelled' }));
	await f.synthesis.start((await f.synthesis.review(request)).id); assert.equal(f.synthesis.records()[0]!.status, 'cancelled');
	f.deliver(async request => { f.synthesis.cancel(request.invocationId); return { invocationId: request.invocationId, delivery: 'pasted' }; });
	await f.synthesis.start((await f.synthesis.review(request)).id); assert.equal(f.synthesis.records()[0]!.status, 'pasted'); assert.equal(f.calls.length, 0); await f.close();
});

test('completed output survives write failure in the recovery draft and retry saves without another call', async () => {
	const f = await fixture(), review = await f.synthesis.review(f.request);
	f.respond(async () => { f.fail(true); return { status: 'succeeded', text: 'Keep complete result' }; });
	await assert.rejects(f.synthesis.start(review.id), /disk-full/);
	assert.equal(f.synthesis.records()[0]!.text, 'Keep complete result'); assert.equal(f.synthesis.unsaved(review.id), true);
	const recovery = decodeWorkspaceRecovery(JSON.parse(f.files.get('.nand/recovery/synthesis.json')!), 'documents'); assert.equal(recovery.draft.syntheses[0]!.text, 'Keep complete result');
	f.fail(false); await f.synthesis.retrySave(); assert.equal(f.calls.length, 1); assert.equal(f.synthesis.unsaved(review.id), false); await f.close();
	const restarted = new WorkspaceStore(f.storage, 'documents', () => {}); await restarted.ready;
	assert.equal(restarted.data().syntheses[0]!.status, 'succeeded'); await restarted.shutdown();
});

test('needs-attention is owner state, cancellation drains on shutdown and does not modify original answers', async () => {
	const f = await fixture(), original = f.store.data().exchanges, review = await f.synthesis.review(f.request);
	let entered!: () => void; const ready = new Promise<void>(resolve => { entered = resolve; });
	f.respond(async request => {
		request.onState?.({ status: 'needs-attention', terminalId: 'terminal' }); entered();
		await new Promise<void>(resolve => request.signal!.addEventListener('abort', () => resolve(), { once: true }));
		return { status: 'cancelled', text: '', terminalId: 'terminal' };
	});
	const done = f.synthesis.start(review.id); await ready;
	assert.equal(f.synthesis.records()[0]!.status, 'needs-attention'); await f.synthesis.open(review.id); assert.deepEqual(f.opened, ['terminal']);
	await f.synthesis.shutdown(); await done; assert.equal(f.store.data().syntheses[0]!.status, 'cancelled'); assert.deepEqual(f.store.data().exchanges, original);
	await assert.rejects(f.synthesis.open(review.id), /synthesis_agent/); await f.store.shutdown();
});

test('restart marks saved intent interrupted without execution and completed recovery merges over that derived state', async () => {
	const f = await fixture(), review = await f.synthesis.review(f.request);
	await f.store.edit(data => data.syntheses.push(review)); const baseline = f.store.data();
	const other = new WorkspaceSynthesis(f.ports); await other.recover(); assert.equal(f.calls.length, 0); assert.equal(other.records()[0]!.status, 'interrupted');
	const draft = structuredClone(baseline); Object.assign(draft.syntheses[0]!, { status: 'succeeded', text: 'Recovered result', updatedAt: 99 });
	const merged = mergeWorkspaceRecovery({ path: 'documents', at: new Date().toISOString(), baseline, draft }, f.store.data());
	assert.equal(merged.syntheses[0]!.status, 'succeeded'); assert.equal(merged.syntheses[0]!.text, 'Recovered result'); await other.shutdown(); await f.close();
});

test('empty completion and thrown owner failure remain failures with selected source material intact', async () => {
	const f = await fixture(); f.respond(async () => ({ status: 'succeeded', text: ' ' }));
	await f.synthesis.start((await f.synthesis.review(f.request)).id); assert.equal(f.synthesis.records()[0]!.status, 'failed');
	f.respond(async () => { throw Error('Owner failed'); }); await f.synthesis.start((await f.synthesis.review(f.request)).id);
	assert.equal(f.synthesis.records()[0]!.status, 'failed'); assert.equal(f.store.data().exchanges[0]!.captures.length, 2); await f.close();
});

test('external edits to the saved source contract are not overwritten by a later model completion', async () => {
	const f = await fixture(), review = await f.synthesis.review(f.request);
	f.respond(async () => { await f.store.edit(data => { data.syntheses[0]!.instruction = 'User changed the saved instruction'; }); return { status: 'succeeded', text: 'Output for the original instruction' }; });
	await assert.rejects(f.synthesis.start(review.id), /storage_changed/);
	assert.equal(f.store.data().syntheses[0]!.instruction, 'User changed the saved instruction');
	assert.equal(f.synthesis.records()[0]!.instruction, f.request.instruction); assert.equal(f.synthesis.records()[0]!.text, 'Output for the original instruction');
	const recovery = decodeWorkspaceRecovery(JSON.parse([...f.files.entries()].find(([path]) => path.startsWith('.nand/recovery/'))![1]), 'documents');
	assert.equal(recovery.draft.syntheses[0]!.text, 'Output for the original instruction');
	assert.throws(() => mergeWorkspaceRecovery(recovery, f.store.data()), /conflict/i);
	assert.equal(f.synthesis.unsaved(review.id), true); await f.close();
});
