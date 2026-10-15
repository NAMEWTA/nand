import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { TextStorage } from '../../../shared/storage/ports';
import { BrowserProfileStore } from './profile-store';

function memory() {
	const files = new Map<string, string>();
	let fail = false;
	const storage: TextStorage = {
		exists: async (path) => files.has(path),
		read: async (path) => files.get(path)!,
		mkdir: async () => {},
		write: async (path, text) => {
			if (fail && path === 'profiles.json') {
				fail = false;
				throw new Error('read-only');
			}
			files.set(path, text);
		},
	};
	return {
		storage,
		files,
		failWrite: () => {
			fail = true;
		},
	};
}

test('profile metadata survives reload, failed edits and interrupted deletion', async () => {
	const { storage, files, failWrite } = memory();
	let store = new BrowserProfileStore(storage, 'profiles.json', () => {});
	await store.ready;
	const first = await store.create('Work'),
		second = await store.create('Personal');
	await store.setSource(first.id, 'Chrome');
	assert.equal(store.get(second.id).importSource, undefined);
	const before = files.get('profiles.json');
	failWrite();
	await assert.rejects(store.rename(first.id, 'Broken'), /read-only/);
	assert.equal(store.get(first.id).label, 'Work');
	assert.equal(files.get('profiles.json'), before);
	await store.rename(first.id, 'Renamed');
	await store.markDeleting(first.id);
	await store.shutdown();
	store = new BrowserProfileStore(storage, 'profiles.json', () => {});
	await store.ready;
	assert.equal(store.get(first.id).state, 'deleting');
	assert.equal(store.get(first.id).label, 'Renamed');
	assert.equal(store.get(first.id).importSource, 'Chrome');
	assert.equal(typeof store.get(first.id).createdAt, 'number');
	await assert.rejects(store.markDeleting('default'), /browser_profile_missing/);
	await store.remove(first.id);
	assert.throws(() => store.get(first.id), /browser_profile_missing/);
	assert.equal(store.get(second.id).state, 'ready');
	assert.equal(store.list()[0]?.id, 'default');
	await store.shutdown();
});

test('profile identity is independent of labels and rejects invalid names', async () => {
	const { storage } = memory(),
		store = new BrowserProfileStore(storage, 'profiles.json', () => {});
	const a = await store.create('Same label'),
		b = await store.create('Same label');
	assert.notEqual(a.id, b.id);
	await assert.rejects(store.create(' '), /browser_profile_label/);
	await store.shutdown();
});

test('invalid account storage fails closed without replacing the file', async () => {
	const { storage, files } = memory();
	const raw = JSON.stringify({
		profiles: [{ id: 'bad', label: 'Broken', kind: 'isolated', state: 'ready' }],
		permissions: {},
	});
	files.set('profiles.json', raw);
	const store = new BrowserProfileStore(storage, 'profiles.json', () => {});
	await assert.rejects(store.ready, /browser_profile_storage/);
	await assert.rejects(store.create('New'), /browser_profile_storage/);
	assert.equal(files.get('profiles.json'), raw);
	await assert.rejects(store.shutdown(), /browser_profile_storage/);
});
