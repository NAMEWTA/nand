import assert from 'node:assert/strict';
import { test } from 'vitest';
import { defineSettings, domainSettings, f, type SettingsScope } from './schema';
import { SettingsStore, type SettingsFile, type SettingsTimers } from './store';

function fakeTimers() {
	let clock = 0;
	const pending = new Map<number, { at: number; callback: () => void }>();
	let id = 0;
	const timers: SettingsTimers = {
		set: (callback, ms) => {
			pending.set(++id, { at: clock + ms, callback });
			return id;
		},
		clear: (handle) => pending.delete(handle as number),
	};
	return {
		timers,
		now: () => clock,
		advance(ms: number) {
			clock += ms;
			for (const [key, entry] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
				if (entry.at > clock) continue;
				pending.delete(key);
				entry.callback();
			}
		},
	};
}

function memory(initial: Partial<Record<SettingsScope, unknown>> = {}) {
	const files: Partial<Record<SettingsScope, unknown>> = { ...initial };
	const writes: Array<{ scope: SettingsScope; file: SettingsFile }> = [];
	let fail = false;
	return {
		files,
		writes,
		failNext() {
			fail = true;
		},
		persistence: {
			load: async (scope: SettingsScope) => (files[scope] ?? null) as SettingsFile | null,
			save: async (scope: SettingsScope, file: SettingsFile) => {
				if (fail) {
					fail = false;
					throw new Error('disk full');
				}
				files[scope] = structuredClone(file);
				writes.push({ scope, file: structuredClone(file) });
			},
		},
	};
}

const schema = defineSettings({
	language: f.enum(['en', 'zh'] as const, { default: 'zh' }),
	count: f.number({ default: 5, min: 0, max: 50, integer: true }),
	panelWidth: f.number({ default: 260, scope: 'device' }),
	tags: f.list(f.string({ default: '' }), { default: [], max: 3 }),
});

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const timers: SettingsTimers = { set: (callback, ms) => setTimeout(callback, ms), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) };

test('values are normalized: unknown keys dropped, invalid values replaced, numbers clamped', async () => {
	const disk = memory({ vault: { version: 1, namespaces: { app: { language: 'fr', count: 99.4, extra: true, tags: ['a', 1, 'b', 'c', 'd'] } } } });
	const store = new SettingsStore(disk.persistence, { timers });
	await store.load();
	const app = store.bind('app', schema).get();
	assert.deepEqual(app, { language: 'zh', count: 50, panelWidth: 260, tags: ['a', '', 'b'] });
});

test('updates notify synchronously and coalesce into one debounced write split by scope', async () => {
	const disk = memory();
	const clock = fakeTimers();
	const store = new SettingsStore(disk.persistence, { timers: clock.timers, now: clock.now, debounceMs: 250 });
	await store.load();
	const app = store.bind('app', schema);
	const seen: string[] = [];
	app.select((value) => value.language, (next) => seen.push(next));
	const first = app.update((draft) => { draft.language = 'en'; });
	const second = app.update((draft) => { draft.panelWidth = 300; });
	assert.deepEqual(seen, ['en']);
	assert.equal(disk.writes.length, 0);
	clock.advance(249);
	assert.equal(disk.writes.length, 0);
	clock.advance(1);
	await Promise.all([first, second]);
	assert.equal(disk.writes.length, 2);
	assert.deepEqual(disk.files.vault, { version: 1, namespaces: { app: { language: 'en', count: 5, tags: [] } } });
	assert.deepEqual(disk.files.device, { version: 1, namespaces: { app: { panelWidth: 300 } } });
});

test('continuous typing is written at least once per max wait', async () => {
	const disk = memory();
	const clock = fakeTimers();
	const store = new SettingsStore(disk.persistence, { timers: clock.timers, now: clock.now, debounceMs: 250, maxWaitMs: 1000 });
	await store.load();
	const app = store.bind('app', schema);
	for (let i = 0; i < 10; i++) {
		void app.update((draft) => { draft.count = i; });
		clock.advance(200);
	}
	await settle();
	assert.ok(disk.writes.length >= 2, `expected max-wait writes, got ${disk.writes.length}`);
});

test('immediate persistence and unbound namespaces pass through unchanged', async () => {
	const disk = memory({ vault: { version: 1, namespaces: { future: { kept: [1, 2] } } } });
	const store = new SettingsStore(disk.persistence, { timers });
	await store.load();
	await store.bind('app', schema).update((draft) => { draft.count = 7; }, { persist: 'immediate' });
	assert.deepEqual((disk.files.vault as SettingsFile).namespaces.future, { kept: [1, 2] });
	assert.equal((disk.files.vault as SettingsFile).namespaces.app?.count, 7);
});

test('a failed write rejects its callers and does not poison later writes', async () => {
	const disk = memory();
	const store = new SettingsStore(disk.persistence, { timers });
	await store.load();
	const app = store.bind('app', schema);
	disk.failNext();
	await assert.rejects(app.update((draft) => { draft.count = 1; }, { persist: 'immediate' }), /disk full/);
	assert.equal(store.status, 'error');
	await app.update((draft) => { draft.count = 2; }, { persist: 'immediate' });
	assert.equal(store.status, 'idle');
	assert.equal((disk.files.vault as SettingsFile).namespaces.app?.count, 2);
});

test('a file without the namespaced layout is ignored and the defaults apply', async () => {
	const disk = memory({ vault: { language: 'en', widgetX: true } });
	const store = new SettingsStore(disk.persistence, { timers });
	await store.load();
	assert.equal(store.bind('app', schema).get().language, 'zh');
	assert.equal(store.empty, true);
});

test('domain namespaces keep their whole value in one scope', async () => {
	const disk = memory();
	const store = new SettingsStore(disk.persistence, { timers });
	await store.load();
	const agent = store.bind('agent', domainSettings({ defaults: () => ({ data: null as unknown }), normalize: (raw) => ({ data: (raw as { data?: unknown }).data ?? null }), scope: 'device' }));
	await agent.update((draft) => { draft.data = { shell: 'zsh' }; }, { persist: 'immediate' });
	assert.deepEqual((disk.files.device as SettingsFile).namespaces.agent, { data: { shell: 'zsh' } });
	assert.equal((disk.files.vault as SettingsFile).namespaces.agent, undefined);
});
