// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationRunDetailsPage.tsx
import { Copy, Play, Square, Terminal } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { useT, useOwnerWindow, useLanguage } from '../../../../ui/react/hooks';
import { isActiveRun, type AutomationRun } from '../../../../shared/automation/types';
import { automationMessage } from '../../../../shared/automation/errors';
import { toast } from 'sonner';
import { IconButton } from '../parts';
import { LastRunCell } from '../list/LastRunCell';
import { durationLabel, tokenLabel } from '../format';
import type { RunActions } from '../detail/RunHistory';
export function RunDetail({
	run,
	disabled,
	onTerminal,
	onRerun,
	onStop,
}: Omit<RunActions, 'onOpen'> & { run: AutomationRun; disabled: boolean }) {
	const t = useT(),
		win = useOwnerWindow(),
		language = useLanguage();
	const copy = (text: string) => {
		void win.navigator.clipboard.writeText(text).catch((error) => toast.error(String(error)));
	};
	return (
		<div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
			<div className="flex w-full flex-col gap-4">
				<div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-4">
					<div className="min-w-0 flex-1 space-y-2">
						<h2 className="truncate text-lg font-semibold" title={run.title}>
							{run.title}
						</h2>
						<LastRunCell run={run} showTime={false} />
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{run.terminalId && (
							<Button variant="outline" size="sm" onClick={() => onTerminal(run)}>
								<Terminal className="size-4" />
								{t('automation.openTerminal')}
							</Button>
						)}
						{isActiveRun(run) ? (
							<Button variant="outline" size="sm" disabled={disabled} onClick={() => onStop(run)}>
								<Square className="size-4" />
								{t('automation.stop')}
							</Button>
						) : (
							<Button size="sm" disabled={disabled || !run.definition} onClick={() => onRerun(run)}>
								<Play className="size-4" />
								{t('automation.rerun')}
							</Button>
						)}
					</div>
				</div>
				<div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-5 rounded-md border border-border/50 bg-muted/30 px-4 py-3 shadow-sm">
					{[
						['started', new Date(run.startedAt).toLocaleString(language)],
						['duration', durationLabel(run)],
						['tokenCount', tokenLabel(run)],
					].map(([key, value]) => (
						<div key={key}>
							<div className="text-[11px] font-medium uppercase text-muted-foreground">
								{t(`automation.${key}`)}
							</div>
							<div className="mt-1 text-sm font-medium">{value}</div>
						</div>
					))}
				</div>
				<section>
					<h3 className="mb-3 text-sm font-medium">{t('automation.timeline')}</h3>
					<ol className="flex flex-wrap gap-4">
						{(run.timeline ?? [{ phase: 'queued', at: run.startedAt }]).map((event, i) => (
							<li key={i} className="rounded-md border border-border/50 px-3 py-2">
								<p className="text-xs font-medium">{t(`automation.phase.${event.phase}`)}</p>
								<time className="text-xs text-muted-foreground">
									{new Date(event.at).toLocaleTimeString(language)}
								</time>
							</li>
						))}
					</ol>
				</section>
				{run.precheckResult && (
					<section>
						<h3 className="mb-2 text-sm font-medium">{t('automation.precheck')}</h3>
						<p className="text-xs text-muted-foreground">
							{run.precheckResult.timedOut
								? t('automation.precheckTimeout')
								: t('automation.exitCode', { code: run.precheckResult.exitCode ?? '—' })}
						</p>
						<pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border/50 bg-muted/20 p-4 font-mono text-xs whitespace-pre-wrap">
							{run.precheckResult.output || '—'}
						</pre>
					</section>
				)}
				{automationMessage(run) && (
					<section>
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-medium">{t('automation.message')}</h3>
							<IconButton label={t('automation.copy')} onClick={() => copy(automationMessage(run))}>
								<Copy className="size-4" />
							</IconButton>
						</div>
						<p className="break-words text-sm whitespace-pre-wrap">{automationMessage(run)}</p>
					</section>
				)}
				<section>
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium">{t('automation.output')}</h3>
						<IconButton
							label={t('automation.copy')}
							disabled={!run.output}
							onClick={() => copy(run.output ?? '')}
						>
							<Copy className="size-4" />
						</IconButton>
					</div>
					<pre className="max-h-96 overflow-auto rounded-md border border-border/50 bg-muted/20 p-4 font-mono text-xs whitespace-pre-wrap">
						{run.output || (run.definition?.action.kind === 'notify' ? run.definition.action.body : '—')}
					</pre>
				</section>
			</div>
		</div>
	);
}
