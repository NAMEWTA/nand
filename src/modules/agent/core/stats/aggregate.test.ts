import { expect, test } from 'vitest';
import { aggregate, emptyStats, recordStats, type SessionSummary } from './aggregate';

test('three native sessions aggregate by day, provider, model and cwd without inventing costs', () => {
	const sessions: SessionSummary[] = [
		{
			agentId: 'claude-code',
			cwd: '/vault/a',
			model: 'opus',
			modifiedAtMs: Date.parse('2026-10-01T10:00:00Z'),
			messageCount: 4,
			usage: { input: 100, output: 20, cacheRead: 30, cacheWrite: 40, cost: 1, known: true },
		},
		{
			agentId: 'claude-code',
			cwd: '/vault/a',
			model: 'opus',
			modifiedAtMs: Date.parse('2026-10-01T20:00:00Z'),
			messageCount: 2,
			usage: { input: 30, output: 5, cacheRead: 20, cacheWrite: 0, cost: null, known: true },
		},
		{
			agentId: 'codex',
			cwd: '/vault/b',
			model: 'gpt',
			modifiedAtMs: Date.parse('2026-10-02T00:00:00Z'),
			messageCount: 6,
			usage: { input: 50, output: 15, cacheRead: 5, cacheWrite: 0, cost: null, known: true },
		},
	];
	const result = aggregate(sessions);
	expect(result.totals).toEqual({
		input: 85,
		output: 40,
		cacheRead: 55,
		cacheWrite: 40,
		cost: 1,
		sessions: 3,
		turns: 12,
		total: 220,
	});
	expect(result.activeDays).toBe(2);
	expect(result.buckets).toHaveLength(2);
	expect(result.buckets[0]).toMatchObject({
		date: '2026-10-01',
		provider: 'claude-code',
		model: 'opus',
		cwd: '/vault/a',
		total: 155,
		sessions: 2,
	});
	expect(result.buckets[1]?.cost).toBeNull();
	expect(aggregate([]).totals.cost).toBeNull();
});
test('launch and work counters preserve earlier buckets and first event', () => {
	const original = emptyStats(),
		first = recordStats(original, 'codex', Date.parse('2026-10-01T23:59:00Z'), 1, 60000);
	const second = recordStats(first, 'codex', Date.parse('2026-10-02T00:00:00Z'), 0, 2000);
	expect(original.agentsLaunched).toBe(0);
	expect(second).toMatchObject({
		agentsLaunched: 1,
		agentWorkMs: 62000,
		firstEventAt: Date.parse('2026-10-01T23:59:00Z'),
		byAgent: { codex: { launched: 1, workMs: 62000 } },
		daily: { '2026-10-01': { launched: 1, workMs: 60000 }, '2026-10-02': { launched: 0, workMs: 2000 } },
	});
});
