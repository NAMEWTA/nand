import type { UsageSnapshot, UsageWindow } from './types';
import { t } from '../../shared/i18n';

export function primaryUsageWindow(snapshot: UsageSnapshot): UsageWindow | null {
	const quota =
		snapshot.windows.find((window) => window.name === '每周') ??
		snapshot.windows.find((window) => window.name === '每月') ??
		snapshot.windows.find((window) => window.usedPct !== null);
	if (!quota || quota.usedPct === null) return null;
	return quota;
}

export function remainingPercent(window: UsageWindow): number {
	return Math.max(0, Math.min(100, Math.round(100 - (window.usedPct ?? 0))));
}

export function formatUsageChip(snapshot: UsageSnapshot): string | null {
	const quota = primaryUsageWindow(snapshot);
	if (!quota) return null;
	return `${remainingPercent(quota)}%`;
}

export function usageStatusText(snapshot: UsageSnapshot): string {
	return snapshot.statusKey ? t(`terminalAgent.agents.${snapshot.statusKey}`) : snapshot.status;
}

