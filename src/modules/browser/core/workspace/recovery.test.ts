import assert from 'node:assert/strict';
import { test } from 'vitest';
import { emptyWorkspace, freezeTurn, type WorkspaceTask } from './model';
import { decodeWorkspaceRecovery, mergeWorkspaceRecovery } from './recovery';

function fixture() {
	const baseline = emptyWorkspace(), task: WorkspaceTask = { id: 'task', title: 'Research', draft: 'Question', pinned: false, createdAt: 1, updatedAt: 1,
		targets: [{ id: 'target', provider: 'deepseek', profileId: 'default', accountLabel: 'Personal', status: 'ready', page: { pageId: 'page', profileId: 'default', generation: 'generation' } }],
		selectedTargetIds: ['target'], visibleTargetIds: ['target'] };
	baseline.tasks.push(task); baseline.turns.push(freezeTurn(task, 'turn', 1, 'Question', [], 2));
	baseline.exchanges.push({ id: 'exchange', turnId: 'turn', targetId: 'target', attempts: [], submitState: 'submitted', acquisitionState: 'waiting', saveState: 'saved', captures: [],
		receipt: { attemptId: 'attempt', conversationId: 'conversation', messageId: 'user' } });
	const draft = structuredClone(baseline), exchange = draft.exchanges[0]!;
	exchange.captures.push({ id: 'capture', exchangeId: 'exchange', revision: 1, source: 'provider-api', adapterVersion: 'fixture', conversationId: 'conversation', messageId: 'answer', parentId: 'user',
		markdown: '# Saved answer', complete: true, reasons: [], terminalEvidence: ['finished'], capturedAt: 3 });
	exchange.currentCaptureId = 'capture'; exchange.acquisitionState = 'complete';
	return { baseline, draft, record: { path: 'documents', at: '2026-10-11T00:00:00Z', baseline, draft } };
}

test('recovery merges a saved answer past restart interruption without overwriting newer human edits', () => {
	const f = fixture(), current = structuredClone(f.baseline);
	current.exchanges[0]!.acquisitionState = 'incomplete'; current.exchanges[0]!.lastError = 'browser_workspace_interrupted';
	current.tasks[0]!.title = 'Renamed locally'; current.tasks[0]!.draft = 'New human draft'; current.tasks[0]!.updatedAt = 8;
	const merged = mergeWorkspaceRecovery(decodeWorkspaceRecovery(f.record, 'documents'), current);
	assert.equal(merged.tasks[0]!.title, 'Renamed locally'); assert.equal(merged.tasks[0]!.draft, 'New human draft');
	assert.equal(merged.exchanges[0]!.acquisitionState, 'complete'); assert.equal(merged.exchanges[0]!.lastError, undefined);
	assert.equal(merged.exchanges[0]!.captures[0]!.markdown, '# Saved answer');
	assert.equal(current.exchanges[0]!.captures.length, 0); assert.equal(f.baseline.exchanges[0]!.captures.length, 0);
});

test('old recovery cannot replace a newer partial capture or resurrect a deleted task', () => {
	const f = fixture(), current = structuredClone(f.draft), exchange = current.exchanges[0]!;
	exchange.captures.push({ ...exchange.captures[0]!, id: 'new', revision: 2, markdown: 'New partial', complete: false, reasons: ['interrupted'], capturedAt: 4 });
	exchange.currentCaptureId = 'new'; exchange.acquisitionState = 'incomplete';
	assert.deepEqual(mergeWorkspaceRecovery(f.record, current), current);
	assert.throws(() => mergeWorkspaceRecovery(f.record, emptyWorkspace()), /Concurrent edit/);
});

test('conflicting answer edits and another workspace key reject restoration', () => {
	const f = fixture(), current = structuredClone(f.draft); current.exchanges[0]!.captures[0]!.markdown = 'New user-owned edit';
	assert.throws(() => mergeWorkspaceRecovery(f.record, current), /Concurrent edit/);
	assert.throws(() => decodeWorkspaceRecovery(f.record, 'different-folder'), /recovery_invalid/);
	assert.throws(() => decodeWorkspaceRecovery({ ...f.record, at: 'not a date' }, 'documents'), /recovery_invalid/);
	assert.throws(() => decodeWorkspaceRecovery({ ...f.record, draft: { ...f.draft, turns: [] } }, 'documents'), /workspace_storage/);
});
