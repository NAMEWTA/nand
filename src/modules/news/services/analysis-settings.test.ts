import assert from 'node:assert/strict';
import { test } from 'vitest';
import { SettingsStore, type SettingsFile } from '../../../shared/settings/store';
import { newsSettings } from '../settings';
import { saveAnalysisSettings } from './analysis-settings';

test('failed analysis settings restore only this edit, persist concurrent fields and permit retry', async () => {
	let fail = true, disk: SettingsFile | undefined;
	const store = new SettingsStore({ load: async () => null, save: async (scope, file) => {
		if (fail) { fail = false; throw Error('disk full'); }
		if (scope === 'vault') disk = structuredClone(file);
	} }, { debounceMs: 0, timers: { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) } });
	await store.load();
	const handle = store.bind('news', newsSettings), original = handle.get().templates!;
	try {
		const failed = assert.rejects(saveAnalysisSettings(handle, value => { value.templates!.writing = 'Draft'; }), /disk full/);
		const other = handle.update(value => { value.interest = 'Concurrent interest'; }).catch(() => undefined);
		await Promise.all([failed, other]);
		assert.deepEqual(handle.get().templates, original);
		assert.equal(handle.get().interest, 'Concurrent interest');
		assert.equal(newsSettings.normalize(disk!.namespaces.news).templates!.writing, original.writing);
		await saveAnalysisSettings(handle, value => { value.templates!.writing = 'Draft'; });
		assert.equal(newsSettings.normalize(disk!.namespaces.news).templates!.writing, 'Draft');
	} finally { await store.dispose(); }
});
