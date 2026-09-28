import { buildPages } from '../src/platform/obsidian/dql/page-builder';
import { collectVaultTasks } from '../src/platform/obsidian/calendar/alltasks-scan';
import { CountdownPanel } from '../src/view/dashboard/widgets/CountdownPanel';
import { AnniversaryPanel } from '../src/view/dashboard/widgets/AnniversaryPanel';
import assert from 'node:assert/strict';
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
	console.log('dashboard isolation: resources, panels, clocks, services, Dataview actions and vault caches passed');
}
void verifyVaultCaches().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
