import { useLayoutEffect, useRef } from 'preact/hooks';
import {
	calendarSpan,
	dateBucketOf,
	taskDayKind,
	toIsoDate,
	type VaultTask,
} from '../../platform/calendar/alltasks-scan';
import { t } from '../../../../shared/i18n/index';
import { Icon } from '../../../../ui/primitives/Icon';
import { InlineLinks } from '../cards/InlineLinks';
import type { DashboardRenderContext } from '../renderer/render-context';
import {
	COMPACT_MAX_PER_DAY,
	TIMEGRID_HOUR_PX,
	WEEK_COMPACT_MAX,
	byDayTaskTime,
	clampBarToWeek,
	hhmmToMin,
	monthDayLabel,
	packBarLanes,
	parseIso,
	taskDayTime,
	weekdayLabels,
	type BarEntry,
	type MonthGridOptions,
} from './calendar-layout';
interface GridProps {
	byDay: Map<string, VaultTask[]>;
	opts: MonthGridOptions;
	context: DashboardRenderContext;
}
function dayTrigger(iso: string, action?: (iso: string) => void) {
	return action
		? {
				role: 'button' as const,
				tabIndex: 0,
				'aria-label': t('calendar.dayNumAddTask'),
				title: t('calendar.dayNumAddTask'),
				onClick: (event: MouseEvent) => {
					event.stopPropagation();
					action(iso);
				},
				onKeyDown: (event: KeyboardEvent) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						action(iso);
					}
				},
			}
		: {};
}
export function OriginMark({ task, iso }: { task: VaultTask; iso: string }) {
	const kind = taskDayKind(task, iso);
	return kind === 'scheduled' || kind === 'completion' ? (
		<div
			class={`dashboard-calendar-mark dashboard-calendar-mark--${kind === 'scheduled' ? 'scheduled' : 'done'}`}
			aria-label={t(kind === 'scheduled' ? 'calendar.markerScheduled' : 'calendar.markerDone')}
			title={t(kind === 'scheduled' ? 'calendar.markerScheduled' : 'calendar.markerDone')}
		>
			<Icon name={kind === 'scheduled' ? 'hourglass' : 'check-circle'} />
		</div>
	) : null;
}
function DayTask({ task, iso, opts, context }: Omit<GridProps, 'byDay'> & { task: VaultTask; iso: string }) {
	const multi = !!(task.start && task.end) && taskDayKind(task, iso) === 'span',
		overdue = !task.checked && dateBucketOf(task.due) === 'overdue',
		time = taskDayTime(task, iso);
	return (
		<div
			class={`dashboard-calendar-event${task.checked ? ' is-done' : ''}${multi ? ' is-multi' : ''}${task.priority ? ` prio-${task.priority}` : ''}${overdue ? ' is-overdue' : ''}${!opts.compact && opts.onOpenNote ? ' is-jumpable' : ''}`}
			onClick={(event) => {
				if (opts.compact || (event.target as HTMLElement).closest('input, a')) return;
				event.stopPropagation();
				opts.onOpenNote?.(task.file, task.line);
			}}
		>
			{!opts.compact && opts.onToggle && (
				<input
					class="dashboard-calendar-check"
					type="checkbox"
					checked={task.checked}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						opts.onToggle?.(task, !task.checked);
					}}
				/>
			)}
			{opts.showTimes && time && <div class="dashboard-calendar-event-time">{time}</div>}
			<div class="dashboard-calendar-event-text">
				<InlineLinks text={task.text} app={opts.app} context={context} />
			</div>
			<OriginMark task={task} iso={iso} />
			{multi && (
				<div class="dashboard-calendar-multi-mark" aria-label={`${task.start} → ${task.end}`}>
					<Icon name="arrow-right-left" />
				</div>
			)}
		</div>
	);
}
function DayCell({
	date,
	month,
	tasks,
	opts,
	context,
}: Omit<GridProps, 'byDay'> & { date: Date; month: number; tasks: VaultTask[] }) {
	const iso = toIsoDate(date),
		today = toIsoDate(new Date()),
		sorted = tasks.slice().sort(byDayTaskTime(iso)),
		shown = opts.compact ? sorted.slice(0, COMPACT_MAX_PER_DAY) : sorted;
	const hover = tasks.length > 0 && (opts.dotMode || !opts.compact),
		click = !!(opts.compact || opts.dotMode) && !!opts.onDayClick;
	return (
		<div
			class={`dashboard-calendar-cell${date.getMonth() === month ? '' : ' is-outside'}${iso === today ? ' is-today' : ''}${tasks.length ? ' has-tasks' : ''}${click ? ' is-clickable' : ''}`}
			onClick={() => {
				if (click) opts.onDayClick?.(iso);
			}}
			onMouseEnter={(event) => {
				if (hover) opts.onDayHover?.(iso, event.currentTarget);
			}}
			onMouseLeave={() => {
				if (hover) opts.onDayLeave?.();
			}}
			onFocus={(event) => {
				if (hover) opts.onDayHover?.(iso, event.currentTarget);
			}}
			onBlur={() => {
				if (hover) opts.onDayLeave?.();
			}}
		>
			<div
				class={`dashboard-calendar-cell-num${!opts.compact && !opts.dotMode && opts.onDayNumClick ? ' is-clickable' : ''}`}
				{...dayTrigger(iso, !opts.compact && !opts.dotMode ? opts.onDayNumClick : undefined)}
			>
				{date.getDate()}
			</div>
			{opts.dotMode ? (
				tasks.length > 0 && (
					<div
						class={`dashboard-calendar-cell-dot${tasks.every((task) => task.checked) ? ' is-done' : ''}`}
					/>
				)
			) : (
				<div class="dashboard-calendar-cell-list">
					{shown.map((task) => (
						<DayTask
							key={task.path + ':' + task.line}
							task={task}
							iso={iso}
							opts={opts}
							context={context}
						/>
					))}
					{opts.compact && sorted.length > COMPACT_MAX_PER_DAY && (
						<div class="dashboard-calendar-more">
							{t('calendar.moreCount', { count: sorted.length - COMPACT_MAX_PER_DAY })}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
function TaskBar({ bar, opts, context }: Omit<GridProps, 'byDay'> & { bar: BarEntry & { lane: number } }) {
	const { task } = bar,
		time = taskDayTime(task, bar.firstIso);
	const range = `${monthDayLabel(parseIso(task.start ?? bar.firstIso))}–${monthDayLabel(parseIso(task.end ?? bar.firstIso))}`;
	const label =
		t('calendar.barLabel', { task: task.text, range }) +
		(bar.contLeft ? ` · ${t('calendar.barContLeft')}` : '') +
		(bar.contRight ? ` · ${t('calendar.barContRight')}` : '');
	return (
		<div
			class={`dashboard-calendar-bar${task.checked ? ' is-done' : ''}${task.priority ? ` prio-${task.priority}` : ''}${bar.contLeft ? ' is-cont-left' : ''}${bar.contRight ? ' is-cont-right' : ''}`}
			style={{
				'--bar-cs': String(bar.fromCol + 1),
				'--bar-len': String(bar.len),
				'--bar-row': String(bar.lane + 1),
			}}
			{...dayTrigger(bar.firstIso, opts.onBarClick)}
			aria-label={label}
			title={task.text}
		>
			{time && <div class="dashboard-calendar-bar-time">{time}</div>}
			<div class="dashboard-calendar-bar-text">
				<InlineLinks text={task.text} app={opts.app} context={context} />
			</div>
		</div>
	);
}
function daysFrom(start: Date, count = 7) {
	return Array.from({ length: count }, (_, index) => {
		const date = new Date(start);
		date.setDate(start.getDate() + index);
		return { date, iso: toIsoDate(date) };
	});
}
export function MonthGrid({ year, month, byDay, opts, context }: GridProps & { year: number; month: number }) {
	const leading = (new Date(year, month, 1).getDay() + 6) % 7,
		days = daysFrom(new Date(year, month, 1 - leading), 42),
		bars = !opts.compact && !opts.dotMode;
	return (
		<div class={`dashboard-calendar${bars ? ' is-full' : ' is-compact'}`}>
			<div class="dashboard-calendar-weekdays">
				{weekdayLabels().map((label) => (
					<div key={label} class="dashboard-calendar-weekday">
						{label}
					</div>
				))}
			</div>
			<div class={`dashboard-calendar-body${bars ? ' dashboard-calendar-body--bars' : ''}`}>
				{!bars
					? days.map(({ date, iso }) => (
							<DayCell
								key={iso}
								date={date}
								month={month}
								tasks={byDay.get(iso) ?? []}
								opts={opts}
								context={context}
							/>
						))
					: Array.from({ length: 6 }, (_, index) => {
							const week = days.slice(index * 7, index * 7 + 7),
								spans = new Map<VaultTask, BarEntry>();
							for (const { iso, date } of week)
								for (const task of byDay.get(iso) ?? []) {
									if (spans.has(task)) continue;
									const span = calendarSpan(task);
									if (span && span.start !== span.end)
										spans.set(task, clampBarToWeek(task, span, date));
								}
							const packed = packBarLanes(Array.from(spans.values())),
								degraded = new Map(
									packed.filter((bar) => bar.lane === -1).map((bar) => [bar.task, bar.firstIso]),
								);
							return (
								<div key={week[0]!.iso} class="dashboard-calendar-week">
									<div
										class="dashboard-calendar-barlayer"
										style={{
											'--bar-lanes': String(Math.max(0, ...packed.map((bar) => bar.lane + 1))),
										}}
									>
										{packed
											.filter((bar) => bar.lane !== -1)
											.map((bar) => (
												<TaskBar
													key={bar.task.path + ':' + bar.task.line}
													bar={bar}
													opts={opts}
													context={context}
												/>
											))}
									</div>
									<div class="dashboard-calendar-week-days">
										{week.map(({ date, iso }) => (
											<DayCell
												key={iso}
												date={date}
												month={month}
												tasks={(byDay.get(iso) ?? []).filter(
													(task) => !spans.has(task) || degraded.get(task) === iso,
												)}
												opts={opts}
												context={context}
											/>
										))}
									</div>
								</div>
							);
						})}
			</div>
		</div>
	);
}
export function WeekGrid({ weekStart, byDay, opts, context }: GridProps & { weekStart: Date }) {
	const labels = weekdayLabels(),
		today = toIsoDate(new Date());
	return (
		<div class={`dashboard-calendar dashboard-calendar--week${opts.compact ? ' is-compact' : ' is-full'}`}>
			{daysFrom(weekStart).map(({ date, iso }, index) => {
				const tasks = (byDay.get(iso) ?? []).slice().sort(byDayTaskTime(iso)),
					shown = opts.compact ? tasks.slice(0, WEEK_COMPACT_MAX) : tasks;
				return (
					<div
						key={iso}
						class={`dashboard-calendar-week-row${iso === today ? ' is-today' : ''}${tasks.length ? ' has-tasks' : ''}`}
					>
						<div
							class={`dashboard-calendar-week-row-head${opts.compact && opts.onDayClick ? ' is-clickable' : ''}`}
							onClick={() => {
								if (opts.compact) opts.onDayClick?.(iso);
							}}
							onMouseEnter={(event) => {
								if (opts.compact && tasks.length) opts.onDayHover?.(iso, event.currentTarget);
							}}
							onMouseLeave={() => opts.onDayLeave?.()}
							onFocus={(event) => {
								if (opts.compact && tasks.length) opts.onDayHover?.(iso, event.currentTarget);
							}}
							onBlur={() => opts.onDayLeave?.()}
						>
							<div class="dashboard-calendar-week-row-namewrap">
								<div class="dashboard-calendar-week-row-name">{labels[index]}</div>
								<div class="dashboard-calendar-week-row-date">
									{date.getMonth() + 1}/{date.getDate()}
								</div>
							</div>
							{tasks.length > 0 && <div class="dashboard-calendar-week-row-count">{tasks.length}</div>}
						</div>
						<div class="dashboard-calendar-cell-list dashboard-calendar-week-row-list">
							{shown.map((task) => (
								<DayTask
									key={task.path + ':' + task.line}
									task={task}
									iso={iso}
									opts={{ ...opts, showTimes: true }}
									context={context}
								/>
							))}
							{opts.compact && tasks.length > WEEK_COMPACT_MAX && (
								<div class="dashboard-calendar-more">
									{t('calendar.moreCount', { count: tasks.length - WEEK_COMPACT_MAX })}
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
export function WeekTimeGrid({ weekStart, byDay, opts, context }: GridProps & { weekStart: Date }) {
	const now = new Date(),
		today = toIsoDate(now),
		labels = weekdayLabels(),
		days = daysFrom(weekStart),
		scroll = useRef<HTMLDivElement>(null);
	const timed = days.map(({ iso }) =>
		(byDay.get(iso) ?? []).flatMap((task) => {
			const time = taskDayTime(task, iso),
				start = hhmmToMin(time);
			if (start === undefined) return [];
			let end = hhmmToMin(task.endTime) ?? start + 60;
			if (end <= start) end = start + 30;
			return [{ task, time, start, end: Math.min(end, 1440) }];
		}),
	);
	const starts = timed.flat().map((event) => event.start),
		earliest = starts.length ? Math.max(0, Math.min(...starts) - 60) : 420;
	useLayoutEffect(() => {
		const element = scroll.current,
			win = element?.ownerDocument.defaultView;
		if (!element || !win) return;
		const id = win.requestAnimationFrame(() => {
			element.scrollTop = Math.round((earliest * TIMEGRID_HOUR_PX) / 60);
		});
		return () => win.cancelAnimationFrame(id);
	}, [weekStart.getTime()]);
	return (
		<div class="dashboard-calgrid">
			<div class="dashboard-calgrid-head">
				<div class="dashboard-calgrid-corner" />
				{days.map(({ date, iso }, index) => (
					<div
						key={iso}
						class={`dashboard-calgrid-dayhead${iso === today ? ' is-today' : ''}${opts.onDayNumClick ? ' is-clickable' : ''}`}
						{...dayTrigger(iso, opts.onDayNumClick)}
					>
						<div class="dashboard-calgrid-dayhead-wd">{labels[index]}</div>
						<div class="dashboard-calgrid-dayhead-date">
							{date.getMonth() + 1}/{date.getDate()}
						</div>
					</div>
				))}
			</div>
			<div class="dashboard-calgrid-allday">
				<div class="dashboard-calgrid-allday-corner">{t('calendar.allDay')}</div>
				{days.map(({ iso }) => {
					const tasks = (byDay.get(iso) ?? [])
						.filter((task) => !taskDayTime(task, iso))
						.sort(byDayTaskTime(iso));
					return (
						<div key={iso} class="dashboard-calgrid-allday-cell">
							{tasks.slice(0, 3).map((task) => (
								<div
									key={task.path + ':' + task.line}
									class={`dashboard-calgrid-allday-chip${task.checked ? ' is-done' : ''}${opts.onOpenNote ? ' is-jumpable' : ''}`}
									onClick={() => opts.onOpenNote?.(task.file, task.line)}
								>
									{task.text}
								</div>
							))}
							{tasks.length > 3 && <div class="dashboard-calgrid-allday-more">+{tasks.length - 3}</div>}
						</div>
					);
				})}
			</div>
			<div ref={scroll} class="dashboard-calgrid-scroll">
				<div class="dashboard-calgrid-body">
					<div class="dashboard-calgrid-hours">
						{Array.from({ length: 24 }, (_, hour) => (
							<div key={hour} class="dashboard-calgrid-hour">
								{String(hour).padStart(2, '0')}:00
							</div>
						))}
					</div>
					{days.map(({ iso }, index) => (
						<div key={iso} class={`dashboard-calgrid-daycol${iso === today ? ' is-today' : ''}`}>
							{timed[index]!.map(({ task, time, start, end }) => (
								<div
									key={task.path + ':' + task.line}
									class={`dashboard-calgrid-event${task.checked ? ' is-done' : ''}${task.priority ? ` prio-${task.priority}` : ''}${opts.onOpenNote ? ' is-jumpable' : ''}`}
									style={{
										top: Math.round((start * TIMEGRID_HOUR_PX) / 60),
										height: Math.max(Math.round(((end - start) * TIMEGRID_HOUR_PX) / 60), 20),
									}}
									onClick={(event) => {
										if (!(event.target as HTMLElement).closest('input, a'))
											opts.onOpenNote?.(task.file, task.line);
									}}
								>
									<div class="dashboard-calgrid-event-time">{time}</div>
									<div class="dashboard-calgrid-event-title">
										<InlineLinks text={task.text} app={opts.app} context={context} />
									</div>
									{!opts.compact && opts.onToggle && (
										<input
											class="dashboard-calgrid-event-check"
											type="checkbox"
											checked={task.checked}
											onClick={(event) => {
												event.preventDefault();
												event.stopPropagation();
												opts.onToggle?.(task, !task.checked);
											}}
										/>
									)}
								</div>
							))}
						</div>
					))}
					{days.some((day) => day.iso === today) && (
						<div
							class="dashboard-calgrid-nowline"
							style={{
								top: Math.round(((now.getHours() * 60 + now.getMinutes()) * TIMEGRID_HOUR_PX) / 60),
							}}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
