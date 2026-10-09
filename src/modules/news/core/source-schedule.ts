import type { NewsSource, NewsSourceHealth } from './model';

export function sourceBackoffMinutes(intervalMinutes: number, oldFailureCount: number): number {
	return Math.min(360, Math.max(15, intervalMinutes) * (Math.max(0, oldFailureCount) + 2));
}
export function sourceDue(source: Pick<NewsSourceHealth, 'nextDue'> & { enabled?: boolean }, now = Date.now()): boolean {
	return source.enabled !== false && (source.nextDue === undefined || source.nextDue <= now);
}
export function nextAdaptiveIntervalMinutes(source: Pick<NewsSource, 'participation' | 'intervalMinutes'>, dailyCount: number): number {
	if (source.participation === 'signal') return Math.min(180, Math.max(15, source.intervalMinutes));
	if (dailyCount <= 0.15) return 1440;
	return Math.round(Math.max(15, Math.min(60, 1440 / (Math.max(0.01, dailyCount) * 3))));
}
export function markSourceAttempt(source: NewsSourceHealth, sourceConfig: Pick<NewsSource, 'intervalMinutes' | 'participation'>, now = Date.now(), success = true, dailyCount = 0): NewsSourceHealth {
	const oldFailureCount = source.failureCount;
	const failureCount = success ? 0 : Math.min(5, oldFailureCount + 1);
	const interval = success ? nextAdaptiveIntervalMinutes(sourceConfig, dailyCount) : sourceBackoffMinutes(sourceConfig.intervalMinutes, oldFailureCount);
	return { ...source, lastAttempt: now, ...(success ? { lastSuccess: now } : {}), failureCount, nextDue: now + interval * 60_000 };
}
