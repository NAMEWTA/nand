import { Menu, Notice, Platform, type App, type TFile } from 'obsidian';
import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
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
import { Icon } from '../../../../ui/primitives/Icon';
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
	onOpenNote?: (file: TFile, line?: number) => void;
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
		[error, setError] = useState(false);
	const started = useRef(!widget || !Platform.isPhone || !!autoLoad),
		generation = useRef(0),
		alive = useRef(true);
	const preview = useDayPreview(app, context);
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
		if (started.current) void load();
		return () => {
			alive.current = false;
			generation.current++;
		};
	}, [load]);
	useLayoutEffect(() => {
		calendarReloaders.set(root, async (reset) => {
			if (!started.current) return;
			if (reset) {
				const now = new Date();
				setDate(now);
				setWeek(mondayOf(now));
				setView('month');
			}
			preview.close();
			await load();
		});
		return () => calendarReloaders.delete(root);
	}, [root, load]);
	useLayoutEffect(() => {
		preview.close();
	}, [date, week, view, byDay, filter]);
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
		!loaded && widget && !started.current
			? t('calendar.today')
			: view === 'week'
				? weekLabel(week)
				: monthLabel(date.getFullYear(), date.getMonth());
	return (
		<>
			<div class={`dashboard-calendar-nav${widget ? '' : ' dashboard-calendar-section-nav'}`}>
				<div class="dashboard-calendar-nav-btn" role="button" tabIndex={0} onClick={() => shift(-1)}>
					<Icon name="chevron-left" />
				</div>
				<div class="dashboard-calendar-nav-label">{label}</div>
				<div class="dashboard-calendar-nav-btn" role="button" tabIndex={0} onClick={() => shift(1)}>
					<Icon name="chevron-right" />
				</div>
				<div class="dashboard-library-view-toggle dashboard-calendar-view-toggle">
					{(widget ? ([view === 'month' ? 'week' : 'month'] as const) : (['month', 'week'] as const)).map(
						(next) => (
							<div
								key={next}
								class={`dashboard-library-view-btn${widget ? ' dashboard-calendar-view-btn' : view === next ? ' active' : ''}`}
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
							</div>
						),
					)}
				</div>
				{widget ? (
					<>
						<div class="dashboard-library-toolbar-spacer" />
						<button
							class="dashboard-calendar-today-btn"
							aria-label={t('calendar.fullscreen')}
							onClick={(event) => {
								event.stopPropagation();
								void load().then((indexed) => {
									if (alive.current && indexed) openFull?.(indexed, view, week, toggle);
								});
							}}
						>
							<Icon name="maximize-2" />
						</button>
					</>
				) : (
					<>
						<button
							type="button"
							class="dashboard-modal-btn dashboard-modal-btn--cancel"
							onClick={() => {
								const now = new Date();
								setDate(now);
								setWeek(mondayOf(now));
							}}
						>
							{t('calendar.today')}
						</button>
						<button
							type="button"
							class={`dashboard-modal-btn dashboard-modal-btn--cancel dashboard-calendar-filter-btn${filter === 'all' ? '' : ' is-filtered'}`}
							aria-haspopup="menu"
							aria-label={t('calendar.filter')}
							onClick={(event) => {
								const menu = new Menu();
								for (const next of CALENDAR_TASK_FILTERS)
									menu.addItem((item) =>
										item
											.setTitle(t(`calendar.filter.${next}`))
											.setChecked(next === filter)
											.onClick(() => {
												if (next !== filter)
													void writeCalendarTaskFilter(settingsAccess, next).then((saved) => {
														if (saved && alive.current) setFilter(next);
													});
											}),
									);
								const button = event.currentTarget;
								button.setAttribute('aria-expanded', 'true');
								menu.onHide(() => button.setAttribute('aria-expanded', 'false'));
								menu.showAtMouseEvent(event);
							}}
						>
							<span class="dashboard-calendar-filter-icon">
								<Icon name="filter" />
							</span>
							<span class="dashboard-calendar-filter-label">{t(`calendar.filter.${filter}`)}</span>
							<span class="dashboard-calendar-filter-caret">
								<Icon name="chevron-down" />
							</span>
						</button>
					</>
				)}
			</div>
			<div class={widget ? 'dashboard-calendar-host' : 'dashboard-calendar-section-body'}>
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
					<div class="dashboard-library-empty">{t('calendar.noEvents')}</div>
				) : widget && !started.current ? (
					<>
						<div class="dashboard-library-empty">{t('calendar.mobileManualLoad')}</div>
						<button
							class="dashboard-calendar-refresh-btn"
							type="button"
							aria-label={t('calendar.refresh')}
							onClick={(event) => {
								event.stopPropagation();
								void load();
							}}
						>
							<Icon name="rotate-cw" />
						</button>
					</>
				) : null}
			</div>
			{preview.content}
		</>
	);
}
