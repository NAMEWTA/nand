// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationRunsDashboardSurface.tsx, AutomationRunsDashboardToolbar.tsx
import { useState } from 'react';
import type { AutomationRun } from '../../../../shared/automation/types';
import { useT } from '../../../../ui/react/hooks';
import { Field, Choice, SearchChoice } from '../parts';
import { RunHistory, type RunActions } from '../detail/RunHistory';
export function RunsPage({
	runs,
	disabled,
	...actions
}: RunActions & { runs: readonly AutomationRun[]; disabled: boolean }) {
	const t = useT(),
		[now] = useState(Date.now);
	const [status, setStatus] = useState('all'),
		[automation, setAutomation] = useState('all'),
		[range, setRange] = useState('all'),
		[limit, setLimit] = useState(50);
	const options = [
		...new Map(runs.map((run) => [run.automationId, { value: run.automationId, label: run.title }])).values(),
	];
	const visible = [...runs]
		.reverse()
		.filter(
			(run) =>
				(status === 'all' || run.status === status) &&
				(automation === 'all' || run.automationId === automation) &&
				(range === 'all' || run.startedAt >= now - Number(range) * 86_400_000),
		);
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6">
			<div className="flex flex-wrap items-end gap-3">
				<div className="w-56">
					<Field label={t('automation.result')}>
						{(id) => (
							<Choice
								id={id}
								label={t('automation.result')}
								value={status}
								options={[
									'all',
									'pending',
									'running',
									'unknown',
									'succeeded',
									'failed',
									'cancelled',
									'interrupted',
									'skipped',
									'delivered',
								].map((value) => ({ value, label: t(`automation.${value}`) }))}
								onChange={(v) => {
									setStatus(v);
									setLimit(50);
								}}
							/>
						)}
					</Field>
				</div>
				<div className="w-56">
					<Field label={t('automation.title')}>
						{(id) => (
							<SearchChoice
								id={id}
								label={t('automation.title')}
								value={automation}
								options={[{ value: 'all', label: t('automation.all') }, ...options]}
								onChange={(v) => {
									setAutomation(v);
									setLimit(50);
								}}
							/>
						)}
					</Field>
				</div>
				<div className="w-40">
					<Field label={t('automation.dateRange')}>
						{(id) => (
							<Choice
								id={id}
								label={t('automation.dateRange')}
								value={range}
								options={['all', '1', '7', '30'].map((value) => ({
									value,
									label:
										value === 'all'
											? t('automation.all')
											: t('automation.lastDays', { count: value }),
								}))}
								onChange={(v) => {
									setRange(v);
									setLimit(50);
								}}
							/>
						)}
					</Field>
				</div>
			</div>
			<RunHistory
				runs={visible.slice(0, limit)}
				hasMore={visible.length > limit}
				onLoadMore={() => setLimit((v) => v + 50)}
				disabled={disabled}
				{...actions}
			/>
		</div>
	);
}
