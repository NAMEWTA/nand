import type { StatusBarPreferences, UsageProvider } from '../../app/contracts/workbench';
import { maxUsed } from './ProviderSegment';

/** Entries shown before the rest fold into a "+N" chip; detailed entries are wider than compact ones. */
export const USAGE_LIMIT: Record<StatusBarPreferences['usageMode'], number> = { verbose: 2, compact: 4 };

/**
 * The status bar has no room measurement of its own, so a fixed budget keeps many providers readable.
 * The busiest providers stay visible (they are the ones to notice); order is the provider order.
 */
export function planUsage(providers: readonly UsageProvider[], mode: StatusBarPreferences['usageMode']) {
	const limit = USAGE_LIMIT[mode];
	if (providers.length <= limit) return { shown: [...providers], hidden: [] as UsageProvider[] };
	const kept = new Set(
		[...providers]
			.sort((a, b) => maxUsed(b) - maxUsed(a))
			.slice(0, limit)
			.map((provider) => provider.id),
	);
	return { shown: providers.filter((p) => kept.has(p.id)), hidden: providers.filter((p) => !kept.has(p.id)) };
}
