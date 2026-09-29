import { App } from 'obsidian';
import { h } from 'preact';
import type { PomodoroService } from '../../../platform/obsidian/pomodoro/pomodoro-service';
import { PomodoroPanel } from '../pomodoro/PomodoroPanel';
import { SidebarWeatherPanel } from '../widgets/SidebarWeatherPanel';
import { applyWidgetBackground, WidgetBackgroundModal } from '../widgets/widget-background';
import { mountDashboardPanel } from './render-context';
import { showPomodoroStats } from './render-sidebar-countdown';

export type WidgetEntry = { key: string; render: (host: HTMLElement) => void };
export function sortByOrder(items: WidgetEntry[], order: string[]): WidgetEntry[] {
	const orderMap = new Map(order.map((k, i) => [k, i]));
	const sorted = [...items].sort((a, b) => {
		// quickActions predates the widget system; a saved order without it
		// keeps it first (its historical spot above the widgets).
		const ai = orderMap.get(a.key) ?? (a.key === 'quickActions' ? -1 : order.length);
		const bi = orderMap.get(b.key) ?? (b.key === 'quickActions' ? -1 : order.length);
		return ai - bi;
	});
	return sorted;
}
export function setupWidgetDnD(
	widgetArea: HTMLElement,
	currentKeys: string[],
	onReorder: (order: string[]) => void,
	stacked: boolean,
): void {
	let draggedKey: string | null = null;

	/** All drag-order cards: keyed by [data-widget-key], which sits on the
	 *  widget itself OR on the bare mount wrapper refreshDataWidget re-renders
	 *  lunar/pomodoro/reading into (the wrapper inherits the key). */
	const widgets = () => widgetArea.querySelectorAll('[data-widget-key]');

	/** Clear every drag-over indicator class (both axes swept as defense). */
	const clearDragOver = (el: HTMLElement): void => {
		el.removeClass('dashboard-sidebar-widget--drag-over-top');
		el.removeClass('dashboard-sidebar-widget--drag-over-bottom');
		el.removeClass('dashboard-sidebar-widget--drag-over-left');
		el.removeClass('dashboard-sidebar-widget--drag-over-right');
	};

	/** Insertion side for a pointer position over `wEl`: against the vertical
	 *  midpoint. Both layouts read the Y axis — the side rail stacks widgets
	 *  vertically, and the stacked deck is a column-major grid where "above
	 *  the target" is exactly "earlier in the flat order". */
	const isBefore = (wEl: HTMLElement, e: DragEvent): boolean => {
		const rect = wEl.getBoundingClientRect();
		return e.clientY < rect.top + rect.height / 2;
	};

	/** Controls whose own pointer gesture must not be hijacked by the widget's
	 *  drag-to-reorder: the music volume slider, text inputs, selects, buttons
	 *  and links. A native HTML5 drag starts on ANY mousedown inside a
	 *  `draggable` ancestor, so `draggable` is armed per gesture instead of
	 *  once at setup: pressing a control leaves it off (the control keeps its
	 *  drag/select behaviour), pressing plain widget surface turns it on.
	 *  `[data-no-drag]` is the opt-out hook for clickable non-form elements
	 *  (playlist rows and similar) that want the same protection. */
	const DRAG_BLOCKED = 'input, textarea, select, button, a[href], [contenteditable], [data-no-drag]';

	// Stacked mode pins the quick-actions card to the leftmost slot, so
	// dropping onto it (or dragging it) could never move anything on screen.
	// It exits the reorder system there entirely: no insertion indicators, no
	// persisted no-op order writes that would read as a broken drag.
	const isPinned = (keyEl: HTMLElement): boolean => stacked && keyEl.dataset.widgetKey === 'quickActions';

	widgets().forEach((el) => {
		const wEl = el as HTMLElement;
		if (isPinned(wEl)) return;
		wEl.setAttribute('draggable', 'false');
	});

	// Delegation on the widget AREA, not per-widget listeners: the in-place
	// data refresh (view.refreshDataWidget) re-mounts lunar/pomodoro/reading
	// inside a new wrapper mid-session, and drag events bubble — delegated
	// handlers keep working across those swaps without re-wiring.
	const keyElOf = (e: Event): HTMLElement | null => {
		const target = e.target as HTMLElement | null;
		const hit = target?.closest('[data-widget-key]') as HTMLElement | null;
		if (!hit || !widgetArea.contains(hit)) return null;
		return hit;
	};

	widgetArea.addEventListener('mousedown', (e) => {
		const keyEl = keyElOf(e);
		if (!keyEl || isPinned(keyEl)) return;
		const blocked = e.button !== 0 || !!(e.target as HTMLElement | null)?.closest(DRAG_BLOCKED);
		keyEl.setAttribute('draggable', blocked ? 'false' : 'true');
	});

	widgetArea.addEventListener('dragstart', (e) => {
		const keyEl = keyElOf(e);
		if (!keyEl || isPinned(keyEl)) return;
		draggedKey = keyEl.dataset.widgetKey ?? null;
		keyEl.addClass('dashboard-sidebar-widget--dragging');
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', draggedKey ?? '');
		}
	});

	widgetArea.addEventListener('dragend', (e) => {
		const keyEl = keyElOf(e);
		if (keyEl) {
			keyEl.setAttribute('draggable', 'false');
			keyEl.removeClass('dashboard-sidebar-widget--dragging');
		}
		widgets().forEach((el2) => clearDragOver(el2 as HTMLElement));
		draggedKey = null;
	});

	widgetArea.addEventListener('dragover', (e) => {
		const keyEl = keyElOf(e);
		if (!keyEl || isPinned(keyEl)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		if (!draggedKey || keyEl.dataset.widgetKey === draggedKey) return;
		widgets().forEach((el2) => clearDragOver(el2 as HTMLElement));
		keyEl.addClass(
			isBefore(keyEl, e)
				? 'dashboard-sidebar-widget--drag-over-top'
				: 'dashboard-sidebar-widget--drag-over-bottom',
		);
	});

	widgetArea.addEventListener('dragleave', (e) => {
		const keyEl = keyElOf(e);
		if (keyEl) clearDragOver(keyEl);
	});

	widgetArea.addEventListener('drop', (e) => {
		const keyEl = keyElOf(e);
		if (!keyEl || isPinned(keyEl)) return;
		e.preventDefault();
		clearDragOver(keyEl);
		if (!draggedKey || keyEl.dataset.widgetKey === draggedKey) return;

		const targetKey = keyEl.dataset.widgetKey ?? '';
		const insertBefore = isBefore(keyEl, e);

		const keys = [...currentKeys];
		const fromIdx = keys.indexOf(draggedKey);
		if (fromIdx === -1) return;
		keys.splice(fromIdx, 1);
		let toIdx = keys.indexOf(targetKey);
		if (toIdx === -1) return;
		if (!insertBefore) toIdx += 1;
		keys.splice(toIdx, 0, draggedKey);
		onReorder(keys);
	});
}
const weatherRevisions = new WeakMap<HTMLElement, number>();
export function renderSidebarWeather(
	container: HTMLElement,
	settings: import('../../../core/dashboard/types/index').DashboardSettings,
	app: App,
): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-weather' });
	mountDashboardPanel(widget, h(SidebarWeatherPanel, { settings, revision: 0 }));
}
export function refreshSidebarWeatherWidget(
	root: HTMLElement,
	settings: import('../../../core/dashboard/types/index').DashboardSettings,
	app: App,
): void {
	root.querySelectorAll<HTMLElement>('.dashboard-sidebar-weather').forEach((widget) => {
		const revision = (weatherRevisions.get(widget) ?? 0) + 1;
		weatherRevisions.set(widget, revision);
		mountDashboardPanel(widget, h(SidebarWeatherPanel, { settings, revision }));
	});
}
export function renderSidebarPomodoro(
	container: HTMLElement,
	service: PomodoroService,
	settings: import('../../../core/dashboard/types/index').DashboardSettings,
	app?: App,
	onBgChange?: (bg: import('../../../core/dashboard/types/index').WidgetBackground | undefined) => void,
): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-pomodoro' });
	mountDashboardPanel(
		widget,
		h(PomodoroPanel, {
			service,
			settings,
			statistics: () => showPomodoroStats(widget.ownerDocument, service),
			background:
				app && onBgChange
					? () => new WidgetBackgroundModal(app, settings.pomodoroBackground, onBgChange).open()
					: undefined,
		}),
	);
	if (app) applyWidgetBackground(widget, settings.pomodoroBackground, app);
}
