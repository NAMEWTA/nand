import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SettingsHandle } from '../../../shared/settings/store';
import { EMPTY_DEVICE_STATE } from '../core/ports';
import { syncSettings, type SyncSettings } from '../settings';
import { Automatics } from './automatics';
import type { SyncService } from './sync-service';

/** A window whose timers run only when `advance` says so. */
function fakeWindow() {
	let now = 0;
	let next = 1;
	const timers = new Map<number, { at: number; run: () => void }>();
	const win = {
		setTimeout: (run: () => void, delay: number) => {
			const id = next++;
			timers.set(id, { at: now + delay, run });
			return id;
		},
		clearTimeout: (id?: number) => {
			if (id !== undefined) timers.delete(id);
		},
	} as unknown as Window;
	return {
		win,
		now: () => now,
		pending: () => [...timers.values()].map((timer) => timer.at - now).sort((a, b) => a - b),
		async advance(ms: number) {
			now += ms;
			for (const [id, timer] of [...timers]) {
				if (timer.at > now) continue;
				timers.delete(id);
				timer.run();
			}
			for (let i = 0; i < 5; i++) await Promise.resolve();
		},
	};
}

function fakeService(overrides: Partial<SyncService['snapshot']> = {}) {
	const calls: string[] = [];
	const service = {
		ready: true,
		writingFiles: false,
		snapshot: { phase: 'ready', operation: null, status: { conflicted: [] }, device: { ...EMPTY_DEVICE_STATE }, ...overrides },
		commitAndSync: async (_mode: string, options: { auto?: boolean }) => { calls.push(`commit-and-sync:${!!options.auto}`); },
		commit: async () => { calls.push('commit'); },
		pull: async () => { calls.push('pull'); },
		push: async () => { calls.push('push'); },
	};
	return { service: service as unknown as SyncService, calls, raw: service };
}

function settingsOf(values: Partial<SyncSettings>): SettingsHandle<SyncSettings> {
	const value = { ...syncSettings.defaults(), ...values };
	return { get: () => value } as unknown as SettingsHandle<SyncSettings>;
}

test('interval clocks continue from the last run, pull on start, and rearm after each run', async () => {
	const clock = fakeWindow();
	const { service, calls, raw } = fakeService();
	raw.snapshot.device.lastCommit = -2 * 60_000;
	const automatics = new Automatics(service, settingsOf({ autoSaveInterval: 5, autoPullInterval: 10, autoPullOnBoot: true }), clock.win, clock.now);
	automatics.start();
	assert.deepEqual(clock.pending(), [3 * 60_000, 10 * 60_000]);
	await clock.advance(0);
	assert.deepEqual(calls, ['pull']);
	await clock.advance(3 * 60_000);
	assert.deepEqual(calls, ['pull', 'commit-and-sync:true']);
	assert.deepEqual(clock.pending(), [5 * 60_000, 7 * 60_000]);
	automatics.stop();
	assert.deepEqual(clock.pending(), []);
});

test('separate push interval commits only on the commit clock', async () => {
	const clock = fakeWindow();
	const { service, calls } = fakeService();
	const automatics = new Automatics(service, settingsOf({ autoSaveInterval: 1, differentIntervalCommitAndPush: true, autoPushInterval: 2 }), clock.win, clock.now);
	automatics.start();
	await clock.advance(60_000);
	await clock.advance(60_000);
	assert.deepEqual(calls.sort(), ['commit', 'commit', 'push']);
});

test('paused devices and stopped merges do not run; editing restarts the after-edit clock', async () => {
	const clock = fakeWindow();
	const paused = fakeService({ device: { ...EMPTY_DEVICE_STATE, paused: 'manual' } });
	new Automatics(paused.service, settingsOf({ autoSaveInterval: 1, autoPullInterval: 1 }), clock.win, clock.now).start();
	assert.deepEqual(clock.pending(), []);

	const stopped = fakeService({ operation: 'merge' });
	const automatics = new Automatics(stopped.service, settingsOf({ autoSaveInterval: 1 }), clock.win, clock.now);
	automatics.start();
	await clock.advance(60_000);
	assert.deepEqual(stopped.calls, []);
	assert.deepEqual(clock.pending(), [60_000]);
	automatics.stop();

	const editing = fakeService();
	const afterEdit = new Automatics(editing.service, settingsOf({ autoSaveInterval: 2, autoBackupAfterFileChange: true }), clock.win, clock.now);
	afterEdit.start();
	assert.deepEqual(clock.pending(), []);
	afterEdit.fileChanged();
	await clock.advance(60_000);
	afterEdit.fileChanged();
	await clock.advance(90_000);
	assert.deepEqual(editing.calls, []);
	await clock.advance(30_000);
	assert.deepEqual(editing.calls, ['commit-and-sync:true']);
	editing.raw.writingFiles = true;
	afterEdit.fileChanged();
	assert.deepEqual(clock.pending(), []);
});
