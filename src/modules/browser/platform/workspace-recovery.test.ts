import assert from 'node:assert/strict';
import { test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { markdownWorkspaceStore } from './workspace-store';
import { readWorkspaceRecovery, workspaceRecoveryDirectory } from './workspace-recovery';
import { initializeTestDevice } from '../../../../test/fixtures/vault-storage';
import { deviceId } from '../../../../src/host/obsidian/storage/device-id';
import { emptyWorkspace } from '../core/workspace/model';

test('legacy folder recovery stays discoverable after content migration without rewriting its evidence', async () => {
	const vault = memoryVault(), old = 'NAND/AI Workspace', root = '.nand/content/' + old;
	await initializeTestDevice(vault.app);
	const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(old)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
	const id = crypto.randomUUID(), path = `.nand/recovery/drafts/browser-${deviceId(vault.app)}-${hash}/${id}.json`;
	const raw = JSON.stringify({ path: 'browser/workspace-documents/' + encodeURIComponent(old) + '.json', at: new Date(1).toISOString(), baseline: emptyWorkspace(), draft: { ...emptyWorkspace(), tasks: [{ id: 'task', title: 'Recovered', draft: 'Keep this', pinned: false, createdAt: 1, updatedAt: 1, targets: [], selectedTargetIds: [], visibleTargetIds: [] }] } });
	vault.contents.set(path, raw);
	const loaded = await readWorkspaceRecovery(vault.app, root, id);
	assert.equal(loaded.review.canRestore, true);
	assert.equal(loaded.record!.path, 'browser/workspace-documents/' + encodeURIComponent(root) + '.json');
	assert.equal(vault.contents.get(path), raw);
});

test('a failed restart save cannot overwrite a previous runtime recovery snapshot, and listing stays in this workspace', async () => {
	const vault = memoryVault(), root = '.nand/content/NAND/AI Workspace';
	Object.assign(vault.app, { loadLocalStorage: () => '00000000-0000-0000-0000-000000000001', saveLocalStorage: () => {} });
	await initializeTestDevice(vault.app);

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
