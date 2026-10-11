import assert from 'node:assert/strict';
import { test } from 'vitest';
import { applyCapture, freezeTurn, recoverExchange, type AnswerCapture, type WorkspaceExchange, type WorkspaceTask } from './model';

const task = (): WorkspaceTask => ({ id: 'task', title: 'Research', pinned: false, createdAt: 1, updatedAt: 1, draft: 'Question',
	targets: ['a', 'b'].map(id => ({ id, provider: 'deepseek', profileId: id, accountLabel: id, page: { pageId: id, profileId: id, generation: 'first' }, status: 'ready' })),
	selectedTargetIds: ['b'], visibleTargetIds: ['a'] });
const exchange = (): WorkspaceExchange => ({ id: 'exchange', turnId: 'turn', targetId: 'b', attempts: [{ id: 'attempt', expectedTarget: { pageId: 'b', profileId: 'b', generation: 'first' }, intentPersistedAt: 1, promptHash: 'hash', outcome: 'intent' }], submitState: 'staging', acquisitionState: 'idle', saveState: 'pending', captures: [] });
test('turn recipients are independent of visibility and frozen against later profile, draft and template edits', () => {
	const source = task(), template = { id: 'template', revision: 1, title: 'Expert', body: 'Analyze carefully' };
	const first = freezeTurn(source, 'first', 1, 'Analyze carefully\nQuestion', [template], 2);
	source.targets[1]!.page = { pageId: 'replacement', profileId: 'b', generation: 'second' };
	source.draft = 'Edited'; template.body = 'Changed';
	assert.deepEqual(first.targets.map(row => row.id), ['b']);
	assert.equal(first.targets[0]!.page!.generation, 'first');
	assert.equal(first.question, 'Question'); assert.equal(first.templates[0]!.body, 'Analyze carefully');
	const second = freezeTurn(task(), 'second', 2, first.finalPrompt, [], 3);
	assert.notEqual(first.id, second.id, 'An identical question still creates a distinct turn');
	const invalid = task(); invalid.targets[1]!.page = { ...invalid.targets[1]!.page!, profileId: 'other' };
	assert.throws(() => freezeTurn(invalid, 'x', 3, 'Q', [], 4), /target_not_ready/);
});
test('restart distinguishes uncommitted intent from dispatch uncertainty; latest partial capture supersedes old complete', () => {
	const initial = exchange();
	assert.equal(recoverExchange(initial).submitState, 'paused');
	initial.attempts[0]!.dispatchStartedAt = 2;
	assert.equal(recoverExchange(initial).submitState, 'unknown');
	assert.equal(initial.attempts[0]!.outcome, 'intent', 'Recovery does not mutate the persisted input');
	const accepted = structuredClone(initial);
	accepted.attempts[0]!.outcome = 'accepted'; accepted.attempts[0]!.finishedAt = 3;
	accepted.submitState = 'submitted'; accepted.acquisitionState = 'waiting';
	assert.equal(recoverExchange(accepted).submitState, 'submitted');
	assert.equal(recoverExchange(accepted).acquisitionState, 'incomplete', 'An accepted submission with interrupted capture is not left waiting forever');
	const capture: AnswerCapture = { id: 'c1', exchangeId: initial.id, revision: 1, source: 'provider-api', adapterVersion: 'fixture', conversationId: 'conversation', messageId: 'answer', parentId: 'question', branchId: 'branch', markdown: 'Answer', complete: true, reasons: [], terminalEvidence: ['finished'], capturedAt: 3 };
	const complete = applyCapture(initial, capture);
	const partial = applyCapture(complete, { ...capture, id: 'c2', revision: 2, complete: false, reasons: ['missing-terminal'], capturedAt: 4 });
	assert.equal(partial.currentCaptureId, 'c2'); assert.equal(partial.acquisitionState, 'incomplete');
	assert.equal(partial.captures[0]!.complete, true, 'The earlier revision remains inspectable');
	assert.throws(() => applyCapture(partial, capture), /stale_capture/);
});
