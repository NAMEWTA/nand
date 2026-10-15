import { expect, test, vi } from 'vitest';
import { StatsService } from './stats-service';
import type { TerminalSessions } from './terminal/sessions';
test('counts one launch, splits work at midnight and persists on disposal', async () => {
	const data = new Map<string, string>(),
		dirs = new Set<string>(),
		listeners = new Set<() => void>();
	const storage = {
		exists: async (p: string) => data.has(p) || dirs.has(p),
		read: async (p: string) => data.get(p)!,
		write: async (p: string, s: string) => {
			data.set(p, s);
		},
		mkdir: async (p: string) => {
			dirs.add(p);
		},
	};
	const session = { id: 'one', agentId: 'codex', connection: 'connected', running: true, activity: 'idle' };
	const sessions = {
		list: () => [session],
		subscribe: (fn: () => void) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
	} as unknown as TerminalSessions;
	const timers = new Map<number, () => void>();
	let id = 0;
	const clock = {
		setTimeout: (fn: () => void) => {
			timers.set(++id, fn);
			return id;
		},
		clearTimeout: (id: number) => {
			timers.delete(id);
		},
	} as unknown as Window;
	const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T23:59:59Z')),
		report = vi.fn();
	try {
		const service = new StatsService(storage, 'test', clock, sessions, report);
		await service.ready;
		session.activity = 'running';
		listeners.forEach((fn) => fn());
		listeners.forEach((fn) => fn());
		now.mockReturnValue(Date.parse('2026-10-02T00:00:01Z'));
		await service.dispose();
		expect(service.store.getState()).toMatchObject({
			agentsLaunched: 1,
			agentWorkMs: 2000,
			daily: { '2026-10-01': { launched: 1, workMs: 1000 }, '2026-10-02': { launched: 0, workMs: 1000 } },
		});
		expect(JSON.parse(data.get('.nand/terminal-agent/test/stats.json')!).agentWorkMs).toBe(2000);
		expect(listeners.size).toBe(0);
		expect(timers.size).toBe(0);
		expect(report).not.toHaveBeenCalled();
	} finally {
		now.mockRestore();
	}
});
