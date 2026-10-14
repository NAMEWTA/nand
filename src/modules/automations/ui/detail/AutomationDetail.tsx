// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationDetail.tsx, AutomationsDetailPane.tsx, AutomationPromptDisclosure.tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Copy, Pencil, Play, Trash2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../ui/components/button';
import { Switch } from '../../../../ui/components/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/components/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../../ui/components/collapsible';
import { RelativeTime } from '../../../../ui/components/nand/RelativeTime';
import { useT, useOwnerWindow } from '../../../../ui/react/hooks';
import { isActiveRun, type AutomationDefinition, type AutomationRun } from '../../../../shared/automation/types';
import { actionText } from '../../core/switch-action';
import { IconButton } from '../parts';
import { nextRun, scheduleLabel, tokenLabel, durationLabel } from '../format';
import { LastRunCell } from '../list/LastRunCell';
import type { RowActions } from '../list/AutomationRow';
import { RunHistory, type RunActions } from './RunHistory';
function DetailMetric({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="min-w-0">
			<div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
			<div className="mt-1 break-words text-sm font-medium">{children}</div>
		</div>
	);
}
export function AutomationDetail({
	definition: d,
	runs,
	disabled,
	rowActions,
	runActions,
	onSource,
}: {
	definition: AutomationDefinition;
	runs: readonly AutomationRun[];
	disabled: boolean;
	rowActions: RowActions;
	runActions: RunActions;
	onSource: () => void;
}) {
	const t = useT(),
		win = useOwnerWindow(),
		[limit, setLimit] = useState(50);
	const latest = runs[runs.length - 1],
		next = nextRun(d);
	return (
		<Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col px-6 pb-6">
			<TabsList className="mb-4 shrink-0">
				<TabsTrigger value="overview">{t('automation.overview')}</TabsTrigger>
				<TabsTrigger value="runs">{t('automation.history')}</TabsTrigger>
			</TabsList>
			<TabsContent value="overview" className="min-h-0 overflow-y-auto">
				<div className="flex w-full flex-col gap-4">
					<div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/50 pb-4">
						<div className="min-w-0">
							<h2 className="truncate text-lg font-semibold">{d.name}</h2>
							<div className="mt-2 flex items-center gap-2">
								<Switch
									checked={d.enabled}
									disabled={disabled}
									aria-label={t('automation.enabled')}
									onCheckedChange={() => rowActions.onToggle(d)}
								/>
								<span className="text-sm">
									{t(d.enabled ? 'automation.enabled' : 'automation.disabled')}
								</span>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Button
								variant="secondary"
								size="sm"
								disabled={disabled}
								onClick={() => rowActions.onRun(d)}
							>
								<Play className="size-4" />
								{t('automation.run')}
							</Button>
							<IconButton
								label={t('automation.edit')}
								disabled={disabled}
								onClick={() => rowActions.onEdit(d)}
							>
								<Pencil className="size-4" />
							</IconButton>
							<IconButton
								label={t('automation.delete')}
								disabled={disabled || runs.some(isActiveRun)}
								onClick={() => rowActions.onDelete(d)}
							>
								<Trash2 className="size-4 text-destructive" />
							</IconButton>
						</div>
					</div>
					<div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-5 rounded-md border border-border/50 bg-muted/30 px-4 py-3 shadow-sm">
						<DetailMetric label={t('automation.schedule')}>
							{scheduleLabel(d.schedule)}
							{d.schedule.kind === 'recurring' && (
								<div className="text-xs text-muted-foreground">{d.schedule.timezone}</div>
							)}
						</DetailMetric>
						<DetailMetric label={t('automation.nextRun')}>
							{next ? <RelativeTime value={next} /> : '—'}
						</DetailMetric>
						<DetailMetric label={t('automation.action')}>
							{t(`automation.${d.action.kind}`)}
							{d.action.kind === 'agent' && (
								<div className="text-xs">
									{d.action.agentId} {d.action.extraArgs}
								</div>
							)}
						</DetailMetric>
						<DetailMetric label={t('automation.cwd')}>
							{'cwd' in d.action ? d.action.cwd : '—'}
						</DetailMetric>
						<DetailMetric label={t('automation.sessionMode')}>
							{d.action.kind === 'agent' ? t(`automation.${d.action.sessionMode}`) : '—'}
						</DetailMetric>
						<DetailMetric label={t('automation.grace')}>
							{t('automation.minutes', { count: d.graceMinutes })}
						</DetailMetric>
						<DetailMetric label={t('automation.precheck')}>{d.precheck?.command || '—'}</DetailMetric>
						{d.source && (
							<DetailMetric label={t('automation.sourceTitle')}>
								<Button variant="link" size="sm" onClick={onSource}>
									{t(`automation.source.${d.source.kind}`)} · {d.source.path}
								</Button>
							</DetailMetric>
						)}
						<DetailMetric label={t('automation.lastRun')}>
							<LastRunCell run={latest} />
							{latest && (
								<div className="mt-1 text-xs text-muted-foreground">
									{durationLabel(latest)} · {tokenLabel(latest)} {t('automation.tokenCount')}
								</div>
							)}
						</DetailMetric>
					</div>
					<Collapsible>
						<div className="flex items-center justify-between">
							<CollapsibleTrigger asChild>
								<Button variant="ghost" size="sm">
									<ChevronDown className="size-4" />
									{t('automation.prompt')}
								</Button>
							</CollapsibleTrigger>
							<IconButton
								label={t('automation.copy')}
								onClick={() => {
									void win.navigator.clipboard
										.writeText(actionText(d.action))
										.catch((error) => toast.error(String(error)));
								}}
							>
								<Copy className="size-4" />
							</IconButton>
						</div>
						<CollapsibleContent>
							<pre className="mt-2 overflow-auto rounded-md border border-border/50 bg-muted/20 p-4 font-mono text-xs whitespace-pre-wrap">
								{actionText(d.action)}
							</pre>
						</CollapsibleContent>
					</Collapsible>
				</div>
			</TabsContent>
			<TabsContent value="runs" className="flex min-h-0 flex-1 flex-col">
				<RunHistory
					runs={[...runs].reverse().slice(0, limit)}
					hasMore={runs.length > limit}
					onLoadMore={() => setLimit((v) => v + 50)}
					disabled={disabled}
					{...runActions}
				/>
			</TabsContent>
		</Tabs>
	);
}
