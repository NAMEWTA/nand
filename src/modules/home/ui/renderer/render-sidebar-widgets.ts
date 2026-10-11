import { App, Platform, TFile } from 'obsidian';
import { h } from 'preact';
import type { HolidayInfo } from '../../platform/calendar/holiday-service';
import type { PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import type { ReadingService } from '../../platform/reading/reading-service';
import { getLanguage, t } from '../../../../shared/i18n/index';
import { homeServices } from '../../services/instances';
import { effectiveBoardLayout } from '../../core/board/layout';
import type { DashboardData, DashboardSettings } from '../../core/board/types/model';
import type { BoardWidgetMember } from '../../core/board/types/model';
import { legacyBoardMembers, widgetPresentationKey } from '../../core/board/widget-members';
import { indexWidgetProviders, widgetProviderKey } from '../../core/board/widget-registry';
import { builtinHomeWidgets } from '../../contrib/widgets';
import type { DashboardSettingsAccess } from '../settings-access';
import { bindBuiltinWidgetEnvironment } from '../widgets/builtin-context';
import { mountWidgetHost } from '../widgets/WidgetHost';
import { WeekCalendarPanel } from '../widgets/WeekCalendarPanel';
import { RATIO_SPAN, buildStackedSpanSpecs, isTieredWidgetKey, resolveStackedSpans } from '../widgets/widget-span';
import { setupWidgetDnD } from './refresh-sidebar-weather-widget';
import { isAccentLight, mountDashboardPanel } from './render-context';

export function renderSidebarWeekCalendar(container: HTMLElement): void {
	const root =
		container.querySelector<HTMLElement>('.dashboard-sidebar-week-calendar') ??
		container.createDiv({ cls: 'dashboard-sidebar-week-calendar' });
	mountDashboardPanel(
		root,
		h(WeekCalendarPanel, { win: root.ownerDocument.defaultView!, accentLight: isAccentLight(container) }),
	);
}
/** Resolve each board independently; phone presentation is never persisted. */
export function isStackedLayout(data?: Pick<DashboardData, 'layout'> | null, settings?: Pick<DashboardSettings, 'layoutMode'>): boolean {
	return effectiveBoardLayout(data?.layout, settings?.layoutMode, Platform.isPhone) !== 'side';
}
export function sidebarWidgetSignature(
	settings: import('../../core/board/types/index').DashboardSettings,
	hasPomodoro: boolean,
	hasReading: boolean,
	hasHolidayData: boolean,
	quickActionsSig: string,
	stacked = isStackedLayout(undefined, settings),
): string {
	return JSON.stringify({
		// The stacked widget area has a different internal structure (quick
		// actions card pinned leftmost + column-major strip wrapper), so a
		// layout switch must rebuild rather than re-attach the previous mode's
		// DOM.
		stacked,
		registryRevision: homeServices.widgetRevision,
		weatherEnabled: settings.widgetWeatherEnabled,
		weatherCity: settings.widgetWeatherCity,
		weatherLat: settings.widgetWeatherLat,
		weatherLon: settings.widgetWeatherLon,
		pomodoroEnabled: settings.pomodoroEnabled,
		pomodoroLongBreakInterval: settings.pomodoroLongBreakInterval,
		lunarEnabled: settings.widgetLunarEnabled,
		yearProgressEnabled: settings.widgetYearProgressEnabled,
		calendarEnabled: settings.widgetCalendarEnabled,
		calendarExcludeFolders: settings.calendarExcludeFolders,
		habitEnabled: settings.widgetHabitEnabled,
		// Tier settings must break the reuse signature: they change the stacked
		// grid spans, which are written as inline CSS variables at build time.
		// (sidebarWidth / widgetUnitHeight deliberately stay OUT — those apply
		// as plain CSS variables on the outer sidebar every render and must not
		// churn the widgets DOM.)
		habitHeightRatio: settings.habitHeightRatio,
		readingHeightRatio: settings.readingHeightRatio,
		expenseEnabled: settings.widgetExpenseEnabled,
		expenseCurrency: settings.expenseCurrency,
		albums: settings.albums ?? [],
		quickActionsBackground: settings.quickActionsBackground,
		pomodoroBackground: settings.pomodoroBackground,
		habitBackground: settings.habitBackground,
		musicBackground: settings.musicBackground,
		yearProgressBackground: settings.yearProgressBackground,
		anniversaryEnabled: settings.anniversaryEnabled,
		anniversaries: settings.anniversaries ?? [],
		// Playlist content itself must NOT enter the signature: every add would
		// rebuild the whole widget area. The service subscription refreshes it
		// in place instead; only the enable flag matters here. Phones have no
		// sidebar widget area; tablets share the desktop layout.
		musicEnabled: settings.widgetMusicEnabled && !Platform.isPhone,
		countdownEnabled: settings.countdownEnabled,
		countdowns: settings.countdowns,
		readingEnabled: settings.readingEnabled,
		quickActionsEnabled: settings.widgetQuickActionsEnabled,
		// Quick buttons live inside the widget area now; their content (actions,
		// order, hidden presets) must break the reuse signature so add/remove/edit
		// rebuilds the area instead of re-attaching a stale quick-actions DOM.
		quickActionsSig,
		widgetOrder: settings.widgetOrder,
		hasPomodoro,
		hasReading,
		hasHolidayData,
		lang: getLanguage(),
	});
}
export function renderSidebarWidgets(
	container: HTMLElement,
	settings: DashboardSettings,
	app: App,
	pomodoroService?: PomodoroService,
	readingService?: ReadingService,
	holidayData?: Record<string, HolidayInfo>,
	onWidgetReorder?: (order: string[]) => void,
	reuse?: HTMLElement | null,
	onOpenNote?: (file: TFile, line?: number) => void,
	renderQuickActions?: (container: HTMLElement) => void,
	settingsAccess?: DashboardSettingsAccess,
	stacked = isStackedLayout(undefined, settings),
	board?: { path: string; members?: BoardWidgetMember[]; openSettings: () => void; renderSkills?: import('../widgets/builtin-context').BuiltinWidgetEnvironment['renderSkills'] },
): HTMLElement | null {
	const members = board?.members ?? legacyBoardMembers(settings, stacked, Platform.isPhone);
	if (!members.length) return null;
	if (reuse && !reuse.isConnected && reuse.childElementCount > 0 && reuse.dataset.layout === (stacked ? 'stacked' : 'side')) {
		container.appendChild(reuse);
		return reuse;
	}
	const widgetArea = container.createDiv({ cls: 'dashboard-sidebar-widgets' });
	widgetArea.dataset.layout = stacked ? 'stacked' : 'side';
	const index = homeServices.widgets ?? indexWidgetProviders([{ module: 'home', bundle: builtinHomeWidgets(() => settings, async (key, root, ctx) => {
		const ui = await import('../widgets/builtin-widgets');
		if (!ctx.signal.aborted) ui.renderBuiltinWidget(key, root, ctx);
	}) }]);
	for (const detail of index.errors) widgetArea.createDiv({ cls: 'nand-widget-status', text: t('home.widget.duplicate', { detail }), attr: { role: 'status' } });
	const host = stacked ? widgetArea.createDiv({ cls: 'dashboard-sidebar-widgets-row' }) : widgetArea;
	const keys = members.map(widgetPresentationKey);
	const spans = stacked ? resolveStackedSpans(buildStackedSpanSpecs(keys, { habit: settings.habitHeightRatio, reading: settings.readingHeightRatio, albums: settings.albums })) : null;
	for (const [i, member] of members.entries()) {
		const root = host.createDiv({ cls: 'dashboard-sidebar-widget-mount' });
		root.dataset.widgetKey = keys[i]!;
		root.dataset.widgetMember = member.memberId;
		if (spans && isTieredWidgetKey(keys[i]!)) root.style.setProperty('--db-widget-span', String(spans[i] ?? RATIO_SPAN.full));
		const descriptor = index.byKey.get(widgetProviderKey(member.provider, member.kind))?.kind;
		mountWidgetHost(root, member, descriptor, board?.path ?? settings.dashboardFile, board?.openSettings ?? (() => undefined), context => {
			bindBuiltinWidgetEnvironment(context, { app, settings, settingsAccess, pomodoro: pomodoroService, reading: readingService, holidayData, openNote: onOpenNote, renderQuickActions, renderSkills: board?.renderSkills });
		});
	}
	if (onWidgetReorder) setupWidgetDnD(widgetArea, members.map(member => member.memberId), onWidgetReorder, false);
	return widgetArea;
}
