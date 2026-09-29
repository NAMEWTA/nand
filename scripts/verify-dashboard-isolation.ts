import { buildPages } from '../src/platform/obsidian/dql/page-builder';
import { collectVaultTasks } from '../src/platform/obsidian/calendar/alltasks-scan';
import { CountdownPanel } from '../src/view/dashboard/widgets/CountdownPanel';
import { AnniversaryPanel } from '../src/view/dashboard/widgets/AnniversaryPanel';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';
import { h } from 'preact';
import type { Chart } from 'chart.js';
import { App, TFile } from 'obsidian';
import { HabitPanel } from '../src/view/dashboard/habit/HabitPanel';
import {
	bindRenderContext,
	getRenderContext,
	destroyAllCharts,
	mountDashboardPanel,
	destroyDashboardPanels,
} from '../src/view/dashboard/renderer/render-context';
import { bindDataviewContext, getDataviewContext } from '../src/view/dashboard/dataview/context';
import { InlineValue } from '../src/view/dashboard/dataview/Values';
import { getHabitService, registerHabitService, type HabitService } from '../src/platform/obsidian/habit/habit-service';
import { registerMusicService, type MusicService } from '../src/platform/obsidian/music/music-service';
import { renderSidebarHabitWidget, refreshHabitWidget } from '../src/view/dashboard/habit/habit-widget';
import { onHabitChanged } from '../src/view/dashboard/view/vault-refresh';
import { renderSidebarAnniversaryWidget } from '../src/view/dashboard/widgets/anniversary-widget';
import { renderSidebarCountdown } from '../src/view/dashboard/renderer/render-sidebar-countdown';
import { renderSidebarPomodoro } from '../src/view/dashboard/renderer/refresh-sidebar-weather-widget';
import { renderSidebarMusicWidget } from '../src/view/dashboard/music/music-widget';
import type { WidgetBackground } from '../src/core/dashboard/types';

const { document } = parseHTML('<html><body></body></html>');
Object.assign(globalThis, { document });
const left = document.createElement('div'),
	right = document.createElement('div');
left.className = right.className = 'nand-dashboard-root';
document.body.append(left, right);
const a = getRenderContext(left),
	b = getRenderContext(right);
assert.notEqual(a, b);
let destroyedA = 0,
	destroyedB = 0;
a.chartInstances.set('same-card', { destroy: () => destroyedA++ } as unknown as Chart);
b.chartInstances.set('same-card', { destroy: () => destroyedB++ } as unknown as Chart);
a.taskDragSource.current = { cardId: 'left', taskPath: [0] };
assert.equal(b.taskDragSource.current, null);
const detached = document.createElement('div');
left.append(detached);
bindRenderContext(detached, a);
detached.remove();
assert.equal(getRenderContext(detached), a, 'preserved detached widgets keep their owner');
destroyAllCharts(left);
assert.deepEqual([destroyedA, destroyedB], [1, 0]);
const toggles: string[] = [];
function panel(owner: string, done = false) {
	return h(HabitPanel, {
		rows: [{ id: 'same', name: owner, done, streak: 2 }],
		toggle: () => toggles.push(owner),
		add: () => {},
		backfill: () => {},
		statistics: () => {},
	});
}
mountDashboardPanel(left, panel('left'));
mountDashboardPanel(right, panel('right'));
const original = left.querySelector<HTMLElement>('[data-habit-id]')!;
original.click();
right.querySelector<HTMLElement>('[data-habit-id]')!.click();
assert.deepEqual(toggles, ['left', 'right']);
mountDashboardPanel(left, panel('left', true));
assert.equal(left.querySelector('[data-habit-id]'), original, 'keyed habit row stays mounted');
assert.equal(original.getAttribute('aria-checked'), 'true');
destroyDashboardPanels(left);
assert.equal(left.childNodes.length, 0);
assert.ok(right.textContent?.includes('right'));
destroyDashboardPanels(right);
destroyAllCharts(right);
assert.deepEqual([destroyedA, destroyedB], [1, 1]);

const appA = new App(),
	appB = new App();
const serviceA = {} as HabitService,
	serviceB = {} as HabitService;
registerHabitService(appA, serviceA);
registerHabitService(appB, serviceB);
assert.equal(getHabitService(appA), serviceA);
assert.equal(getHabitService(appB), serviceB);
registerHabitService(appA, null);
assert.equal(getHabitService(appB), serviceB);
registerHabitService(appB, null);

// Moving a clock to another window releases the exact originating timer.
function clockWindow() {
	const timers = new Set<number>();
	let next = 0;
	const win = {
		setInterval: () => {
			timers.add(++next);
			return next;
		},
		clearInterval: (id: number) => {
			timers.delete(id);
		},
	} as unknown as Window;
	return { win, timers };
}
const clockA = clockWindow(),
	clockB = clockWindow();
const config = {
	id: 'deadline',
	label: 'Deadline',
	targetDate: '2099-01-01',
	displayMode: 'days' as const,
	reminderDays: 0,
};
mountDashboardPanel(left, h(CountdownPanel, { config, win: clockA.win, edit: () => {} }));
mountDashboardPanel(
	right,
	h(AnniversaryPanel, {
		config: {
			id: 'anniversary',
			label: 'Start',
			startDate: '2020-01-01',
			precision: 'hours',
			annualReminder: false,
		},
		win: clockB.win,
	}),
);
assert.deepEqual([clockA.timers.size, clockB.timers.size], [1, 1]);
mountDashboardPanel(left, h(CountdownPanel, { config, win: clockB.win, edit: () => {} }));
assert.deepEqual([clockA.timers.size, clockB.timers.size], [0, 2]);
destroyDashboardPanels(left);
assert.equal(clockB.timers.size, 1);
destroyDashboardPanels(right);
assert.equal(clockB.timers.size, 0);

// Event handlers retain each Dataview's app and opener after the second surface renders.

const hosts = [document.createElement('div'), document.createElement('div')];
const opened: number[] = [];
for (const [i, host] of hosts.entries()) {
	const file = Object.assign(new TFile(), { path: 'same.md', basename: 'same' });
	const app = { vault: { getAbstractFileByPath: () => file } } as unknown as App;
	bindDataviewContext(host as unknown as HTMLElement, {
		app,
		hoverParent: null,
		opener: () => {
			opened.push(i);
		},
	});
	mountDashboardPanel(host, h(InlineValue, { text: '[[same]]', context: getDataviewContext(host) }));
}
for (const host of hosts) host.querySelector<HTMLElement>('.dashboard-wikilink')!.click();
assert.deepEqual(opened, [0, 1]);

// Widget photo layers are siblings of the Preact tree. The first render used
// to delete them; a second habit refresh must leave them in place.
const widgetWindow = clockWindow().win;
Object.defineProperty(document, 'defaultView', { configurable: true, get: () => widgetWindow });
const elementProto = document.createElement('div').constructor.prototype as HTMLElement & {
	createDiv(this: HTMLElement, o?: { cls?: string }): HTMLElement;
	addClass(this: HTMLElement, ...names: string[]): void;
	setCssProps(this: HTMLElement, props: Record<string, string>): void;
};
elementProto.createDiv = function (o) {
	const el = this.ownerDocument.createElement('div');
	const cls = typeof o === 'string' ? o : o?.cls;
	if (typeof cls === 'string') el.className = cls;
	else if (Array.isArray(cls)) el.className = cls.join(' ');
	this.appendChild(el);
	return el;
};
elementProto.addClass = function (...names) {
	for (const name of names) this.classList.add(name);
};
elementProto.setCssProps = function (props) {
	for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value);
};
const photo: WidgetBackground = {
	image: 'https://example.test/card.jpg',
	opacity: 100,
	dim: 20,
	blur: 0,
	foreground: 'light',
};
const habitApp = new App();
const habits: { id: string; name: string }[] = [];
const habitDone = new Set<string>();
registerHabitService(
	habitApp,
	{
		getHabits: () => habits.map((habit) => ({ ...habit })),
		isDone: (id: string) => habitDone.has(id),
		getStreak: () => 0,
		addHabit: (name: string) => {
			habits.push({ id: name, name });
			return true;
		},
		toggle: (id: string) => {
			if (habitDone.has(id)) habitDone.delete(id);
			else habitDone.add(id);
		},
	} as unknown as HabitService,
);
const musicApp = new App();
registerMusicService(
	musicApp,
	{
		subscribe: () => () => {},
		getState: () => ({
			status: 'idle',
			current: null,
			currentIndex: -1,
			playlist: [],
			volume: 1,
			mode: 'list',
			positionSec: 0,
			durationSec: 0,
		}),
	} as unknown as MusicService,
);
function hosted(render: (host: HTMLElement) => void): HTMLElement {
	const host = document.createElement('div');
	document.body.append(host);
	render(host);
	return host;
}
function assertPhoto(host: HTMLElement, frame: boolean): void {
	const card = host.firstElementChild as HTMLElement;
	assert.ok(card.classList.contains('dashboard-sidebar-widget--has-bg'), card.className);
	assert.ok(card.classList.contains('dashboard-sidebar-widget--fg-set'));
	assert.ok(card.querySelector('.dashboard-widget-bg'));
	assert.equal(card.querySelector('.dashboard-widget-frame') != null, frame);
}
const habitHost = hosted((host) => renderSidebarHabitWidget(host, habitApp, photo));
assertPhoto(habitHost, true);
refreshHabitWidget(habitHost);
assertPhoto(habitHost, true);
const bareHabit = hosted((host) => renderSidebarHabitWidget(host, habitApp));
assert.equal(bareHabit.firstElementChild?.classList.contains('dashboard-sidebar-widget--has-bg'), false);
assert.equal(bareHabit.querySelector('.dashboard-widget-bg'), null);
const habitShell = document.createElement('div');
const habitRoot = document.createElement('div');
habitShell.append(document.createElement('div'), habitRoot);
document.body.append(habitShell);
renderSidebarHabitWidget(habitRoot, habitApp, photo);
renderSidebarHabitWidget(habitRoot, habitApp);
assert.equal(habitRoot.querySelectorAll('.dashboard-sidebar-habit-empty').length, 2);
let habitBanners = 0;
const habitView = {
	containerEl: habitShell,
	debouncedRefreshBannerStats() {
		habitBanners++;
	},
};
habits.push({ id: 'water', name: '喝水' });
onHabitChanged.call(habitView as never);
assert.equal(habitBanners, 1);
assert.equal(habitRoot.querySelectorAll('.dashboard-sidebar-habit-empty').length, 0);
assert.equal(habitRoot.querySelectorAll('.dashboard-sidebar-habit-item').length, 2);
habitRoot.querySelectorAll('[aria-checked]').forEach((row) => assert.equal(row.getAttribute('aria-checked'), 'false'));
habitDone.add('water');
onHabitChanged.call(habitView as never);
assert.equal(habitBanners, 2);
habitRoot.querySelectorAll('[aria-checked]').forEach((row) => assert.equal(row.getAttribute('aria-checked'), 'true'));
assert.equal(habitRoot.textContent?.includes('喝水'), true);
assertPhoto(habitRoot, true);
assert.equal(habitRoot.children[1]?.classList.contains('dashboard-sidebar-widget--has-bg'), false);
assertPhoto(
	hosted((host) =>
		renderSidebarAnniversaryWidget(host, {
			id: 'av',
			label: 'Start',
			startDate: '2020-01-01',
			precision: 'ymd',
			annualReminder: false,
			background: photo,
		}, new App()),
	),
	true,
);
assertPhoto(
	hosted((host) =>
		renderSidebarCountdown(
			host,
			{
				id: 'cd',
				label: 'Deadline',
				targetDate: '2099-01-01',
				displayMode: 'days',
				reminderDays: 0,
				background: photo,
			},
			new App(),
		),
	),
	true,
);
assertPhoto(
	hosted((host) =>
		renderSidebarPomodoro(
			host,
			{
				subscribe: () => () => {},
				subscribeTick: () => () => {},
				getState: () => ({
					phase: 'work',
					status: 'paused',
					remainingSeconds: 1500,
					totalSeconds: 1500,
					completedWorkSessions: 0,
				}),
				getTodayCount: () => 0,
				getActivity: () => '',
			} as never,
			{ pomodoroLongBreakInterval: 4, pomodoroBackground: photo } as never,
			new App(),
		),
	),
	true,
);
assertPhoto(hosted((host) => renderSidebarMusicWidget(host, photo, musicApp)), true);

async function verifyVaultCaches(): Promise<void> {
	const makeVault = (title: string) => {
		const file = Object.assign(new TFile(), {
			path: 'same.md',
			basename: 'same',
			extension: 'md',
			stat: { mtime: 10, ctime: 1, size: 1 },
		});
		const cache = { frontmatter: { title }, listItems: [{ task: ' ' }] };
		return {
			vault: { getMarkdownFiles: () => [file], cachedRead: async () => '- [ ] ' + title },
			metadataCache: { getFileCache: () => cache, resolvedLinks: { 'source.md': { 'same.md': 1 } } },
		} as unknown as App;
	};
	const first = makeVault('First vault'),
		second = makeVault('Second vault');
	const [pagesA, pagesB] = await Promise.all([buildPages(first), buildPages(second)]);
	assert.equal(pagesA[0]?.fields.title, 'First vault');
	assert.equal(pagesB[0]?.fields.title, 'Second vault');
	const [tasksA, tasksB] = await Promise.all([collectVaultTasks(first), collectVaultTasks(second)]);
	assert.equal(tasksA[0]?.text, 'First vault');
	assert.equal(tasksB[0]?.text, 'Second vault');
	first.metadataCache.resolvedLinks = {};
	const refreshed = await buildPages(first);
	assert.deepEqual(
		refreshed[0]?.fields['file.inlinks'],
		[],
		'link changes update cached pages without touching note mtimes',
	);
	const css = readFileSync(join(process.cwd(), 'styles.css'), 'utf8');
	const hint = css.match(/\.dashboard-sidebar-pomodoro-stats-hint\s*\{[^}]*\}/)?.[0] ?? '';
	assert.match(hint, /flex-shrink:\s*0/);
	assert.equal(hint.includes('position: absolute'), false, hint);
	assert.equal(css.includes('.dashboard-sidebar-pomodoro-top-spacer'), false);
	const selector = css.match(/\.dashboard-pomodoro-activity-selector\s*\{[^}]*\}/)?.[0] ?? '';
	assert.match(selector, /min-width:\s*0/);
	const placeholder = css.match(/\.dashboard-pomodoro-activity-placeholder\s*\{[^}]*\}/)?.[0] ?? '';
	assert.match(placeholder, /text-overflow:\s*ellipsis/);
	console.log('dashboard isolation: resources, panels, clocks, services, Dataview actions and vault caches passed');
}
void verifyVaultCaches().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
