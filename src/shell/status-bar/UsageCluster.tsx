// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/status-bar/StatusBarSurface.tsx
import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RefreshCw } from 'lucide-react';
import type { AgentUsage, StatusBarPreferences, UsageSnapshot, WorkbenchTarget } from '../../app/contracts/workbench';
import { t } from '../../shared/i18n';
import { useOwnerDocument } from '../../ui/react/contexts';
import { Button } from '../../ui/components/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '../../ui/components/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/components/tooltip';
import { ProviderSegment, maxUsed, usageTone } from './ProviderSegment';
import { UsageRosterPanel } from './UsageRosterPanel';
import { planUsageCollapse } from './collapse';
import { useShellCloseAutoFocus } from '../interaction-lifetime';
const empty: UsageSnapshot = { providers: [], refreshing: false };
export function UsageCluster({
	usage,
	preferences,
	onPreferences,
	navigate,
	report,
}: {
	usage?: AgentUsage;
	preferences: StatusBarPreferences;
	onPreferences: (value: StatusBarPreferences) => void;
	navigate: (target: WorkbenchTarget) => void;
	report: (error: unknown) => void;
}) {
	const closeAutoFocus = useShellCloseAutoFocus();
	const ownerDocument = useOwnerDocument();
	const snapshot = useSyncExternalStore(
		useCallback((listener) => usage?.subscribe(listener) ?? (() => {}), [usage]),
		() => usage?.snapshot() ?? empty,
	);
	const container = useRef<HTMLDivElement>(null);
	const measurements = useRef<HTMLDivElement>(null);
	const [plan, setPlan] = useState<{ mode: 'verbose' | 'compact'; collapsed: string[]; unit: boolean }>({
		mode: preferences.usageMode,
		collapsed: [],
		unit: true,
	});
	useLayoutEffect(() => {
		const el = container.current,
			measures = measurements.current;
		const win = ownerDocument.defaultView as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
		if (!el || !measures) return;
		const measure = () => {
			const items = snapshot.providers.map((p) => ({
				id: p.id,
				verbose:
					measures.querySelector<HTMLElement>(`[data-measure-verbose="${p.id}"]`)?.getBoundingClientRect()
						.width ?? 0,
				compact:
					measures.querySelector<HTMLElement>(`[data-measure-compact="${p.id}"]`)?.getBoundingClientRect()
						.width ?? 0,
			}));
			const unit = measures.querySelector<HTMLElement>('[data-measure-unit]')?.getBoundingClientRect().width ?? 0;
			const chip = measures.querySelector<HTMLElement>('[data-measure-chip]')?.getBoundingClientRect().width ?? 0;
			const available = Math.max(0, el.clientWidth - 32);
			const input =
				preferences.usageMode === 'compact'
					? items.map((i) => ({ ...i, verbose: Number.POSITIVE_INFINITY }))
					: items;
			let next = planUsageCollapse(available - unit, input, chip);
			const showUnit = next.collapsed.length < items.length && available > unit + chip;
			if (!showUnit) next = planUsageCollapse(available, input, chip);
			setPlan((previous) =>
				previous.mode === next.mode &&
				previous.unit === showUnit &&
				previous.collapsed.join() === next.collapsed.join()
					? previous
					: { ...next, unit: showUnit },
			);
		};
		measure();
		const observer = win?.ResizeObserver ? new win.ResizeObserver(measure) : undefined;
		observer?.observe(el);
		observer?.observe(measures);
		return () => observer?.disconnect();
	}, [ownerDocument, snapshot, preferences.usageMode, preferences.usageDisplay]);
	const refresh = () => {
		void usage?.refresh().catch(report);
	};
	const hidden = snapshot.providers.filter((p) => plan.collapsed.includes(p.id));
	return (
		<div
			ref={container}
			className="status-bar-usage-cluster relative flex min-w-0 flex-1 items-center overflow-clip [overflow-clip-margin:3px]"
		>
			{!snapshot.providers.length ? (
				<Button
					variant="ghost"
					size="xs"
					onClick={() => navigate({ feature: 'settings', section: 'terminal' })}
				>
					{t('shell.setupUsage')}
				</Button>
			) : (
				<div className="flex min-w-0 items-center gap-3">
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="inline-flex h-5 items-center gap-3 rounded px-1 py-0.5 text-xs hover:bg-accent/70"
								aria-label={t('shell.usage')}
							>
								{plan.unit && (
									<span className="text-2xs text-muted-foreground">
										{t(preferences.usageDisplay === 'used' ? 'shell.used' : 'shell.remaining')}
									</span>
								)}
								{snapshot.providers.map((p) => (
									<span
										key={p.id}
										data-usage-chip={p.id}
										data-usage-collapsed={plan.collapsed.includes(p.id)}
										aria-hidden={plan.collapsed.includes(p.id)}
										className="inline-flex data-[usage-collapsed=true]:invisible data-[usage-collapsed=true]:absolute"
									>
										<ProviderSegment
											provider={p}
											mode={plan.mode}
											display={preferences.usageDisplay}
											refreshing={snapshot.refreshing}
										/>
									</span>
								))}
								{!!hidden.length && (
									<span
										data-usage-more
										title={hidden
											.map(
												(p) =>
													`${p.name} ${preferences.usageDisplay === 'used' ? maxUsed(p) : 100 - maxUsed(p)}%`,
											)
											.join(' · ')}
										className={`h-4 rounded-full border px-1.5 text-2xs ${usageTone(Math.max(...hidden.map(maxUsed)))}`}
									>
										+{hidden.length}
									</span>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							onCloseAutoFocus={closeAutoFocus}
							side="top"
							align="start"
							sideOffset={8}
							collisionPadding={{ top: 8, bottom: 32, left: 8, right: 8 }}
							className="w-[360px] max-w-[calc(100vw-16px)] p-0"
						>
							<UsageRosterPanel
								snapshot={snapshot}
								preferences={preferences}
								onPreferences={onPreferences}
								refresh={refresh}
								navigate={navigate}
							/>
						</DropdownMenuContent>
					</DropdownMenu>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-xs"
								className="size-5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
								disabled={snapshot.refreshing}
								aria-label={t('shell.refreshUsage')}
								onClick={refresh}
							>
								<RefreshCw
									className={`size-[11px] ${snapshot.refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
								/>
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top" sideOffset={6}>
							{t('shell.refreshUsage')}
						</TooltipContent>
					</Tooltip>
				</div>
			)}
			<div
				ref={measurements}
				aria-hidden="true"
				className="pointer-events-none invisible absolute flex w-max items-center text-xs"
			>
				<span data-measure-unit className="pr-3 text-2xs">
					{t(preferences.usageDisplay === 'used' ? 'shell.used' : 'shell.remaining')}
				</span>
				{snapshot.providers.flatMap((p) =>
					(['verbose', 'compact'] as const).map((mode) => (
						<span
							key={p.id + mode}
							{...(mode === 'verbose'
								? { 'data-measure-verbose': p.id }
								: { 'data-measure-compact': p.id })}
							className="inline-flex pr-3"
						>
							<ProviderSegment
								provider={p}
								mode={mode}
								display={preferences.usageDisplay}
								refreshing={snapshot.refreshing}
							/>
						</span>
					)),
				)}
				<span data-measure-chip className="h-4 rounded-full border px-1.5 text-2xs">
					+{snapshot.providers.length}
				</span>
			</div>
		</div>
	);
}
