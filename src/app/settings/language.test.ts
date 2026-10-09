import assert from 'node:assert/strict';
import { test } from 'vitest';
import { languageUpdater, normalizeLanguage, settingsWriter } from './language';

test('missing and invalid language preferences use Chinese; explicit English survives', () => {
	for (const value of [undefined, null, '', 'de', {}, 'zh']) assert.equal(normalizeLanguage(value), 'zh');
	assert.equal(normalizeLanguage('en'), 'en');
});

test('language requests serialize and publish only after successful persistence', async () => {
	const writes: string[] = [], published: string[] = [];
	let release!: () => void;
	const gate = new Promise<void>((resolve) => { release = resolve; });
	const update = languageUpdater(async (value) => { writes.push(value); await gate; }, (value) => published.push(value));
	const first = update('en'), second = update('zh');
	await Promise.resolve();
	assert.deepEqual(writes, ['en']); assert.deepEqual(published, []);
	release(); await Promise.all([first, second]);
	assert.deepEqual(writes, ['en', 'zh']); assert.deepEqual(published, ['en', 'zh']);
});

test('failed persistence keeps the previous language and permits a later retry', async () => {
	let fail = true, language = 'zh';
	const update = languageUpdater(async () => { if (fail) throw new Error('disk unavailable'); }, (value) => { language = value; });
	await assert.rejects(update('en'), /disk unavailable/);
	assert.equal(language, 'zh'); fail = false;
	await update('en'); assert.equal(language, 'en');
});

test('ordinary setting saves queued during a language write use the newly committed preference', async () => {
	const write = settingsWriter(), snapshots: string[] = [];
	let language = 'zh', release!: () => void;
	const gate = new Promise<void>((resolve) => { release = resolve; });
	const update = languageUpdater(async (next) => { await gate; snapshots.push(next); language = next; }, () => {}, write);
	const first = update('en');
	const otherSetting = write(async () => { snapshots.push(language); });
	await Promise.resolve();
	assert.deepEqual(snapshots, []);
	release(); await Promise.all([first, otherSetting]);
	assert.deepEqual(snapshots, ['en', 'en']);
});
