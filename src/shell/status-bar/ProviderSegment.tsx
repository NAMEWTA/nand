// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/status-bar/StatusBarProviderSegment.tsx
import { TriangleAlert } from 'lucide-react';
import type { StatusBarPreferences, UsageProvider } from '../../app/contracts/workbench';
import { AgentIcon } from '../../ui/components/nand/AgentIcon';
import { t } from '../../shared/i18n';
export const maxUsed = (provider: UsageProvider) => Math.max(0, ...provider.windows.map((w) => w.usedPercent));
export const usageTone = (used: number) =>
	used >= 95 ? 'text-destructive' : used >= 80 ? 'text-status-warning' : 'text-muted-foreground';
export const shownPercent = (used: number, display: StatusBarPreferences['usageDisplay']) =>
	Math.round(display === 'remaining' ? 100 - used : used);
export function ProviderSegment({
	provider,
	mode,
	display,
	refreshing,
}: {
	provider: UsageProvider;
	mode: StatusBarPreferences['usageMode'];
	display: StatusBarPreferences['usageDisplay'];
	refreshing: boolean;
}) {
	const max = maxUsed(provider);
	const windows =
		mode === 'compact'
			? [...provider.windows].sort((a, b) => b.usedPercent - a.usedPercent).slice(0, 1)
			: provider.windows;
	return (
		<span className={`inline-flex shrink-0 items-center gap-1.5 ${usageTone(max)}`}>
			<AgentIcon agent={provider.id === 'gemini' ? 'gemini-cli' : provider.id} size={14} />
			{mode === 'verbose' && !!windows.length && (
				<span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
					<span
						className="block h-full rounded-full bg-muted-foreground/40"
						style={{ width: `${shownPercent(max, display)}%` }}
					/>
				</span>
			)}
			{windows.length ? (
				<span className="tabular-nums">
					{windows.map((w) => `${shownPercent(w.usedPercent, display)}% ${w.label}`).join(' · ')}
				</span>
			) : refreshing ? (
				<span className="animate-pulse motion-reduce:animate-none">···</span>
			) : provider.failed ? (
				<>
					<TriangleAlert className="size-3" />
					{mode === 'verbose' && <span>{provider.status ?? t('shell.usageFailed')}</span>}
				</>
			) : (
				<span className="opacity-50">--</span>
			)}
			{provider.stale && !!windows.length && (
				<TriangleAlert className="size-3 text-muted-foreground" aria-label={t('shell.usageStale')} />
			)}
		</span>
	);
}
