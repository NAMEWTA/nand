import assert from 'node:assert/strict';
import { test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { markdownWorkspaceStore } from './workspace-store';
import { readWorkspaceRecovery, workspaceRecoveryDirectory } from './workspace-recovery';

test('a failed restart save cannot overwrite a previous runtime recovery snapshot, and listing stays in this workspace', async () => {
	const vault = memoryVault(), root = 'NAND/AI Workspace';
	Object.assign(vault.app, { loadLocalStorage: () => '00000000-0000-0000-0000-000000000001', saveLocalStorage: () => {} });
	Object.assign(vault.adapter, {
		exists: async (path: string) => vault.contents.has(path) || [...vault.contents.keys()].some(key => key.startsWith(path + '/')),
		list: async (path: string) => ({ files: [...vault.contents.keys()].filter(key => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/')), folders: [] }),
	});
	const directory = await workspaceRecoveryDirectory(vault.app, root), firstId = crypto.randomUUID(), secondId = crypto.randomUUID();
	const firstFile = directory + '/' + firstId + '.json', secondFile = directory + '/' + secondId + '.json';
	let store = markdownWorkspaceStore(vault.app, root, () => {}, firstFile);
	await store.edit(data => data.tasks.push({ id: 'task', title: 'Research', draft: 'Question', pinned: false, createdAt: 1, updatedAt: 1, targets: [], selectedTargetIds: [], visibleTargetIds: [] }));
	const write = vault.adapter.write.bind(vault.adapter);
	vault.adapter.write = async (path, text) => { if (path.endsWith('.md')) throw Error('read-only'); await write(path, text); };
	await assert.rejects(store.edit(data => { data.tasks[0]!.draft = 'Previously captured content'; }), /read-only/);
	const before = vault.contents.get(firstFile)!; assert.ok(before);
	await store.shutdown().catch(() => undefined);
	store = markdownWorkspaceStore(vault.app, root, () => {}, secondFile); await store.ready;
	await assert.rejects(store.edit(data => { data.tasks[0]!.pinned = true; }), /read-only/);
	assert.equal(vault.contents.get(firstFile), before); assert.ok(vault.contents.has(secondFile));
	await store.shutdown().catch(() => undefined);
	const first = await readWorkspaceRecovery(vault.app, root, firstId);
	assert.equal(first.review.drafts.length, 2); assert.equal(first.review.draft!.tasks[0]!.draft, 'Previously captured content'); assert.equal(first.review.canRestore, true);
	assert.equal((await readWorkspaceRecovery(vault.app, root)).review.draft, undefined, 'No snapshot is implicitly chosen');
	assert.equal((await readWorkspaceRecovery(vault.app, 'Another workspace')).review.drafts.length, 0);
	assert.equal(vault.contents.get(firstFile), before, 'Review remains read-only');
});
