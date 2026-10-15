// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationRunHistory.tsx, AutomationRunsTable.tsx
import { Play, Square, Terminal, Eye } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { RelativeTime } from '../../../../ui/components/nand/RelativeTime';
import { useT } from '../../../../ui/react/hooks';
import { isActiveRun, type AutomationRun } from '../../../../shared/automation/types';
import { IconButton } from '../parts';
import { LastRunCell } from '../list/LastRunCell';
import { durationLabel, tokenLabel } from '../format';
export interface RunActions {
	onOpen: (run: AutomationRun) => void;
	onTerminal: (run: AutomationRun) => void;
	onStop: (run: AutomationRun) => void;
	onRerun: (run: AutomationRun) => void;
}
const GRID =
	'grid grid-cols-[minmax(9rem,1fr)_minmax(10rem,1.2fr)_minmax(7rem,.8fr)_minmax(10rem,1.2fr)_5rem_5rem_8rem]';
export function RunHistory({
	runs,
	hasMore,
	onLoadMore,
	disabled,
	...actions
}: RunActions & { runs: readonly AutomationRun[]; hasMore?: boolean; onLoadMore?: () => void; disabled: boolean }) {
	const t = useT();
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-card">
			<div
				className="scrollbar-sleek min-h-0 flex-1 overflow-auto"
				role="table"
				aria-label={t('automation.history')}
			>
				<div className="min-w-[920px]">
					<div
						role="row"
						className={`${GRID} sticky top-0 z-10 shrink-0 items-center gap-3 border-b border-border/60 bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground`}
					>
						{['started', 'name', 'action', 'result', 'duration', 'tokenCount', 'actions'].map((key) => (
							<span role="columnheader" key={key}>
								{t(`automation.${key}`)}
							</span>
						))}
					</div>
					<div role="rowgroup">
						{runs.map((run) => (
							<div
								role="row"
								key={run.id}
								className={`${GRID} items-center gap-3 border-b border-border/50 px-4 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground`}
								onClick={() => actions.onOpen(run)}
							>
								<span role="cell">
									<Button
										variant="link"
										size="sm"
										className="px-0 text-xs"
										onClick={(event) => {
											event.stopPropagation();
											actions.onOpen(run);
										}}
									>
										<RelativeTime value={run.startedAt} />
									</Button>
								</span>
								<span role="cell" className="truncate font-medium">
									{run.title}
								</span>
								<span role="cell" className="truncate text-muted-foreground">
									{run.definition ? t(`automation.${run.definition.action.kind}`) : '—'}
								</span>
								<span role="cell" className="min-w-0 overflow-hidden">
									<LastRunCell run={run} showTime={false} />
								</span>
								<span role="cell" className="text-xs tabular-nums">
									{durationLabel(run)}
								</span>
								<span role="cell" className="text-xs tabular-nums">
									{tokenLabel(run)}
								</span>
								<span
									role="cell"
									className="flex items-center gap-1"
									onClick={(event) => event.stopPropagation()}
								>
									{run.terminalId && (
										<IconButton
											label={t('automation.openTerminal')}
											size="icon-xs"
											onClick={() => actions.onTerminal(run)}
										>
											<Terminal className="size-3.5" />
										</IconButton>
									)}
									{isActiveRun(run) ? (
										<IconButton
											label={t('automation.stop')}
											size="icon-xs"
											disabled={disabled}
											onClick={() => actions.onStop(run)}
										>
											<Square className="size-3.5" />
										</IconButton>
									) : (
										<IconButton
											label={t('automation.rerun')}
											size="icon-xs"
											disabled={disabled || !run.definition}
											onClick={() => actions.onRerun(run)}
										>
											<Play className="size-3.5" />
										</IconButton>
									)}
									<IconButton
										label={t('automation.viewOutput')}
										size="icon-xs"
										onClick={() => actions.onOpen(run)}
									>
										<Eye className="size-3.5" />
									</IconButton>
								</span>
							</div>
						))}
					</div>
					{!runs.length && (
						<div className="px-6 py-10 text-sm text-muted-foreground">{t('workbench.noRuns')}</div>
					)}
				</div>
			</div>
			{hasMore && (
				<Button variant="ghost" onClick={onLoadMore}>
					{t('automation.loadMore')}
				</Button>
			)}
		</div>
	);
}
