import { App, Platform, TFile } from 'obsidian';
import { h } from 'preact';
import type { HolidayInfo } from '../../platform/calendar/holiday-service';
import type { PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import type { ReadingService } from '../../platform/reading/reading-service';
import { getLanguage } from '../../../../shared/i18n/index';
import { renderSidebarCalendar } from '../calendar/calendar-widget';
import { renderSidebarExpenseWidget } from '../expense/expense-widget';
import { renderSidebarHabitWidget } from '../habit/habit-widget';
import { renderSidebarMusicWidget } from '../music/music-widget';
import type { DashboardSettingsAccess } from '../settings-access';
import { renderSidebarAlbumWidget } from '../widgets/album-widget';
import { renderSidebarAnniversaryWidget } from '../widgets/anniversary-widget';
import { renderSidebarLunarWidget } from '../widgets/lunar-widget';
import { WeekCalendarPanel } from '../widgets/WeekCalendarPanel';
import { appendInlineBackgroundButton, applyWidgetBackground } from '../widgets/widget-background';
import { RATIO_SPAN, buildStackedSpanSpecs, isTieredWidgetKey, resolveStackedSpans } from '../widgets/widget-span';
import { renderSidebarYearProgress } from '../widgets/year-progress-widget';
import {
	renderSidebarPomodoro,
	renderSidebarWeather,
	setupWidgetDnD,
	sortByOrder,
} from './refresh-sidebar-weather-widget';
import { isAccentLight, mountDashboardPanel } from './render-context';
import { renderSidebarCountdown, renderSidebarReading } from './render-sidebar-countdown';

export function renderSidebarWeekCalendar(container: HTMLElement): void {
	const root =
		container.querySelector<HTMLElement>('.dashboard-sidebar-week-calendar') ??
		container.createDiv({ cls: 'dashboard-sidebar-week-calendar' });
	mountDashboardPanel(
		root,
		h(WeekCalendarPanel, { win: root.ownerDocument.defaultView!, accentLight: isAccentLight(container) }),
	);
}
/** Boards use the stacked layout everywhere except phones (their own mobile layout). */
export function isStackedLayout(): boolean {
	return !Platform.isPhone;
}
export function sidebarWidgetSignature(
	settings: import('../../core/board/types/index').DashboardSettings,
	hasPomodoro: boolean,
	hasReading: boolean,
	hasHolidayData: boolean,
	quickActionsSig: string,
): string {
	return JSON.stringify({
		// The stacked widget area has a different internal structure (quick
		// actions card pinned leftmost + column-major strip wrapper), so a
		// layout switch must rebuild rather than re-attach the previous mode's
		// DOM.
		stacked: isStackedLayout(),
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
function saveSingletonBackground(
	settingsAccess: DashboardSettingsAccess | undefined,
	key:
		| 'quickActionsBackground'
		| 'pomodoroBackground'
		| 'habitBackground'
		| 'musicBackground'
		| 'yearProgressBackground',
	bg: import('../../core/board/types/index').WidgetBackground | undefined,
): void {
	void settingsAccess?.updateSettings((current) => ({ ...current, [key]: bg }));
}
export function renderSidebarWidgets(
	container: HTMLElement,
	settings: import('../../core/board/types/index').DashboardSettings,
	app: App,
	pomodoroService?: PomodoroService,
	readingService?: ReadingService,
	holidayData?: Record<string, HolidayInfo>,
	onWidgetReorder?: (order: string[]) => void,
	reuse?: HTMLElement | null,
	onOpenNote?: (file: TFile, line?: number) => void,
	renderQuickActions?: (container: HTMLElement) => void,
	settingsAccess?: DashboardSettingsAccess,
): HTMLElement | null {
	const anyEnabled =
		settings.widgetWeatherEnabled ||
		settings.pomodoroEnabled ||
		settings.widgetLunarEnabled ||
		settings.widgetYearProgressEnabled ||
		settings.widgetCalendarEnabled ||
		settings.widgetHabitEnabled ||
		settings.widgetExpenseEnabled ||
		(settings.albums?.length ?? 0) > 0 ||
		(settings.anniversaryEnabled && (settings.anniversaries?.length ?? 0) > 0) ||
		(settings.countdownEnabled && (settings.countdowns?.length ?? 0) > 0) ||
		settings.readingEnabled ||
		(settings.widgetQuickActionsEnabled && !!renderQuickActions) ||
		(settings.widgetMusicEnabled && !Platform.isPhone);
	if (!anyEnabled) return null;

	const stacked = isStackedLayout();
	// Unchanged inputs: keep the previous DOM (and its live timers/listeners).
	// The layout marker check is local defense-in-depth on top of the caller's
	// signature gate: a side-built area (flat children) must never re-attach
	// into a stacked render (strip wrapper expected) or vice versa, even if a
	// future caller forgets to include the layout in its signature.
	if (
		reuse &&
		reuse.isConnected === false &&
		reuse.childElementCount > 0 &&
		reuse.dataset.layout === (stacked ? 'stacked' : 'side')
	) {
		container.appendChild(reuse);
		return reuse;
	}

	const widgetArea = container.createDiv({ cls: 'dashboard-sidebar-widgets' });
	widgetArea.dataset.layout = stacked ? 'stacked' : 'side';

	const DEFAULT_ORDER = [
		'quickActions',
		'lunar',
		'weather',
		'pomodoro',
		'reading',
		'countdown',
		'anniversary',
		'yearProgress',
		'calendar',
		'habit',
		'expense',
		'album',
		'music',
	];
	const order = settings.widgetOrder?.length ? settings.widgetOrder : DEFAULT_ORDER;

	type WidgetEntry = { key: string; render: (host: HTMLElement) => void };
	const enabled: WidgetEntry[] = [];
	if (settings.widgetQuickActionsEnabled && renderQuickActions) {
		const renderQuick = renderQuickActions;
		enabled.push({
			key: 'quickActions',
			render: (host) => {
				renderQuick(host);
			},
		});
	}
	if (settings.widgetLunarEnabled) {
		enabled.push({ key: 'lunar', render: (host) => renderSidebarLunarWidget(host, holidayData ?? {}, app) });
	}
	if (settings.widgetYearProgressEnabled) {
		enabled.push({
			key: 'yearProgress',
			render: (host) =>
				renderSidebarYearProgress(host, settings.yearProgressBackground, app, (bg) =>
					saveSingletonBackground(settingsAccess, 'yearProgressBackground', bg),
				),
		});
	}
	if (settings.widgetCalendarEnabled) {
		enabled.push({
			key: 'calendar',
			render: (host) => renderSidebarCalendar(host, settings, app, onOpenNote, undefined, settingsAccess),
		});
	}
	if (settings.widgetWeatherEnabled) {
		enabled.push({ key: 'weather', render: (host) => renderSidebarWeather(host, settings, app) });
	}
	if (settings.pomodoroEnabled && pomodoroService) {
		enabled.push({
			key: 'pomodoro',
			render: (host) =>
				renderSidebarPomodoro(host, pomodoroService, settings, app, (bg) =>
					saveSingletonBackground(settingsAccess, 'pomodoroBackground', bg),
				),
		});
	}
	if (settings.readingEnabled && readingService) {
		enabled.push({ key: 'reading', render: (host) => renderSidebarReading(host, readingService) });
	}
	if (settings.widgetHabitEnabled) {
		enabled.push({
			key: 'habit',
			render: (host) =>
				renderSidebarHabitWidget(host, app, settings.habitBackground, (bg) =>
					saveSingletonBackground(settingsAccess, 'habitBackground', bg),
				),
		});
	}
	if (settings.widgetExpenseEnabled) {
		enabled.push({ key: 'expense', render: (host) => renderSidebarExpenseWidget(host, app) });
	}
	// Multiple album widgets: one card per albums[] entry, keyed album-<id>.
	// renderSidebarAlbumWidget reads the flat widgetAlbum* fields, so each entry
	// renders through a per-album settings shim (spread — never mutated).
	for (const cfg of settings.albums ?? []) {
		const ref = cfg;
		enabled.push({
			key: `album-${ref.id}`,
			render: (host) =>
				renderSidebarAlbumWidget(
					host,
					{
						...settings,
						widgetAlbumFolder: ref.folder,
						widgetAlbumIntervalSec: ref.intervalSec,
						widgetAlbumRecursive: ref.recursive,
						widgetAlbumRatio: ref.ratio,
						widgetAlbumTransition: ref.transition,
					},
					app,
				),
		});
	}
	// Anniversary widgets: one card per anniversaries[] entry, keyed
	// anniversary-<id> (the countdown multi-instance pattern).
	if (settings.anniversaryEnabled) {
		for (const cfg of settings.anniversaries ?? []) {
			const ref = cfg;
			enabled.push({
				key: `anniversary-${ref.id}`,
				render: (host) =>
					renderSidebarAnniversaryWidget(host, ref, app, (updated) => {
						void settingsAccess?.updateSettings((current) => ({
							...current,
							anniversaries: current.anniversaries.map((a) => (a.id === updated.id ? updated : a)),
						}));
					}),
			});
		}
	}
	if (settings.widgetMusicEnabled && !Platform.isPhone) {
		enabled.push({
			key: 'music',
			render: (host) =>
				renderSidebarMusicWidget(host, settings.musicBackground, app, (bg) =>
					saveSingletonBackground(settingsAccess, 'musicBackground', bg),
				),
		});
	}
	if (settings.countdownEnabled) {
		for (const cd of settings.countdowns ?? []) {
			const cdRef = cd;
			enabled.push({
				key: `countdown-${cd.id}`,
				render: (host) => renderSidebarCountdown(host, cdRef, app, settingsAccess),
			});
		}
	}

	const ordered = sortByOrder(enabled, order);

	// Stacked mode: quick actions is a regular card in the strip grid, always
	// FIRST in the build order = leftmost column (it also exits the reorder
	// system there, so the pinned position is deterministic). The saved drag
	// order is untouched and still rules the side layout. The strip wrapper is
	// created lazily on the first widget, so an empty enable set never gets a
	// stray container.
	const buildOrder = stacked
		? [...ordered.filter((e) => e.key === 'quickActions'), ...ordered.filter((e) => e.key !== 'quickActions')]
		: ordered;
	let stripRow: HTMLElement | null = null;
	const hostFor = (_key: string): HTMLElement => {
		if (!stacked) return widgetArea;
		stripRow ??= widgetArea.createDiv({ cls: 'dashboard-sidebar-widgets-row' });
		return stripRow;
	};

	// Stacked-mode height ratios: rows of the 6-row widget grid per fraction.
	const albumById = new Map((settings.albums ?? []).map((a) => [String(a.id), a]));
	// Adaptive column packing ("首选档 + 放不下自动换挡"): simulate the sparse
	// column-first grid over the DOM order and resolve each TIERED card's
	// span (habit / reading / album-*). Fixed cards keep their hardcoded
	// per-type CSS spans; tiered cards get the resolved span inline as
	// --db-widget-span, which their CSS rule reads with a historical fallback.
	const spans = stacked
		? resolveStackedSpans(
				buildStackedSpanSpecs(
					buildOrder.map((e) => e.key),
					{
						// Explicit mapping: the settings field names (habitHeightRatio)
						// differ from the StackedRatios shape, and a whole-settings pass
						// would type-check (all-optional interface) while silently reading
						// undefined -> default tiers.
						habit: settings.habitHeightRatio,
						reading: settings.readingHeightRatio,
						albums: settings.albums,
					},
				),
			)
		: null;

	for (let i = 0; i < buildOrder.length; i++) {
		const { key, render } = buildOrder[i]!;
		const host = hostFor(key);
		const childCount = host.children.length;
		render(host);
		const el = host.children[childCount] as HTMLElement | undefined;
		if (el) {
			el.dataset.widgetKey = key;
			// The quick-actions section carries its own section classes; give it
			// the widget class too so it joins the drag-to-reorder system.
			if (key === 'quickActions') {
				el.addClass('dashboard-sidebar-widget');
				// Card background + config gear INSIDE the header's button group
				// (left of palette/add) — a corner button would overlap them.
				applyWidgetBackground(el, settings.quickActionsBackground, app, { skipFrame: true });
				const btnGroup = el.querySelector<HTMLElement>('.dashboard-qa-btn-group');
				if (btnGroup) {
					const gear = appendInlineBackgroundButton(btnGroup, app, settings.quickActionsBackground, (bg) =>
						saveSingletonBackground(settingsAccess, 'quickActionsBackground', bg),
					);
					btnGroup.insertBefore(gear, btnGroup.firstChild);
				}
			}
			// Album cards carry their config id (the multi-instance refresh
			// matches on it).
			if (key.startsWith('album-')) {
				const cfg = albumById.get(key.slice('album-'.length));
				if (cfg) el.dataset.albumId = String(cfg.id);
			}
			if (spans && isTieredWidgetKey(key)) {
				el.setCssProps({ '--db-widget-span': String(spans[i] ?? RATIO_SPAN.full) });
			}
		}
	}

	if (onWidgetReorder) {
		setupWidgetDnD(
			widgetArea,
			ordered.map((e) => e.key),
			onWidgetReorder,
			stacked,
		);
	}
	return widgetArea;
}
