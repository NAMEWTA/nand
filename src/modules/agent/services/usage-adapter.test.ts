import { expect, test, vi } from 'vitest';
import { AgentUsageSource } from '../core/launch/usage-source';
import { agentUsage } from './usage-adapter';
import type { UsageSnapshot } from '../core/launch/types';
test('usage adapter shares demand, keeps snapshots stable and retains last quota after a failed refresh', async () => {
 let snapshots: UsageSnapshot[] = [{ agentId: 'codex', provider: 'Codex', account: null, status: '', failed: false, windows: [{ name: '5h', usedPct: 85, resetAt: null }] }];
 const source = new AgentUsageSource({ read: async () => snapshots, active: () => true, now: () => 0, delay: () => 60_000, schedule: () => 1, cancel: () => {} });
 const usage = agentUsage({ usage: source, usageAgents: () => ['codex'], subscribe: listener => source.subscribe(listener) });
 const listener = vi.fn(), off = usage.subscribe(listener); expect(source.hasDemand).toBe(true);
 await usage.refresh(); expect(usage.snapshot().providers[0]?.windows[0]?.usedPercent).toBe(85); expect(usage.snapshot()).toBe(usage.snapshot());
 snapshots = [{ ...snapshots[0]!, failed: true, windows: [] }]; await usage.refresh(); expect(usage.snapshot().providers[0]?.windows[0]?.usedPercent).toBe(85); expect(usage.snapshot().providers[0]?.stale).toBe(true);
 expect(listener).toHaveBeenCalled(); off(); expect(source.hasDemand).toBe(false); source.dispose();
});
