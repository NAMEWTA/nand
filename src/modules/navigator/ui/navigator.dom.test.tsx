// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NandProviders } from '../../../ui/react/providers';
import { setLanguage } from '../../../shared/i18n';
import { createMemoryCache } from '../platform/cache-store';
import { PreviewStore } from '../platform/preview-store';
import { FakeVault, createTestService, note } from '../services/test-support';
import type { NavigatorEnv } from './env';
import { NavigatorContext } from './hooks';
import { ListPane } from './ListPane';
import { NavPane } from './NavPane';
import { NavigatorRoot } from './NavigatorRoot';

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

const files = () => [note('Work/a.md', 30, ['plan']), note('Work/b.md', 20), note('Work/c.md', 10), note('Home/d.md', 5, ['plan'])];

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
const selectedPaths = () => [...document.querySelectorAll<HTMLElement>('[data-note-path][aria-selected=true]')].map((row) => row.dataset.notePath);

test('the navigation pane lists folders and tags with counts; clicking selects the folder and lists its notes', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	await screen.findByRole('tree');
	const work = await screen.findByText('Work');
	expect(within(work.closest('[data-nav-key]') as HTMLElement).getByText('3')).toBeTruthy();
	expect(screen.getByText('plan')).toBeTruthy();
	fireEvent.click(work);
	await waitFor(() => expect(notePaths()).toEqual(['Work/a.md', 'Work/b.md', 'Work/c.md']));
	expect(within(document.querySelector('[data-navigator-pane=list] header') as HTMLElement).getByText('Work')).toBeTruthy();
});

test('keyboard: arrows move and open, shift extends, ctrl+a selects all, Home/End jump', async () => {
	const t = await fixture();
	t.view(<ListPane />);
	t.service.selectContext({ kind: 'folder', key: 'Work' });
	const list = await screen.findByRole('listbox');
	await waitFor(() => expect(notePaths()).toHaveLength(3));
	list.focus();
	fireEvent.keyDown(list, { key: 'ArrowDown' });
	await waitFor(() => expect(selectedPaths()).toEqual(['Work/a.md']));
	fireEvent.keyDown(list, { key: 'ArrowDown', shiftKey: true });
	fireEvent.keyDown(list, { key: 'ArrowDown', shiftKey: true });
	await waitFor(() => expect(selectedPaths()).toEqual(['Work/a.md', 'Work/b.md', 'Work/c.md']));
	fireEvent.keyDown(list, { key: 'End' });
	await waitFor(() => expect(selectedPaths()).toEqual(['Work/c.md']));
	fireEvent.keyDown(list, { key: 'Home' });
	await waitFor(() => expect(selectedPaths()).toEqual(['Work/a.md']));
	fireEvent.keyDown(list, { key: 'a', ctrlKey: true });
	await waitFor(() => expect(selectedPaths()).toHaveLength(3));
});

test('keyboard: left and right switch panes, Tab goes to the editor, Enter opens', async () => {
	const t = await fixture();
	t.view(<NavigatorRoot />);
	t.service.selectContext({ kind: 'folder', key: 'Work' });
	await waitFor(() => expect(notePaths()).toHaveLength(3));
	const tree = screen.getByRole('tree');
	tree.focus();
	fireEvent.keyDown(tree, { key: 'ArrowRight' });
	await waitFor(() => expect(t.service.state.getState().pane).toBe('list'));
	expect(t.service.state.getState().selection.paths).toEqual(['Work/a.md']);
	const list = screen.getByRole('listbox');
	fireEvent.keyDown(list, { key: 'Enter' });
	expect(t.calls).toContainEqual(['open', 'Work/a.md', { focus: true }]);
	fireEvent.keyDown(list, { key: 'ArrowLeft' });
	await waitFor(() => expect(t.service.state.getState().pane).toBe('nav'));
});

test('mouse: ctrl-click toggles, shift-click selects a range, a plain click opens', async () => {
	const t = await fixture({ settings: { openOnSelect: true } });
	t.view(<ListPane />);
	t.service.selectContext({ kind: 'folder', key: 'Work' });
	await waitFor(() => expect(notePaths()).toHaveLength(3));
	const row = (name: string) => document.querySelector(`[data-note-path="Work/${name}.md"]`) as HTMLElement;
	fireEvent.click(row('a'));
	expect(t.calls).toContainEqual(['open', 'Work/a.md', {}]);
	fireEvent.click(row('c'), { ctrlKey: true });
	await waitFor(() => expect(selectedPaths()).toEqual(['Work/a.md', 'Work/c.md']));
	fireEvent.click(row('b'));
	fireEvent.click(row('c'), { shiftKey: true });
	await waitFor(() => expect(selectedPaths()).toEqual(['Work/b.md', 'Work/c.md']));
});

test('F2 renames in place: Enter commits, a conflict keeps the editor with an error, Escape cancels', async () => {
	const t = await fixture();
	t.view(<ListPane />);
	t.service.selectContext({ kind: 'folder', key: 'Work' });
	await waitFor(() => expect(notePaths()).toHaveLength(3));
	const list = screen.getByRole('listbox');
	list.focus();
	fireEvent.keyDown(list, { key: 'ArrowDown' });
	fireEvent.keyDown(list, { key: 'F2' });
	const input = await screen.findByRole('textbox', { name: 'Rename' });
	expect((input as HTMLInputElement).value).toBe('a');
	fireEvent.change(input, { target: { value: 'taken' } });
	fireEvent.keyDown(input, { key: 'Enter' });
	await screen.findByRole('alert');
	expect(screen.getByRole('textbox', { name: 'Rename' })).toBeTruthy();
	fireEvent.change(input, { target: { value: 'renamed' } });
	fireEvent.keyDown(input, { key: 'Enter' });
	await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull());
	expect(t.calls).toContainEqual(['rename', 'Work/a.md', 'renamed']);
	fireEvent.keyDown(list, { key: 'F2' });
	const again = await screen.findByRole('textbox', { name: 'Rename' });
	fireEvent.keyDown(again, { key: 'Escape' });
	await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Rename' })).toBeNull());
});

test('IME composition does not trigger shortcuts', async () => {
	const t = await fixture();
	t.view(<ListPane />);
	t.service.selectContext({ kind: 'folder', key: 'Work' });
	await waitFor(() => expect(notePaths()).toHaveLength(3));
	const list = screen.getByRole('listbox');
	fireEvent.keyDown(list, { key: 'ArrowDown', isComposing: true });
	expect(selectedPaths()).toEqual([]);
});

test('drop on a folder row moves the dragged notes; drop on a tag adds the tag', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	fireEvent.click(await screen.findByText('Work'));
	await waitFor(() => expect(notePaths()).toHaveLength(3));
	const data = new Map<string, string>();
	const transfer = { types: [] as string[], setData: (type: string, value: string) => { data.set(type, value); transfer.types = [...data.keys()]; }, getData: (type: string) => data.get(type) ?? '', effectAllowed: '', dropEffect: '' };
	fireEvent.dragStart(document.querySelector('[data-note-path="Work/b.md"]')!, { dataTransfer: transfer });
	const home = document.querySelector('[data-nav-key="folder:Home"]')!;
	fireEvent.dragOver(home, { dataTransfer: transfer });
	fireEvent.drop(home, { dataTransfer: transfer });
	await waitFor(() => expect(t.calls).toContainEqual(['move', ['Work/b.md'], 'Home']));
	fireEvent.drop(document.querySelector('[data-nav-key="tag:plan"]')!, { dataTransfer: transfer });
	await waitFor(() => expect(t.calls).toContainEqual(['addTag', ['Work/b.md'], 'plan']));
});

test('a folder hovered during a drag expands after a short delay', async () => {
	const t = await fixture();
	t.service.selectContext({ kind: 'folder', key: 'Work' });
	t.vault.folderList.push('Work/Deep');
	t.vault.change(t.vault.files);
	t.view(<NavPane />);
	await screen.findByText('Work');
	vi.useFakeTimers();
	const transfer = { types: ['application/x-nand-navigator'], getData: () => '["Home/d.md"]', dropEffect: '' };
	const row = document.querySelector('[data-nav-key="folder:Work"]')!;
	expect(row.getAttribute('aria-expanded')).toBe('false');
	fireEvent.dragOver(row, { dataTransfer: transfer });
	await act(async () => { await vi.advanceTimersByTimeAsync(800); });
	expect(document.querySelector('[data-nav-key="folder:Work"]')!.getAttribute('aria-expanded')).toBe('true');
});

test('single-pane mode shows one pane at a time', async () => {
	const t = await fixture({ settings: { layout: 'single' } });
	t.view(<NavigatorRoot />);
	await screen.findByRole('tree');
	const panes = () => [...document.querySelectorAll<HTMLElement>('[data-navigator-pane]')].map((pane) => [pane.dataset.navigatorPane, pane.parentElement!.hasAttribute('inert')]);
	expect(panes()).toEqual([['nav', false], ['list', true]]);
	fireEvent.click(await screen.findByText('Work'));
	await waitFor(() => expect(panes()).toEqual([['nav', true], ['list', false]]));
	fireEvent.click(screen.getByRole('button', { name: 'Back to folders' }));
	await waitFor(() => expect(panes()).toEqual([['nav', false], ['list', true]]));
});

test('"open navigator" in single-pane mode shows the list and moves keyboard focus into it', async () => {
	const t = await fixture({ settings: { layout: 'single', singleView: 'nav' } });
	t.view(<NavigatorRoot />);
	t.service.selectContext({ kind: 'folder', key: 'Work' });
	await screen.findByRole('tree');
	act(() => { t.service.focusPane('list'); });
	await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('listbox')));
	const panes = [...document.querySelectorAll<HTMLElement>('[data-navigator-pane]')].map((pane) => [pane.dataset.navigatorPane, pane.parentElement!.hasAttribute('inert')]);
	expect(panes).toEqual([['nav', true], ['list', false]]);
	act(() => { t.service.focusPane('nav'); });
	await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tree')));
});

test('timers of the panes use the window that owns the panel', async () => {
	const t = await fixture();
	const spy = vi.spyOn(window, 'setTimeout');
	t.view(<NavPane />);
	await screen.findByText('Work');
	const transfer = { types: ['application/x-nand-navigator'], getData: () => '[]', dropEffect: '' };
	fireEvent.dragOver(document.querySelector('[data-nav-key="folder:Work"]')!, { dataTransfer: transfer });
	// The owner document here is the test window; the spring timer is created through it, not a captured global.
	expect(spy).toHaveBeenCalled();
	spy.mockRestore();
});
