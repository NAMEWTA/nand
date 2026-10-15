import { expect, test, vi } from 'vitest';
import { UsageStore } from './usage-store';
import { normalizeTerminalSettings } from '../core/terminal/settings';
import type { AgentController } from './controller';
import type { UsageState } from '../core/launch/usage-source';
test('quota failure retains same-account windows and exposes error; focus refresh and disposal are owned', async () => {
	const settings = normalizeTerminalSettings(undefined),
		listeners = new Set<() => void>(),
		focus = new Map<string, () => void>(),
		release = vi.fn();
	let state: UsageState = {
		refreshing: false,
		snapshots: [
			{
				agentId: 'codex',
				provider: 'Codex',
				account: 'Personal',
				status: 'ok',
				failed: false,
				checkedAt: 1,
				windows: [{ name: '每周', usedPct: 42, resetAt: null }],
			},
		],
	};
	const refresh = vi.fn(async () => state.snapshots);
	const controller = {
		settings: { get: () => settings },
		usageAgents: () => ['codex'],
		subscribe: (fn: () => void) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		usage: { retain: () => release, getState: () => state, refresh },
	} as unknown as AgentController;
	const win = {
		addEventListener: (key: string, fn: () => void) => focus.set(key, fn),
		removeEventListener: (key: string) => focus.delete(key),
	} as unknown as Window;
	const store = new UsageStore(controller, win),
		emit = () => listeners.forEach((fn) => fn());
	expect(store.snapshot().providers[0]).toMatchObject({
		rateStatus: 'ok',
		windows: [{ usedPercent: 42, key: 'weekly', windowMinutes: 10080 }],
	});
	state = {
		refreshing: false,
		snapshots: [{ ...state.snapshots[0]!, windows: [], failed: true, status: 'offline' }],
	};
	emit();
	expect(store.snapshot().providers[0]).toMatchObject({
		rateStatus: 'error',
		stale: true,
		windows: [{ usedPercent: 42 }],
	});
	settings.agents.agents.codex.accountId = 'work';
	state = { refreshing: true, snapshots: [] };
	emit();
	expect(store.snapshot().providers[0]?.windows).toEqual([]);
	focus.get('focus')!();
	await Promise.resolve();
	expect(refresh).toHaveBeenCalledOnce();
	store.dispose();
	expect(release).toHaveBeenCalledOnce();
	expect(listeners.size).toBe(0);
	expect(focus.size).toBe(0);
});
