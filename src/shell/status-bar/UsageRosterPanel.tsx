// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/status-bar/UsageRosterPanel.tsx
import { useEffect, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import type { StatusBarPreferences, UsageSnapshot, WorkbenchTarget } from '../../app/contracts/workbench';
import { t } from '../../shared/i18n';
import { useOwnerDocument } from '../../ui/react/contexts';
import { DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuItem } from '../../ui/components/dropdown-menu';
import { SegmentedControl } from '../../ui/components/nand/SettingsFormControls';
import { AgentIcon } from '../../ui/components/nand/AgentIcon';
import { maxUsed, shownPercent, usageTone } from './ProviderSegment';
export function UsageRosterPanel({
	snapshot,
	preferences,
	onPreferences,
	refresh,
	navigate,
 selectAccount,
}: {
	selectAccount?: (provider: string, accountId: string) => void;
	snapshot: UsageSnapshot;
	preferences: StatusBarPreferences;
	onPreferences: (value: StatusBarPreferences) => void;
	refresh: () => void;
	navigate: (target: WorkbenchTarget) => void;
}) {
	const doc = useOwnerDocument();
	const [now, setNow] = useState(Date.now);
	const hasReset = snapshot.providers.some((p) => p.windows.some((w) => w.resetsAt));
	useEffect(() => {
		const win = doc.defaultView;
		if (!win || !hasReset) return;
		let timer: number;
		const tick = () => {
			setNow(Date.now());
			timer = win.setTimeout(tick, 60_000 - (Date.now() % 60_000));
		};
		timer = win.setTimeout(tick, 60_000 - (Date.now() % 60_000));
		return () => win.clearTimeout(timer);
	}, [doc, hasReset]);
	const resetLabel = (resets: number[]) => {
		if (!resets.length) return '';
		const minutes = Math.max(0, Math.ceil((Math.min(...resets) - now) / 60_000));
		return t('shell.resetsIn', {
			time:
				minutes >= 1440
					? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
					: `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
		});
	};
	return (
		<div className="w-[360px] max-w-full text-xs">
			<div className="flex items-center justify-between px-3.5 pb-2 pt-3">
				<span className="text-[13px] font-semibold text-foreground">{t('shell.usage')}</span>
				<div className="flex items-center gap-2 text-muted-foreground">
					<span className="text-[11px]">{t('shell.allAgents')}</span>
					<DropdownMenuItem
						onSelect={(e) => {
							e.preventDefault();
							refresh();
						}}
						aria-label={t('shell.refreshUsage')}
						className="size-5 justify-center p-0"
					>
						<RefreshCw
							size={12}
							className={snapshot.refreshing ? 'animate-spin motion-reduce:animate-none' : ''}
						/>
					</DropdownMenuItem>
				</div>
			</div>
			<div className="px-3.5 pb-2.5">
				<SegmentedControl
					value={preferences.usageMode}
					onChange={(usageMode) => onPreferences({ ...preferences, usageMode })}
					ariaLabel={t('shell.usageMode')}
					size="sm"
					equalWidth
					options={[
						{ value: 'verbose', label: t('shell.verbose') },
						{ value: 'compact', label: t('shell.compact') },
					]}
				/>
			</div>
			<div className="border-t border-border/70" />
			{[...snapshot.providers]
				.sort((a, b) => maxUsed(b) - maxUsed(a))
				.map((p) => {
 const Row = p.accounts ? DropdownMenuSubTrigger : DropdownMenuItem;
 const row = (
					<Row
						key={p.id}
						onSelect={p.accounts ? undefined : () => navigate({ feature: 'terminal', section: 'usage', resourceId: p.id })}
						className="w-full cursor-pointer rounded-none px-3.5 py-2.5"
					>
						<div data-usage-mode={preferences.usageMode} className="flex min-w-0 flex-1 flex-col gap-1">
							<div className="flex items-center gap-2.5">
								<span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
									<AgentIcon agent={p.id === 'gemini' ? 'gemini-cli' : p.id} size={14} />
								</span>
								<span className="min-w-0 shrink truncate text-[13px] font-medium text-foreground">
									{p.name}
									{p.account && (
										<span className="font-normal text-muted-foreground"> · {p.account}</span>
									)}
								</span>
								<span className="shrink-0 text-[11px] text-muted-foreground">
									{!p.windows.length
										? (p.statusLabel ?? p.status)
										: preferences.usageMode === 'compact'
											? `${shownPercent(maxUsed(p), preferences.usageDisplay)}%`
											: resetLabel(p.windows.flatMap((w) => (w.resetsAt ? [w.resetsAt] : [])))}
								</span>
							</div>
							{!!p.windows.length && preferences.usageMode === 'verbose' && (
								<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-[30px]">
									{p.windows.map((w) => (
										<span key={w.label} className="flex shrink-0 items-center gap-1.5">
											<span className="text-[10px] text-muted-foreground">{w.label}</span>
											<span className="h-[5px] w-7 overflow-hidden rounded-full bg-muted">
												<span
													className="block h-full rounded-full bg-muted-foreground/40"
													style={{
														width: `${shownPercent(w.usedPercent, preferences.usageDisplay)}%`,
													}}
												/>
											</span>
											<span className={`tabular-nums text-[11px] ${usageTone(w.usedPercent)}`}>
												{shownPercent(w.usedPercent, preferences.usageDisplay)}%
											</span>
										</span>
									))}
								</div>
							)}
						</div>
						{!p.accounts && <ChevronRight size={14} className="text-muted-foreground" />}
					</Row>
 );
 return p.accounts ? <DropdownMenuSub key={p.id}>{row}<DropdownMenuSubContent className="w-56">
 <DropdownMenuRadioGroup value={p.accountId ?? ''} onValueChange={id => selectAccount?.(p.id, id)}>{p.accounts.map(account => <DropdownMenuRadioItem key={account.id} value={account.id}>{account.name}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
 <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => navigate({ feature: 'settings', section: 'terminal', resourceId: 'accounts' })}>{t('shell.addAccount')}</DropdownMenuItem>
 <DropdownMenuItem onSelect={() => navigate({ feature: 'settings', section: 'terminal', resourceId: 'accounts' })}>{t('shell.manageAccounts')}</DropdownMenuItem>
 </DropdownMenuSubContent></DropdownMenuSub> : row;
 })}
			<div className="border-t border-border/70" />
			<DropdownMenuItem
				onSelect={() => navigate({ feature: 'terminal', section: 'usage' })}
				className="w-full cursor-pointer justify-between rounded-none px-3.5 py-2.5 text-[13px] text-foreground"
			>
				{t('shell.usageDetails')}
				<ChevronRight size={14} className="text-muted-foreground" />
			</DropdownMenuItem>
			<DropdownMenuItem
				onSelect={() => navigate({ feature: 'settings', section: 'terminal' })}
				className="w-full cursor-pointer justify-between rounded-none px-3.5 py-2.5 text-[13px] text-foreground"
			>
				{t('shell.manageAccounts')}
				<ChevronRight size={14} className="text-muted-foreground" />
			</DropdownMenuItem>
		</div>
	);
}
