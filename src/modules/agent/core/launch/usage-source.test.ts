import assert from 'node:assert/strict';
import { test } from 'vitest';
import { AgentUsageSource } from './usage-source';
import type { UsageSnapshot } from './types';
const snapshot = (): UsageSnapshot => ({ agentId: 'codex', provider: 'Codex', account: null, status: 'ok', failed: false, windows: [{ name: '每周', usedPct: 30, resetAt: null }] });
function fixture(read: () => Promise<UsageSnapshot[]> = async () => [snapshot()]) {
 let time = 0, serial = 0, active = true;
 const timers = new Map<number, { callback: () => void; delay: number }>();
 const source = new AgentUsageSource({ read, active: () => active, delay: (failures) => 45000 * (failures + 1), now: () => time, schedule: (callback, delay) => { const id = ++serial; timers.set(id, { callback, delay }); return id; }, cancel: (timer) => { timers.delete(timer); } });
 return { source, timers, advance: (next: number) => { time = next; }, deactivate: () => { active = false; } };
}
test('usage has no idle timer or reads; visible pages share one reader', async () => {
 let reads = 0; const f = fixture(async () => { reads++; return [snapshot()]; });
 assert.equal(f.timers.size, 0); await f.source.refresh(); assert.equal(reads, 0);
 const first = f.source.retain(), second = f.source.retain();
 assert.equal(f.timers.size, 1);
 const one = f.source.refresh(), two = f.source.refresh(true);
 assert.equal(one, two); await one; assert.equal(reads, 1);
 first(); assert.equal(f.timers.size, 1); second(); assert.equal(f.timers.size, 0);
 second(); assert.equal(f.source.hasDemand, false);
});
test('language-only observers neither refresh nor reset the polling schedule', async () => {
 let reads = 0; const f = fixture(async () => { reads++; return [snapshot()]; });
 const stop = f.source.subscribe(() => {});
 assert.equal(f.timers.size, 0);
 f.source.setPinned(true); await f.source.refresh();
 const timer = [...f.timers.entries()][0];
 f.source.getState(); f.source.getState();
 assert.deepEqual([...f.timers.entries()][0], timer); assert.equal(reads, 1);
 stop(); f.source.setPinned(false); assert.equal(f.timers.size, 0);
});
test('usage errors retain stale values, reject manual refresh and back off', async () => {
 let fail = false; const f = fixture(async () => { if (fail) throw new Error('offline'); return [snapshot()]; });
 f.source.setPinned(true); await f.source.refresh(); fail = true;
 await assert.rejects(f.source.refresh(true), /offline/);
 assert.equal(f.source.getState().snapshots[0]?.stale, true);
 assert.equal(f.source.getState().snapshots[0]?.windows[0]?.usedPct, 30);
 assert.equal([...f.timers.values()][0]?.delay, 90000);
 assert.equal(f.source.getState().refreshing, false);
});
test('disposing the source cancels its timer and ignores late responses', async () => {
 let resolve!: (value: UsageSnapshot[]) => void, emissions = 0;
 const f = fixture(() => new Promise((done) => { resolve = done; }));
 f.source.subscribe(() => { emissions++; }); f.source.setPinned(true);
 const pending = f.source.refresh(); await Promise.resolve();
 f.source.dispose(); const before = emissions; resolve([snapshot()]); await pending;
 assert.equal(f.timers.size, 0); assert.equal(emissions, before);
 assert.equal(f.source.getState().snapshots.length, 0);
});
test('module deactivation cannot publish late quota or schedule another read', async () => {
 let resolve!: (value: UsageSnapshot[]) => void;
 const f = fixture(() => new Promise((done) => { resolve = done; }));
 f.source.setPinned(true); const pending = f.source.refresh(); await Promise.resolve();
 f.deactivate(); resolve([snapshot()]); await pending;
 assert.equal(f.source.getState().snapshots.length, 0); assert.equal(f.timers.size, 0);
});
