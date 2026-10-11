import assert from 'node:assert/strict';
import { test } from 'vitest';
import { emptyWorkspace, type TargetBinding } from './model';
import { validateWorkspace } from './documents';
import { searchTasks, taskDocuments, taskTurns } from './history';

test('history search follows task relationships and orders by pin/date, independent of document enumeration', () => {
	const data = emptyWorkspace();
	for (const [id, title, pinned, updatedAt] of [['a', 'Research', false, 3], ['b', 'Pinned task', true, 1], ['c', 'Another', false, 2]] as const)
		data.tasks.push({ id, title, pinned, updatedAt, createdAt: 1, draft: '', targets: [], selectedTargetIds: [], visibleTargetIds: [] });
	const binding: TargetBinding = { id: 'target', provider: 'deepseek', profileId: 'default', accountLabel: 'Personal', status: 'ready', page: { pageId: 'page', profileId: 'default', generation: 'generation' } };
	for (const sequence of [3, 1, 2]) data.turns.push({ id: 'turn-' + sequence, taskId: 'a', sequence, question: sequence === 2 ? 'Earlier question' : '', finalPrompt: '', templates: [], targets: [binding], createdAt: sequence });
	data.exchanges.push({ id: 'answer', turnId: 'turn-1', targetId: 'target', attempts: [], submitState: 'submitted', acquisitionState: 'complete', saveState: 'saved', currentCaptureId: 'capture',
		captures: [{ id: 'capture', exchangeId: 'answer', revision: 1, source: 'provider-api', adapterVersion: 'fixture', conversationId: 'conversation', messageId: 'message', markdown: 'Searchable answer', complete: true, reasons: [], terminalEvidence: ['done'], capturedAt: 1 }] });
	validateWorkspace(data);
	assert.deepEqual(searchTasks(data, '').map(task => task.id), ['b', 'a', 'c']);
	assert.deepEqual(searchTasks(data, '  SEARCHABLE ').map(task => task.id), ['a']);
	assert.deepEqual(searchTasks(data, 'earlier').map(task => task.id), ['a']);
	assert.deepEqual(searchTasks(data, 'missing'), []);
	assert.deepEqual(taskTurns(data, 'a').map(turn => turn.sequence), [1, 2, 3]);
	const scope = taskDocuments(data, 'a');
	assert.equal(scope.task.id, 'a'); assert.equal(scope.exchanges.length, 1);
	scope.task.title = 'Caller mutation'; assert.equal(data.tasks[0]!.title, 'Research');
	assert.throws(() => taskDocuments(data, 'missing'), /task_missing/);
});
