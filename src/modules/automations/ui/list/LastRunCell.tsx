// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationListLastRunCell.tsx
import { CheckCircle2, XCircle, CircleSlash, Loader2 } from 'lucide-react';
import type { AutomationRun } from '../../../../shared/automation/types';
import { isActiveRun } from '../../../../shared/automation/types';
import { automationOutcome } from '../../../../shared/automation/errors';
import { RelativeTime } from '../../../../ui/components/nand/RelativeTime';
import { useT } from '../../../../ui/react/hooks';
import { cn } from '../../../../ui/lib/utils';
export function LastRunCell({ run, showTime = true }: { run?: AutomationRun; showTime?: boolean }) {
	const t = useT();
	if (!run) return <span className="text-muted-foreground">{t('automation.neverRun')}</span>;
	const active = isActiveRun(run),
		failed = run.status === 'failed';
	const Icon = active ? Loader2 : run.status === 'succeeded' ? CheckCircle2 : failed ? XCircle : CircleSlash;
	return (
		<span
			className={cn(
				'inline-flex max-w-full min-w-0 items-center gap-1.5 truncate',
				failed
					? 'text-destructive'
					: run.status === 'succeeded'
						? 'text-status-success'
						: 'text-muted-foreground',
			)}
			title={automationOutcome(run)}
		>
			<Icon className={cn('size-3.5 shrink-0', active && 'animate-spin motion-reduce:animate-none')} />
			<span className="truncate">
				{showTime ? (
					<>
						<span className="sr-only">{automationOutcome(run)}</span>
						<RelativeTime value={run.startedAt} />
					</>
				) : (
					automationOutcome(run)
				)}
			</span>
		</span>
	);
}
