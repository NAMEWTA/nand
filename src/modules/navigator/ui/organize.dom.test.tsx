// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NandProviders } from '../../../ui/react/providers';
import { setLanguage } from '../../../shared/i18n';
import { createMemoryCache } from '../platform/cache-store';
import { PreviewStore } from '../platform/preview-store';
import { FakeVault, createTestService, note } from '../services/test-support';
import type { NavigatorEnv } from './env';
import { NavigatorContext } from './hooks';
import { ListPane } from './ListPane';
import { NavPane } from './NavPane';

vi.mock('obsidian', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), Platform: { isMacOS: false, isPhone: false, isMobile: false } }));

beforeAll(() => {
	// happy-dom has no layout: give every element a size so the virtualizer renders rows.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 600, width: 300, height: 600, toJSON: () => ({}) } as DOMRect);
	Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 600 });
	Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 300 });
	Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
	globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
	HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { vi.useRealTimers(); });

const files = () => [
	note('Work/a.md', 30, ['plan'], { aliases: ['Alpha'], props: { status: ['active'] } }),
	note('Work/b.md', 20, [], { props: { status: ['done'] } }),
	note('Work/c.md', 10),
	note('Home/d.md', 5, ['plan', 'home']),
];

async function fixture(options: Parameters<typeof createTestService>[1] = {}) {
	setLanguage('en');
	const vault = new FakeVault(files(), ['/', 'Work', 'Home']);
	const { service, calls, settings } = await createTestService(vault, options);
	const previews = new PreviewStore({
		cache: createMemoryCache(),
		source: { mtime: () => 1, isMarkdown: () => true, readText: (path) => Promise.resolve(`Preview of ${path}`), propertyImage: () => undefined, resolveImage: () => null, title: () => '', metadataReady: () => true },
		scheduler: { now: () => 0, yield: () => Promise.resolve(), later: (callback) => { const handle = setTimeout(callback, 0); return () => clearTimeout(handle); } },
		imageProperties: () => [],
	});
	const env: NavigatorEnv = {
		app: { scope: {}, keymap: { pushScope() {}, popScope() {} } } as never,
		service,
		previews,
		isMac: false,
		resolveIcon: () => ({ icon: null, emoji: false, color: null }),
		subscribeIcons: () => () => undefined,
		imageUrl: (path) => path,
		copyPath: () => undefined,
		openSettings: () => undefined,
		openAppearance: () => undefined,
		askName: (_title, value) => Promise.resolve(value),
		report: (error) => { throw error instanceof Error ? error : new Error(String(error)); },
	};
	const view = (node: React.ReactNode) => render(<NandProviders ownerDocument={document}><NavigatorContext.Provider value={env}><div className="nand-ui">{node}</div></NavigatorContext.Provider></NandProviders>);
	return { vault, service, calls, settings, env, view };
}


const notePaths = () => [...document.querySelectorAll<HTMLElement>('[data-note-path]')].map((row) => row.dataset.notePath);
const navKeys = () => [...document.querySelectorAll<HTMLElement>('[data-nav-key]')].map((row) => row.dataset.navKey);

/** happy-dom ignores clientY on drag events, so set it on the event itself. */
function dragAt(type: 'dragOver' | 'drop', element: Element, dataTransfer: object, clientY: number) {
	const event = createEvent[type](element, { dataTransfer });
	Object.defineProperty(event, 'clientY', { value: clientY });
	fireEvent(element, event);
}

function dragData() {
	const data = new Map<string, string>();
	const transfer = { types: [] as string[], setData: (type: string, value: string) => { data.set(type, value); transfer.types = [...data.keys()]; }, getData: (type: string) => data.get(type) ?? '', effectAllowed: '', dropEffect: '' };
	return transfer;
}

test('the search button opens a focused field; typing filters the list below the selected folder', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	fireEvent.click(await screen.findByText('Work'));
	await waitFor(() => expect(notePaths()).toHaveLength(3));
	fireEvent.click(document.querySelector<HTMLElement>('[data-navigator-pane=list] header')!.querySelector('button[aria-label="Search"]')!);
	const input = await screen.findByRole('textbox', { name: 'Filter notes' });
	await waitFor(() => expect(document.activeElement).toBe(input));
	fireEvent.change(input, { target: { value: 'alpha' } });
	await waitFor(() => expect(notePaths()).toEqual(['Work/a.md']));
	fireEvent.change(input, { target: { value: '.status=done' } });
	await waitFor(() => expect(notePaths()).toEqual(['Work/b.md']));
	fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
	await waitFor(() => expect(notePaths()).toHaveLength(3));
});

test('Enter and Tab leave the field for the list, Shift+Tab for the folders, Escape closes the search and keeps the query', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	fireEvent.click(await screen.findByText('Work'));
	t.service.openSearch();
	const input = await screen.findByRole('textbox', { name: 'Filter notes' });
	fireEvent.change(input, { target: { value: 'c' } });
	await waitFor(() => expect(notePaths()).toEqual(['Work/c.md']));
	input.focus();
	fireEvent.keyDown(input, { key: 'Enter' });
	await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('listbox')));
	expect(t.service.state.getState().selection.paths).toEqual(['Work/c.md']);
	input.focus();
	fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
	await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tree')));
	input.focus();
	fireEvent.keyDown(input, { key: 'Tab' });
	await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('listbox')));
	input.focus();
	fireEvent.keyDown(input, { key: 'Escape' });
	await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Filter notes' })).toBeNull());
	expect(notePaths()).toHaveLength(3);
	expect(t.service.state.getState().search.query).toBe('c');
	await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('listbox')));
	t.service.openSearch();
	expect((await screen.findByRole('textbox', { name: 'Filter notes' }) as HTMLInputElement).value).toBe('c');
});

test('Mod+click on a tag pill or a tag row adds it to the search with AND, Mod+Shift+click with OR, and again removes it', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	fireEvent.click(await screen.findByText('Home'));
	await waitFor(() => expect(notePaths()).toEqual(['Home/d.md']));
	fireEvent.click(await screen.findByRole('button', { name: '#plan' }), { ctrlKey: true });
	expect(t.service.state.getState().search).toEqual({ open: true, query: '#plan' });
	fireEvent.click(await screen.findByRole('button', { name: '#home' }), { ctrlKey: true, shiftKey: true });
	expect(t.service.state.getState().search.query).toBe('#plan OR #home');
	fireEvent.click(document.querySelector('[data-nav-key="tag:plan"]')!, { ctrlKey: true });
	expect(t.service.state.getState().search.query).toBe('#home');
	// A plain click still goes to the tag.
	t.service.setSearchQuery('');
	fireEvent.click(await screen.findByRole('button', { name: '#plan' }));
	expect(t.service.state.getState().context).toEqual({ kind: 'tag', key: 'plan' });
});

test('the star saves the query as a shortcut that applies it again', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	t.service.openSearch();
	const input = await screen.findByRole('textbox', { name: 'Filter notes' });
	expect((screen.getByRole('button', { name: 'Save search as a shortcut' }) as HTMLButtonElement).disabled).toBe(true);
	fireEvent.change(input, { target: { value: '#plan' } });
	fireEvent.click(await screen.findByRole('button', { name: 'Save search as a shortcut' }));
	const row = await waitFor(() => { const found = document.querySelector('[data-nav-key="shortcut:search:#plan"]'); expect(found).toBeTruthy(); return found!; });
	fireEvent.change(input, { target: { value: '' } });
	fireEvent.click(row);
	await waitFor(() => expect(notePaths()).toEqual(['Work/a.md', 'Home/d.md']));
	expect((input as HTMLInputElement).value).toBe('#plan');
});

test('shortcuts reorder by dragging a row onto another; folders and tags dropped on a shortcut are pinned', async () => {
	const t = await fixture();
	for (const name of ['Work', 'Home']) t.service.toggleShortcut({ id: `folder:${name}`, kind: 'folder', key: name });
	t.service.toggleShortcut({ id: 'tag:plan', kind: 'tag', key: 'plan' });
	t.view(<NavPane />);
	await screen.findByText('Shortcuts');
	const shortcuts = () => navKeys().filter((key) => key?.startsWith('shortcut:'));
	expect(shortcuts()).toEqual(['shortcut:folder:Work', 'shortcut:folder:Home', 'shortcut:tag:plan']);
	const transfer = dragData();
	fireEvent.dragStart(document.querySelector('[data-nav-key="shortcut:tag:plan"]')!, { dataTransfer: transfer });
	const first = document.querySelector('[data-nav-key="shortcut:folder:Work"]')!;
	dragAt('dragOver', first, transfer, 0);
	dragAt('drop', first, transfer, 0);
	await waitFor(() => expect(shortcuts()).toEqual(['shortcut:tag:plan', 'shortcut:folder:Work', 'shortcut:folder:Home']));
	// Dropping on the lower half puts it after the row.
	const again = dragData();
	fireEvent.dragStart(document.querySelector('[data-nav-key="shortcut:tag:plan"]')!, { dataTransfer: again });
	dragAt('drop', document.querySelector('[data-nav-key="shortcut:folder:Home"]')!, again, 500);
	await waitFor(() => expect(shortcuts()).toEqual(['shortcut:folder:Work', 'shortcut:folder:Home', 'shortcut:tag:plan']));
	// A folder dragged from the tree onto a shortcut is pinned; so is a tag.
	t.service.removeShortcut('tag:plan');
	t.service.removeShortcut('folder:Home');
	const pin = dragData();
	fireEvent.dragStart(await screen.findByText('Home').then((node) => node.closest('[data-nav-key]')!), { dataTransfer: pin });
	fireEvent.drop(document.querySelector('[data-nav-key="shortcut:folder:Work"]')!, { dataTransfer: pin });
	expect(t.service.settings.get().shortcuts.map((entry) => entry.id)).toEqual(['folder:Work', 'folder:Home']);
	const tagDrag = dragData();
	fireEvent.dragStart(document.querySelector('[data-nav-key="tag:plan"]')!, { dataTransfer: tagDrag });
	fireEvent.drop(document.querySelector('[data-nav-key="shortcut:folder:Work"]')!, { dataTransfer: tagDrag });
	expect(t.service.settings.get().shortcuts.map((entry) => entry.id)).toEqual(['folder:Work', 'folder:Home', 'tag:plan']);
});

test('sections fold when their title is clicked and reorder by dragging a title', async () => {
	const t = await fixture();
	t.view(<NavPane />);
	await screen.findByText('Folders');
	expect(navKeys()).toContain('folder:Work');
	fireEvent.click(screen.getByRole('button', { name: /^Folders/ }));
	await waitFor(() => expect(navKeys()).not.toContain('folder:Work'));
	expect(screen.getByRole('button', { name: /^Folders/ }).getAttribute('aria-expanded')).toBe('false');
	fireEvent.click(screen.getByRole('button', { name: /^Folders/ }));
	await waitFor(() => expect(navKeys()).toContain('folder:Work'));
	const sections = () => navKeys().filter((key) => key?.startsWith('section:'));
	expect(sections()).toEqual(['section:folders', 'section:tags', 'section:properties']);
	const transfer = dragData();
	fireEvent.dragStart(document.querySelector('[data-nav-key="section:properties"]')!, { dataTransfer: transfer });
	const folders = document.querySelector('[data-nav-key="section:folders"]')!;
	dragAt('dragOver', folders, transfer, 0);
	dragAt('drop', folders, transfer, 0);
	await waitFor(() => expect(sections()).toEqual(['section:properties', 'section:folders', 'section:tags']));
	void t;
});

test('property rows expand to values; choosing a value lists its notes and Mod+click filters by it', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	const key = await screen.findByText('status');
	fireEvent.doubleClick(key);
	const value = await waitFor(() => { const found = document.querySelector('[data-nav-key="property:status=done"]'); expect(found).toBeTruthy(); return found!; });
	fireEvent.click(value);
	await waitFor(() => expect(notePaths()).toEqual(['Work/b.md']));
	fireEvent.click(document.querySelector('[data-nav-key="property:status=active"]')!, { ctrlKey: true });
	expect(t.service.state.getState().search.query).toBe('.status=active');
});

test('the context menu pins, unpins and hides', async () => {
	const t = await fixture();
	t.view(<NavPane />);
	const row = (await screen.findByText('Work')).closest('[data-nav-key]')!;
	fireEvent.contextMenu(row);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Add to shortcuts' }));
	await waitFor(() => expect(t.service.settings.get().shortcuts.map((entry) => entry.id)).toEqual(['folder:Work']));
	const shortcut = await waitFor(() => { const found = document.querySelector('[data-nav-key="shortcut:folder:Work"]'); expect(found).toBeTruthy(); return found!; });
	fireEvent.contextMenu(shortcut);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove from shortcuts' }));
	await waitFor(() => expect(t.service.settings.get().shortcuts).toEqual([]));
	fireEvent.contextMenu((await screen.findByText('Home')).closest('[data-nav-key]')!);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Hide' }));
	await waitFor(() => expect(navKeys()).not.toContain('folder:Home'));
	expect(t.service.settings.get().hiddenFolders).toEqual(['/Home']);
});

test('hidden items come back dimmed while "show hidden" is on', async () => {
	const t = await fixture({ settings: { hiddenFolders: ['Home'] } });
	t.view(<NavPane />);
	await screen.findByText('Work');
	expect(navKeys()).not.toContain('folder:Home');
	fireEvent.click(screen.getByRole('button', { name: 'Show hidden items' }));
	const row = await waitFor(() => { const found = document.querySelector('[data-nav-key="folder:Home"]'); expect(found).toBeTruthy(); return found!; });
	expect(row.className).toContain('opacity-50');
});

test('groups by a property and titles the notes without one None', async () => {
	const t = await fixture();
	t.view(<ListPane />);
	t.service.selectContext({ kind: 'folder', key: 'Work' });
	t.service.setListOptions({ groupBy: 'property', groupProperty: 'status' });
	await waitFor(() => expect(screen.getByText('active')).toBeTruthy());
	expect(screen.getByText('done')).toBeTruthy();
	expect(screen.getByText('None')).toBeTruthy();
});

test('searching away the selected note, then Enter and Delete, only deletes a note that is shown', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	fireEvent.click(await screen.findByText('Work'));
	await waitFor(() => expect(notePaths()).toHaveLength(3));
	fireEvent.click(document.querySelector('[data-note-path="Work/a.md"]')!);
	await waitFor(() => expect(document.querySelector('[data-note-path="Work/a.md"]')!.getAttribute('aria-selected')).toBe('true'));
	t.service.openSearch();
	const input = await screen.findByRole('textbox', { name: 'Filter notes' });
	fireEvent.change(input, { target: { value: 'c' } });
	await waitFor(() => expect(notePaths()).toEqual(['Work/c.md']));
	expect(document.querySelectorAll('[data-note-path][aria-selected=true]')).toHaveLength(0);
	fireEvent.keyDown(input, { key: 'Enter' });
	const list = await screen.findByRole('listbox');
	await waitFor(() => expect(document.activeElement).toBe(list));
	fireEvent.keyDown(list, { key: 'Delete' });
	await waitFor(() => expect(t.calls.filter(([name]) => name === 'trash')).toEqual([['trash', ['Work/c.md']]]));
});

test('with every section folded the keyboard can still reach the titles and open them', async () => {
	const t = await fixture();
	t.service.toggleShortcut({ id: 'folder:Work', kind: 'folder', key: 'Work' });
	t.view(<NavPane />);
	for (const id of ['shortcuts', 'folders', 'tags', 'properties'] as const) t.service.toggleSection(id);
	const tree = await screen.findByRole('tree');
	await waitFor(() => expect(navKeys().every((key) => key?.startsWith('section:'))).toBe(true));
	tree.focus();
	fireEvent.keyDown(tree, { key: 'Home' });
	await waitFor(() => expect(tree.getAttribute('aria-activedescendant')).toBe('nav-row-section%3Ashortcuts'));
	fireEvent.keyDown(tree, { key: 'ArrowRight' });
	await waitFor(() => expect(screen.getByRole('button', { name: /^Shortcuts/ }).getAttribute('aria-expanded')).toBe('true'));
	fireEvent.keyDown(tree, { key: 'ArrowDown' });
	await waitFor(() => expect(tree.getAttribute('aria-activedescendant')).toBe('nav-row-shortcut%3Afolder%3AWork'));
	fireEvent.keyDown(tree, { key: 'Enter' });
	await waitFor(() => expect(t.service.state.getState().context).toEqual({ kind: 'folder', key: 'Work' }));
	fireEvent.keyDown(tree, { key: 'ArrowLeft' });
	fireEvent.keyDown(tree, { key: 'ArrowLeft' });
	await waitFor(() => expect(navKeys().filter((key) => key?.startsWith('shortcut:'))).toEqual([]));
	fireEvent.keyDown(tree, { key: 'Enter' });
	await waitFor(() => expect(navKeys()).toContain('shortcut:folder:Work'));
});

test('the context-menu key opens the menu of the focused shortcut row', async () => {
	const t = await fixture();
	t.service.toggleShortcut({ id: 'folder:Work', kind: 'folder', key: 'Work' });
	t.view(<NavPane />);
	const tree = await screen.findByRole('tree');
	tree.focus();
	fireEvent.keyDown(tree, { key: 'Home' });
	fireEvent.keyDown(tree, { key: 'ArrowDown' });
	await waitFor(() => expect(tree.getAttribute('aria-activedescendant')).toBe('nav-row-shortcut%3Afolder%3AWork'));
	fireEvent.keyDown(tree, { key: 'ContextMenu' });
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove from shortcuts' }));
	await waitFor(() => expect(t.service.settings.get().shortcuts).toEqual([]));
});

test('stopping the navigator closes the appearance dialog and its React root', async () => {
	const t = await fixture();
	const { DialogRegistry } = await import('./dialog-registry');
	const { openAppearanceDialog } = await import('./dialogs');
	const app = { workspace: { containerEl: document.body, getActiveViewOfType: () => null } } as never;
	const registry = new DialogRegistry();
	openAppearanceDialog(app, registry, t.service, { kind: 'folder', key: 'Work' });
	await waitFor(() => expect(document.querySelector('[data-appearance-field]')).toBeTruthy());
	expect(registry.size).toBe(1);
	registry.stop();
	await waitFor(() => expect(document.querySelector('[data-appearance-field]')).toBeNull());
	expect(document.querySelector('[role=dialog]')).toBeNull();
	// A dialog that finishes loading afterwards never opens.
	openAppearanceDialog(app, registry, t.service, { kind: 'folder', key: 'Work' });
	await waitFor(() => expect(document.querySelector('[data-appearance-field]')).toBeNull());
	expect(registry.size).toBe(0);
});

test('the name dialog belongs to the navigator: stopping it closes the dialog and nothing can be confirmed', async () => {
	const { DialogRegistry } = await import('./dialog-registry');
	const { askName } = await import('./dialogs');
	await fixture();
	const app = { workspace: { containerEl: document.body, getActiveViewOfType: () => null } } as never;
	const registry = new DialogRegistry();
	const answered: Array<string | undefined> = [];
	void askName(app, registry, { title: 'Detach', label: 'Name', value: 'Old', confirm: 'OK' }).then((value) => answered.push(value));
	const input = (await screen.findByRole('textbox', { name: 'Name' })) as HTMLInputElement;
	expect(input.value).toBe('Old');
	expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
	registry.stop();
	await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull());
	expect(answered).toEqual([undefined]);
	// Opening after stop never shows anything and answers "cancelled" at once.
	await askName(app, registry, { title: 'Late', label: 'Name', value: 'x', confirm: 'OK' }).then((value) => answered.push(value));
	expect(answered).toEqual([undefined, undefined]);
	expect(document.querySelector('[role=dialog]')).toBeNull();
});

test('the name dialog answers with the trimmed text on confirm', async () => {
	const { DialogRegistry } = await import('./dialog-registry');
	const { askName } = await import('./dialogs');
	await fixture();
	const app = { workspace: { containerEl: document.body, getActiveViewOfType: () => null } } as never;
	const registry = new DialogRegistry();
	const answer = askName(app, registry, { title: 'Rename', label: 'Name', value: 'Old', confirm: 'OK' });
	const input = await screen.findByRole('textbox', { name: 'Name' });
	fireEvent.change(input, { target: { value: '  New name ' } });
	fireEvent.click(screen.getByRole('button', { name: 'OK' }));
	expect(await answer).toBe('New name');
	expect(registry.size).toBe(0);
});
