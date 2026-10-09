import { installPreactMiniDom } from './preact-mini-dom';
/**
 * Verifies the stacked (top-bottom) widget layout:
 *
 * 1. Off phones the layout is stacked and the widget signature records it.
 * 2. The default settings build the strip wrapper.
 * 3. Stacked build: exactly one .dashboard-sidebar-widgets-row wrapper, the
 *    only child of the widgets area; quick actions is its FIRST card (the
 *    leftmost grid column) even when the saved order puts it last; other
 *    widgets follow in saved relative order.
 * 4. Preserve within stacked: re-render with identical settings re-attaches
 *    the SAME widget-area element (reuse path) and does not duplicate the
 *    wrapper.
 * 5. Widget drag reorder axis: the vertical pointer coordinate decides the
 *    drop side (the stacked deck is a column-major grid where "above the
 *    target" = earlier in the flat order) and the matching drag-over
 *    indicator classes are painted.
 * 5b. Mousedown arming: left button arms draggability, non-left does not.
 * 5c. Stacked quick-actions row is pinned: no drag wiring, drops on it are
 *    complete no-ops (no reorder, no indicator).
 *
 * Run: `pnpm run test:layout-stacked`
 */
import { strict as assert } from 'node:assert';
import type { App } from 'obsidian';
import type { DashboardSettings } from '../src/modules/home/core/board/types/index';
import { isStackedLayout,renderSidebarWidgets,sidebarWidgetSignature } from '../src/modules/home/ui/renderer/index';
import { El,findByClass } from './mini-dom';

const baseSettings = (over: Partial<DashboardSettings>): DashboardSettings =>
	({
		widgetQuickActionsEnabled: true,
		widgetLunarEnabled: true,
		widgetYearProgressEnabled: true,
		widgetWeatherEnabled: false,
		pomodoroEnabled: false,
		widgetCalendarEnabled: false,
		widgetHabitEnabled: false,
		widgetExpenseEnabled: false,
		widgetAlbumEnabled: false,
		widgetMusicEnabled: false,
		readingEnabled: false,
		countdownEnabled: false,
		countdowns: [],
		widgetOrder: ['lunar', 'yearProgress', 'quickActions'],
		...over,
	}) as unknown as DashboardSettings;

/** Quick-actions stand-in: the real widget drags in the full quick-actions
 *  module; only its root classes matter for structure and DnD wiring. */
const stubQuickActions = (host: HTMLElement): void => {
	(host as unknown as El).createDiv({ cls: 'dashboard-section dashboard-quick-actions' });
};

const inertApp = {} as App;

const run = (): void => {
 installPreactMiniDom();
 Object.assign(document, {defaultView:{setInterval:()=>0,clearInterval:()=>{}}});
	// Globals touched on the render path (modal-theme imports etc.).
	(globalThis as { activeDocument?: unknown }).activeDocument = {
		querySelector: (): null => null,
		body: new El('body'),
		addEventListener: (): void => {},
		removeEventListener: (): void => {},
	};

	// 1. Off phones the layout is always stacked (Platform.isPhone is falsy in the stub).
	assert.equal(isStackedLayout(), true, 'boards are stacked off phones');
	assert.ok(JSON.parse(sidebarWidgetSignature(baseSettings({}), false, false, false, '')).stacked, 'the signature records the stacked layout');

	// 2. The default settings build the strip.
	{
		const host = new El('div');
		renderSidebarWidgets(host as unknown as HTMLElement, baseSettings({}), inertApp, undefined, undefined, undefined, undefined, undefined, undefined, stubQuickActions);
		assert.equal(findByClass(host, 'dashboard-sidebar-widgets-row').length, 1, 'the default settings render the strip');
	}

	// 3. Stacked build: everything renders into the strip wrapper; quick
	//    actions is its FIRST card (leftmost grid column) regardless of the
	//    saved order; relative order of the rest is preserved.
	{
		const host = new El('div');
		const area = renderSidebarWidgets(
			host as unknown as HTMLElement,
			baseSettings({}),
			inertApp,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			stubQuickActions,
		);
		const areaEl = (area ?? assert.fail('stacked build returned null')) as unknown as El;
		const rows = findByClass(host, 'dashboard-sidebar-widgets-row');
		assert.equal(rows.length, 1, 'stacked build creates exactly one strip wrapper');
		const row = rows[0]!;
		assert.equal(row.parent, areaEl, 'strip wrapper is a direct child of the widgets area');
		assert.equal(areaEl.children.length, 1, 'strip wrapper is the widgets area only child');
		const qa = findByClass(host, 'dashboard-quick-actions')[0]!;
		assert.equal(qa.parent, row, 'quick actions renders inside the strip');
		assert.deepEqual(
			row.children.map((c) => c.dataset.widgetKey ?? ''),
			['quickActions', 'lunar', 'yearProgress'],
			'quick actions is the leftmost strip card; the rest keep the saved relative order',
		);
	}

	// 4. Preserve within stacked: same settings re-attach the same element.
	{
		const host = new El('div');
		const first = renderSidebarWidgets(
			host as unknown as HTMLElement,
			baseSettings({}),
			inertApp,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			stubQuickActions,
		);
		const firstEl = first as unknown as El;
		firstEl.remove(); // detach like view.render does before a re-render

		const second = renderSidebarWidgets(
			host as unknown as HTMLElement,
			baseSettings({}),
			inertApp,
			undefined,
			undefined,
			undefined,
			undefined,
			firstEl as unknown as HTMLElement,
			undefined,
			stubQuickActions,
		);
		assert.equal(second, first, 'identical stacked settings re-attach the same widgets element');
		assert.equal(
			findByClass(host, 'dashboard-sidebar-widgets-row').length,
			1,
			'reuse does not duplicate the strip wrapper',
		);
	}

	// 5. Drag reorder: the stacked deck is a column-major grid where "above the
	//    target" = earlier in the flat order, so the vertical axis decides.
	const dragCase = (coords: { clientX: number; clientY: number }): string => {
		const host = new El('div');
		const orders: string[][] = [];
		renderSidebarWidgets(
			host as unknown as HTMLElement,
			baseSettings({}),
			inertApp,
			undefined,
			undefined,
			undefined,
			(order) => {
				orders.push(order);
			},
			undefined,
			undefined,
			stubQuickActions,
		);
		const widgets = findByClass(host, 'dashboard-sidebar-widget');
		// Saved order is [lunar, yearProgress, quickActions]. The pinned QA row
		// exits the reorder system (5c), so yearProgress is dragged onto lunar.
		const dragged = widgets.find((w) => w.dataset.widgetKey === 'yearProgress')!;
		const target = widgets.find((w) => w.dataset.widgetKey === 'lunar')!;
		const dataTransfer = { effectAllowed: '', setData: (): void => {}, dropEffect: '' };
		dragged.dispatchEvent({ type: 'dragstart', target: dragged, dataTransfer });
		target.dispatchEvent({ type: 'dragover', target, dataTransfer, ...coords });
		const indicator = target.hasClass('dashboard-sidebar-widget--drag-over-top')
			? 'top'
			: target.hasClass('dashboard-sidebar-widget--drag-over-bottom')
				? 'bottom'
				: 'none';
		target.dispatchEvent({ type: 'drop', target, dataTransfer, ...coords });
		dragged.dispatchEvent({ type: 'dragend', target: dragged });
		assert.equal(orders.length, 1, 'drop fires one reorder');
		// The reordered array must match the painted indicator. The dragged and
		// target widgets are adjacent, where "after lunar" is the saved spot.
		assert.deepEqual(
			orders[0],
			indicator === 'top' ? ['yearProgress', 'lunar', 'quickActions'] : ['lunar', 'yearProgress', 'quickActions'],
			`reorder matches the ${indicator} indicator`,
		);
		return indicator;
	};

	// mini-dom rects are all-zero: midpoint = 0. clientY decides;
	// clientX must be ignored (a stray X-axis branch would flip these).
	{
		const topCoords = { clientX: 50, clientY: -5 };
		assert.equal(dragCase(topCoords), 'top', 'above midpoint -> top');
		const bottomCoords = { clientX: -5, clientY: 50 };
		assert.equal(dragCase(bottomCoords), 'bottom', 'below midpoint -> bottom (clientX ignored)');
	}

	// 5b. Arming path: a plain left mousedown arms native draggability, a
	//     non-left button does not (the blocked-controls branch needs closest(),
	//     absent from mini-dom, so only the button gate is exercised here).
	{
		const host = new El('div');
		renderSidebarWidgets(
			host as unknown as HTMLElement,
			baseSettings({}),
			inertApp,
			undefined,
			undefined,
			undefined,
			(): void => {}, // onWidgetReorder must be present for DnD wiring
			undefined,
			undefined,
			stubQuickActions,
		);
		const lunar = findByClass(host, 'dashboard-sidebar-lunar')[0]!;
		lunar.dispatchEvent({ type: 'mousedown', target: lunar, button: 0 });
		assert.equal(lunar.getAttribute('draggable'), 'true', 'left mousedown arms the widget for dragging');
		lunar.dispatchEvent({ type: 'mousedown', target: lunar, button: 2 });
		assert.equal(lunar.getAttribute('draggable'), 'false', 'non-left mousedown leaves the widget undraggable');
	}

	// 5c. Stacked: the quick-actions row is pinned and exits the reorder
	//     system — no drag wiring at all, drops on it do nothing.
	{
		const host = new El('div');
		const orders: string[][] = [];
		renderSidebarWidgets(
			host as unknown as HTMLElement,
			baseSettings({}),
			inertApp,
			undefined,
			undefined,
			undefined,
			(order) => {
				orders.push(order);
			},
			undefined,
			undefined,
			stubQuickActions,
		);
		const qa = findByClass(host, 'dashboard-quick-actions')[0]!;
		assert.equal(qa.getAttribute('draggable'), null, 'stacked QA row is never armed draggable');
		const lunar = findByClass(host, 'dashboard-sidebar-lunar')[0]!;
		const dataTransfer = { effectAllowed: '', setData: (): void => {}, dropEffect: '' };
		lunar.dispatchEvent({ type: 'dragstart', target: lunar, dataTransfer });
		qa.dispatchEvent({ type: 'dragover', target: qa, dataTransfer, clientX: -5, clientY: -5 });
		qa.dispatchEvent({ type: 'drop', target: qa, dataTransfer, clientX: -5, clientY: -5 });
		assert.equal(orders.length, 0, 'drop on the pinned QA row fires no reorder');
		assert.equal(
			['left', 'right', 'top', 'bottom'].some((side) =>
				qa.hasClass(`dashboard-sidebar-widget--drag-over-${side}`),
			),
			false,
			'drop on the pinned QA row paints no insertion indicator',
		);
	}
};

run();
console.log('layout stacked: ALL PASS');
