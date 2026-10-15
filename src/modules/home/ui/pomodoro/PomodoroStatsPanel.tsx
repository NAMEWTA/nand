// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pomodoro-stats-modal.ts
import { RecordButton as Button } from '../dialogs/RecordButton';
import { widgetClasses } from '../theme/widget-classes';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { RecordSaveStatus } from '../dialogs/RecordSaveStatus';
import { Fragment, type ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { datesForRange, type PomodoroRangeKey } from '../../core/pomodoro/stats';
import { PomodoroService, activityColor } from '../../platform/pomodoro/pomodoro-service';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import { describeArc } from './stats-geometry';
const HEAT_STEPS: [number, string][] = [
	[46, 'var(--db-accent)'],
	[16, 'color-mix(in srgb, var(--db-accent) 65%, var(--db-bg-hover))'],
	[1, 'color-mix(in srgb, var(--db-accent) 35%, var(--db-bg-hover))'],
];
export function PomodoroStatsPanel({ service, close }: { service: PomodoroService; close?: () => void }) {
	const doc = useOwnerDocument();
	const [, refresh] = useState(0),
		[activeRange, setRange] = useState<PomodoroRangeKey>('week'),
		[activityFilter, setFilter] = useState<string | null>(null),
		[goalEditor, setGoalEditor] = useState(false),
		[drill, setDrill] = useState<string | null>(null),
		[hover, setHover] = useState<string | null>(null);
	useLayoutEffect(() => service.subscribe(() => refresh((n) => n + 1)), [service]);
	const goalRoot = useRef<HTMLDivElement>(null),
		drillRoot = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		if (!goalEditor && !drill) return undefined;
		const down = (e: MouseEvent) => {
			if (goalEditor && !goalRoot.current?.contains(e.target as Node)) setGoalEditor(false);
			if (drill && !drillRoot.current?.contains(e.target as Node)) setDrill(null);
		};
		doc.addEventListener('mousedown', down);
		return () => doc.removeEventListener('mousedown', down);
	}, [goalEditor, drill, doc]);
	function heatColor(minutes: number): string {
		for (const [min, color] of HEAT_STEPS) {
			if (minutes >= min) return color;
		}
		return '';
	}

	function rangeBreakdown(key: PomodoroRangeKey): Map<string, number> {
		switch (key) {
			case 'day':
				return service.getActivityBreakdownByRange(1);
			case 'week':
				return service.getActivityBreakdownByCalendarWeek();
			case 'month':
				return service.getActivityBreakdownByCalendarMonth();
			case 'year':
				return service.getActivityBreakdownByCalendarYear();
			case 'all':
				return service.getActivityBreakdown();
		}
	}

	function streakText(streak: number): string {
		if (streak <= 0) return t('pomodoro.streakRestart');
		if (streak === 1) return t('pomodoro.streakDay1');
		if (streak < 3) return t('pomodoro.streakDay2');
		if (streak < 7) return t('pomodoro.streakDay3');
		return t('pomodoro.streakWeek');
	}

	function rangeLabel(): string {
		switch (activeRange) {
			case 'day':
				return t('pomodoro.todayFocus');
			case 'week':
				return t('pomodoro.weekFocus');
			case 'month':
				return t('pomodoro.monthFocus');
			case 'year':
				return t('pomodoro.yearFocus');
			case 'all':
				return t('pomodoro.totalFocus');
		}
	}

	function trendTitleText(): string {
		switch (activeRange) {
			case 'day':
				return t('pomodoro.todayChart');
			case 'week':
				return t('pomodoro.weekChart');
			case 'month':
				return t('pomodoro.monthChart');
			case 'year':
				return t('pomodoro.yearChart');
			case 'all':
				return t('pomodoro.allChart');
		}
	}

	function formatMinutes(minutes: number): string {
		if (minutes < 60) {
			return t('pomodoro.minutes', { count: minutes });
		}
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (mins === 0) return t('pomodoro.hours', { count: hours });
		return t('pomodoro.hours', { count: hours }) + ' ' + t('pomodoro.minutes', { count: mins });
	}
	const goal = service.getTodayGoal(),
		pct = goal.goal > 0 ? Math.min(1, goal.completed / goal.goal) : 0,
		score = service.getTodayScore(),
		inter = service.getTodayInterruptions(),
		adherence = service.getBreakAdherence(),
		streak = service.getStreak(),
		period = datesForRange(activeRange),
		totals = service.getRangeTotals(period.curStart, period.prevStart, period.prevEnd),
		delta = totals.previous > 0 ? ((totals.current - totals.previous) / totals.previous) * 100 : undefined;
	const sorted = [...rangeBreakdown(activeRange)].sort((a, b) => b[1] - a[1]),
		total = sorted.reduce((s, [, n]) => s + n, 0),
		hovered = sorted.find(([name]) => name === hover);
	const daily = service.getDailyMinutes(Math.min(period.dayCount, 31));
	let bars: { label: string; minutes: number; tooltip: string; date?: string }[];
	if (activeRange === 'day')
		bars = service.getTodayHourlyMinutes().map((h) => {
			const minutes = activityFilter
				? service
						.getTodayTimeline()
						.filter((r) => r.activity === activityFilter && new Date(r.timestamp).getHours() === h.hour)
						.reduce((n, r) => n + r.duration, 0)
				: h.minutes;
			return {
				label: String(h.hour).padStart(2, '0'),
				minutes,
				tooltip: `${String(h.hour).padStart(2, '0')}:00 · ${formatMinutes(minutes)}`,
			};
		});
	else if (activeRange === 'all')
		bars = service
			.getMonthlyMinutes(activityFilter ?? undefined)
			.filter((m) => activeRange === 'all' || m.month >= period.curStart.slice(0, 7))
			.map((m) => {
				const minutes = m.minutes;
				return { label: m.month.slice(2), minutes, tooltip: `${m.month} · ${formatMinutes(minutes)}` };
			});
	else
		bars = daily.map((d) => {
			const minutes = activityFilter
				? service
						.getRecordsForDate(d.date)
						.filter((r) => r.activity === activityFilter)
						.reduce((n, r) => n + r.duration, 0)
				: d.minutes;
			return { label: d.date.slice(8), minutes, date: d.date, tooltip: `${d.date} · ${formatMinutes(minutes)}` };
		});
	const goalMinutes = goal.goal * service.getWorkMinutes(),
		baseline = bars.some((b) => b.date) && !activityFilter,
		max = Math.max(...bars.map((b) => b.minutes), baseline ? goalMinutes : 0, 1),
		step = 520 / Math.max(1, bars.length),
		barWidth = Math.max(2, Math.min(18, step * 0.6)),
		goalY = 168 - Math.round((goalMinutes / max) * 158),
		heat = service.getHeatmapMinutes(),
		hours = service.getHourDistribution(),
		maxHour = Math.max(...hours.map((h) => h.minutes), 1),
		peak = service.getPeakHour(),
		timeline = service.getTodayTimeline();
	const setGoal = (value: number) => {
		service.getGoalSettings().pomodoroDailyGoal = Math.max(1, Math.min(16, value));
		refresh((n) => n + 1);
		void service.saveGoalSettings();
	};
	return (
		<>
			<RecordSaveStatus source={service} />
			<div className={widgetClasses('dashboard-pomodoro-stats-header')}>
				<div className={widgetClasses('dashboard-pomodoro-stats-header-titlewrap')}>
					<div className={widgetClasses('dashboard-pomodoro-stats-header-title')}>
						{t('pomodoro.statsTitle')}
					</div>
					<div className={widgetClasses('dashboard-pomodoro-insight')}>{service.getInsight()}</div>
				</div>
				<div className={widgetClasses('dashboard-pomodoro-stats-header-right')}>
					<div className={widgetClasses('dashboard-pomodoro-range-toggle')}>
						{(['day', 'week', 'month', 'year', 'all'] as const).map((range) => (
							<Button
								variant="ghost"
								key={range}
								className={widgetClasses(
									`dashboard-pomodoro-range-btn${activeRange === range ? ' dashboard-pomodoro-range-btn--active' : ''}`,
								)}
								onClick={() => setRange(range)}
							>
								{t(`pomodoro.range${range[0]!.toUpperCase() + range.slice(1)}`)}
							</Button>
						))}
					</div>
				</div>
				{close && (
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-pomodoro-stats-close')}
						onClick={close}
						aria-label={t('common.close')}
					>
						<Icon name="x" />
					</Button>
				)}
			</div>
			{activityFilter && (
				<div className={widgetClasses('dashboard-pomodoro-filterbar dashboard-pomodoro-filterbar--visible')}>
					<div className={widgetClasses('dashboard-pomodoro-filterbar-chip')}>
						<div
							className={widgetClasses('dashboard-pomodoro-donut-legend-dot')}
							style={{ backgroundColor: activityColor(activityFilter) }}
						/>
						<span>{t('pomodoro.filterActive', { name: activityFilter })}</span>
					</div>
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-pomodoro-filterbar-clear')}
						onClick={() => setFilter(null)}
						aria-label={t('common.close')}
					>
						<Icon name="x" />
					</Button>
				</div>
			)}
			<div className={widgetClasses('dashboard-pomodoro-stats-body')}>
				<div className={widgetClasses('dashboard-pomodoro-kpi-col')}>
					<div className={widgetClasses('dashboard-pomodoro-kpi-group')}>
						<div className={widgetClasses('dashboard-pomodoro-kpi-group-title')}>
							{t('pomodoro.kpiTodayGroup')}
						</div>
						<div
							className={widgetClasses('dashboard-pomodoro-kpi-hero dashboard-pomodoro-kpi-hero--gauge')}
						>
							<Button
								variant="ghost"
								className={widgetClasses('dashboard-pomodoro-kpi-hero-edit')}
								onClick={() => setGoalEditor(true)}
								aria-label={t('pomodoro.editGoal')}
							>
								<Icon name="pencil" />
							</Button>
							<svg
								className={widgetClasses('dashboard-pomodoro-kpi-hero-gauge')}
								viewBox="0 0 132 132"
								width="132"
								height="132"
							>
								<path
									className={widgetClasses('dashboard-pomodoro-donut-bg')}
									d={describeArc(66, 70, 45, 135, 405)}
									fill="none"
									strokeWidth="15"
									strokeLinecap="round"
								/>
								{goal.completed > 0 && (
									<path
										d={describeArc(66, 70, 45, 135, 135 + 270 * pct)}
										fill="none"
										strokeWidth="15"
										strokeLinecap="round"
										style={{ stroke: pct >= 1 ? 'var(--color-green)' : 'var(--db-accent)' }}
									/>
								)}
								<text
									className={widgetClasses('dashboard-pomodoro-kpi-hero-gauge-value')}
									x="66"
									y="67"
									textAnchor="middle"
									dominantBaseline="middle"
								>
									{goal.completed}/{goal.goal}
								</text>
								<text
									className={widgetClasses('dashboard-pomodoro-donut-center-label')}
									x="66"
									y="87"
									textAnchor="middle"
									dominantBaseline="middle"
								>
									{t('pomodoro.todayPomodoros')}
								</text>
							</svg>
							<div className={widgetClasses('dashboard-pomodoro-kpi-hero-label')}>
								{t('pomodoro.todayPomodoros')} · {Math.round(pct * 100)}%
							</div>
						</div>
						<div className={widgetClasses('dashboard-pomodoro-stats-summary')}>
							<Kpi
								value={formatMinutes(service.getTodayFocusMinutes())}
								label={t('pomodoro.todayFocus')}
							/>
							<Kpi
								value={String(score)}
								label={t('pomodoro.efficiencyScore')}
								mood={score >= 80 ? 'good' : undefined}
							/>
						</div>
						<div className={widgetClasses('dashboard-pomodoro-stats-summary')}>
							<Kpi
								value={String(inter)}
								label={t('pomodoro.interruptions')}
								mood={inter >= 3 ? 'warn' : undefined}
							/>
							<Kpi
								value={adherence === null ? '—' : `${adherence}%`}
								label={t('pomodoro.breakAdherence')}
							/>
						</div>
						<div className={widgetClasses('dashboard-pomodoro-kpi-streak')}>
							<Icon className={widgetClasses('dashboard-pomodoro-kpi-streak-icon')} name="flame" />
							<div className={widgetClasses('dashboard-pomodoro-kpi-streak-value')}>{streak}</div>
							<div className={widgetClasses('dashboard-pomodoro-kpi-streak-label')}>
								{t('pomodoro.streakDays')}
							</div>
							<div className={widgetClasses('dashboard-pomodoro-kpi-streak-hint')}>
								{streakText(streak)}
							</div>
						</div>
					</div>
					<div className={widgetClasses('dashboard-pomodoro-kpi-group dashboard-pomodoro-kpi-group--hist')}>
						<div className={widgetClasses('dashboard-pomodoro-kpi-group-title')}>
							{t('pomodoro.kpiHistoryGroup')}
						</div>
						<div className={widgetClasses('dashboard-pomodoro-stats-summary')}>
							<Kpi value={formatMinutes(totals.current)} label={rangeLabel()} delta={delta} />
							<Kpi value={formatMinutes(service.getRecent7AvgMinutes())} label={t('pomodoro.avg7')} />
						</div>
						<div className={widgetClasses('dashboard-pomodoro-stats-summary')}>
							<Kpi
								value={formatMinutes(service.getTotalFocusMinutes())}
								label={t('pomodoro.totalFocus')}
							/>
							<Kpi
								value={formatMinutes(
									Math.max(0, ...service.getDailyMinutes(365).map((d) => d.minutes)),
								)}
								label={t('pomodoro.bestDay')}
							/>
						</div>
					</div>
					{goalEditor && (
						<div ref={goalRoot} className={widgetClasses('dashboard-pomodoro-goal-editor')}>
							<div className={widgetClasses('dashboard-pomodoro-goal-editor-label')}>
								{t('pomodoro.editGoalLabel')}
							</div>
							<div className={widgetClasses('dashboard-pomodoro-goal-editor-controls')}>
								<Button
									variant="ghost"
									className={widgetClasses('dashboard-pomodoro-goal-editor-step')}
									aria-label={t('pomodoro.decreaseGoal')}
									onClick={() => setGoal(goal.goal - 1)}
								>
									<Icon name="minus" />
								</Button>
								<div className={widgetClasses('dashboard-pomodoro-goal-editor-value')}>{goal.goal}</div>
								<Button
									variant="ghost"
									className={widgetClasses('dashboard-pomodoro-goal-editor-step')}
									aria-label={t('pomodoro.increaseGoal')}
									onClick={() => setGoal(goal.goal + 1)}
								>
									<Icon name="plus" />
								</Button>
							</div>
						</div>
					)}
				</div>
				<div className={widgetClasses('dashboard-pomodoro-mid-col')}>
					{sorted.length > 1 && (
						<Section title={t('pomodoro.timeDistribution')}>
							<div
								className={widgetClasses(
									'dashboard-pomodoro-donut-container dashboard-pomodoro-donut-container--wide',
								)}
							>
								<div className={widgetClasses('dashboard-pomodoro-donut-wrap')}>
									<svg
										className={widgetClasses('dashboard-pomodoro-donut-svg')}
										viewBox="0 0 200 200"
										width="200"
										height="200"
									>
										<circle
											className={widgetClasses('dashboard-pomodoro-donut-bg')}
											cx="100"
											cy="100"
											r="84"
											fill="none"
											strokeWidth="32"
										/>
										<text
											className={widgetClasses('dashboard-pomodoro-donut-center-value')}
											x="100"
											y="94"
											textAnchor="middle"
											dominantBaseline="middle"
										>
											{formatMinutes(hovered?.[1] ?? total)}
										</text>
										<text
											className={widgetClasses('dashboard-pomodoro-donut-center-label')}
											x="100"
											y="116"
											textAnchor="middle"
											dominantBaseline="middle"
										>
											{hovered
												? `${hovered[0]} · ${Math.round((hovered[1] / total) * 100)}%`
												: ''}
										</text>
										{sorted.map(([name, minutes], index) => {
											const c = 2 * Math.PI * 84,
												dash = Math.max(0, (c * minutes) / Math.max(total, 1) - 3),
												start = sorted
													.slice(0, index)
													.reduce(
														(sum, [, value]) =>
															sum + Math.max(0, (c * value) / Math.max(total, 1) - 3) + 3,
														0,
													);
											return (
												<circle
													key={name}
													className={widgetClasses('dashboard-pomodoro-donut-segment')}
													cx="100"
													cy="100"
													r="84"
													fill="none"
													strokeWidth={hover === name ? 38 : 32}
													strokeDasharray={`${dash} ${c - dash}`}
													strokeDashoffset={-start}
													transform="rotate(-90 100 100)"
													style={{ stroke: activityColor(name) }}
													onMouseEnter={() => setHover(name)}
													onMouseLeave={() => setHover(null)}
												/>
											);
										})}
									</svg>
								</div>
								<div
									className={widgetClasses(
										'dashboard-pomodoro-donut-legend dashboard-pomodoro-donut-legend--grid',
									)}
								>
									{sorted.map(([name, minutes]) => (
										<div
											key={name}
											className={widgetClasses('dashboard-pomodoro-donut-legend-item')}
										>
											<div
												className={widgetClasses('dashboard-pomodoro-donut-legend-dot')}
												style={{ backgroundColor: activityColor(name) }}
											/>
											<div className={widgetClasses('dashboard-pomodoro-donut-legend-name')}>
												{name}
											</div>
											<div className={widgetClasses('dashboard-pomodoro-donut-legend-pct')}>
												{Math.round((minutes / Math.max(1, total)) * 100)}%
											</div>
											<div className={widgetClasses('dashboard-pomodoro-donut-legend-time')}>
												{formatMinutes(minutes)}
											</div>
										</div>
									))}
								</div>
							</div>
						</Section>
					)}
					<Section title={trendTitleText() + (activityFilter ? ` · ${activityFilter}` : '')}>
						<div className={widgetClasses('dashboard-pomodoro-trend-container')}>
							{bars.every((b) => !b.minutes) ? (
								<div className={widgetClasses('dashboard-pomodoro-donut-empty')}>
									{t('pomodoro.noRecords')}
								</div>
							) : (
								<svg
									className={widgetClasses('dashboard-pomodoro-trend-svg')}
									viewBox="0 0 520 184"
									width="100%"
									height="184"
								>
									{baseline && goalY > 0 && goalY < 168 && (
										<>
											<line
												className={widgetClasses('dashboard-pomodoro-trend-goal-line')}
												x1="0"
												y1={goalY}
												x2="520"
												y2={goalY}
												strokeDasharray="5 4"
											/>
											<text
												className={widgetClasses('dashboard-pomodoro-trend-goal-label')}
												x="518"
												y={goalY - 4}
												textAnchor="end"
											>
												{t('pomodoro.goalBaseline', { count: goal.goal })}
											</text>
										</>
									)}
									{bars.map((b, i) => {
										const h = Math.round((b.minutes / max) * 158);
										return (
											<Fragment key={b.date ?? b.label}>
												<rect
													className={widgetClasses(
														`dashboard-pomodoro-trend-bar${b.date ? ' dashboard-pomodoro-trend-bar--clickable' : ''}`,
													)}
													x={i * step + (step - barWidth) / 2}
													y={168 - h}
													width={barWidth}
													height={Math.max(b.minutes > 0 ? 2 : 0, h)}
													rx="2"
													style={{
														fill: activityFilter
															? activityColor(activityFilter)
															: 'var(--db-accent)',
													}}
													onClick={() => {
														if (b.date && service.getRecordsForDate(b.date).length)
															setDrill(b.date);
													}}
												>
													<title>
														{b.tooltip}
														{b.date ? ` · ${t('pomodoro.clickToDrill')}` : ''}
													</title>
												</rect>
												{(bars.length <= 14 || i % Math.ceil(bars.length / 12) === 0) && (
													<text
														className={widgetClasses('dashboard-pomodoro-trend-tick')}
														x={i * step + step / 2}
														y="180"
														textAnchor="middle"
													>
														{b.label}
													</text>
												)}
											</Fragment>
										);
									})}
								</svg>
							)}
						</div>
					</Section>
					<Section
						title={t('pomodoro.hourDistribution')}
						hint={
							peak === null
								? undefined
								: t('pomodoro.peakHour', { hour: `${String(peak).padStart(2, '0')}:00` })
						}
					>
						<div className={widgetClasses('dashboard-pomodoro-hour-container')}>
							{hours.map((h) => (
								<div
									key={h.hour}
									className={widgetClasses(
										`dashboard-pomodoro-hour-cell${h.hour === peak && h.minutes ? ' dashboard-pomodoro-hour-cell--peak' : ''}`,
									)}
									title={`${String(h.hour).padStart(2, '0')}:00 · ${formatMinutes(h.minutes)}`}
								>
									<div
										className={widgetClasses(
											`dashboard-pomodoro-hour-bar${h.minutes ? '' : ' dashboard-pomodoro-hour-bar--empty'}`,
										)}
										style={{ height: Math.max(3, Math.round((h.minutes / maxHour) * 44)) }}
									/>
									<div className={widgetClasses('dashboard-pomodoro-hour-tick')}>
										{h.hour % 6 === 0 ? h.hour : ''}
									</div>
								</div>
							))}
						</div>
					</Section>
				</div>
				<div className={widgetClasses('dashboard-pomodoro-right-col')}>
					<Section title={t('pomodoro.heatmap')} hint={t('pomodoro.heatmapHint')}>
						<div className={widgetClasses('dashboard-pomodoro-heatmap-wrap')}>
							<div className={widgetClasses('dashboard-pomodoro-heatmap-container')}>
								<div className={widgetClasses('dashboard-pomodoro-heatmap-grid')}>
									{heat.map((d) => (
										<div
											key={d.date}
											className={widgetClasses('dashboard-pomodoro-heatmap-cell')}
											title={`${d.date} · ${formatMinutes(d.minutes)}`}
											style={{ backgroundColor: heatColor(d.minutes) }}
										/>
									))}
								</div>
							</div>
							{heat.every((d) => !d.minutes) && (
								<div className={widgetClasses('dashboard-pomodoro-heatmap-empty')}>
									{t('pomodoro.heatmapEmptyHint')}
								</div>
							)}
						</div>
						<div className={widgetClasses('dashboard-pomodoro-heatmap-legend')}>
							<span className={widgetClasses('dashboard-pomodoro-heatmap-legend-label')}>
								{t('pomodoro.less')}
							</span>
							{[0, 1, 16, 46].map((n) => (
								<div
									key={n}
									className={widgetClasses('dashboard-pomodoro-heatmap-legend-swatch')}
									style={{ backgroundColor: heatColor(n) }}
								/>
							))}
							<span className={widgetClasses('dashboard-pomodoro-heatmap-legend-label')}>
								{t('pomodoro.more')}
							</span>
						</div>
					</Section>
					<Section title={t('pomodoro.todayTimeline')} hint={t('pomodoro.todayTimelineHint')}>
						<div className={widgetClasses('dashboard-pomodoro-timeline-container')}>
							{timeline.length ? (
								timeline.map((r, i) => (
									<div
										key={`${r.timestamp}-${i}`}
										className={widgetClasses('dashboard-pomodoro-timeline-item')}
									>
										<div className={widgetClasses('dashboard-pomodoro-timeline-head')}>
											<div className={widgetClasses('dashboard-pomodoro-timeline-time')}>
												{timeOf(r.timestamp)}
											</div>
											<div className={widgetClasses('dashboard-pomodoro-timeline-activity')}>
												<div
													className={widgetClasses('dashboard-pomodoro-donut-legend-dot')}
													style={{
														backgroundColor: activityColor(
															r.activity || t('pomodoro.defaultActivity'),
														),
													}}
												/>
												<span>{r.activity || t('pomodoro.defaultActivity')}</span>
											</div>
											<div className={widgetClasses('dashboard-pomodoro-timeline-duration')}>
												{formatMinutes(r.duration)}
											</div>
											<Icon
												className={widgetClasses(
													'dashboard-pomodoro-timeline-done size-[18px]',
												)}
												name="check"
											/>
										</div>
										{r.breakCompleted !== undefined && (
											<div className={widgetClasses('dashboard-pomodoro-timeline-sub')}>
												<Icon
													className={widgetClasses(
														'dashboard-pomodoro-timeline-sub-icon size-[18px]',
													)}
													name={r.breakCompleted ? 'coffee' : 'zap-off'}
												/>
												<span>
													{r.breakCompleted
														? t('pomodoro.breakTaken', { count: r.breakMinutes ?? 0 })
														: t('pomodoro.breakSkipped')}
												</span>
												{!!r.interruptions && (
													<span
														className={widgetClasses(
															'dashboard-pomodoro-timeline-interruptions',
														)}
													>
														{' '}
														· {t('pomodoro.interrupted', { count: r.interruptions })}
													</span>
												)}
											</div>
										)}
									</div>
								))
							) : (
								<div className={widgetClasses('dashboard-pomodoro-timeline-empty')}>
									<div className={widgetClasses('dashboard-pomodoro-timeline-empty-text')}>
										{t('pomodoro.timelineEmpty')}
									</div>
									<Button
										variant="ghost"
										className={widgetClasses('dashboard-pomodoro-timeline-start')}
										onClick={close}
									>
										{t('pomodoro.startFocus')}
									</Button>
								</div>
							)}
						</div>
					</Section>
					<Section title={t('pomodoro.activityRanking')}>
						<div className={widgetClasses('dashboard-pomodoro-rank-container')}>
							{sorted.length ? (
								sorted.map(([name, minutes]) => (
									<Button
										variant="ghost"
										key={name}
										role="button"
										tabIndex={0}
										className={widgetClasses(
											`dashboard-pomodoro-rank-row w-[calc(100%_+_8px)] ${activityFilter === name ? ' dashboard-pomodoro-rank-row--active' : ''}`,
										)}
										title={t('pomodoro.filterByActivity')}
										onClick={() => setFilter(activityFilter === name ? null : name)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												setFilter(activityFilter === name ? null : name);
											}
										}}
									>
										<div className={widgetClasses('dashboard-pomodoro-rank-head')}>
											<div
												className={widgetClasses('dashboard-pomodoro-donut-legend-dot')}
												style={{ backgroundColor: activityColor(name) }}
											/>
											<div className={widgetClasses('dashboard-pomodoro-rank-name')}>{name}</div>
											<div className={widgetClasses('dashboard-pomodoro-rank-time')}>
												{formatMinutes(minutes)}
											</div>
										</div>
										<div className={widgetClasses('dashboard-pomodoro-rank-bar-wrap')}>
											<div
												className={widgetClasses('dashboard-pomodoro-rank-bar')}
												style={{
													width: `${Math.max(3, Math.round((minutes / Math.max(1, sorted[0]![1])) * 100))}%`,
													backgroundColor: activityColor(name),
												}}
											/>
										</div>
									</Button>
								))
							) : (
								<div className={widgetClasses('dashboard-pomodoro-donut-empty')}>
									{t('pomodoro.noRecords')}
								</div>
							)}
						</div>
					</Section>
				</div>
			</div>
			{drill && (
				<div ref={drillRoot} className={widgetClasses('dashboard-pomodoro-drilldown')}>
					<div className={widgetClasses('dashboard-pomodoro-drilldown-head')}>
						<div className={widgetClasses('dashboard-pomodoro-drilldown-title')}>{drill}</div>
						<Button
							variant="ghost"
							className={widgetClasses('dashboard-pomodoro-stats-close')}
							onClick={() => setDrill(null)}
							aria-label={t('common.close')}
						>
							<Icon name="x" />
						</Button>
					</div>
					<div className={widgetClasses('dashboard-pomodoro-drilldown-list')}>
						{service.getRecordsForDate(drill).map((r, i) => (
							<div
								key={`${r.timestamp}-${i}`}
								className={widgetClasses('dashboard-pomodoro-stats-record-row')}
							>
								<div
									className={widgetClasses('dashboard-pomodoro-stats-record-dot')}
									style={{
										backgroundColor: activityColor(r.activity || t('pomodoro.defaultActivity')),
									}}
								/>
								<div className={widgetClasses('dashboard-pomodoro-stats-record-date')}>
									{timeOf(r.timestamp)}
								</div>
								<div className={widgetClasses('dashboard-pomodoro-stats-record-activity')}>
									{r.activity}
								</div>
								<div className={widgetClasses('dashboard-pomodoro-stats-record-duration')}>
									{formatMinutes(r.duration)}
								</div>
								{!!r.interruptions && (
									<div className={widgetClasses('dashboard-pomodoro-stats-record-interruptions')}>
										⏸ {r.interruptions}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</>
	);
}
function timeOf(timestamp: string) {
	const date = new Date(timestamp);
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function Kpi({ value, label, delta, mood }: { value: string; label: string; delta?: number; mood?: string }) {
	return (
		<div
			className={widgetClasses(
				`dashboard-pomodoro-stats-card${mood ? ` dashboard-pomodoro-stats-card--${mood}` : ''}`,
			)}
		>
			<div className={widgetClasses('dashboard-pomodoro-stats-card-value-row')}>
				<div className={widgetClasses('dashboard-pomodoro-stats-card-value')}>{value}</div>
				{delta !== undefined && Number.isFinite(delta) && (
					<div
						className={widgetClasses(
							`dashboard-pomodoro-stats-card-delta dashboard-pomodoro-stats-card-delta--${delta >= 0 ? 'up' : 'down'}`,
						)}
						title={t('pomodoro.vsPrev')}
					>
						{delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(delta))}%
					</div>
				)}
			</div>
			<div className={widgetClasses('dashboard-pomodoro-stats-card-label')}>{label}</div>
		</div>
	);
}
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
	return (
		<div className={widgetClasses('dashboard-pomodoro-stats-section')}>
			<div className={widgetClasses('dashboard-pomodoro-stats-section-title-row')}>
				<div className={widgetClasses('dashboard-pomodoro-stats-section-title')}>{title}</div>
				{hint && <div className={widgetClasses('dashboard-pomodoro-stats-section-hint')}>{hint}</div>}
			</div>
			{children}
		</div>
	);
}
