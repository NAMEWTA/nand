import type { App, TFile } from 'obsidian';
import { Menu } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
	CALENDAR_TASK_FILTERS,
	filterTasksByDay,
	toIsoDate,
	type VaultTask,
} from '../../../platform/obsidian/calendar/alltasks-scan';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { InlineLinks } from '../cards/InlineLinks';
import type { DashboardRenderContext } from '../renderer/render-context';
import type { DashboardSettingsAccess } from '../settings-access';
import { MonthGrid, OriginMark, WeekTimeGrid } from './CalendarGrids';
import { byDayTaskTime, mondayOf, monthLabel, taskDayTime, weekLabel } from './calendar-layout';
import { readCalendarTaskFilter, writeCalendarTaskFilter } from './calendar-preferences';

export interface CalendarModalCallbacks {
	settingsAccess?: DashboardSettingsAccess;
	onToggle: (task: VaultTask, checked: boolean) => Promise<void> | void;
	onOpenNote?: (file: TFile, line?: number) => void;
}
interface CommonProps {
	app: App;
	context: DashboardRenderContext;
	actions: CalendarModalCallbacks;
}
export function CalendarModalPanel({
	app,
	context,
	actions,
	byDay,
	initialView,
	initialWeekStart,
	registerShift,
	openDay,
}: CommonProps & {
	byDay: Map<string, VaultTask[]>;
	initialView: 'month' | 'week';
	initialWeekStart?: Date;
	registerShift: (callback: ((delta: number) => void) | null) => void;
	openDay: (iso: string, tasks: VaultTask[], focus: boolean) => void;
}) {
	const [view, setView] = useState(initialView);
	const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
	const [week, setWeek] = useState(() => initialWeekStart ?? mondayOf(new Date()));
	const [filter, setFilter] = useState(() => readCalendarTaskFilter(actions.settingsAccess));
	const [, refresh] = useState(0);
	const pending = useRef(new Set<VaultTask>());
	const shift = (delta: number) =>
		view === 'week'
			? setWeek((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta * 7))
			: setMonth((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
	useLayoutEffect(() => {
		registerShift(shift);
		return () => registerShift(null);
	}, [view]);
	const days = filterTasksByDay(byDay, filter, toIsoDate(new Date()));
	const opts = {
		compact: false,
		app,
		onOpenNote: actions.onOpenNote,
		onToggle: (task: VaultTask, next: boolean) => {
			if (pending.current.has(task)) return;
			pending.current.add(task);
			void Promise.resolve()
				.then(() => actions.onToggle(task, next))
				.then(() => {
					task.checked = next;
					refresh((n) => n + 1);
				})
				.catch((error) => console.error('[Dashboard] calendar toggle failed', error))
				.finally(() => pending.current.delete(task));
		},
		onBarClick: (iso: string) => openDay(iso, days.get(iso) ?? [], false),
		onDayNumClick: (iso: string) => openDay(iso, days.get(iso) ?? [], true),
	};
	return (
		<div class="dashboard-modal dashboard-calendar-fullscreen-inner">
			<div class="dashboard-modal-header dashboard-calendar-nav">
				<div class="dashboard-calendar-nav-btn" role="button" tabIndex={0} onClick={() => shift(-1)}>
					<Icon name="chevron-left" />
				</div>
				<div class="dashboard-modal-title dashboard-calendar-nav-label">
					{view === 'week' ? weekLabel(week) : monthLabel(month.getFullYear(), month.getMonth())}
				</div>
				<div class="dashboard-calendar-nav-btn" role="button" tabIndex={0} onClick={() => shift(1)}>
					<Icon name="chevron-right" />
				</div>
				<div class="dashboard-library-view-toggle dashboard-calendar-view-toggle">
					{(['month', 'week'] as const).map((value) => (
						<div
							key={value}
							role="button"
							tabIndex={0}
							class={`dashboard-library-view-btn${view === value ? ' active' : ''}`}
							aria-label={t(value === 'month' ? 'calendar.viewMonth' : 'calendar.viewWeek')}
							onClick={() => {
								setView(value);
								if (value === 'week') setWeek(mondayOf(new Date()));
							}}
						>
							<Icon name={value === 'month' ? 'calendar' : 'calendar-range'} />
						</div>
					))}
				</div>
				<button
					class="dashboard-modal-btn dashboard-modal-btn--cancel"
					onClick={() => {
						const now = new Date();
						setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
						setWeek(mondayOf(now));
					}}
				>
					{t('calendar.today')}
				</button>
				<button
					class={`dashboard-modal-btn dashboard-modal-btn--cancel dashboard-calendar-filter-btn${filter === 'all' ? '' : ' is-filtered'}`}
					aria-haspopup="menu"
					aria-label={t('calendar.filter')}
					onClick={(event) => {
						const anchor = event.currentTarget;
						const menu = new Menu();
						for (const value of CALENDAR_TASK_FILTERS)
							menu.addItem((item) =>
								item
									.setTitle(t(`calendar.filter.${value}`))
									.setChecked(filter === value)
									.onClick(async () => {
										if (await writeCalendarTaskFilter(actions.settingsAccess, value))
											setFilter(value);
									}),
							);
						anchor.setAttribute('aria-expanded', 'true');
						menu.onHide(() => anchor.setAttribute('aria-expanded', 'false'));
						menu.showAtMouseEvent(event);
					}}
				>
					<Icon name="filter" />
					<span class="dashboard-calendar-filter-label">{t(`calendar.filter.${filter}`)}</span>
					<Icon className="dashboard-calendar-filter-caret" name="chevron-down" />
				</button>
			</div>
			<div class="dashboard-modal-body dashboard-calendar-fullscreen-body">
				{view === 'week' ? (
					<WeekTimeGrid weekStart={week} byDay={days} opts={opts} context={context} />
				) : (
					<MonthGrid
						year={month.getFullYear()}
						month={month.getMonth()}
						byDay={days}
						opts={opts}
						context={context}
					/>
				)}
			</div>
		</div>
	);
}
export function DayAgendaPanel({
	app,
	context,
	actions,
	iso,
	tasks: initialTasks,
	focusInput,
	addTask,
	close,
}: CommonProps & {
	iso: string;
	tasks: VaultTask[];
	focusInput: boolean;
	addTask: (title: string, time: string) => Promise<VaultTask | null>;
	close: () => void;
}) {
	const [tasks, setTasks] = useState(initialTasks);
	const [title, setTitle] = useState('');
	const [time, setTime] = useState('');
	const [busy, setBusy] = useState(false);
	const adding = useRef(false);
	const pending = useRef(new Set<VaultTask>());
	const input = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		if (focusInput) input.current?.focus();
	}, []);
	const add = async () => {
		if (!title.trim() || adding.current) return;
		adding.current = true;
		setBusy(true);
		try {
			const task = await addTask(title.trim(), time);
			if (task) {
				setTasks((items) => [...items, task]);
				setTitle('');
				setTime('');
				input.current?.focus();
			}
		} finally {
			adding.current = false;
			setBusy(false);
		}
	};
	const toggle = async (task: VaultTask) => {
		if (pending.current.has(task)) return;
		pending.current.add(task);
		try {
			const next = !task.checked;
			await actions.onToggle(task, next);
			task.checked = next;
			setTasks((items) => [...items]);
		} catch (error) {
			console.error('[Dashboard] calendar toggle failed', error);
		} finally {
			pending.current.delete(task);
		}
	};
	return (
		<div class="dashboard-modal dashboard-modal--compact">
			<div class="dashboard-modal-header">
				<div class="dashboard-modal-title">
					{iso} · {t('calendar.dayAgenda')}
				</div>
			</div>
			<div class="dashboard-modal-body">
				<div class="dashboard-cal-day-add">
					<input
						class="dashboard-modal-input dashboard-cal-day-add-time"
						type="time"
						aria-label={t('calendar.taskTime')}
						value={time}
						onInput={(e) => setTime(e.currentTarget.value)}
					/>
					<input
						ref={input}
						class="dashboard-modal-input dashboard-cal-day-add-title"
						type="text"
						placeholder={t('calendar.addTaskPlaceholder')}
						value={title}
						onInput={(e) => setTitle(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.isComposing) {
								e.preventDefault();
								void add();
							}
						}}
					/>
					<button
						class="dashboard-modal-btn dashboard-modal-btn--confirm dashboard-cal-day-add-btn"
						disabled={busy}
						onClick={() => void add()}
					>
						{t('calendar.addTask')}
					</button>
				</div>
				{tasks.length === 0 ? (
					<div class="dashboard-library-empty">{t('calendar.noEvents')}</div>
				) : (
					<div class="dashboard-alltasks-list">
						{[...tasks].sort(byDayTaskTime(iso)).map((task) => (
							<div
								key={`${task.path}:${task.line}`}
								class={`dashboard-alltasks-row${task.checked ? ' is-done' : ''}${actions.onOpenNote ? ' is-jumpable' : ''}`}
								onClick={(e) => {
									const target = e.target as HTMLElement;
									if (!target.closest('input,a,[role="link"],.dashboard-alltasks-chip'))
										actions.onOpenNote?.(task.file, task.line);
								}}
							>
								<input
									class="dashboard-alltasks-check"
									type="checkbox"
									checked={task.checked}
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										void toggle(task);
									}}
								/>
								{taskDayTime(task, iso) && (
									<div class="dashboard-calendar-event-time">{taskDayTime(task, iso)}</div>
								)}
								<OriginMark task={task} iso={iso} />
								{task.priority && (
									<div class={`dashboard-alltasks-prio dashboard-alltasks-prio--${task.priority}`}>
										{task.priority[0]?.toUpperCase()}
									</div>
								)}
								<div class="dashboard-alltasks-body">
									<div class="dashboard-alltasks-text">
										<InlineLinks text={task.text} app={app} context={context} />
									</div>
								</div>
								<div class="dashboard-alltasks-source">
									<div
										class="dashboard-alltasks-chip"
										role="button"
										title={task.path}
										onClick={(e) => {
											e.stopPropagation();
											actions.onOpenNote?.(task.file, task.line);
										}}
									>
										{task.file.basename}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
			<div class="dashboard-modal-footer">
				<button class="dashboard-modal-btn dashboard-modal-btn--cancel" onClick={close}>
					{t('common.close')}
				</button>
			</div>
		</div>
	);
}
