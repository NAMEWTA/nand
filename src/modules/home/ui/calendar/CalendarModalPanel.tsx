import { Choice } from '../board/controls';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/calendar-grid.ts
import { RecordButton as Button } from '../dialogs/RecordButton';
import { Checkbox } from '../../../../ui/components/checkbox';
import { Input } from '../../../../ui/components/input';
import { widgetClasses } from '../theme/widget-classes';
import type { App } from 'obsidian';
import type { ContentFile } from '../../../../host/obsidian/storage/content-files';

import { useLayoutEffect, useRef, useState } from 'react';
import {
	CALENDAR_TASK_FILTERS,
	filterTasksByDay,
	toIsoDate,
	type VaultTask,
} from '../../platform/calendar/alltasks-scan';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import { InlineLinks } from './CalendarLinks';
import type { DashboardRenderContext } from '../renderer/render-context';
import type { DashboardSettingsAccess } from '../settings-access';
import { MonthGrid, OriginMark, WeekTimeGrid } from './CalendarGrids';
import { byDayTaskTime, mondayOf, monthLabel, taskDayTime, weekLabel } from './calendar-layout';
import { readCalendarTaskFilter, writeCalendarTaskFilter } from './calendar-preferences';

export interface CalendarModalCallbacks {
	settingsAccess?: DashboardSettingsAccess;
	onToggle: (task: VaultTask, checked: boolean) => Promise<void> | void;
	onOpenNote?: (file: ContentFile, line?: number) => void;
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
	openDay,
	close,
}: CommonProps & {
	byDay: Map<string, VaultTask[]>;
	initialView: 'month' | 'week';
	close?: () => void;
	initialWeekStart?: Date;
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
		<div
			className={widgetClasses('dashboard-modal dashboard-calendar-fullscreen-inner h-auto min-h-full')}
			onKeyDown={(event) => {
				if ((event.target as HTMLElement).closest('input,textarea,[role=combobox]')) return;
				if (event.key === 'ArrowLeft') shift(-1);
				if (event.key === 'ArrowRight') shift(1);
			}}
		>
			<div className={widgetClasses('dashboard-modal-header dashboard-calendar-nav')}>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-calendar-nav-btn')}
					role="button"
					tabIndex={0}
					aria-label={t(view === 'week' ? 'calendar.previousWeek' : 'calendar.previousMonth')}
					onClick={() => shift(-1)}
				>
					<Icon name="chevron-left" />
				</Button>
				<div className={widgetClasses('dashboard-modal-title dashboard-calendar-nav-label')}>
					{view === 'week' ? weekLabel(week) : monthLabel(month.getFullYear(), month.getMonth())}
				</div>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-calendar-nav-btn')}
					role="button"
					tabIndex={0}
					aria-label={t(view === 'week' ? 'calendar.nextWeek' : 'calendar.nextMonth')}
					onClick={() => shift(1)}
				>
					<Icon name="chevron-right" />
				</Button>
				<div className={widgetClasses('dashboard-library-view-toggle dashboard-calendar-view-toggle')}>
					{(['month', 'week'] as const).map((value) => (
						<Button
							variant="ghost"
							key={value}
							role="button"
							tabIndex={0}
							className={widgetClasses(`dashboard-library-view-btn${view === value ? ' active' : ''}`)}
							aria-label={t(value === 'month' ? 'calendar.viewMonth' : 'calendar.viewWeek')}
							onClick={() => {
								setView(value);
								if (value === 'week') setWeek(mondayOf(new Date()));
							}}
						>
							<Icon name={value === 'month' ? 'calendar' : 'calendar-range'} />
						</Button>
					))}
				</div>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-modal-btn dashboard-modal-btn--cancel')}
					onClick={() => {
						const now = new Date();
						setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
						setWeek(mondayOf(now));
					}}
				>
					{t('calendar.today')}
				</Button>
				<Choice
					className={widgetClasses(
						`dashboard-modal-btn dashboard-modal-btn--cancel dashboard-calendar-filter-btn${filter === 'all' ? '' : ' is-filtered'}`,
					)}
					label={t('calendar.filter')}
					value={filter}
					options={CALENDAR_TASK_FILTERS.map((value) => ({ value, label: t(`calendar.filter.${value}`) }))}
					onChange={(value) => {
						void writeCalendarTaskFilter(actions.settingsAccess, value as typeof filter).then((saved) => {
							if (saved) setFilter(value as typeof filter);
						});
					}}
				/>
			</div>
			<Button
				variant="ghost"
				className="absolute right-2 top-2 size-6"
				aria-label={t('common.close')}
				onClick={close}
			>
				<Icon name="x" />
			</Button>
			<div
				className={widgetClasses(
					'dashboard-modal-body dashboard-calendar-fullscreen-body flex-none overflow-visible',
				)}
			>
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
	}, [focusInput]);
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
		<div className={widgetClasses('dashboard-modal dashboard-modal--compact')}>
			<div className={widgetClasses('dashboard-modal-header')}>
				<div className={widgetClasses('dashboard-modal-title')}>
					{iso} · {t('calendar.dayAgenda')}
				</div>
			</div>
			<div className={widgetClasses('dashboard-modal-body')}>
				<div className={widgetClasses('dashboard-cal-day-add')}>
					<Input
						className={widgetClasses('dashboard-modal-input dashboard-cal-day-add-time')}
						type="time"
						aria-label={t('calendar.taskTime')}
						value={time}
						onInput={(e) => setTime(e.currentTarget.value)}
					/>
					<Input
						ref={input}
						className={widgetClasses('dashboard-modal-input dashboard-cal-day-add-title')}
						type="text"
						placeholder={t('calendar.addTaskPlaceholder')}
						value={title}
						onInput={(e) => setTitle(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
								e.preventDefault();
								void add();
							}
						}}
					/>
					<Button
						variant="ghost"
						className={widgetClasses(
							'dashboard-modal-btn dashboard-modal-btn--confirm dashboard-cal-day-add-btn',
						)}
						disabled={busy}
						onClick={() => void add()}
					>
						{t('calendar.addTask')}
					</Button>
				</div>
				{tasks.length === 0 ? (
					<div className={widgetClasses('dashboard-library-empty')}>{t('calendar.noEvents')}</div>
				) : (
					<div className={widgetClasses('dashboard-alltasks-list')}>
						{[...tasks].sort(byDayTaskTime(iso)).map((task) => (
							<div
								key={`${task.path}:${task.line}`}
								className={widgetClasses(
									`dashboard-alltasks-row${task.checked ? ' is-done' : ''}${actions.onOpenNote ? ' is-jumpable' : ''}`,
								)}
								onClick={(e) => {
									const target = e.target as HTMLElement;
									if (
										!target.closest(
											'input,[role="checkbox"],a,[role="link"],.dashboard-alltasks-chip',
										)
									)
										actions.onOpenNote?.(task.file, task.line);
								}}
							>
								<Checkbox
									className={widgetClasses('dashboard-alltasks-check')}
									checked={task.checked}
									aria-label={task.text}
									onCheckedChange={() => void toggle(task)}
									onClick={(e) => {
										e.stopPropagation();
									}}
								/>
								{taskDayTime(task, iso) && (
									<div className={widgetClasses('dashboard-calendar-event-time')}>
										{taskDayTime(task, iso)}
									</div>
								)}
								<OriginMark task={task} iso={iso} />
								{task.priority && (
									<div
										className={widgetClasses(
											`dashboard-alltasks-prio dashboard-alltasks-prio--${task.priority}`,
										)}
									>
										{task.priority[0]?.toUpperCase()}
									</div>
								)}
								<div className={widgetClasses('dashboard-alltasks-body')}>
									<div className={widgetClasses('dashboard-alltasks-text')}>
										<InlineLinks text={task.text} app={app} context={context} />
									</div>
								</div>
								<div className={widgetClasses('dashboard-alltasks-source')}>
									<Button
										variant="ghost"
										className={widgetClasses('dashboard-alltasks-chip')}
										role="button"
										title={task.path}
										onClick={(e) => {
											e.stopPropagation();
											actions.onOpenNote?.(task.file, task.line);
										}}
									>
										{task.file.basename}
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
			<div className={widgetClasses('dashboard-modal-footer')}>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-modal-btn dashboard-modal-btn--cancel')}
					onClick={close}
				>
					{t('common.close')}
				</Button>
			</div>
		</div>
	);
}
