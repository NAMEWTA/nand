import assert from 'node:assert/strict';
import { test } from 'vitest';
import { emptyWorkspace, type TargetBinding } from './model';
import { workspaceMarkdown, type MarkdownLabels } from './markdown-export';

const labels: MarkdownLabels = { question: 'Question', prompt: 'Prompt', complete: 'Complete', incomplete: 'Incomplete', imported: 'Imported MAIW history', noAnswer: 'No saved answer', noRounds: 'No selected rounds', round: n => 'Round ' + n, provider: id => id, source: id => id };
test('scoped Markdown exports chronological selected answers and current partial revisions without runtime or arbitrary URLs', () => {
	const data = emptyWorkspace(), target: TargetBinding = { id: 'ds', provider: 'deepseek', profileId: 'secret-profile', accountLabel: 'Personal', status: 'ready', officialUrl: 'https://chat.deepseek.com/?token=secret', page: { pageId: 'page', profileId: 'secret-profile', generation: 'generation' } };
	data.tasks.push({ id: 'task', title: 'Research', pinned: false, createdAt: 1, updatedAt: 3, draft: 'Unsent private draft', targets: [target], selectedTargetIds: ['ds'], visibleTargetIds: [] });
	for (const n of [2, 1]) {
		data.turns.push({ id: 'turn-' + n, taskId: 'task', sequence: n, question: 'Question ' + n, finalPrompt: 'Frozen ' + n, templates: [], targets: [target, { ...target, id: 'kimi', provider: 'kimi' }], createdAt: n });
		for (const id of ['ds', 'kimi']) data.exchanges.push({ id: 'exchange-' + id + n, turnId: 'turn-' + n, targetId: id, attempts: [], submitState: 'submitted', acquisitionState: 'incomplete', saveState: 'saved', currentCaptureId: 'current-' + id + n,
			captures: [1, 2].map(revision => ({ id: revision === 2 ? 'current-' + id + n : 'old-' + id + n, exchangeId: 'exchange-' + id + n, revision, source: 'provider-api', adapterVersion: 'fixture', conversationId: 'conversation', messageId: 'answer', markdown: revision === 2 ? 'Partial ' + id + n : 'Old complete ' + id + n, complete: revision === 1, reasons: revision === 1 ? [] : ['missing-page'], terminalEvidence: revision === 1 ? ['finished'] : [], capturedAt: 3 })) });
	}
	const all = workspaceMarkdown(data, { taskIds: ['task'], targetIds: ['ds'], rounds: 'all' }, labels);
	assert.ok(all.indexOf('Round 1') < all.indexOf('Round 2'));
	assert.match(all, /Partial ds1/); assert.match(all, /Incomplete/); assert.match(all, /https:\/\/chat.deepseek.com\/a\/chat\/s\/conversation/);
	assert.doesNotMatch(all, /Old complete|secret|Unsent private|kimi/);
	const latest = workspaceMarkdown(data, { taskIds: ['task'], targetIds: ['kimi'], rounds: 'latest' }, labels);
	assert.match(latest, /Question 2/); assert.match(latest, /Frozen 2/); assert.match(latest, /Partial kimi2/); assert.doesNotMatch(latest, /Round 1|Partial ds/);
	assert.throws(() => workspaceMarkdown(data, { taskIds: ['missing'], targetIds: ['ds'], rounds: 'all' }, labels), /export_scope/);
	assert.throws(() => workspaceMarkdown(data, { taskIds: ['task'], targetIds: [], rounds: 'all' }, labels), /export_scope/);
	assert.throws(() => workspaceMarkdown(data, { taskIds: ['task'], targetIds: ['unknown'], rounds: 'all' }, labels), /export_scope/);
});
