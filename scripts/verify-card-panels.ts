import { verifyOpenIssuePanels } from './verify-open-issue-panels';
import { memoryVault } from './fixtures/memory-vault';
import { useLayoutEffect } from 'preact/hooks';
import {
	DashboardPanelModal,
	closeOwnedDashboardPanels,
	closeDashboardPanelModals,
} from '../src/modules/home/ui/ui/panel-modal';
import { parseHTML } from 'linkedom';
import assert from 'node:assert/strict';
import { App, Component, MarkdownRenderer, TFile } from 'obsidian';
import { h } from 'preact';
import type { DataviewConfig } from '../src/modules/home/core/board/types';
import type { DashboardCard, TaskItem } from '../src/modules/home/core/board/types/index';
import { expenseToday } from '../src/modules/home/core/expense/model';
import { ExpenseService } from '../src/modules/home/platform/expense/expense-service';
import { ReadingService } from '../src/modules/home/platform/reading/reading-service';
import type { WidgetSettingsHost } from '../src/modules/home/platform/widget-settings-host';
import { CardPanel } from '../src/modules/home/ui/cards/CardPanel';
import { MemoPanel } from '../src/modules/home/ui/cards/MemoPanel';
import { HabitStatsPanel } from '../src/modules/home/ui/habit/HabitStatsPanel';
import type { HabitService } from '../src/modules/home/platform/habit/habit-service';
import { QuickActionsPanel } from '../src/modules/home/ui/notes/QuickActionsPanel';
import { loadLunar } from '../src/modules/home/ui/widgets/lunar-model';
import { LunarPanel } from '../src/modules/home/ui/widgets/LunarPanel';
import { setLanguage } from '../src/shared/i18n';
import { t } from '../src/shared/i18n';
import { bindLocalizedControl, localizedAttributes, refreshLocalizedDom, setLocalizedText } from '../src/ui/primitives/localized-dom';
import { QuickNotesPanel } from '../src/modules/home/ui/notes/QuickNotesPanel';
import { ProjectPanel } from '../src/modules/home/ui/cards/ProjectPanel';
import { TaskPanel } from '../src/modules/home/ui/cards/TaskPanel';
import { DataviewPanel } from '../src/modules/home/ui/dataview/DataviewPanel';
import { ExpenseLedgerPanel } from '../src/modules/home/ui/expense/ExpenseLedgerPanel';
import { ExpenseStatsPanel } from '../src/modules/home/ui/expense/ExpenseStatsPanel';
import type { LibraryFileResult } from '../src/modules/home/ui/library/library-file-result';
import { LibraryKanban } from '../src/modules/home/ui/library/LibraryKanban';
import { MediaVideo } from '../src/modules/home/ui/media/MediaViews';
import { ReadingPanel } from '../src/modules/home/ui/reading/ReadingPanel';
import type { RenderCallbacks } from '../src/modules/home/ui/render-contract';
import {
	destroyDashboardPanels,
	getRenderContext,
	mountDashboardPanel,
	refreshDashboardLanguage,
} from '../src/modules/home/ui/renderer/render-context';

const { document, window } = parseHTML('<html><body></body></html>');
Object.assign(globalThis, { document });
Object.assign(window.HTMLInputElement.prototype, { select() {} });
Object.assign(window.HTMLElement.prototype, {
	setCssProps(this: HTMLElement, props: Record<string, string>) {
		for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value);
	},
});
Object.assign(window.HTMLTextAreaElement.prototype, { setSelectionRange() {} });
const flush = async () => {
	await new Promise((resolve) => setTimeout(resolve, 0));
};
const file = Object.assign(new TFile(), { path: 'Target.md', basename: 'Target', extension: 'md' });
const app = Object.assign(new App(), {
	vault: {
		getFileByPath: (path: string) => (path === 'Target.md' || path === 'Target' ? file : null),
		getFiles: () => [file],
	},
	workspace: { trigger() {} },
});
const actions: unknown[][] = [];
const callbacks = new Proxy({} as RenderCallbacks, {
	get:
		(_target, name) =>
		(...args: unknown[]) =>
			actions.push([name, ...args]),
});
const makeTask = (text: string, children: TaskItem[] = [], collapsed = false) =>
	({ text, children, collapsed, checked: false, reminder: '' }) as TaskItem;
const card = {
	id: 'tasks',
	title: 'Task title',
	type: 'task',
	tasks: [makeTask('Parent', [makeTask('Child', [makeTask('Grandchild')], true)], true), makeTask('[[Target]]')],
	docs: [],
	body: '',
	blockquote: '',
	wikiLink: '',
	url: '',
	width: 0,
} as unknown as DashboardCard;
function host() {
	const root = document.createElement('div');
	root.className = 'nand-dashboard-root';
	document.body.append(root);
	return { root, context: getRenderContext(root) };
}
function event(element: Element, type: string, extra: Record<string, unknown> = {}) {
	const event = new window.Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, extra);
	element.dispatchEvent(event);
}
async function main() {
	const left = host(),
		right = host();
	const props = { app, card, callbacks, context: left.context };
	mountDashboardPanel(left.root, h(TaskPanel, props));
	mountDashboardPanel(right.root, h(TaskPanel, { ...props, context: right.context }));
	const rows = () => Array.from(left.root.querySelectorAll<HTMLElement>('.dashboard-task-item'));
	assert.equal(rows().length, 4, 'collapsed descendants remain mounted');
	const grandchild = rows()[2]!;
	rows()[0]!.querySelector<HTMLElement>('.dashboard-task-toggle')!.click();
	await flush();
	assert.ok(!rows()[1]!.classList.contains('dashboard-task-item--hidden'));
	assert.ok(grandchild.classList.contains('dashboard-task-item--hidden'), 'nested collapse remains independent');
	rows()[1]!.querySelector<HTMLElement>('.dashboard-task-toggle')!.click();
	await flush();
	assert.equal(rows()[2], grandchild, 'expanding preserves row identity');
	assert.ok(!grandchild.classList.contains('dashboard-task-item--hidden'));
	rows()[0]!.querySelector<HTMLElement>('.dashboard-task-toggle')!.click();
	await flush();
	rows()[0]!.querySelector<HTMLElement>('.dashboard-task-toggle')!.click();
	await flush();
	assert.ok(
		!grandchild.classList.contains('dashboard-task-item--hidden'),
		'repeated collapse keeps local child state',
	);
	assert.ok(
		right.root.querySelectorAll('.dashboard-task-item')[1]!.classList.contains('dashboard-task-item--hidden'),
		'other leaf unaffected',
	);
	const label = rows()[3]!.querySelector<HTMLElement>('.dashboard-task-text')!;
	event(label, 'dblclick');
	await flush();
	let edit = label.querySelector<HTMLTextAreaElement>('textarea')!;
	edit.value = 'cancelled';
	event(edit, 'keydown', { key: 'Escape' });
	await flush();
	assert.ok(label.querySelector('.dashboard-wikilink'), 'cancel restores live link markup');
	assert.ok(!actions.some((action) => action[0] === 'onTaskEdit'));
	event(label, 'dblclick');
	await flush();
	edit = label.querySelector<HTMLTextAreaElement>('textarea')!;
	edit.value = 'saved';
	event(edit, 'keydown', { key: 'Enter' });
	event(edit, 'blur');
	await flush();
	assert.equal(actions.filter((action) => action[0] === 'onTaskEdit').length, 1, 'Enter followed by blur saves once');
	const transfer = { effectAllowed: '', setData() {} };
	event(rows()[3]!, 'dragstart', { dataTransfer: transfer });
	assert.deepEqual(left.context.taskDragSource.current, { cardId: card.id, taskPath: [1] });
	assert.equal(right.context.taskDragSource.current, null, 'drag state isolated');
	const dest = host();
	dest.context.taskDragSource.current = left.context.taskDragSource.current;
	mountDashboardPanel(
		dest.root,
		h(TaskPanel, { ...props, card: { ...card, id: 'destination', tasks: [] }, context: dest.context }),
	);
	event(dest.root.querySelector('.dashboard-task-list')!, 'drop');
	assert.deepEqual(actions.at(-1), ['onTaskMoveToCard', 'tasks', [1], 'destination', [0], 'before']);
	event(rows()[3]!, 'dragend');
	assert.equal(left.context.taskDragSource.current, null);

	const project = host();
	mountDashboardPanel(
		project.root,
		h(ProjectPanel, {
			...props,
			context: project.context,
			card: { ...card, docs: [{ path: 'Target.md', collapsed: true, children: [{ path: 'Target.md' }] }] },
		}),
	);
	project.root.querySelector<HTMLElement>('.dashboard-task-toggle')!.click();
	await flush();
	assert.equal(project.root.querySelectorAll('.dashboard-project-doc-item--hidden').length, 0);

	const memo = host();
	const nativeChildren = new Set<Component>();
	memo.context.markdownComponent = {
		addChild: (child: Component) => {
			nativeChildren.add(child);
			return child;
		},
		removeChild: (child: Component) => {
			nativeChildren.delete(child);
		},
	} as unknown as Component;
	const completions: (() => void)[] = [];
	MarkdownRenderer.render = (_app: unknown, markdown: string, target: unknown) =>
		new Promise<void>((resolve) => {
			completions.push(() => {
				const element = target as HTMLElement;
				element.textContent = markdown;
				resolve();
			});
		});
	mountDashboardPanel(
		memo.root,
		h(MemoPanel, { ...props, context: memo.context, card: { ...card, tasks: [], body: 'old' } }),
	);
	mountDashboardPanel(
		memo.root,
		h(MemoPanel, { ...props, context: memo.context, card: { ...card, tasks: [], body: 'new' } }),
	);
	await flush();
	completions.at(-1)!();
	await flush();
	completions[0]!();
	await flush();
	assert.ok(memo.root.textContent?.includes('new'));
	assert.ok(!memo.root.textContent?.includes('old'), 'late markdown cannot overwrite newer content');
	assert.equal(nativeChildren.size, 1);
	destroyDashboardPanels(memo.root);
	assert.equal(nativeChildren.size, 0, 'native Markdown children released');

	const shell = host();
	mountDashboardPanel(
		shell.root,
		h(CardPanel, { ...props, root: shell.root, context: shell.context, sectionType: 'todo' }),
	);
	const header = shell.root.querySelector('h4')!;
	event(header, 'dblclick');
	await flush();
	const title = header.querySelector<HTMLInputElement>('input')!;
	title.value = 'changed';
	event(title, 'keydown', { key: 'Escape' });
	event(title, 'blur');
	await flush();
	assert.ok(!actions.some((action) => action[0] === 'onCardTitleEdit'), 'title cancel does not commit on blur');

	// One native timer can feed multiple panels; unmounting one only removes its own subscription.
	Object.assign(globalThis, { activeDocument: document, window });
	const readingHost = { app: memoryVault({}, window).app, settings: {}, saveSettings: async () => {}, manifest: { id: 'nand' } } as unknown as WidgetSettingsHost;
	const service = new ReadingService(readingHost);
	let firstTicks = 0,
		secondTicks = 0;
	const offFirst = service.subscribeTick(() => firstTicks++),
		offSecond = service.subscribeTick(() => secondTicks++);
	service.discardSession();
	assert.deepEqual([firstTicks, secondTicks], [1, 1]);
	offFirst();
	service.discardSession();
	assert.deepEqual([firstTicks, secondTicks], [1, 2]);
	offSecond();
	const shelfA = host(),
		shelfB = host();
	const shelf = { service, add: () => {}, statistics: () => {}, edit: () => {}, finish: () => {} };
	mountDashboardPanel(shelfA.root, h(ReadingPanel, shelf));
	mountDashboardPanel(shelfB.root, h(ReadingPanel, shelf));
	await service.addActiveBook({
		title: 'Shared book',
		author: '',
		isbn: '',
		coverUrl: '',
		totalPages: 100,
		currentPage: 0,
		finished: false,
	} as Parameters<ReadingService['addActiveBook']>[0]);
	await flush();
	assert.ok(shelfA.root.textContent?.includes('Shared book'));
	assert.ok(shelfB.root.textContent?.includes('Shared book'));
	const scroll = shelfB.root.querySelector('.dashboard-reading-scroll');
	destroyDashboardPanels(shelfA.root);
	await service.updateBookInfo('Shared book', { author: 'Updated' });
	await flush();
	assert.ok(shelfB.root.textContent?.includes('Updated'));
	assert.equal(shelfB.root.querySelector('.dashboard-reading-scroll'), scroll);
	destroyDashboardPanels(shelfB.root);
	service.destroy();

	// Failed frontmatter moves roll the visual groups back; successful multi-valued moves replace only the source member.
	const board = host();
	const one = Object.assign(new TFile(), { path: 'one.md', name: 'one.md', basename: 'One', extension: 'md' });
	const two = Object.assign(new TFile(), { path: 'two.md', name: 'two.md', basename: 'Two', extension: 'md' });
	const metadata = new Map<TFile, Record<string, unknown>>([
		[one, { status: ['A', 'Keep'] }],
		[two, { status: 'B' }],
	]);
	let rejectWrite = true;
	const libraryApp = Object.assign(new App(), {
		metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: metadata.get(file) }) },
		fileManager: {
			processFrontMatter: async (file: TFile, mutate: (data: Record<string, unknown>) => void) => {
				if (rejectWrite) throw new Error('expected test failure');
				mutate(metadata.get(file)!);
			},
		},
	});
	const results: LibraryFileResult[] = [one, two].map((file) => ({
		file,
		basename: file.basename,
		mtime: 1,
		ctime: 1,
		frontmatter: metadata.get(file)!,
		preview: '',
		tags: [],
	}));
	mountDashboardPanel(
		board.root,
		h(LibraryKanban, {
			app: libraryApp,
			results,
			context: board.context,
			config: { filters: [], viewMode: 'kanban', sortBy: 'name', sortDesc: false, kanbanGroupBy: 'status' },
		}),
	);
	const column = (key: string) => board.root.querySelector<HTMLElement>(`[data-group-label="${key}"]`)!;
	const drop = async () => {
		event(column('A').querySelector('.dashboard-library-kanban-card')!, 'dragstart', { dataTransfer: transfer });
		event(column('B'), 'drop');
		await flush();
	};
	await drop();
	assert.equal(
		column('A').querySelectorAll('.dashboard-library-kanban-card').length,
		1,
		'failed move restores source',
	);
	assert.equal(
		column('B').querySelectorAll('.dashboard-library-kanban-card').length,
		1,
		'failed move restores target count',
	);
	rejectWrite = false;
	await drop();
	assert.deepEqual(metadata.get(one)!.status, ['Keep', 'B']);
	assert.equal(
		column('Keep').querySelectorAll('.dashboard-library-kanban-card').length,
		1,
		'other property membership preserved',
	);
	assert.equal(column('B').querySelectorAll('.dashboard-library-kanban-card').length, 2);
	destroyDashboardPanels(board.root);
	for (const item of [left, right, dest, project, shell]) destroyDashboardPanels(item.root);
	assert.equal(left.context.panels.size, 0);
	// A video decoder is retained across unrelated renders, released on replacement and unmount.
	let pauses = 0,
		loads = 0;
	Object.assign(window.HTMLElement.prototype, {
		pause() {
			pauses++;
		},
		load() {
			loads++;
		},
	});
	const videoHost = host();
	mountDashboardPanel(videoHost.root, h(MediaVideo, { src: 'first.mp4', className: 'video', play: true }));
	const video = videoHost.root.querySelector('video')!;
	mountDashboardPanel(videoHost.root, h(MediaVideo, { src: 'first.mp4', className: 'selected', play: true }));
	assert.equal(videoHost.root.querySelector('video'), video);
	assert.equal(pauses, 0);
	mountDashboardPanel(videoHost.root, h(MediaVideo, { src: 'second.mp4', className: 'selected', play: true }));
	assert.equal(pauses, 1);
	assert.equal(video.getAttribute('src'), 'second.mp4', 'source cleanup must not erase the replacement source');
	destroyDashboardPanels(videoHost.root);
	assert.equal(pauses, 2);
	assert.equal(loads, 2);
	assert.equal(video.getAttribute('src'), null);

	// Expense service changes preserve ledger filters, row selection, input and ledgerScroll nodes.
	const expenseHost = { ...readingHost, settings: { expenseCurrency: '$' } } as unknown as WidgetSettingsHost;
	const expenseService = new ExpenseService(expenseHost),
		ledger = host(),
		stats = host();
	for (let i = 0; i < 55; i++)
		expenseService.addRecord({
			type: 'expense',
			amount: i + 1,
			category: 'food',
			note: `meal ${i}`,
			date: expenseToday(),
		});
	mountDashboardPanel(ledger.root, h(ExpenseLedgerPanel, { service: expenseService, close: () => {} }));
	mountDashboardPanel(
		stats.root,
		h(ExpenseStatsPanel, { service: expenseService, close: () => {}, root: stats.root }),
	);
	const search = ledger.root.querySelector<HTMLInputElement>('.dashboard-expense-ledger-search')!,
		ledgerScroll = ledger.root.querySelector<HTMLElement>('.dashboard-expense-ledger-wrap')!;
	assert.equal(ledger.root.querySelectorAll('tbody tr').length, 50, 'ledger paginates long histories');
	search.value = 'meal 1';
	event(search, 'input');
	await flush();
	assert.equal(ledger.root.querySelectorAll('tbody tr').length, 11);
	const checkbox = ledger.root.querySelector<HTMLInputElement>('tbody input')!;
	checkbox.checked = true;
	event(checkbox, 'change');
	await flush();
	ledgerScroll.scrollTop = 77;
	expenseService.addRecord({
		type: 'income',
		amount: 100,
		category: 'salary',
		note: 'unrelated',
		date: expenseToday(),
	});
	await flush();
	assert.equal(ledger.root.querySelector('.dashboard-expense-ledger-search'), search);
	assert.equal(search.value, 'meal 1');
	assert.equal(ledger.root.querySelector('.dashboard-expense-ledger-wrap'), ledgerScroll);
	assert.equal(ledgerScroll.scrollTop, 77);
	assert.equal(ledger.root.querySelectorAll('tbody tr').length, 11);
	assert.equal(ledger.root.querySelector<HTMLInputElement>('tbody input')!.checked, true);
	assert.ok(stats.root.querySelector('svg'), 'statistics render actual SVG components');
	destroyDashboardPanels(ledger.root);
	destroyDashboardPanels(stats.root);
	expenseService.destroy();

	// Query refresh keeps the result panel, active filter and page size mounted.
	const queryHost = host(),
		queryFiles = Array.from({ length: 12 }, (_, i) =>
			Object.assign(new TFile(), {
				path: `Note ${i}.md`,
				basename: `Note ${i}`,
				extension: 'md',
				stat: { mtime: 1, ctime: 1, size: 10 },
				parent: { path: '' },
			}),
		);
	const queryApp = {
		vault: {
			getAbstractFileByPath: (path: string) => queryFiles.find((f) => f.path === path) ?? null,
			getFileByPath: (path: string) => queryFiles.find((f) => f.path === path) ?? null,
			getMarkdownFiles: () => queryFiles,
			cachedRead: async () => '',
		},
		metadataCache: { getFileCache: () => null, resolvedLinks: {} },
	} as unknown as App;
	let reloadQuery = () => {};
	mountDashboardPanel(
		queryHost.root,
		h(DataviewPanel, {
			context: { app: queryApp, hoverParent: null, opener: null },
			config: { query: 'TABLE file.name', pageSize: 10, viewMode: 'table' } as DataviewConfig,
			reloadRegister: (reload) => {
				reloadQuery = reload;
			},
			change: null,
		}),
	);
	await flush();
	await flush();
	const querySearch = queryHost.root.querySelector<HTMLInputElement>('.dashboard-dataview-search')!;
	assert.ok(querySearch, 'query rendered');
	querySearch.value = 'Note 1';
	event(querySearch, 'input');
	await flush();
	const resultBody = queryHost.root.querySelector('.dashboard-dataview-body');
	reloadQuery();
	await flush();
	await flush();
	assert.equal(
		queryHost.root.querySelector('.dashboard-dataview-search'),
		querySearch,
		'query reload preserves the input node',
	);
	assert.equal(querySearch.value, 'Note 1');
	assert.equal(queryHost.root.querySelector('.dashboard-dataview-body'), resultBody);
	destroyDashboardPanels(queryHost.root);

	// Native modal teardown releases only the owner's panels, then the whole plugin scope.
	Object.assign(window.HTMLElement.prototype, {
		addClass(this: HTMLElement, ...names: string[]) {
			this.classList.add(...names);
		},
		empty(this: HTMLElement) {
			this.replaceChildren();
		},
	});
	Object.assign(window, { getComputedStyle: () => ({ getPropertyValue: () => '' }) });
	let mountedModals = 0;
	function Probe() {
		useLayoutEffect(() => {
			mountedModals++;
			return () => {
				mountedModals--;
			};
		}, []);
		return h('div', {}, 'modal probe');
	}
	const ownerA = {},
		ownerB = {};
	const createModal = (owner: object) => {
		const modal = new DashboardPanelModal(app, 'dashboard-expense-stats-modal', () => h(Probe, {}), owner);
		Object.assign(modal, { modalEl: document.createElement('div'), contentEl: document.createElement('div') });
		modal.close = () => modal.onClose();
		modal.onOpen();
		return modal;
	};
	const modalA = createModal(ownerA),
		modalB = createModal(ownerB);
	assert.equal(mountedModals, 2);
	closeOwnedDashboardPanels(app, ownerA);
	assert.equal(mountedModals, 1);
	assert.equal(modalA.contentEl.textContent, '');
	assert.equal(modalB.contentEl.textContent, 'modal probe');
	closeDashboardPanelModals(app);
	assert.equal(mountedModals, 0);
	assert.equal(modalB.contentEl.textContent, '');

	// Both native Obsidian close-button variants leave one keyboard-reachable panel close.
	for (const nativeClass of ['modal-header-button', 'modal-close-button']) {
		const service = { getHabits: () => [], saveState: { status: 'saved' }, retrySave: async () => {}, subscribe: () => () => {} } as unknown as HabitService;
		const modal = new DashboardPanelModal(app, 'dashboard-habit-stats-modal', (close) => h(HabitStatsPanel, { service, close }));
		const shell = document.createElement('div');
		const native = document.createElement('button');
		native.className = nativeClass;
		const content = document.createElement('div');
		shell.append(native, content);
		Object.assign(modal, { modalEl: shell, contentEl: content });
		modal.close = () => modal.onClose();
		modal.onOpen();
		assert.equal(shell.querySelectorAll('button').length, 1, `${nativeClass} does not duplicate the close action`);
		assert.ok(shell.classList.contains('dashboard-habit-stats-host'));
		const close = shell.querySelector<HTMLButtonElement>('.dashboard-habit-stats-close')!;
		assert.equal(close.tagName, 'BUTTON');
		close.click();
		assert.equal(content.textContent, '');
	}
	const quick = host(), lunar = host();
	await loadLunar();
	const customAction = { name: 'My New Journal / 用户名字', target: 'daily-notes', type: 'command' as const, icon: 'star' };
	let executed: unknown;
	for (const language of ['zh', 'en', 'zh'] as const) {
		setLanguage(language);
		mountDashboardPanel(quick.root, h(QuickActionsPanel, { actions: [customAction], execute: (action) => { executed = action; }, remove: () => {}, add: () => {} }));
		assert.deepEqual(Array.from(quick.root.querySelectorAll('.dashboard-qa-name')).map((node) => node.textContent), language === 'zh' ? ['新建日记', '新建笔记', customAction.name] : ['New journal', 'New note', customAction.name]);
		quick.root.querySelector<HTMLElement>('[data-qa-key="c:daily-notes"] .dashboard-qa-run')!.click();
		assert.equal(executed, customAction, 'Custom actions retain their saved identity and name');
		mountDashboardPanel(lunar.root, h(LunarPanel, { holidays: {}, win: window as unknown as Window, fortune: () => {} }));
		assert.equal(lunar.root.querySelector('.dashboard-sidebar-lunar-almanac') !== null, language === 'zh', 'English omits the Chinese-only daily quote');
	}
	destroyDashboardPanels(quick.root);
	destroyDashboardPanels(lunar.root);

	// Language changes reconcile existing roots; no draft loss, accidental submit or effect restart.
	const languageHost = host();
	const chrome = document.createElement('button');
	setLocalizedText(chrome, 'renderer.addSection');
	for (const [key, value] of Object.entries(localizedAttributes('banner.editLabel'))) chrome.setAttribute(key, value);
	languageHost.root.append(chrome);
	const noteRoot = document.createElement('div');
	languageHost.root.append(noteRoot);
	mountDashboardPanel(noteRoot, h(QuickNotesPanel, {
		root: noteRoot, settings: { quickCaptureEnabled: true } as never, callbacks: {} as RenderCallbacks,
	}));
	const draft = noteRoot.querySelector('textarea')!;
	draft.value = '未提交 user draft';
	setLanguage('en');
	refreshDashboardLanguage(languageHost.root);
	assert.equal(noteRoot.querySelector('textarea'), draft, 'The existing input node survives');
	assert.equal(draft.value, '未提交 user draft');
	assert.equal(chrome.textContent, t('renderer.addSection'));
	assert.equal(chrome.getAttribute('aria-label'), t('banner.editLabel'));
	assert.equal(draft.placeholder, t('quickNote.capturePlaceholder'));
	const nameEl = document.createElement('div'), inputEl = document.createElement('input');
	languageHost.root.append(nameEl, inputEl);
	inputEl.value = '草稿';
	bindLocalizedControl({ nameEl }, 'name', 'common.save');
	bindLocalizedControl({ inputEl }, 'placeholder', 'quickNote.capturePlaceholder');
	setLanguage('zh');
	refreshLocalizedDom(languageHost.root);
	assert.equal(nameEl.textContent, t('common.save'));
	assert.equal(inputEl.value, '草稿');
	assert.equal(inputEl.placeholder, t('quickNote.capturePlaceholder'));
	nameEl.textContent = 'User-owned result';
	setLanguage('en');
	refreshLocalizedDom(languageHost.root);
	assert.equal(nameEl.textContent, 'User-owned result', 'Retired loading labels cannot replace later content');
	destroyDashboardPanels(languageHost.root);
	setLanguage('zh');

	await verifyOpenIssuePanels(document);
	console.log(
		'Dashboard panels: editing, drag rollback, async Markdown, subscriptions, video cleanup, ledger/query state and native modal teardown passed',
	);
}
void main();
