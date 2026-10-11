import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { emptyWorkspace, freezeTurn, retryContext } from './model';
import { validateWorkspace, workspaceDocuments } from './documents';
import { exportMaiwHistory, mergeHistoryImport, planHistoryImport } from './history-transfer';
import { parseMaiwHistory, type MaiwHistory } from './maiw-format';

const fixture = (): MaiwHistory => parseMaiwHistory(readFileSync(resolve('src/modules/browser/core/workspace/fixtures/maiw-v3.jsonl'), 'utf8'));
const ports = () => { let id = 0; return { id: () => 'local-' + ++id, hash: async (text: string) => createHash('sha256').update(text).digest('hex'), accountLabel: 'Imported; choose an account' }; };
const ordered = (data: MaiwHistory) => ({ ...data, sessions: data.sessions.toSorted((a,b)=>a.id.localeCompare(b.id)), turns: data.turns.toSorted((a,b)=>a.id.localeCompare(b.id)), exchanges: data.exchanges.toSorted((a,b)=>a.id.localeCompare(b.id)) });

test('v3 import maps readable transcripts and frozen templates without creating website identities or a template library', async () => {
	const input = fixture(), plan = await planHistoryImport(input, emptyWorkspace(), ports()), data = mergeHistoryImport(emptyWorkspace(), plan);
	assert.deepEqual(plan.counts, { sessions: { added: 1, duplicate: 0 }, turns: { added: 2, duplicate: 0 }, exchanges: { added: 2, duplicate: 0 } });
	assert.equal(data.templates.length, 0); assert.equal(data.tasks[0]!.targets[0]!.profileId, 'unbound'); assert.deepEqual(data.tasks[0]!.selectedTargetIds, []);
	assert.ok(data.turns.every(turn => turn.targets.every(target => !target.page && !target.conversationId && target.status === 'unverified')));
	assert.ok(data.exchanges.every(exchange => !exchange.receipt && !exchange.attempts.length && !exchange.captures.length && exchange.acquisitionState === 'incomplete'));
	assert.equal(data.turns[0]!.templates[0]!.body, 'Check sources'); assert.equal(data.exchanges[0]!.imported!.record.responseStatus, 'completed');
	const codec = workspaceDocuments('NAND/AI Workspace'), documents = codec.encode(data);
	const answer = documents.find(doc => doc.id === data.exchanges[0]!.id)!;
	assert.match(answer.sections!['imported-markdown']!, /# Saved answer/);
	assert.doesNotMatch(JSON.stringify(answer.properties), /# Saved answer/);
	const restored = codec.decode(documents.toReversed());
	assert.deepEqual(ordered(parseMaiwHistory(exportMaiwHistory(restored, [restored.tasks[0]!.id], input.exportedAt))), ordered(input));
	assert.throws(() => retryContext(restored, restored.exchanges[0]!.id), /retry_review/);
});

test('source fingerprints make repeated imports idempotent while preserving later local edits and reporting conflicts without additions', async () => {
	const input = fixture(), p = ports(), data = mergeHistoryImport(emptyWorkspace(), await planHistoryImport(input, emptyWorkspace(), p));
	data.tasks[0]!.title = 'Renamed locally'; data.exchanges[0]!.imported!.markdown = 'Local annotated answer';
	const repeat = await planHistoryImport(input, data, p);
	assert.deepEqual(repeat.counts, { sessions: { added: 0, duplicate: 1 }, turns: { added: 0, duplicate: 2 }, exchanges: { added: 0, duplicate: 2 } });
	assert.deepEqual(mergeHistoryImport(data, repeat), data);
	input.exchanges[0]!.responseMarkdown = 'Changed upstream';
	const conflict = await planHistoryImport(input, data, p);
	assert.deepEqual(conflict.conflicts, [{ kind: 'exchanges', sourceId: 'source-exchange-one' }]);
	assert.equal(conflict.additions.tasks.length, 0); assert.equal(conflict.additions.exchanges.length, 0);
	assert.throws(() => mergeHistoryImport(data, conflict), /import_conflict/);
	assert.equal(data.exchanges[0]!.imported!.markdown, 'Local annotated answer');
});

test('import provenance cannot be turned into native captures, page bindings or duplicate source ownership', async () => {
	const data = mergeHistoryImport(emptyWorkspace(), await planHistoryImport(fixture(), emptyWorkspace(), ports()));
	for (const change of [
		(value: typeof data) => { value.turns[0]!.targets[0]!.page = { pageId: 'fake', profileId: 'unbound', generation: 'fake' }; },
		(value: typeof data) => { value.exchanges[0]!.receipt = { attemptId: 'fake', conversationId: 'fake', messageId: 'fake' }; },
		(value: typeof data) => { value.exchanges[0]!.acquisitionState = 'complete'; },
		(value: typeof data) => { value.tasks.push({ ...value.tasks[0]!, id: 'another-owner' }); },
	]) { const invalid = structuredClone(data); change(invalid); assert.throws(() => validateWorkspace(invalid), /workspace_storage/); }
});

test('an aborted imported round with no exchanges stays readable without invented targets or answers', async () => {
	const input = fixture(); input.turns.push({ id: 'aborted', sessionId: input.sessions[0]!.id, sequence: 3, prompt: 'Unsent preparation', createdAt: input.exportedAt, status: 'aborted' });
	const data = mergeHistoryImport(emptyWorkspace(), await planHistoryImport(input, emptyWorkspace(), ports()));
	assert.equal(data.turns.at(-1)!.targets.length, 0); assert.equal(data.exchanges.length, 2);
	assert.equal(parseMaiwHistory(exportMaiwHistory(data, [data.tasks[0]!.id], input.exportedAt)).turns.find(turn => turn.id === 'aborted')!.status, 'aborted');
});

test('native v3 export keeps same-site answers from different targets, reports actual completion and refuses oversized fields', () => {
	const data = emptyWorkspace();
	const task = { id: 'task', title: 'Native task', pinned: false, createdAt: 1, updatedAt: 3, draft: 'Question', targets: [0, 1].map(index => ({ id: 'target-' + index, provider: 'deepseek' as const,
		profileId: 'private-profile-' + index, accountLabel: 'Private label', status: 'ready' as const, page: { pageId: 'page-' + index, profileId: 'private-profile-' + index, generation: 'generation' } })), selectedTargetIds: ['target-0', 'target-1'], visibleTargetIds: [] };
	data.tasks.push(task); data.turns.push(freezeTurn(task, 'turn', 1, 'Question', [], 2));
	data.tasks[0]!.panelLayout = { order: ['target-1', 'target-0'], widths: { 'target-1': 2 } };
	for (const [index, target] of task.targets.entries()) data.exchanges.push({ id: 'answer-' + index, turnId: 'turn', targetId: target.id, attempts: [], submitState: 'submitted', acquisitionState: 'complete', saveState: 'saved', currentCaptureId: 'capture-' + index,
		captures: [{ id: 'capture-' + index, exchangeId: 'answer-' + index, revision: 1, source: 'provider-api', adapterVersion: 'fixture', conversationId: 'conversation-' + index, messageId: 'message-' + index, markdown: 'Answer ' + index, complete: true, reasons: [], terminalEvidence: ['finished'], capturedAt: 3 }] });
	const text = exportMaiwHistory(data, ['task'], '2026-09-01T08:00:00.000Z'), parsed = parseMaiwHistory(text);
	assert.equal(parsed.sessions[0]!.workspace.panels.length, 1); assert.equal(parsed.exchanges.length, 2); assert.equal(parsed.turns[0]!.status, 'completed');
	assert.equal(parsed.sessions[0]!.workspace.panels[0]!.panelId, 'target-1'); assert.equal(parsed.sessions[0]!.workspace.panels[0]!.widthRatio, 2);
	assert.doesNotMatch(text, /private-profile|Private label|generation|adapterVersion/);
	data.turns[0]!.finalPrompt = 'x'.repeat(100001);
	assert.throws(() => exportMaiwHistory(data, ['task'], '2026-09-01T08:00:00.000Z'), /export_v3_limits/);
});
