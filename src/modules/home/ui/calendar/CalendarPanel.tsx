import { Choice } from '../board/controls';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/calendar-grid.ts
import { RecordButton as Button } from '../dialogs/RecordButton';
import { widgetClasses } from '../theme/widget-classes';
import { Notice, Platform, type App } from 'obsidian';
import { contentFiles, type ContentFile } from '../../../../host/obsidian/storage/content-files';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CalendarTaskFilter } from '../../core/calendar/task-filter';
import type { DashboardSettings } from '../../core/board/types/index';
import {
	CALENDAR_TASK_FILTERS,
	collectVaultTasks,
	filterTasksByDay,
	indexTasksByDay,
	invalidatePath,
	isCalendarRelevant,
	toggleTaskInFile,
	toIsoDate,
	type VaultTask,
} from '../../platform/calendar/alltasks-scan';
import { t } from '../../../../shared/i18n/index';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import type { DashboardRenderContext } from '../renderer/render-context';
import type { DashboardSettingsAccess } from '../settings-access';
import { MonthGrid, WeekGrid, WeekTimeGrid } from './CalendarGrids';
import { useDayPreview } from './DayPreview';
import { mondayOf, monthLabel, weekLabel } from './calendar-layout';
import { readCalendarTaskFilter, writeCalendarTaskFilter } from './calendar-preferences';
import { calendarReloaders } from './calendar-reload';
export interface CalendarPanelProps {
	root: HTMLElement;
	context: DashboardRenderContext;
	app: App;
	settings: DashboardSettings;
	settingsAccess?: DashboardSettingsAccess;
	widget?: boolean;
	autoLoad?: boolean;
	onOpenNote?: (file: ContentFile, line?: number) => void;
	openDay: (
		iso: string,
		tasks: VaultTask[],
		focus: boolean,
		toggle: (task: VaultTask, checked: boolean) => Promise<void>,
	) => void;
	openFull?: (
		byDay: Map<string, VaultTask[]>,
		view: 'month' | 'week',
		weekStart: Date,
		toggle: (task: VaultTask, checked: boolean) => Promise<void>,
	) => void;
}
export function CalendarPanel({
	root,
	context,
	app,
	settings,
	settingsAccess,
	widget = false,
	autoLoad,
	onOpenNote,
	openDay,
	openFull,
}: CalendarPanelProps) {
	const [date, setDate] = useState(new Date()),
		[week, setWeek] = useState(() => mondayOf(new Date())),
		[view, setView] = useState<'month' | 'week'>('month');
	const [filter, setFilter] = useState<CalendarTaskFilter>(() => readCalendarTaskFilter(settingsAccess));
	const [byDay, setByDay] = useState(new Map<string, VaultTask[]>()),
		[loaded, setLoaded] = useState(false),
		[error, setError] = useState(false),
		[hasStarted, setHasStarted] = useState(!widget || !Platform.isPhone || !!autoLoad);
	const started = useRef(!widget || !Platform.isPhone || !!autoLoad),
		generation = useRef(0),
		alive = useRef(true);
	const preview = useDayPreview(app, context),
		closePreview = preview.close;
	const excludeKey = JSON.stringify(settings.calendarExcludeFolders ?? []);
	const load = useCallback(async () => {
		started.current = true;

		const version = ++generation.current;
		try {
			const tasks = await collectVaultTasks(app, JSON.parse(excludeKey) as string[], settings.dashboardFile);
			if (!alive.current || version !== generation.current) return;
			const indexed = indexTasksByDay(tasks.filter(isCalendarRelevant));
			setByDay(indexed);
			setLoaded(true);
			setHasStarted(true);
			setError(false);
			return indexed;
		} catch (error) {
			if (alive.current && version === generation.current) {
				setError(true);
				console.error('[Dashboard] calendar scan failed:', error);
			}
		}
		return undefined;
	}, [app, excludeKey, settings.dashboardFile]);
	useLayoutEffect(() => {
		alive.current = true;
		if (started.current) void Promise.resolve().then(load);
		return () => {
			alive.current = false;
		};
	}, [load]);
	useLayoutEffect(
		() =>
			contentFiles(app).subscribe((event) => {
				if (event.path.endsWith('.md') && started.current) void load();
			}),
		[app, load],
	);
	useLayoutEffect(() => {
		calendarReloaders.set(root, async (reset) => {
			if (!started.current) return;
			if (reset) {
				const now = new Date();
				setDate(now);
				setWeek(mondayOf(now));
				setView('month');
			}
			closePreview();
			await load();
		});
		return () => {
			calendarReloaders.delete(root);
		};
	}, [root, load, closePreview]);
	useLayoutEffect(() => {
		closePreview();
	}, [date, week, view, byDay, filter, closePreview]);
	const visible = widget ? byDay : filterTasksByDay(byDay, filter, toIsoDate(new Date()));
	const toggle = async (task: VaultTask, checked: boolean) => {
		try {
			await toggleTaskInFile(app, task, checked);
			invalidatePath(app, task.path);
			task.checked = checked;
			if (alive.current) setByDay((previous) => new Map(previous));
		} catch (error) {
			new Notice(t('alltasks.toggleFailed'));
			throw error;
		}
	};
	const gridOptions = {
		compact: widget,
		app,
		onOpenNote,
		onToggle: (task: VaultTask, checked: boolean) => {
			void toggle(task, checked).catch(() => {});
		},
		onDayClick: (iso: string) => openDay(iso, visible.get(iso) ?? [], false, toggle),
		onBarClick: (iso: string) => openDay(iso, visible.get(iso) ?? [], false, toggle),
		onDayNumClick: (iso: string) => openDay(iso, visible.get(iso) ?? [], true, toggle),
		onDayHover: Platform.isMobile
			? undefined
			: (iso: string, anchor: HTMLElement) => {
					const tasks = visible.get(iso) ?? [];
					if (tasks.length) preview.hover(anchor, iso, tasks);
				},
		onDayLeave: () => preview.close(),
	};
	const shift = (delta: number) => {
		if (view === 'week')
			setWeek((value) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + delta * 7));
		else setDate((value) => new Date(value.getFullYear(), value.getMonth() + delta, 1));
		if (!loaded) void load();
	};
	const switchView = (next: 'month' | 'week') => {
		setView(next);
		if (next === 'week') setWeek(mondayOf(new Date()));
		if (!loaded) void load();
	};
	const label =
		!loaded && widget && !hasStarted
			? t('calendar.today')
			: view === 'week'
				? weekLabel(week)
				: monthLabel(date.getFullYear(), date.getMonth());
	return (
		<>
			<div className={widgetClasses(`dashboard-calendar-nav${widget ? '' : ' dashboard-calendar-section-nav'}`)}>
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
				<div className={widgetClasses('dashboard-calendar-nav-label')}>{label}</div>
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
					{(widget ? ([view === 'month' ? 'week' : 'month'] as const) : (['month', 'week'] as const)).map(
						(next) => (
							<Button
								variant="ghost"
								key={next}
								className={widgetClasses(
									`dashboard-library-view-btn${widget ? ' dashboard-calendar-view-btn' : view === next ? ' active' : ''}`,
								)}
								role="button"
								tabIndex={0}
								aria-label={t(
									widget
										? next === 'week'
											? 'calendar.switchToWeek'
											: 'calendar.switchToMonth'
										: next === 'week'
											? 'calendar.viewWeek'
											: 'calendar.viewMonth',
								)}
								onClick={(event) => {
									event.stopPropagation();
									switchView(next);
								}}
							>
								<Icon name={next === 'week' ? 'calendar-range' : 'calendar'} />
							</Button>
						),
					)}
				</div>
				{widget ? (
					<>
						<div className={widgetClasses('dashboard-library-toolbar-spacer')} />
						<Button
							variant="ghost"
							className={widgetClasses('dashboard-calendar-today-btn')}
							aria-label={t('calendar.fullscreen')}
							onClick={(event) => {
								event.stopPropagation();
								void load().then((indexed) => {
									if (alive.current && indexed) openFull?.(indexed, view, week, toggle);
								});
							}}
						>
							<Icon name="maximize-2" />
						</Button>
					</>
				) : (
					<>
						<Button
							variant="ghost"
							type="button"
							className={widgetClasses('dashboard-modal-btn dashboard-modal-btn--cancel')}
							onClick={() => {
								const now = new Date();
								setDate(now);
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
							options={CALENDAR_TASK_FILTERS.map((value) => ({
								value,
								label: t(`calendar.filter.${value}`),
							}))}
							onChange={(value) => {
								void writeCalendarTaskFilter(settingsAccess, value as typeof filter).then((saved) => {
									if (saved) setFilter(value as typeof filter);
								});
							}}
						/>
					</>
				)}
			</div>
			<div className={widgetClasses(widget ? 'dashboard-calendar-host' : 'dashboard-calendar-section-body')}>
				{loaded ? (
					view === 'month' ? (
						<MonthGrid
							year={date.getFullYear()}
							month={date.getMonth()}
							byDay={visible}
							opts={{ ...gridOptions, dotMode: widget }}
							context={context}
						/>
					) : widget ? (
						<WeekGrid weekStart={week} byDay={visible} opts={gridOptions} context={context} />
					) : (
						<WeekTimeGrid weekStart={week} byDay={visible} opts={gridOptions} context={context} />
					)
				) : error ? (
					<div className={widgetClasses('dashboard-library-empty')}>{t('calendar.noEvents')}</div>
				) : widget && !hasStarted ? (
					<>
						<div className={widgetClasses('dashboard-library-empty')}>{t('calendar.mobileManualLoad')}</div>
						<Button
							variant="ghost"
							className={widgetClasses('dashboard-calendar-refresh-btn')}
							type="button"
							aria-label={t('calendar.refresh')}
							onClick={(event) => {
								event.stopPropagation();
								void load();
							}}
						>
							<Icon name="rotate-cw" />
						</Button>
					</>
				) : null}
			</div>
			{preview.content}
		</>
	);
}
