import type { UsageProvider } from '../../../../app/contracts/workbench';

export type UsageDisplay = 'used' | 'remaining';
/** How much of the usage a tile can show: the busiest provider only, every provider, or every provider with all its windows. */
export type UsageMode = 'top' | 'list' | 'detail';

/** The highest used share over all windows of a provider (0 when it reports none). */
export const maxUsed = (provider: UsageProvider): number =>
	Math.max(0, ...provider.windows.map((window) => window.usedPercent));

export const shownPercent = (used: number, display: UsageDisplay): number =>
	Math.max(0, Math.min(100, Math.round(display === 'remaining' ? 100 - used : used)));

export type UsageTone = 'normal' | 'warning' | 'danger';
export const usageTone = (used: number): UsageTone => (used >= 95 ? 'danger' : used >= 80 ? 'warning' : 'normal');

/** Providers with the busiest first; equal usage keeps the provider order. */
export function rankProviders(providers: readonly UsageProvider[]): UsageProvider[] {
	return providers
		.map((provider, index) => ({ provider, index }))
		.sort((a, b) => maxUsed(b.provider) - maxUsed(a.provider) || a.index - b.index)
		.map((item) => item.provider);
}

/** Pick a mode from the measured tile box: height decides how many rows fit, width whether windows sit beside the name. */
export function usageMode(box: { width: number; height: number }): UsageMode {
	if (box.height < 120) return 'top';
	if (box.height < 190 || box.width < 220) return 'list';
	return 'detail';
}

export interface ResetIn {
	days: number;
	hours: number;
	minutes: number;
}

/** Time until the earliest of `resets` (epoch ms); undefined without any. */
export function resetIn(resets: readonly number[], now: number): ResetIn | undefined {
	if (!resets.length) return undefined;
	const total = Math.max(0, Math.ceil((Math.min(...resets) - now) / 60_000));
	return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
}

/** The dictionary key and values that spell a reset countdown: days and hours past a day, hours and minutes before. */
export function resetUnits(reset: ResetIn): { key: 'usage.reset.days' | 'usage.reset.hours'; values: Record<string, string> } {
	return reset.days >= 1
		? { key: 'usage.reset.days', values: { days: String(reset.days), hours: String(reset.hours) } }
		: { key: 'usage.reset.hours', values: { hours: String(reset.hours), minutes: String(reset.minutes).padStart(2, '0') } };
}

const KNOWN_STATUS = new Set(['idle', 'fetching', 'ok', 'error', 'unavailable']);
/** The dictionary key for a provider status code the service did not label itself; unknown codes are never shown raw. */
export const usageStatusKey = (status: string | undefined): string =>
	status && KNOWN_STATUS.has(status) ? `usage.status.${status}` : 'usage.failed';
