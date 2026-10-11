import assert from 'node:assert/strict';
import { expect, test } from 'vitest';
import { resolve } from 'node:path';
import { DocumentRepository, parseDocumentValue } from '../../../../shared/storage/document-repository';
import { workspaceDocuments } from './documents';
import { emptyWorkspace, freezeTurn, type WorkspaceTask } from './model';
import { synthesisPrompt } from './synthesis';

test('workspace Markdown keeps question, frozen prompt and every answer revision in owned readable sections', async () => {
	const data = emptyWorkspace();
	const task: WorkspaceTask = { id: 'task', title: 'Compare sources', pinned: false, createdAt: 1, updatedAt: 1, draft: 'Question',
		targets: [{ id: 'target', provider: 'deepseek', profileId: 'default', accountLabel: 'Personal', page: { pageId: 'page', profileId: 'default', generation: 'generation' }, status: 'ready' }], selectedTargetIds: ['target'], visibleTargetIds: [] };
	data.tasks.push(task);
	data.turns.push(freezeTurn(task, 'turn', 1, 'Full frozen prompt', [], 2));
	data.exchanges.push({ id: 'exchange', turnId: 'turn', targetId: 'target', attempts: [], submitState: 'submitted', acquisitionState: 'incomplete', saveState: 'saved', currentCaptureId: 'capture-two',
		captures: [1, 2].map(revision => ({ id: revision === 1 ? 'capture-one' : 'capture-two', exchangeId: 'exchange', revision, source: 'provider-api', adapterVersion: 'fixture-v1', conversationId: 'conversation', messageId: 'answer', parentId: 'question', branchId: 'branch', markdown: revision === 1 ? '# Heading\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```ts\nconst a = 1;\n```\n\n$x^2$' : 'Partial update', complete: revision === 1, reasons: revision === 1 ? [] : ['missing-terminal'], terminalEvidence: revision === 1 ? ['finished'] : [], capturedAt: 2 + revision })) });
	const codec = workspaceDocuments('NAND/AI Workspace'), documents = codec.encode(data);
	assert.equal(documents.length, 3, 'Answer revisions and the current pointer are saved atomically in one file');
	const files = new Map<string, string>();
	const repository = new DocumentRepository({ read: async path => files.get(path)!, process: async (path, update) => { const result = update(files.get(path) ?? null); files.set(path, result); return result; } });
	for (const document of documents) await repository.update(document.path, { properties: {} }, document);
	await expect(documents.map(document => `# ${document.path}\n\n${files.get(document.path)}`).join('\n')).toMatchFileSnapshot(resolve(process.cwd(), 'test/golden/__snapshots__/browser-workspace.md'));
	const read = documents.map(document => ({ id: document.id, path: document.path, ...parseDocumentValue(files.get(document.path)!) }));
	assert.deepEqual(codec.decode(read), data);
	const answer = documents.find(document => document.id === 'exchange')!;
	assert.match(files.get(answer.path)!, /const a = 1/);
	assert.equal(JSON.stringify(answer.properties).includes('const a = 1'), false, 'Answer text belongs in the Markdown body');
	files.set(answer.path, files.get(answer.path)!.replace('---\n', '---\ncustom-label: Keep\n') + '\nMy notes outside the owned answer.\n');
	const next = structuredClone(answer); next.sections!.answer = 'Updated partial answer';
	await repository.update(answer.path, answer, next);
	assert.match(files.get(answer.path)!, /custom-label: Keep/);
	assert.match(files.get(answer.path)!, /My notes outside the owned answer/);
	assert.match(files.get(answer.path)!, /const a = 1/);
	assert.throws(() => codec.decode(read.filter(document => document.id !== 'turn')), /browser_workspace_storage/);
	const invalid = structuredClone(data); invalid.exchanges[0]!.currentCaptureId = 'capture-one';
	assert.throws(() => codec.encode(invalid), /browser_workspace_storage/, 'An older complete capture cannot masquerade as the current partial revision');
});

test('standalone synthesis Markdown owns its result and exact source copies without requiring the original task', async () => {
	const data = emptyWorkspace();
	const inputs = [{ exchangeId: 'exchange', captureId: 'capture', revision: 2, turnId: 'turn', sequence: 1, provider: 'deepseek' as const,
		question: 'Question', text: 'Partial answer', complete: false, source: 'scoped-dom' as const, url: 'https://chat.deepseek.com/a/chat/s/conversation' }];
	data.syntheses.push({ id: 'synthesis', taskId: 'deleted-task', taskTitle: 'Original task', title: 'Evidence summary', instruction: 'Summarize with uncertainty',
		prompt: synthesisPrompt('Summarize with uncertainty', inputs), inputs, destination: { kind: 'automatic', agentId: 'codex' }, createdAt: 1, updatedAt: 2,
		status: 'succeeded', text: '# Summary\n\nLimited evidence [S1].' });
	const codec = workspaceDocuments('NAND/AI Workspace'), document = codec.encode(data)[0]!, files = new Map<string, string>();
	const repository = new DocumentRepository({ read: async path => files.get(path)!, process: async (path, update) => { const result = update(files.get(path) ?? null); files.set(path, result); return result; } });
	await repository.update(document.path, { properties: {} }, document);
	await expect(files.get(document.path)).toMatchFileSnapshot(resolve(process.cwd(), 'test/golden/__snapshots__/browser-synthesis.md'));
	assert.deepEqual(codec.decode([{ id: document.id, path: document.path, ...parseDocumentValue(files.get(document.path)!) }]), data);
	files.set(document.path, files.get(document.path)! + '\nMy review notes.\n');
	const next = structuredClone(document); next.sections!.result += '\nReview complete.';
	await repository.update(document.path, document, next); assert.match(files.get(document.path)!, /My review notes/);
	const invalid = structuredClone(data); invalid.syntheses[0]!.inputs[0]!.url = 'https://example.invalid/'; assert.throws(() => codec.encode(invalid), /workspace_storage/);
});
