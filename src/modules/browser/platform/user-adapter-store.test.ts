import assert from 'node:assert/strict';
import { test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import type { TextStorage } from '../../../shared/storage/ports';
import type { UserAdapter } from '../core/providers/user-adapter';
import { markdownUserAdapterStore, UserAdapterStore } from './user-adapter-store';

const candidate: UserAdapter = { id: 'rule', title: 'Rule', provider: 'deepseek', origin: 'https://chat.deepseek.com', profileScope: 'default', pathPattern: '/*',
	selectors: { composer: '#composer', submit: '#submit', answer: '.answer' }, version: 1, state: 'candidate', createdAt: 1, updatedAt: 1 };
test('adapter Markdown coexists with task documents and preserves user prose outside owned properties', async () => {
	const foreign = '---\nnand-type: browser-task\nnand-id: unrelated\n---\nKeep this task.\n';
	const vault = memoryVault({ 'Workspace/task.md': foreign });
	const store = markdownUserAdapterStore(vault.app, 'Workspace', '.nand/recovery/rules.json', () => {});
	await store.put(candidate); assert.equal(vault.contents.get('Workspace/task.md'), foreign);
	const path = [...vault.contents.keys()].find(path => path.endsWith('/rule.md'))!;
	await vault.adapter.write(path, vault.contents.get(path)! + '\nPersonal explanation.\n');
	await store.put({ ...candidate, state: 'disabled' }, candidate);
	assert.ok(vault.contents.get(path)?.includes('Personal explanation.')); await store.shutdown();
	const restarted = markdownUserAdapterStore(vault.app, 'Workspace', '.nand/recovery/next.json', () => {}); await restarted.ready;
	assert.equal(restarted.data().rules[0]!.state, 'disabled'); await restarted.shutdown();
});
test('failed rule writes preserve a recoverable candidate and block further admission until an explicit save retry', async () => {
	const files = new Map<string, string>(); let fail = true;
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => files.get(path)!, mkdir: async () => {},
		write: async (path, text) => { if (path === 'rules.json' && fail) throw Error('disk-full'); files.set(path, text); } };
	const store = new UserAdapterStore(storage, 'rules.json', () => {}, 'recovery.json');
	await assert.rejects(store.put(candidate), /disk-full/); assert.equal(store.state().status, 'unsaved');
	assert.ok(files.get('recovery.json')?.includes('#composer')); await assert.rejects(store.refresh(), /save_pending/);
	fail = false; await store.retrySave(); await store.refresh(); assert.deepEqual(store.data().rules, [candidate]);
	files.set('rules.json', JSON.stringify({ version: 1, rules: [{ ...candidate, title: 'User edit' }] }));
	await assert.rejects(store.put({ ...candidate, state: 'disabled' }, candidate), /storage_changed/);
	assert.equal(store.data().rules[0]!.title, 'User edit'); await store.shutdown();
});
