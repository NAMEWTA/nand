// Interval rules adapted from KKKKhazix/AIHOT c547b669acc7f64720cd82024e502446ee1ef88d (MIT).
// Copyright (c) 2026 数字生命卡兹克. See NOTICE and docs/third-party/aihot-news.md.
import type { NewsSource, NewsSourceHealth } from './model';

export function sourceBackoffMinutes(intervalMinutes: number, oldFailureCount: number): number {
	return Math.min(360, Math.max(15, intervalMinutes) * (Math.max(0, oldFailureCount) + 2));
}
export function sourceDue(source: Pick<NewsSourceHealth, 'nextDue'> & { enabled?: boolean }, now = Date.now()): boolean {
	return source.enabled !== false && (source.nextDue === undefined || source.nextDue <= now);
}
export function nextAdaptiveIntervalMinutes(source: Pick<NewsSource, 'participation' | 'intervalMinutes'>, dailyCount: number): number {
	const upper = source.participation === 'signal' ? 180 : 60;
	if (dailyCount <= 0.15) return upper;
	return Math.round(Math.max(15, Math.min(upper, 1440 / (dailyCount * 3))));
}
export function markSourceAttempt(source: NewsSourceHealth, sourceConfig: Pick<NewsSource, 'intervalMinutes' | 'participation'>, now = Date.now(), success = true, dailyCount = 0, adaptive = true): NewsSourceHealth {
	const oldFailureCount = source.failureCount;
	const failureCount = success ? 0 : oldFailureCount + 1;
	const base = !adaptive ? sourceConfig.intervalMinutes : success ? nextAdaptiveIntervalMinutes(sourceConfig, dailyCount) : source.intervalMinutes ?? sourceConfig.intervalMinutes;
	const interval = success ? base : sourceBackoffMinutes(base, oldFailureCount);
	return { ...source, intervalMinutes: base, lastAttempt: now, ...(success ? { lastSuccess: now, lastError: undefined } : {}), failureCount, nextDue: now + interval * 60_000 };
}
