import assert from 'node:assert/strict';
import { test } from 'vitest';
import { SettingsStore, type SettingsFile } from '../../../shared/settings/store';
import { newsSettings } from '../settings';
import { saveNewsWidget } from './widget-settings';

test('a failed widget save restores that instance, preserves another update, and can retry durably', async () => {
	let fail = true;
	let disk: SettingsFile | undefined;
	const store = new SettingsStore({ load: async () => null, save: async (scope, file) => {
		if (fail) { fail = false; throw Error('disk full'); }
		if (scope === 'vault') disk = structuredClone(file);
	} }, { debounceMs: 0, timers: { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) } });
	await store.load();
	const handle = store.bind('news', newsSettings), original = handle.get().widgets![0]!;
	try {
		const failed = assert.rejects(saveNewsWidget(handle, original.id, { ...original, count: 2 }), /disk full/);
		const other = handle.update(settings => { settings.widgets![1]!.count = 4; }).catch(() => undefined);
		await Promise.all([failed, other]);
		assert.equal(handle.get().widgets![0]!.count, original.count);
		assert.equal(handle.get().widgets![1]!.count, 4);
		assert.deepEqual(newsSettings.normalize(disk!.namespaces.news).widgets, handle.get().widgets);
		await saveNewsWidget(handle, original.id, { ...original, count: 2 });
		assert.equal(newsSettings.normalize(disk!.namespaces.news).widgets![0]!.count, 2);
		fail = true;
		await assert.rejects(saveNewsWidget(handle, 'new', { ...original, id: 'new' }), /disk full/);
		assert.equal(handle.get().widgets!.some(item => item.id === 'new'), false);
	} finally { await store.dispose(); }
});
