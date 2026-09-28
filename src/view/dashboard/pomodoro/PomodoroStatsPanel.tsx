import { Fragment, type ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { datesForRange, type PomodoroRangeKey } from '../../../core/pomodoro/stats';
import { PomodoroService, activityColor } from '../../../platform/obsidian/pomodoro/pomodoro-service';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { openPomodoroTagManager } from './pomodoro-tag-manager';
import { describeArc } from './stats-geometry';
const HEAT_STEPS: [number, string][] = [
	[46, 'var(--db-accent)'],
	[16, 'color-mix(in srgb, var(--db-accent) 65%, var(--db-bg-hover))'],
	[1, 'color-mix(in srgb, var(--db-accent) 35%, var(--db-bg-hover))'],
];
export function PomodoroStatsPanel({
	service,
	close,
	root,
}: {
	service: PomodoroService;
	close: () => void;
	root: HTMLElement;
}) {
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
		root.ownerDocument.addEventListener('mousedown', down);
		return () => root.ownerDocument.removeEventListener('mousedown', down);
	}, [goalEditor, drill, root]);
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
	let offset = 0;
	const daily = service.getDailyMinutes(366).filter((d) => d.date >= period.curStart);
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
	else if (activeRange === 'all' || activeRange === 'year')
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
			<div class="dashboard-pomodoro-stats-header">
				<div class="dashboard-pomodoro-stats-header-titlewrap">
					<div class="dashboard-pomodoro-stats-header-title">{t('pomodoro.statsTitle')}</div>
					<div class="dashboard-pomodoro-insight">{service.getInsight()}</div>
				</div>
				<div class="dashboard-pomodoro-stats-header-right">
					<div class="dashboard-pomodoro-range-toggle">
						{(['day', 'week', 'month', 'year', 'all'] as const).map((range) => (
							<button
								key={range}
								class={`dashboard-pomodoro-range-btn${activeRange === range ? ' dashboard-pomodoro-range-btn--active' : ''}`}
								onClick={() => setRange(range)}
							>
								{t(`pomodoro.range${range[0]!.toUpperCase() + range.slice(1)}`)}
							</button>
						))}
					</div>
					<button
						class="dashboard-pomodoro-stats-icon-btn"
						aria-label={t('pomodoro.tagManage')}
						onClick={() => openPomodoroTagManager(root.ownerDocument, service, () => refresh((n) => n + 1))}
					>
						<Icon name="settings-2" />
					</button>
				</div>
				<button class="dashboard-pomodoro-stats-close" onClick={close} aria-label={t('common.close')}>
					<Icon name="x" />
				</button>
			</div>
			{activityFilter && (
				<div class="dashboard-pomodoro-filterbar dashboard-pomodoro-filterbar--visible">
					<div class="dashboard-pomodoro-filterbar-chip">
						<div
							class="dashboard-pomodoro-donut-legend-dot"
							style={{ backgroundColor: activityColor(activityFilter) }}
						/>
						<span>{t('pomodoro.filterActive', { name: activityFilter })}</span>
					</div>
					<button
						class="dashboard-pomodoro-filterbar-clear"
						onClick={() => setFilter(null)}
						aria-label={t('common.close')}
					>
						<Icon name="x" />
					</button>
				</div>
			)}
			<div class="dashboard-pomodoro-stats-body">
				<div class="dashboard-pomodoro-kpi-col">
					<div class="dashboard-pomodoro-kpi-group">
						<div class="dashboard-pomodoro-kpi-group-title">{t('pomodoro.kpiTodayGroup')}</div>
						<div class="dashboard-pomodoro-kpi-hero dashboard-pomodoro-kpi-hero--gauge">
							<button
								class="dashboard-pomodoro-kpi-hero-edit"
								onClick={() => setGoalEditor(true)}
								aria-label={t('pomodoro.editGoal')}
							>
								<Icon name="pencil" />
							</button>
							<svg
								class="dashboard-pomodoro-kpi-hero-gauge"
								viewBox="0 0 132 132"
								width="132"
								height="132"
							>
								<path
									class="dashboard-pomodoro-donut-bg"
									d={describeArc(66, 70, 45, 135, 405)}
									fill="none"
									stroke-width="15"
									stroke-linecap="round"
								/>
								{goal.completed > 0 && (
									<path
										d={describeArc(66, 70, 45, 135, 135 + 270 * pct)}
										fill="none"
										stroke-width="15"
										stroke-linecap="round"
										style={{ stroke: pct >= 1 ? 'var(--color-green)' : 'var(--db-accent)' }}
									/>
								)}
								<text
									class="dashboard-pomodoro-kpi-hero-gauge-value"
									x="66"
									y="67"
									text-anchor="middle"
									dominant-baseline="middle"
								>
									{goal.completed}/{goal.goal}
								</text>
								<text
									class="dashboard-pomodoro-donut-center-label"
									x="66"
									y="87"
									text-anchor="middle"
									dominant-baseline="middle"
								>
									{t('pomodoro.todayPomodoros')}
								</text>
							</svg>
							<div class="dashboard-pomodoro-kpi-hero-label">
								{t('pomodoro.todayPomodoros')} · {Math.round(pct * 100)}%
							</div>
						</div>
						<div class="dashboard-pomodoro-stats-summary">
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
						<div class="dashboard-pomodoro-stats-summary">
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
						<div class="dashboard-pomodoro-kpi-streak">
							<Icon className="dashboard-pomodoro-kpi-streak-icon" name="flame" />
							<div class="dashboard-pomodoro-kpi-streak-value">{streak}</div>
							<div class="dashboard-pomodoro-kpi-streak-label">{t('pomodoro.streakDays')}</div>
							<div class="dashboard-pomodoro-kpi-streak-hint">{streakText(streak)}</div>
						</div>
					</div>
					<div class="dashboard-pomodoro-kpi-group dashboard-pomodoro-kpi-group--hist">
						<div class="dashboard-pomodoro-kpi-group-title">{t('pomodoro.kpiHistoryGroup')}</div>
						<div class="dashboard-pomodoro-stats-summary">
							<Kpi value={formatMinutes(totals.current)} label={rangeLabel()} delta={delta} />
							<Kpi value={formatMinutes(service.getRecent7AvgMinutes())} label={t('pomodoro.avg7')} />
						</div>
						<div class="dashboard-pomodoro-stats-summary">
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
						<div ref={goalRoot} class="dashboard-pomodoro-goal-editor">
							<div class="dashboard-pomodoro-goal-editor-label">{t('pomodoro.editGoalLabel')}</div>
							<div class="dashboard-pomodoro-goal-editor-controls">
								<button
									class="dashboard-pomodoro-goal-editor-step"
									onClick={() => setGoal(goal.goal - 1)}
								>
									<Icon name="minus" />
								</button>
								<div class="dashboard-pomodoro-goal-editor-value">{goal.goal}</div>
								<button
									class="dashboard-pomodoro-goal-editor-step"
									onClick={() => setGoal(goal.goal + 1)}
								>
									<Icon name="plus" />
								</button>
							</div>
						</div>
					)}
				</div>
				<div class="dashboard-pomodoro-mid-col">
					{sorted.length > 1 && (
						<Section title={t('pomodoro.timeDistribution')}>
							<div class="dashboard-pomodoro-donut-container dashboard-pomodoro-donut-container--wide">
								<div class="dashboard-pomodoro-donut-wrap">
									<svg
										class="dashboard-pomodoro-donut-svg"
										viewBox="0 0 200 200"
										width="200"
										height="200"
									>
										<circle
											class="dashboard-pomodoro-donut-bg"
											cx="100"
											cy="100"
											r="84"
											fill="none"
											stroke-width="32"
										/>
										<text
											class="dashboard-pomodoro-donut-center-value"
											x="100"
											y="94"
											text-anchor="middle"
											dominant-baseline="middle"
										>
											{formatMinutes(hovered?.[1] ?? total)}
										</text>
										<text
											class="dashboard-pomodoro-donut-center-label"
											x="100"
											y="116"
											text-anchor="middle"
											dominant-baseline="middle"
										>
											{hovered
												? `${hovered[0]} · ${Math.round((hovered[1] / total) * 100)}%`
												: ''}
										</text>
										{sorted.map(([name, minutes]) => {
											const c = 2 * Math.PI * 84,
												dash = Math.max(0, (c * minutes) / Math.max(total, 1) - 3),
												start = offset;
											offset += dash + 3;
											return (
												<circle
													key={name}
													class="dashboard-pomodoro-donut-segment"
													cx="100"
													cy="100"
													r="84"
													fill="none"
													stroke-width={hover === name ? 38 : 32}
													stroke-dasharray={`${dash} ${c - dash}`}
													stroke-dashoffset={-start}
													transform="rotate(-90 100 100)"
													style={{ stroke: activityColor(name) }}
													onMouseEnter={() => setHover(name)}
													onMouseLeave={() => setHover(null)}
												/>
											);
										})}
									</svg>
								</div>
								<div class="dashboard-pomodoro-donut-legend dashboard-pomodoro-donut-legend--grid">
									{sorted.map(([name, minutes]) => (
										<div key={name} class="dashboard-pomodoro-donut-legend-item">
											<div
												class="dashboard-pomodoro-donut-legend-dot"
												style={{ backgroundColor: activityColor(name) }}
											/>
											<div class="dashboard-pomodoro-donut-legend-name">{name}</div>
											<div class="dashboard-pomodoro-donut-legend-pct">
												{Math.round((minutes / Math.max(1, total)) * 100)}%
											</div>
											<div class="dashboard-pomodoro-donut-legend-time">
												{formatMinutes(minutes)}
											</div>
										</div>
									))}
								</div>
							</div>
						</Section>
					)}
					<Section title={trendTitleText() + (activityFilter ? ` · ${activityFilter}` : '')}>
						<div class="dashboard-pomodoro-trend-container">
							{bars.every((b) => !b.minutes) ? (
								<div class="dashboard-pomodoro-donut-empty">{t('pomodoro.noRecords')}</div>
							) : (
								<svg
									class="dashboard-pomodoro-trend-svg"
									viewBox="0 0 520 184"
									width="100%"
									height="184"
								>
									{baseline && goalY > 0 && goalY < 168 && (
										<>
											<line
												class="dashboard-pomodoro-trend-goal-line"
												x1="0"
												y1={goalY}
												x2="520"
												y2={goalY}
												stroke-dasharray="5 4"
											/>
											<text
												class="dashboard-pomodoro-trend-goal-label"
												x="518"
												y={goalY - 4}
												text-anchor="end"
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
													class={`dashboard-pomodoro-trend-bar${b.date ? ' dashboard-pomodoro-trend-bar--clickable' : ''}`}
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
														class="dashboard-pomodoro-trend-tick"
														x={i * step + step / 2}
														y="180"
														text-anchor="middle"
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
						<div class="dashboard-pomodoro-hour-container">
							{hours.map((h) => (
								<div
									key={h.hour}
									class={`dashboard-pomodoro-hour-cell${h.hour === peak && h.minutes ? ' dashboard-pomodoro-hour-cell--peak' : ''}`}
									title={`${String(h.hour).padStart(2, '0')}:00 · ${formatMinutes(h.minutes)}`}
								>
									<div
										class={`dashboard-pomodoro-hour-bar${h.minutes ? '' : ' dashboard-pomodoro-hour-bar--empty'}`}
										style={{ height: Math.max(3, Math.round((h.minutes / maxHour) * 44)) }}
									/>
									<div class="dashboard-pomodoro-hour-tick">{h.hour % 6 === 0 ? h.hour : ''}</div>
								</div>
							))}
						</div>
					</Section>
				</div>
				<div class="dashboard-pomodoro-right-col">
					<Section title={t('pomodoro.heatmap')} hint={t('pomodoro.heatmapHint')}>
						<div class="dashboard-pomodoro-heatmap-wrap">
							<div class="dashboard-pomodoro-heatmap-container">
								<div class="dashboard-pomodoro-heatmap-grid">
									{heat.map((d) => (
										<div
											key={d.date}
											class="dashboard-pomodoro-heatmap-cell"
											title={`${d.date} · ${formatMinutes(d.minutes)}`}
											style={{ backgroundColor: heatColor(d.minutes) }}
										/>
									))}
								</div>
							</div>
							{heat.every((d) => !d.minutes) && (
								<div class="dashboard-pomodoro-heatmap-empty">{t('pomodoro.heatmapEmptyHint')}</div>
							)}
						</div>
						<div class="dashboard-pomodoro-heatmap-legend">
							<span class="dashboard-pomodoro-heatmap-legend-label">{t('pomodoro.less')}</span>
							{[0, 1, 16, 46].map((n) => (
								<div
									key={n}
									class="dashboard-pomodoro-heatmap-legend-swatch"
									style={{ backgroundColor: heatColor(n) }}
								/>
							))}
							<span class="dashboard-pomodoro-heatmap-legend-label">{t('pomodoro.more')}</span>
						</div>
					</Section>
					<Section title={t('pomodoro.todayTimeline')} hint={t('pomodoro.todayTimelineHint')}>
						<div class="dashboard-pomodoro-timeline-container">
							{timeline.length ? (
								timeline.map((r, i) => (
									<div key={`${r.timestamp}-${i}`} class="dashboard-pomodoro-timeline-item">
										<div class="dashboard-pomodoro-timeline-head">
											<div class="dashboard-pomodoro-timeline-time">{timeOf(r.timestamp)}</div>
											<div class="dashboard-pomodoro-timeline-activity">
												<div
													class="dashboard-pomodoro-donut-legend-dot"
													style={{
														backgroundColor: activityColor(
															r.activity || t('pomodoro.defaultActivity'),
														),
													}}
												/>
												<span>{r.activity || t('pomodoro.defaultActivity')}</span>
											</div>
											<div class="dashboard-pomodoro-timeline-duration">
												{formatMinutes(r.duration)}
											</div>
											<Icon className="dashboard-pomodoro-timeline-done" name="check" />
										</div>
										{r.breakCompleted !== undefined && (
											<div class="dashboard-pomodoro-timeline-sub">
												<Icon
													className="dashboard-pomodoro-timeline-sub-icon"
													name={r.breakCompleted ? 'coffee' : 'zap-off'}
												/>
												<span>
													{r.breakCompleted
														? t('pomodoro.breakTaken', { count: r.breakMinutes ?? 0 })
														: t('pomodoro.breakSkipped')}
												</span>
												{!!r.interruptions && (
													<span class="dashboard-pomodoro-timeline-interruptions">
														{' '}
														· {t('pomodoro.interrupted', { count: r.interruptions })}
													</span>
												)}
											</div>
										)}
									</div>
								))
							) : (
								<div class="dashboard-pomodoro-timeline-empty">
									<div class="dashboard-pomodoro-timeline-empty-text">
										{t('pomodoro.timelineEmpty')}
									</div>
									<button class="dashboard-pomodoro-timeline-start" onClick={close}>
										{t('pomodoro.startFocus')}
									</button>
								</div>
							)}
						</div>
					</Section>
					<Section title={t('pomodoro.activityRanking')}>
						<div class="dashboard-pomodoro-rank-container">
							{sorted.length ? (
								sorted.map(([name, minutes]) => (
									<div
										key={name}
										role="button"
										tabIndex={0}
										class={`dashboard-pomodoro-rank-row${activityFilter === name ? ' dashboard-pomodoro-rank-row--active' : ''}`}
										title={t('pomodoro.filterByActivity')}
										onClick={() => setFilter(activityFilter === name ? null : name)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												setFilter(activityFilter === name ? null : name);
											}
										}}
									>
										<div class="dashboard-pomodoro-rank-head">
											<div
												class="dashboard-pomodoro-donut-legend-dot"
												style={{ backgroundColor: activityColor(name) }}
											/>
											<div class="dashboard-pomodoro-rank-name">{name}</div>
											<div class="dashboard-pomodoro-rank-time">{formatMinutes(minutes)}</div>
										</div>
										<div class="dashboard-pomodoro-rank-bar-wrap">
											<div
												class="dashboard-pomodoro-rank-bar"
												style={{
													width: `${Math.max(3, Math.round((minutes / Math.max(1, sorted[0]![1])) * 100))}%`,
													backgroundColor: activityColor(name),
												}}
											/>
										</div>
									</div>
								))
							) : (
								<div class="dashboard-pomodoro-donut-empty">{t('pomodoro.noRecords')}</div>
							)}
						</div>
					</Section>
				</div>
			</div>
			{drill && (
				<div ref={drillRoot} class="dashboard-pomodoro-drilldown">
					<div class="dashboard-pomodoro-drilldown-head">
						<div class="dashboard-pomodoro-drilldown-title">{drill}</div>
						<button
							class="dashboard-pomodoro-stats-close"
							onClick={() => setDrill(null)}
							aria-label={t('common.close')}
						>
							<Icon name="x" />
						</button>
					</div>
					<div class="dashboard-pomodoro-drilldown-list">
						{service.getRecordsForDate(drill).map((r, i) => (
							<div key={`${r.timestamp}-${i}`} class="dashboard-pomodoro-stats-record-row">
								<div
									class="dashboard-pomodoro-stats-record-dot"
									style={{
										backgroundColor: activityColor(r.activity || t('pomodoro.defaultActivity')),
									}}
								/>
								<div class="dashboard-pomodoro-stats-record-date">{timeOf(r.timestamp)}</div>
								<div class="dashboard-pomodoro-stats-record-activity">{r.activity}</div>
								<div class="dashboard-pomodoro-stats-record-duration">{formatMinutes(r.duration)}</div>
								{!!r.interruptions && (
									<div class="dashboard-pomodoro-stats-record-interruptions">⏸ {r.interruptions}</div>
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
		<div class={`dashboard-pomodoro-stats-card${mood ? ` dashboard-pomodoro-stats-card--${mood}` : ''}`}>
			<div class="dashboard-pomodoro-stats-card-value-row">
				<div class="dashboard-pomodoro-stats-card-value">{value}</div>
				{delta !== undefined && Number.isFinite(delta) && (
					<div
						class={`dashboard-pomodoro-stats-card-delta dashboard-pomodoro-stats-card-delta--${delta >= 0 ? 'up' : 'down'}`}
						title={t('pomodoro.vsPrev')}
					>
						{delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(delta))}%
					</div>
				)}
			</div>
			<div class="dashboard-pomodoro-stats-card-label">{label}</div>
		</div>
	);
}
function Section({ title, hint, children }: { title: string; hint?: string; children: ComponentChildren }) {
	return (
		<div class="dashboard-pomodoro-stats-section">
			<div class="dashboard-pomodoro-stats-section-title-row">
				<div class="dashboard-pomodoro-stats-section-title">{title}</div>
				{hint && <div class="dashboard-pomodoro-stats-section-hint">{hint}</div>}
			</div>
			{children}
		</div>
	);
}
