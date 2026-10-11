import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';
import type { TextStorage } from '../../../shared/storage/ports';
import type { ProviderReadiness, ProviderSession } from '../core/providers/contracts';
import type { TargetBinding, WorkspaceProvider } from '../core/workspace/model';
import { workspaceDocuments } from '../core/workspace/documents';
import { snapshotJson } from '../core/workspace/snapshot';
import { WorkspaceJournal } from '../platform/workspace-journal';
import { WorkspaceStore } from '../platform/workspace-store';
import { Workspace } from './workspace';
import { synthesisInputs } from '../core/workspace/synthesis';

async function fixture(agents?: ConstructorParameters<typeof Workspace>[0]['agents']) {
	const files = new Map<string, string>(), mutations: string[] = [], reads: string[] = [], disposed: string[] = []; let fail = false, dirty = false, id = 0;
	const inspections = new Map<string, (value: ProviderReadiness) => ProviderReadiness | Promise<ProviderReadiness>>();
	const unknown = new Set<string>();
	let writeGate: { entered(): void; release: Promise<void> } | undefined;
	const codec = workspaceDocuments('NAND/AI Workspace');
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => path === 'documents.json'
		? JSON.stringify(codec.decode(codec.encode(JSON.parse(files.get(path)!)))) : files.get(path)!, mkdir: async () => {},
		write: async (path, text) => {
			if (path === 'documents.json' && fail) throw Error('read-only');
			if (path === 'documents.json' && writeGate) { const gate = writeGate; writeGate = undefined; gate.entered(); await gate.release; }
			files.set(path, text);
		} };
	const store = new WorkspaceStore(storage, 'documents.json', () => {}), journal = new WorkspaceJournal(storage, 'journal.json', () => {});
	const providers = { connect: async (binding: TargetBinding): Promise<ProviderSession> => {
		const readiness: ProviderReadiness = { identity: { provider: binding.provider, page: binding.page!, url: 'https://chat.deepseek.com/', conversationId: binding.conversationId }, draft: '', messageIds: [], state: 'ready' };
		return { target: binding.page!, inspect: async () => { reads.push(binding.id); return inspections.get(binding.id)?.(structuredClone(readiness)) ?? structuredClone(readiness); },
			newConversation: async () => { mutations.push('new-conversation'); return { ...structuredClone(readiness), draft: dirty ? 'Existing draft' : '' }; },
			stage: async prompt => { mutations.push(`stage:${prompt}`); readiness.draft = prompt; return structuredClone(readiness); },
			commit: async prompt => { mutations.push(`commit:${prompt}`); return unknown.has(binding.id) ? { status: 'unknown' } : { status: 'accepted', message: { conversationId: 'conversation', messageId: `user-${++id}`, text: prompt } }; },
			capture: async message => ({ adapterVersion: 'fixture-v1', conversationId: message.conversationId, messageId: `answer-${++id}`, parentId: message.messageId,
				complete: true, reasons: [], terminalEvidence: ['finished'], source: 'provider-api', markdown: 'Answer' }),
			rollback: async () => { mutations.push('rollback'); }, dispose: () => { disposed.push(binding.id); } };
	} };
	const workspace = new Workspace({ store, journal, providers, agents, target: binding => ({ pageId: binding.id, profileId: binding.profileId, generation: 'generation' }),
		id: () => `id-${++id}`, now: () => 10, hash: async text => createHash('sha256').update(text).digest('hex') });
	await workspace.ready;
	const taskId = await workspace.createTask('Research', 'default', 'Personal'), targetId = workspace.data().tasks[0]!.targets[0]!.id;
	return { workspace, store, journal, files, mutations, reads, disposed, inspections, unknown, taskId, targetId, fail: (value: boolean) => { fail = value; }, dirty: (value: boolean) => { dirty = value; },
		holdWrite: () => {
			let enter!: () => void, release!: () => void;
			const entered = new Promise<void>(resolve => { enter = resolve; }), wait = new Promise<void>(resolve => { release = resolve; });
			writeGate = { entered: enter, release: wait }; return { entered, release };
		},
		prepare: async () => { await workspace.updateTask(taskId, { draft: 'Question' }); await workspace.prepareTarget(taskId, targetId, true); mutations.length = 0; } };
}

const historyFile = () => readFileSync(resolve('src/modules/browser/core/workspace/fixtures/maiw-v3.jsonl'), 'utf8');
test('explicit selected excerpts preserve native captures, exact provenance and partial synthesis copies without website actions', async () => {
	const f = await fixture(); await f.prepare(); await f.workspace.send((await f.workspace.preview(f.taskId)).id);
	const before = f.workspace.data(), exchange = before.exchanges[0]!, mutations = [...f.mutations];
	const source = { page: { pageId: f.targetId, profileId: 'default', generation: 'generation' }, url: 'https://chat.deepseek.com/a/chat/s/conversation',
		title: 'Selected region', selector: '#answer > p', rect: { x: 1, y: 2, width: 200, height: 60 }, viewport: { width: 900, height: 700 } };
	await f.workspace.addSelection(exchange.id, 'Only this paragraph.', source);
	const saved = f.workspace.data().exchanges[0]!, selection = saved.selections![0]!;
	assert.deepEqual(saved.captures, exchange.captures); assert.equal(saved.currentCaptureId, exchange.currentCaptureId);
	assert.equal(saved.acquisitionState, exchange.acquisitionState); assert.equal(selection.complete, false); assert.equal(selection.selection.messageId, undefined);
	assert.deepEqual(f.mutations, mutations);
	const inputs = synthesisInputs(f.workspace.data(), f.taskId, [{ exchangeId: exchange.id, captureId: selection.id }]);
	assert.equal(inputs[0]!.source, 'user-selection'); assert.equal(inputs[0]!.complete, false); assert.deepEqual(inputs[0]!.selection, source);
	const documents = workspaceDocuments('Workspace').encode(f.workspace.data()), answer = documents.find(doc => doc.id === exchange.id)!;
	assert.equal(JSON.stringify(answer.properties).includes('Only this paragraph.'), false); assert.equal(answer.sections!['selection-a'], 'Only this paragraph.');
	assert.deepEqual(workspaceDocuments('Workspace').decode(documents).exchanges[0]!.selections, saved.selections);
	for (const changed of [{ ...source, page: { ...source.page, profileId: 'other' } }, { ...source, page: { ...source.page, generation: 'stale' } }, { ...source, url: 'https://example.org' }])
		await assert.rejects(f.workspace.addSelection(exchange.id, 'Must not save', changed), /selection_invalid/);
	await assert.rejects(f.workspace.addSelection(exchange.id, 'x'.repeat(2001), source), /selection_invalid/);
	assert.equal(f.workspace.data().exchanges[0]!.selections!.length, 1);
	await f.workspace.shutdown();
});
test('ordinary website send and recapture perform no agent discovery, model call or delivery', async () => {
	let calls = 0; const unavailable = () => { calls++; return undefined; };
	const f = await fixture({ directory: unavailable, sessions: unavailable, runner: unavailable, dispatch: unavailable });
	await f.prepare(); await f.workspace.send((await f.workspace.preview(f.taskId)).id);
	f.inspections.set(f.targetId, ready => ({ ...ready, messageIds: [f.workspace.data().exchanges[0]!.receipt!.messageId], currentMessageId: f.workspace.data().exchanges[0]!.receipt!.messageId }));
	await f.workspace.recollect(f.workspace.data().exchanges[0]!.id);
	assert.equal(calls, 0); assert.equal(f.workspace.data().syntheses.length, 0); await f.workspace.shutdown();
});
test('panel geometry preserves a reviewed send and round snapshots while persisting separately from recipients', async () => {
	const f = await fixture(); await f.prepare();
	const second = await f.workspace.addTarget(f.taskId, 'kimi', 'default', 'Other');
	await f.workspace.setTargetVisible(f.taskId, second, true);
	const preview = await f.workspace.preview(f.taskId), before = f.workspace.data().tasks[0]!;
	await f.workspace.updatePanelLayout(f.taskId, { kind: 'move', targetId: second, direction: -1 });
	await f.workspace.updatePanelLayout(f.taskId, { kind: 'width', targetId: second, width: 2 });
	await f.workspace.updatePanelLayout(f.taskId, { kind: 'maximize', targetId: second });
	const changed = f.workspace.data().tasks[0]!;
	assert.deepEqual(changed.targets, before.targets); assert.deepEqual(changed.selectedTargetIds, before.selectedTargetIds);
	assert.deepEqual(changed.visibleTargetIds, before.visibleTargetIds); assert.equal(changed.draft, before.draft);
	assert.deepEqual(changed.panelLayout, { order: [second, f.targetId], widths: { [second]: 2 }, focused: second, maximized: second });
	assert.deepEqual(workspaceDocuments('NAND/AI Workspace').decode(workspaceDocuments('NAND/AI Workspace').encode(f.workspace.data())).tasks[0]!.panelLayout, changed.panelLayout);
	await f.workspace.send(preview.id);
	assert.deepEqual(f.workspace.data().turns[0]!.targets, preview.targets); assert.equal(f.mutations.filter(row => row.startsWith('commit:')).length, 1);
	await f.workspace.shutdown();
});

test('panel edits validate widths and membership and prune removed targets without changing historical rounds', async () => {
	const f = await fixture(), second = await f.workspace.addTarget(f.taskId, 'kimi', 'default', 'Other');
	await assert.rejects(f.workspace.updatePanelLayout(f.taskId, { kind: 'maximize', targetId: second }), /panel_layout/);
	await assert.rejects(f.workspace.updatePanelLayout(f.taskId, { kind: 'width', targetId: second, width: Infinity }), /panel_layout/);
	await assert.rejects(f.workspace.updatePanelLayout(f.taskId, { kind: 'move', targetId: f.targetId, direction: -1 }), /panel_layout/);
	await f.workspace.setTargetVisible(f.taskId, second, true);
	await f.workspace.updatePanelLayout(f.taskId, { kind: 'maximize', targetId: second });
	await f.workspace.updatePanelLayout(f.taskId, { kind: 'focus', targetId: f.targetId });
	assert.equal(f.workspace.data().tasks[0]!.panelLayout!.maximized, undefined);
	const third = await f.workspace.addTarget(f.taskId, 'deepseek', 'default', 'Third');
	await f.workspace.removeTarget(f.taskId, second);
	assert.deepEqual(f.workspace.data().tasks[0]!.panelLayout!.order, [f.targetId, third]);
	assert.deepEqual(f.mutations, []); assert.deepEqual(f.reads, []); await f.workspace.shutdown();
});

test('history import is reviewed, idempotent and local, with source conflicts blocking the whole import', async () => {
	const f = await fixture(), before = new Map(f.files), input = historyFile();
	await assert.rejects(f.workspace.previewImport('not json', 'Choose account'), /import_format/);
	assert.deepEqual(f.files, before);
	const preview = await f.workspace.previewImport(input, 'Choose account');
	assert.deepEqual(f.files, before); assert.equal(preview.counts.sessions.added, 1);
	await f.workspace.commitImport(preview.id);
	const imported = f.workspace.data().tasks.find(task => task.imported)!;
	await f.workspace.updateTask(imported.id, { title: 'My local title' });
	const repeated = await f.workspace.previewImport(input, 'Choose account');
	assert.equal(repeated.counts.sessions.duplicate, 1); assert.equal(repeated.counts.exchanges.added, 0);
	await f.workspace.commitImport(repeated.id); assert.equal(f.workspace.data().tasks.find(task => task.id === imported.id)!.title, 'My local title');
	const conflict = await f.workspace.previewImport(input.replace('# Saved answer', '# Changed answer'), 'Choose account'), state = f.workspace.data();
	assert.equal(conflict.conflicts.length, 1); await assert.rejects(f.workspace.commitImport(conflict.id), /import_conflict/);
	assert.deepEqual(f.workspace.data(), state); assert.deepEqual(f.mutations, []); assert.deepEqual(f.reads, []);
	assert.equal(f.files.get('journal.json'), before.get('journal.json'));
	await f.workspace.shutdown();
});

test('history import refuses stale previews and new previews invalidate earlier reviews', async () => {
	const f = await fixture(), input = historyFile(), preview = await f.workspace.previewImport(input, 'Choose account');
	await f.workspace.updateTask(f.taskId, { draft: 'New question' });
	await assert.rejects(f.workspace.commitImport(preview.id), /preview_changed/); assert.equal(f.workspace.data().turns.length, 0);
	const first = await f.workspace.previewImport(input, 'Choose account'), second = await f.workspace.previewImport(input, 'Choose account');
	await assert.rejects(f.workspace.commitImport(first.id), /preview_changed/); await f.workspace.commitImport(second.id);
	await assert.rejects(f.workspace.commitImport(second.id), /preview_changed/);
	assert.deepEqual(f.mutations, []); await f.workspace.shutdown();
});

test('failed import writes retain the full local draft and retry without repeating an import or website action', async () => {
	const f = await fixture(), preview = await f.workspace.previewImport(historyFile(), 'Choose account');
	f.fail(true); await assert.rejects(f.workspace.commitImport(preview.id), /read-only/);
	assert.equal(f.store.hasPendingSave(), true); assert.equal(f.workspace.data().exchanges.filter(row => row.imported).length, 2);
	await assert.rejects(f.workspace.previewImport(historyFile(), 'Choose account'), /save_pending/);
	f.fail(false); await f.workspace.retrySave(); assert.equal(f.store.hasPendingSave(), false);
	const repeated = await f.workspace.previewImport(historyFile(), 'Choose account');
	assert.equal(repeated.counts.exchanges.duplicate, 2); assert.equal(repeated.counts.exchanges.added, 0);
	assert.deepEqual(f.mutations, []); assert.deepEqual(f.reads, []); await f.workspace.shutdown();
});

test('rebinding imported tasks requires new verification and preserves historical target snapshots', async () => {
	const f = await fixture(), preview = await f.workspace.previewImport(historyFile(), 'Choose account');
	await f.workspace.commitImport(preview.id);
	const imported = f.workspace.data().tasks.find(task => task.imported)!, target = imported.targets[0]!, historical = f.workspace.data().turns;
	await f.workspace.updateTask(imported.id, { selectedTargetIds: [target.id], visibleTargetIds: [target.id] });
	await f.workspace.rebindTarget(imported.id, target.id, 'default', 'Personal');
	const current = f.workspace.data().tasks.find(task => task.id === imported.id)!;
	assert.deepEqual(current.selectedTargetIds, []); assert.deepEqual(current.visibleTargetIds, []);
	assert.deepEqual(current.targets[0], { id: target.id, provider: target.provider, profileId: 'default', accountLabel: 'Personal', status: 'unverified' });
	assert.deepEqual(f.workspace.data().turns, historical); assert.deepEqual(f.mutations, []); assert.deepEqual(f.reads, []);
	await f.workspace.shutdown();
});

test('prompt library retains order and selection across Markdown enumeration and freezes historical copies', async () => {
	const f = await fixture(); await f.prepare();
	const first = await f.workspace.saveTemplate('First', 'First instructions'), second = await f.workspace.saveTemplate('Second', '# Second instructions');
	await f.workspace.updateTask(f.taskId, { promptTemplateIds: [first, second] });
	await f.workspace.moveTemplate(second, -1);
	const codec = workspaceDocuments('NAND/AI Workspace');
	const restored = codec.decode(codec.encode(f.workspace.data()).reverse());
	await f.store.edit(data => Object.assign(data, restored));
	const preview = await f.workspace.preview(f.taskId);
	assert.deepEqual(preview.templates.map(row => row.id), [second, first]);
	assert.equal(preview.finalPrompt, '# Second instructions\n\nFirst instructions\n\nQuestion');
	await f.workspace.send(preview.id);
	const historical = structuredClone(f.workspace.data().turns);
	const template = f.workspace.data().templates.find(row => row.id === first)!;
	await f.workspace.saveTemplate('Renamed', 'Edited instructions', template);
	const changed = f.workspace.data().templates.find(row => row.id === first)!;
	assert.equal(changed.id, first); assert.equal(changed.revision, template.revision + 1);
	await f.workspace.deleteTemplate(first, changed.revision);
	assert.deepEqual(f.workspace.data().turns, historical);
	assert.deepEqual(f.workspace.data().tasks[0]!.promptTemplateIds, [second]);
	assert.equal(f.mutations.filter(row => row.startsWith('commit:')).length, 1);
	await f.workspace.shutdown();
});

test('template edits, deletion and reordering reject stale editors and reviewed sends without website input', async () => {
	const f = await fixture(); await f.prepare();
	const first = await f.workspace.saveTemplate('First', 'A'), second = await f.workspace.saveTemplate('Second', 'B');
	await f.workspace.updateTask(f.taskId, { promptTemplateIds: [first, second] });
	const stale = f.workspace.data().templates.find(row => row.id === first)!;
	const preview = await f.workspace.preview(f.taskId);
	await f.workspace.moveTemplate(first, 1);
	await assert.rejects(f.workspace.send(preview.id), /preview_changed/);
	await assert.rejects(f.workspace.saveTemplate('Lost update', 'Discarded', stale), /template_missing/);
	await assert.rejects(f.workspace.deleteTemplate(first, stale.revision), /template_missing/);
	await assert.rejects(f.workspace.saveTemplate(' ', 'A'), /template_empty/);
	const next = await f.workspace.preview(f.taskId);
	await f.workspace.deleteTemplate(first, f.workspace.data().templates.find(row => row.id === first)!.revision);
	await assert.rejects(f.workspace.send(next.id), /preview_changed/);
	assert.equal(f.mutations.length, 0); assert.equal(f.journal.list().length, 0);
	await f.workspace.shutdown();
});

test('failed template persistence retains the draft and never alters an already frozen round', async () => {
	const f = await fixture(); await f.prepare();
	const id = await f.workspace.saveTemplate('Template', 'Original');
	await f.workspace.updateTask(f.taskId, { promptTemplateIds: [id], draft: '' });
	await f.workspace.send((await f.workspace.preview(f.taskId)).id);
	const turns = structuredClone(f.workspace.data().turns);
	f.fail(true);
	await assert.rejects(f.workspace.saveTemplate('Changed', 'New draft', f.workspace.data().templates[0]), /read-only/);
	assert.equal(f.store.hasPendingSave(), true); assert.equal(f.workspace.data().templates[0]!.body, 'New draft');
	assert.deepEqual(f.workspace.data().turns, turns);
	f.fail(false); await f.workspace.retrySave();
	assert.equal(f.store.hasPendingSave(), false); assert.equal(f.workspace.data().templates[0]!.body, 'New draft');
	await f.workspace.shutdown();
});

test('local task deletion rejects a changed review and removes only its current and historical records without website input', async () => {
	const f = await fixture(); await f.prepare();
	const template = await f.workspace.saveTemplate('Shared template', 'Keep me');
	await f.workspace.updateTask(f.taskId, { promptTemplateIds: [template] });
	await f.workspace.send((await f.workspace.preview(f.taskId)).id);
	const other = await f.workspace.createTask('Other task', 'default', 'Personal');
	const stale = await f.workspace.reviewDeleteTask(f.taskId);
	await f.workspace.updateTask(f.taskId, { title: 'New title' });
	await assert.rejects(f.workspace.deleteTask(stale), /preview_changed/);
	await f.workspace.removeTarget(f.taskId, f.targetId);
	const review = await f.workspace.reviewDeleteTask(f.taskId);
	assert.equal(review.turns.length, 1); assert.equal(review.exchanges.length, 1);
	f.mutations.length = 0; f.reads.length = 0;
	const journal = f.journal.list();
	await f.workspace.deleteTask(review);
	assert.deepEqual(f.workspace.data().tasks.map(task => task.id), [other]);
	assert.equal(f.workspace.data().turns.length, 0); assert.equal(f.workspace.data().exchanges.length, 0);
	assert.equal(f.workspace.data().templates[0]!.id, template);
	assert.deepEqual(f.journal.list(), journal); assert.equal(f.mutations.length, 0); assert.equal(f.reads.length, 0);
	await f.workspace.shutdown();
});

test('task deletion flushes the reviewed draft and retains recoverable local state on a failed write', async () => {
	const f = await fixture();
	await f.workspace.stageDraft(f.taskId, 'Keep draft on disk');
	const review = await f.workspace.reviewDeleteTask(f.taskId);
	assert.equal(review.task.draft, 'Keep draft on disk');
	f.fail(true); await assert.rejects(f.workspace.deleteTask(review), /read-only/);
	assert.equal(f.store.hasPendingSave(), true);
	assert.equal(f.workspace.data().tasks.length, 0);
	assert.equal(JSON.parse(f.files.get('documents.json')!).tasks.length, 1);
	f.fail(false); await f.workspace.retrySave();
	assert.equal(JSON.parse(f.files.get('documents.json')!).tasks.length, 0);
	assert.equal(f.mutations.length, 0); await f.workspace.shutdown();
});

test('explicit local recovery checks the preview and workspace key and never opens a provider', async () => {
	const f = await fixture(), baseline = f.store.data(), draft = structuredClone(baseline);
	draft.tasks[0]!.draft = 'Recovered question'; const record = { path: 'documents.json', at: '2026-10-11T00:00:00Z', baseline, draft };
	await assert.rejects(f.workspace.restoreRecovery({ ...record, path: 'different-folder' }, baseline), /recovery_invalid/);
	await f.workspace.updateTask(f.taskId, { title: 'Current title' });
	await assert.rejects(f.workspace.restoreRecovery(record, baseline), /preview_changed/);
	await f.workspace.restoreRecovery(record, f.store.data());
	assert.equal(f.workspace.data().tasks[0]!.draft, 'Recovered question'); assert.equal(f.workspace.data().tasks[0]!.title, 'Current title');
	assert.equal(f.mutations.length, 0); assert.equal(f.reads.length, 0); assert.equal(f.journal.list().length, 0);
	await f.workspace.shutdown();
});

test('single-target resend reviews the immutable prompt without input and consumes its exact preview only once', async () => {
	const f = await fixture(); await f.prepare();
	const second = await f.workspace.addTarget(f.taskId, 'kimi', 'default', 'Second'); await f.workspace.prepareTarget(f.taskId, second, false);
	await f.workspace.updateTask(f.taskId, { selectedTargetIds: [f.targetId, second] }); f.unknown.add(f.targetId);
	await f.workspace.send((await f.workspace.preview(f.taskId)).id);
	const original = f.workspace.data(), exchange = original.exchanges[0]!;
	await f.workspace.updateTask(f.taskId, { draft: 'Next question', selectedTargetIds: [], visibleTargetIds: [] });
	f.reads.length = 0; f.mutations.length = 0; const attempts = f.journal.list();
	const preview = await f.workspace.previewRetry(exchange.id);
	assert.equal(preview.finalPrompt, 'Question'); assert.equal(preview.target.id, f.targetId); assert.equal(preview.duplicateRisk, true);
	assert.deepEqual(f.reads, [f.targetId]); assert.equal(f.mutations.length, 0); assert.equal(snapshotJson(f.journal.list()), snapshotJson(attempts));
	preview.finalPrompt = 'Caller mutation'; preview.target.profileId = 'another'; f.unknown.clear();
	const results = await Promise.allSettled([f.workspace.retrySend(preview.id), f.workspace.retrySend(preview.id)]);
	assert.deepEqual(results.map(row => row.status), ['fulfilled', 'rejected']);
	assert.deepEqual(f.mutations, ['stage:Question', 'commit:Question']);
	const data = f.workspace.data(); assert.deepEqual(data.turns, original.turns);
	assert.equal(snapshotJson(data.exchanges[1]), snapshotJson(original.exchanges[1]));
	assert.deepEqual(data.exchanges[0]!.attempts.map(row => row.outcome), ['unknown', 'accepted']);
	assert.deepEqual(data.tasks[0]!.selectedTargetIds, []); assert.deepEqual(data.tasks[0]!.visibleTargetIds, []);
	assert.equal(data.tasks[0]!.draft, 'Next question'); await f.workspace.shutdown();
});

test('changed binding or task edits invalidate a resend preview before any attempt or input', async () => {
	const f = await fixture(); await f.prepare(); f.unknown.add(f.targetId); await f.workspace.send((await f.workspace.preview(f.taskId)).id);
	const exchangeId = f.workspace.data().exchanges[0]!.id; f.mutations.length = 0;
	let preview = await f.workspace.previewRetry(exchangeId);
	await f.store.edit(data => { const binding = data.tasks[0]!.targets[0]!; binding.page = { ...binding.page!, generation: 'new-generation' }; });
	await assert.rejects(f.workspace.retrySend(preview.id), /preview_changed/);
	preview = await f.workspace.previewRetry(exchangeId);
	await f.workspace.stageDraft(f.taskId, 'Changed draft'); await assert.rejects(f.workspace.retrySend(preview.id), /preview_changed/);
	assert.equal(f.journal.list().length, 1); assert.equal(f.mutations.length, 0); await f.workspace.shutdown();
});

test('pause cancels a resend waiting behind metadata persistence before it reaches the provider', async () => {
	const f = await fixture(); await f.prepare(); f.unknown.add(f.targetId); await f.workspace.send((await f.workspace.preview(f.taskId)).id);
	const review = await f.workspace.previewRetry(f.workspace.data().exchanges[0]!.id), gate = f.holdWrite();
	const saving = f.workspace.setTargetVisible(f.taskId, f.targetId, false); await gate.entered;
	f.mutations.length = 0; f.reads.length = 0;
	const resend = f.workspace.retrySend(review.id), rejected = assert.rejects(resend, /paused/);
	assert.equal(f.workspace.busy(f.taskId), true); f.workspace.pause(f.taskId); gate.release(); await saving; await rejected;
	assert.equal(f.journal.list().length, 1); assert.equal(f.mutations.length, 0); assert.equal(f.reads.length, 0);
	await f.workspace.shutdown();
});

test('follow-up selects one existing conversation, preserves draft and visibility, and the reviewed send creates only one new exchange', async () => {
	const f = await fixture(); await f.prepare();
	const second = await f.workspace.addTarget(f.taskId, 'kimi', 'default', 'Second'); await f.workspace.prepareTarget(f.taskId, second, false);
	await f.workspace.updateTask(f.taskId, { selectedTargetIds: [f.targetId, second] }); await f.workspace.send((await f.workspace.preview(f.taskId)).id);
	await f.workspace.stageDraft(f.taskId, 'Follow-up question'); const before = f.workspace.data(), exchange = before.exchanges[1]!;
	f.mutations.length = 0; await f.workspace.followUp(exchange.id);
	assert.equal(f.mutations.length, 0); assert.deepEqual(f.workspace.data().tasks[0]!.selectedTargetIds, [second]);
	assert.equal(f.workspace.data().tasks[0]!.draft, 'Follow-up question'); assert.deepEqual(f.workspace.data().tasks[0]!.visibleTargetIds, before.tasks[0]!.visibleTargetIds);
	const preview = await f.workspace.preview(f.taskId); assert.deepEqual(preview.targets.map(target => target.id), [second]);
	await f.workspace.send(preview.id); const after = f.workspace.data();
	assert.equal(after.turns.length, 2); assert.equal(after.exchanges.length, 3);
	assert.equal(snapshotJson(after.exchanges.slice(0, 2)), snapshotJson(before.exchanges));
	assert.deepEqual(f.mutations, ['stage:Follow-up question', 'commit:Follow-up question']);
	await f.store.edit(data => { data.tasks[0]!.targets[1]!.conversationId = 'another'; });
	await assert.rejects(f.workspace.followUp(exchange.id), /identity_changed/); await f.workspace.shutdown();
});

test('fresh preflight checks every recipient without input and ready-only previews freeze an explicit subset', async () => {
	const f = await fixture(); await f.prepare();
	const second = await f.workspace.addTarget(f.taskId, 'kimi', 'default', 'Kimi');
	const third = await f.workspace.addTarget(f.taskId, 'chatgpt', 'default', 'ChatGPT');
	await f.workspace.prepareTarget(f.taskId, second, false); await f.workspace.prepareTarget(f.taskId, third, false);
	await f.workspace.updateTask(f.taskId, { selectedTargetIds: [f.targetId, second, third] });
	f.inspections.set(second, value => ({ ...value, state: 'login-required' }));
	f.inspections.set(third, value => ({ ...value, draft: 'Private existing website draft' }));
	f.reads.length = 0;
	await assert.rejects(f.workspace.preview(f.taskId), /target_not_ready/);
	assert.deepEqual(f.reads, [f.targetId, second, third]); assert.equal(f.mutations.length, 0);
	assert.equal(f.workspace.data().turns.length, 0);
	assert.equal(f.workspace.targetCheck(f.taskId, second)!.state, 'login-required');
	assert.equal(f.workspace.targetCheck(f.taskId, third)!.state, 'draft-present');
	assert.doesNotMatch(JSON.stringify(await f.workspace.checkTargets(f.taskId)), /Private existing/);
	const preview = await f.workspace.preview(f.taskId, [], undefined, true);
	assert.deepEqual(preview.targets.map(target => target.id), [f.targetId]);
	assert.deepEqual(f.workspace.data().tasks[0]!.selectedTargetIds, [f.targetId, second, third]);
	await f.workspace.send(preview.id);
	assert.equal(f.workspace.data().exchanges.length, 1);
	assert.equal(f.mutations.filter(event => event.startsWith('commit:')).length, 1);
	await f.workspace.shutdown();
});

test('pause revokes a held readiness check and does not inspect later targets or stage input', async () => {
	const f = await fixture(); await f.prepare();
	const second = await f.workspace.addTarget(f.taskId, 'kimi', 'default', 'Kimi');
	await f.workspace.prepareTarget(f.taskId, second, false);
	await f.workspace.updateTask(f.taskId, { selectedTargetIds: [f.targetId, second] });
	let enter!: () => void, release!: () => void;
	const entered = new Promise<void>(resolve => { enter = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
	f.inspections.set(f.targetId, async value => { enter(); await held; return value; }); f.reads.length = 0;
	const checking = f.workspace.preview(f.taskId), rejected = assert.rejects(checking, /paused/);
	await entered; f.workspace.pause(f.taskId); release(); await rejected;
	assert.deepEqual(f.reads, [f.targetId]); assert.equal(f.mutations.length, 0); assert.equal(f.workspace.busy(f.taskId), false);
	assert.equal(f.workspace.targetCheck(f.taskId, second)!.reason, 'browser_workspace_paused');
	await f.workspace.shutdown();
});

test('target membership preserves recipient/visibility choices and old answer snapshots while invalidating reviewed sends', async () => {
	const f = await fixture(); await f.prepare();
	const reviewed = await f.workspace.preview(f.taskId), first = f.workspace.data().tasks[0]!;
	const second = await f.workspace.addTarget(f.taskId, 'kimi', 'default', 'Personal');
	const duplicateProvider = await f.workspace.addTarget(f.taskId, 'kimi', 'default', 'Second session');
	assert.notEqual(second, duplicateProvider);
	assert.deepEqual(f.workspace.data().tasks[0]!.selectedTargetIds, first.selectedTargetIds);
	assert.deepEqual(f.workspace.data().tasks[0]!.visibleTargetIds, first.visibleTargetIds);
	assert.equal(f.mutations.length, 0, 'Adding targets cannot open or input to a website');
	await Promise.all([f.workspace.setTargetVisible(f.taskId, second, true), f.workspace.setTargetVisible(f.taskId, duplicateProvider, true)]);
	assert.deepEqual(f.workspace.data().tasks[0]!.visibleTargetIds, [f.targetId, second, duplicateProvider]);
	await assert.rejects(f.workspace.send(reviewed.id), /preview_changed/);
	await f.workspace.send((await f.workspace.preview(f.taskId)).id);
	const saved = f.workspace.data(), turn = saved.turns[0]!, answer = saved.exchanges[0]!;
	await f.workspace.removeTarget(f.taskId, f.targetId);
	assert.deepEqual(f.workspace.data().tasks[0]!.selectedTargetIds, []);
	assert.deepEqual(f.workspace.data().tasks[0]!.visibleTargetIds, [second, duplicateProvider]);
	assert.deepEqual(f.workspace.data().turns[0], turn);
	assert.equal(snapshotJson(f.workspace.data().exchanges[0]), snapshotJson(answer));
	assert.equal(f.workspace.data().tasks[0]!.targets.length, 2);
	await assert.rejects(f.workspace.addTarget(f.taskId, 'unknown' as WorkspaceProvider, 'default', ''), /provider_unsupported/);
	await f.workspace.shutdown();
});

test('Kimi tasks retain the selected provider and canonical conversation URL; unsupported providers do not create tasks', async () => {
	const f = await fixture(), id = await f.workspace.createTask('Kimi research', 'default', 'Personal', 'kimi');
	const target = f.workspace.data().tasks.find(task => task.id === id)!.targets[0]!;
	assert.equal(target.provider, 'kimi');
	await f.workspace.prepareTarget(id, target.id, true);
	assert.equal(f.workspace.data().tasks.find(task => task.id === id)!.targets[0]!.officialUrl, 'https://www.kimi.com/');
	await f.workspace.updateTask(id, { draft: 'Question' }); await f.workspace.send((await f.workspace.preview(id)).id);
	assert.equal(f.workspace.data().tasks.find(task => task.id === id)!.targets[0]!.officialUrl, 'https://www.kimi.com/chat/conversation');
	await assert.rejects(f.workspace.createTask('Unsupported', 'default', 'Personal', 'unknown' as WorkspaceProvider), /provider_unsupported/);
	assert.equal(f.workspace.data().tasks.length, 2); await f.workspace.shutdown();
});

test('pausing while the reviewed turn is being persisted prevents every provider operation', async () => {
	const f = await fixture(); await f.prepare(); const preview = await f.workspace.preview(f.taskId);
	const gate = f.holdWrite(), sending = f.workspace.send(preview.id), rejected = assert.rejects(sending, /workspace_paused/);
	assert.equal(f.workspace.busy(f.taskId), true);
	await gate.entered; f.workspace.pause(f.taskId); gate.release(); await rejected;
	assert.equal(f.workspace.busy(f.taskId), false);
	assert.equal(f.workspace.data().exchanges[0]!.submitState, 'paused');
	assert.equal(f.workspace.data().exchanges[0]!.attempts.length, 0);
	assert.equal(f.mutations.length, 0); await f.workspace.shutdown();
});

test('draft edits are owned by the service, coalesced, retained on failure and drained before shutdown', async () => {
	const f = await fixture();
	const first = f.workspace.stageDraft(f.taskId, 'First character');
	const last = f.workspace.stageDraft(f.taskId, 'Latest question');
	assert.equal(f.workspace.data().tasks[0]!.draft, 'Latest question');
	await Promise.all([first, last]);
	assert.equal(JSON.parse(f.files.get('documents.json')!).tasks[0].draft, 'Latest question');
	f.fail(true);
	const failed = f.workspace.stageDraft(f.taskId, 'Failed write');
	const newer = f.workspace.stageDraft(f.taskId, 'Keep this newer draft');
	await Promise.all([assert.rejects(failed, /read-only/), assert.rejects(newer, /read-only/)]);
	assert.equal(f.workspace.data().tasks[0]!.draft, 'Keep this newer draft');
	assert.equal(f.workspace.draftPending(f.taskId), true);
	f.fail(false); await f.workspace.retrySave();
	assert.equal(JSON.parse(f.files.get('documents.json')!).tasks[0].draft, 'Keep this newer draft');
	assert.equal(f.workspace.draftPending(f.taskId), false);
	const saving = f.workspace.stageDraft(f.taskId, 'Close immediately');
	await f.workspace.shutdown(); await saving;
	assert.equal(JSON.parse(f.files.get('documents.json')!).tasks[0].draft, 'Close immediately');
	assert.equal(f.mutations.length, 0);
});

test('task content is durable, preparation is explicit, and only the reviewed final text is dispatched', async () => {
	const f = await fixture(); assert.equal(f.workspace.data().tasks[0]!.targets[0]!.status, 'unverified'); assert.equal(f.mutations.length, 0);
	await f.prepare();
	const preview = await f.workspace.preview(f.taskId, [], 'User edited final prompt');
	assert.equal(f.mutations.length, 0, 'Preview is read-only');
	preview.finalPrompt = 'Mutated caller object'; preview.targets[0]!.profileId = 'other';
	await f.workspace.send(preview.id);
	assert.ok(f.mutations.includes('commit:User edited final prompt'));
	assert.equal(f.workspace.data().turns[0]!.finalPrompt, 'User edited final prompt');
	assert.equal(f.workspace.data().turns[0]!.question, 'Question');
	assert.equal(JSON.parse(f.files.get('documents.json')!).tasks[0].draft, 'Question');
	await f.workspace.shutdown(); await f.workspace.shutdown();
});

test('editing a question or a template invalidates the reviewed preview but pane visibility does not change recipients', async () => {
	const f = await fixture(); await f.prepare();
	let preview = await f.workspace.preview(f.taskId);
	await f.workspace.updateTask(f.taskId, { draft: 'Changed question' });
	await assert.rejects(f.workspace.send(preview.id), /preview_changed/); assert.equal(f.mutations.length, 0);
	await f.store.edit(data => { data.templates.push({ id: 'template', revision: 1, order: 0, title: 'Expert', body: 'Analyze carefully', createdAt: 1, updatedAt: 1 }); });
	preview = await f.workspace.preview(f.taskId, ['template']);
	await f.store.edit(data => { data.templates[0]!.revision++; data.templates[0]!.body = 'Changed template'; });
	await assert.rejects(f.workspace.send(preview.id), /preview_changed/); assert.equal(f.mutations.length, 0);
	preview = await f.workspace.preview(f.taskId, ['template']);
	await f.workspace.updateTask(f.taskId, { visibleTargetIds: [] });
	await f.workspace.send(preview.id);
	assert.ok(f.mutations.includes('commit:Changed template\n\nChanged question'));
	assert.equal(f.workspace.data().turns[0]!.targets.length, 1); await f.workspace.shutdown();
});

test('a failed turn document write cannot stage input; save retry is disk-only and the old preview cannot submit', async () => {
	const f = await fixture(); await f.prepare(); const preview = await f.workspace.preview(f.taskId);
	f.fail(true); await assert.rejects(f.workspace.send(preview.id), /read-only/);
	assert.equal(f.mutations.length, 0); f.fail(false); await f.workspace.retrySave();
	assert.equal(f.mutations.length, 0); await assert.rejects(f.workspace.send(preview.id), /preview_changed/);
	assert.equal(f.workspace.data().turns.length, 1); await f.workspace.shutdown();
});

test('double activation consumes a preview once and an identical subsequent question creates a separate turn', async () => {
	const f = await fixture(); await f.prepare(); const first = await f.workspace.preview(f.taskId);
	const results = await Promise.allSettled([f.workspace.send(first.id), f.workspace.send(first.id)]);
	assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected']);
	assert.equal(f.mutations.filter(value => value.startsWith('commit:')).length, 1);
	const second = await f.workspace.preview(f.taskId); await f.workspace.send(second.id);
	assert.notEqual(first.id, second.id); assert.equal(second.sequence, 2);
	assert.equal(f.workspace.data().turns.length, 2); assert.equal(f.mutations.filter(value => value.startsWith('commit:')).length, 2);
	await f.workspace.shutdown();
});

test('opening a website without verifying an empty conversation cannot mark a target ready', async () => {
	const f = await fixture(); f.dirty(true);
	await assert.rejects(f.workspace.prepareTarget(f.taskId, f.targetId, true), /new_conversation/);
	assert.equal(f.workspace.data().tasks[0]!.targets[0]!.status, 'unverified');
	assert.equal(f.disposed.at(-1), f.targetId); assert.equal(f.workspace.busy(f.taskId), false);
	await f.workspace.shutdown(); await assert.rejects(f.workspace.createTask('Closed', 'default', ''), /browser_disabled/);
});
