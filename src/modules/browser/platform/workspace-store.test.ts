import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { TextStorage } from '../../../shared/storage/ports';
import { WorkspaceStore, markdownWorkspaceStore } from './workspace-store';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { freezeTurn } from '../core/workspace/model';
import { decodeWorkspaceRecovery, mergeWorkspaceRecovery } from '../core/workspace/recovery';

test('failed visible-document writes retain the draft and require explicit save retry before any further edit', async () => {
	const files = new Map<string, string>(); let fail = false, closed = 0;
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => files.get(path)!, mkdir: async () => {},
		write: async (path, text) => { if (path === 'documents.json' && fail) { fail = false; throw Error('read-only'); } files.set(path, text); } };
	let store = new WorkspaceStore(storage, 'documents.json', () => {}, () => { closed++; });
	fail = true;
	await assert.rejects(store.edit(data => { data.tasks.push({ id: 'task', title: 'Research', draft: 'Keep this question', pinned: false, createdAt: 1, updatedAt: 1, targets: [], selectedTargetIds: [], visibleTargetIds: [] }); }), /read-only/);
	assert.equal(store.hasPendingSave(), true); assert.equal(store.data().tasks[0]!.draft, 'Keep this question');
	assert.equal(files.has('documents.json'), false);
	await assert.rejects(store.edit(data => { data.tasks[0]!.draft = 'Must not replace'; }), /save_pending/);
	await store.refresh(); assert.equal(store.data().tasks[0]!.draft, 'Keep this question');
	await store.retrySave(); assert.equal(store.hasPendingSave(), false);
	await store.shutdown(); assert.equal(closed, 1);
	store = new WorkspaceStore(storage, 'documents.json', () => {}); await store.ready;
	assert.equal(store.data().tasks[0]!.draft, 'Keep this question');
	await store.shutdown();
	await assert.rejects(store.edit(() => {}), /browser_disabled/);
});

test('workspace collection preserves foreign NAND documents in its configured folder', async () => {
	const foreign = '---\nnand-type: automation\nnand-id: foreign\nname: Keep me\n---\nUser automation text.\n';
	const vault = memoryVault({ 'Shared/other.md': foreign });
	const store = markdownWorkspaceStore(vault.app, 'Shared', () => {});
	await store.ready;
	await store.edit(data => { data.tasks.push({ id: 'task', title: 'New task', draft: 'Question', pinned: false, createdAt: 1, updatedAt: 1, targets: [], selectedTargetIds: [], visibleTargetIds: [] }); });
	assert.equal(vault.contents.get('Shared/other.md'), foreign);
	assert.ok([...vault.contents.keys()].some(path => path.startsWith('Shared/task/')));
	await store.shutdown(); await store.shutdown();
});

test('interrupted task deletion leaves a valid partial collection and retry completes without orphan answers', async () => {
	const vault = memoryVault(), store = markdownWorkspaceStore(vault.app, 'Workspace', () => {}, '.nand/recovery/delete.json');
	await store.edit(data => {
		const task = { id: 'task', title: 'Research', pinned: false, createdAt: 1, updatedAt: 1, draft: 'Question', targets: [{ id: 'target', provider: 'deepseek' as const, profileId: 'default', accountLabel: 'Personal', status: 'ready' as const, page: { pageId: 'page', profileId: 'default', generation: 'generation' } }], selectedTargetIds: ['target'], visibleTargetIds: [] };
		data.tasks.push(task); data.turns.push(freezeTurn(task, 'turn', 1, 'Question', [], 2));
		data.exchanges.push({ id: 'answer', turnId: 'turn', targetId: 'target', attempts: [], submitState: 'submitted', acquisitionState: 'waiting', saveState: 'saved', captures: [] });
	});
	const write = vault.adapter.write.bind(vault.adapter); let tombstones = 0;
	vault.adapter.write = async (path, text) => { if (path.endsWith('.md') && text.includes('nand-deleted: true') && ++tombstones === 2) throw Error('disk-full'); await write(path, text); };
	await assert.rejects(store.edit(data => { data.tasks = []; data.turns = []; data.exchanges = []; }), /disk-full/);
	const restarted = markdownWorkspaceStore(vault.app, 'Workspace', () => {});
	await restarted.ready;
	assert.equal(restarted.data().tasks.length, 1); assert.equal(restarted.data().turns.length, 1); assert.equal(restarted.data().exchanges.length, 0);
	const recovery = decodeWorkspaceRecovery(JSON.parse(vault.contents.get('.nand/recovery/delete.json')!), store.key);
	assert.equal(mergeWorkspaceRecovery(recovery, restarted.data()).tasks.length, 0, 'An explicit recovery can finish the reviewed deletion after restart');
	await restarted.shutdown();
	assert.ok(vault.contents.get('.nand/recovery/delete.json')?.includes('Question'));
	await store.retrySave();
	assert.equal(store.hasPendingSave(), false); assert.equal(store.data().tasks.length, 0);
	await store.shutdown();
	const final = markdownWorkspaceStore(vault.app, 'Workspace', () => {}); await final.ready;
	assert.equal(final.data().tasks.length, 0); await final.shutdown();
	assert.equal([...vault.contents.entries()].filter(([path, text]) => path.endsWith('.md') && text.includes('nand-deleted: true')).length, 3);
});
