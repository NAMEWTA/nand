export interface SessionSummary {
	agentId: string;
	cwd: string;
	modifiedAtMs: number;
	model?: string | null;
	messageCount?: number;
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number | null;
		known: boolean;
	};
}
export interface UsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number | null;
	sessions: number;
	turns: number;
	total: number;
}
export interface UsageBucket extends UsageTotals {
	date: string;
	provider: string;
	model: string;
	cwd: string;
}
export function emptyTotals(): UsageTotals {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: null, sessions: 0, turns: 0, total: 0 };
}
/** Native input already includes cache reads and writes. */
export function totalTokens(usage: SessionSummary['usage']): number {
	return usage.input + usage.output;
}
export function addTotals(target: UsageTotals, source: UsageTotals): void {
	for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'sessions', 'turns', 'total'] as const)
		target[key] += source[key];
	if (source.cost !== null) target.cost = (target.cost ?? 0) + source.cost;
}
export function aggregate(sessions: readonly SessionSummary[]) {
	const buckets = new Map<string, UsageBucket>(),
		totals = emptyTotals();
	for (const row of sessions) {
		const date = new Date(row.modifiedAtMs).toISOString().slice(0, 10),
			model = row.model ?? '',
			provider = row.agentId,
			cwd = row.cwd;
		const key = JSON.stringify([date, provider, model, cwd]);
		const bucket = buckets.get(key) ?? { ...emptyTotals(), date, provider, model, cwd };
		const values = {
			...row.usage,
			input: Math.max(0, row.usage.input - row.usage.cacheRead - row.usage.cacheWrite),
			sessions: 1,
			turns: row.messageCount ?? 0,
			total: totalTokens(row.usage),
		};
		addTotals(bucket, values);
		addTotals(totals, values);
		buckets.set(key, bucket);
	}
	return {
		totals,
		buckets: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)),
		activeDays: new Set([...buckets.values()].map((b) => b.date)).size,
	};
}
export interface AgentStats {
	version: 1;
	firstEventAt: number | null;
	agentsLaunched: number;
	agentWorkMs: number;
	byAgent: Record<string, { launched: number; workMs: number }>;
	daily: Record<string, { launched: number; workMs: number }>;
}
export function emptyStats(): AgentStats {
	return { version: 1, firstEventAt: null, agentsLaunched: 0, agentWorkMs: 0, byAgent: {}, daily: {} };
}
export function recordStats(
	stats: AgentStats,
	agent: string,
	at: number,
	launched: number,
	workMs: number,
): AgentStats {
	const next = structuredClone(stats),
		day = new Date(at).toISOString().slice(0, 10);
	next.firstEventAt ??= at;
	next.agentsLaunched += launched;
	next.agentWorkMs += workMs;
	for (const bucket of [
		(next.byAgent[agent] ??= { launched: 0, workMs: 0 }),
		(next.daily[day] ??= { launched: 0, workMs: 0 }),
	]) {
		bucket.launched += launched;
		bucket.workMs += workMs;
	}
	return next;
}
