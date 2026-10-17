// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TFile } from 'obsidian';
import { NandProviders } from '../../../ui/react/providers';
import { setLanguage } from '../../../shared/i18n';
import { normalizePeriodRules } from '../core/periodic';
import { createFakeApp } from '../platform/fake-app';
import { createMemoryCache } from '../platform/cache-store';
import { createNoteFactory } from '../platform/note-factory';
import { createPeriodicNotes } from '../platform/periodic-notes';
import { PreviewStore } from '../platform/preview-store';
import { FakeVault, createTestService, note } from '../services/test-support';
import type { ProductivityActions } from './actions';
import type { NavigatorEnv } from './env';
import { NavigatorContext } from './hooks';
import { ListPane } from './ListPane';
import { NavPane } from './NavPane';

vi.mock('obsidian', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), Platform: { isMacOS: false, isPhone: false, isMobile: false } }));

beforeAll(() => {
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 600, width: 300, height: 600, toJSON: () => ({}) } as DOMRect);
	Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 600 });
	Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 300 });
	Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
	globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
	HTMLElement.prototype.scrollIntoView = () => {};
});
afterEach(() => { vi.useRealTimers(); });

async function fixture(settings: Record<string, unknown> = {}, extraActions: Partial<ProductivityActions> = {}) {
	setLanguage('en');
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(2026, 9, 15, 10));
	const fake = createFakeApp({ 'Daily/2026-10-14.md': '' });
	const vault = new FakeVault([note('Daily/2026-10-14.md', 5), note('Work/a.md', 4), note('Work/b.md', 3)], ['/', 'Daily', 'Work']);
	const rules = normalizePeriodRules({ day: { enabled: true, folder: 'Daily' }, week: { enabled: true, folder: 'Weekly' } });
	const t = await createTestService(vault, { settings: { periodRules: rules, calendarWeekStart: 'monday', calendarOpen: true, ...settings } });
	const opened: string[] = [];
	const factory = createNoteFactory({
		app: fake.app,
		settings: t.settings,
		ask: () => Promise.resolve('x'),
		open: (file: TFile) => { opened.push(file.path); return Promise.resolve(); },
		notify: () => undefined, defaultName: () => 'Untitled',
		addTag: () => Promise.resolve(),
	});
	const periodic = createPeriodicNotes({
		app: fake.app,
		settings: t.settings,
		factory,
		openFile: (file) => { opened.push(file.path); return Promise.resolve(); },
		entry: (path) => vault.get(path),
		notify: () => undefined,
		report: (error) => { throw error instanceof Error ? error : new Error(String(error)); },
	});
	const calls: string[] = [];
	const actions: ProductivityActions = {
		periodic,
		openPeriod: async (period, date) => { await periodic.open(period, date ?? new Date()); },
		newNoteFromTemplate: () => { calls.push('template'); return Promise.resolve(); },
		runCreateCommand: (id) => { calls.push(`command:${id}`); return Promise.resolve(); },
		mergeSelected: () => { calls.push('merge'); return Promise.resolve(); },
		addTagToSelected: () => { calls.push('add-tag'); return Promise.resolve(); },
		removeTagFromSelected: () => { calls.push('remove-tag'); return Promise.resolve(); },
		clearTagsOfSelected: () => { calls.push('clear-tags'); return Promise.resolve(); },
		renameTag: (tag) => { calls.push(`rename:${tag}`); return Promise.resolve(); },
		deleteTag: (tag) => { calls.push(`delete:${tag}`); return Promise.resolve(); },
		undoTagEdit: () => Promise.resolve(),
		chooseProfile: () => { calls.push('profiles'); return Promise.resolve(); },
		selectProfileAt: () => Promise.resolve(),
		setFolderTemplate: (folder) => { calls.push(`folder-template:${folder}`); return Promise.resolve(); },
		hasFolderTemplate: () => false,
		dispose: () => undefined,
		...extraActions,
	};
	const previews = new PreviewStore({
		cache: createMemoryCache(),
		source: { mtime: () => 1, isMarkdown: () => true, readText: () => Promise.resolve(''), propertyImage: () => undefined, resolveImage: () => null, title: () => '', metadataReady: () => true },
		scheduler: { now: () => 0, yield: () => Promise.resolve(), later: (callback) => { const handle = setTimeout(callback, 0); return () => clearTimeout(handle); } },
		imageProperties: () => [],
	});
	const env: NavigatorEnv = {
		app: { scope: {}, keymap: { pushScope() {}, popScope() {} } } as never,
		service: t.service,
		previews,
		isMac: false,
		resolveIcon: () => ({ icon: null, emoji: false, color: null }),
		subscribeIcons: () => () => undefined,
		imageUrl: (path) => path,
		copyPath: () => undefined,
		openSettings: () => undefined,
		openAppearance: () => undefined,
		askName: (_title, value) => Promise.resolve(value),
		actions,
		report: (error) => { throw error instanceof Error ? error : new Error(String(error)); },
	};
	const view = (node: React.ReactNode) => render(<NandProviders ownerDocument={document}><NavigatorContext.Provider value={env}><div className="nand-ui">{node}</div></NavigatorContext.Provider></NandProviders>);
	return { ...t, fake, vault, opened, calls, view, env };
}

const day = (iso: string) => document.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;

test('the calendar shows the month, marks days that have a note and today', async () => {
	const t = await fixture();
	t.view(<NavPane />);
	const grid = await waitFor(() => { expect(document.querySelector('[data-navigator-calendar]')).toBeTruthy(); return document.querySelector('[data-navigator-calendar]')!; });
	expect(grid.textContent).toContain('October');
	expect(grid.textContent).toContain('2026');
	expect(grid.textContent).toContain('Q4');
	expect(day('2026-10-14').dataset.hasNote).toBe('true');
	expect(day('2026-10-13').dataset.hasNote).toBeUndefined();
	expect(day('2026-10-15').getAttribute('aria-current')).toBe('date');
	// five weeks, Monday first: the grid starts on 28 September and ends on 1 November
	expect(document.querySelectorAll('[data-date]')).toHaveLength(35);
	expect(document.querySelector('[data-date]')!.getAttribute('data-date')).toBe('2026-09-28');
});

test('the calendar button shows and hides it, and the calendar follows the settings', async () => {
	const t = await fixture({ calendarOpen: false });
	t.view(<NavPane />);
	await screen.findByText('Work');
	expect(document.querySelector('[data-navigator-calendar]')).toBeNull();
	fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
	await waitFor(() => expect(document.querySelector('[data-navigator-calendar]')).toBeTruthy());
	expect(t.settings.get().calendarOpen).toBe(true);
	fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
	await waitFor(() => expect(document.querySelector('[data-navigator-calendar]')).toBeNull());
});

test('clicking a day creates its note at the exact path; an existing note is just opened', async () => {
	const t = await fixture();
	t.view(<NavPane />);
	await screen.findByText('Work');
	fireEvent.click(day('2026-10-16'));
	await waitFor(() => expect(t.opened).toEqual(['Daily/2026-10-16.md']));
	expect(t.fake.has('Daily/2026-10-16.md')).toBe(true);
	fireEvent.click(day('2026-10-14'));
	await waitFor(() => expect(t.opened).toEqual(['Daily/2026-10-16.md', 'Daily/2026-10-14.md']));
	expect(t.fake.files.size).toBe(2);
});

test('week numbers open the weekly note; disabled periods cannot be clicked', async () => {
	const t = await fixture();
	t.view(<NavPane />);
	await screen.findByText('Work');
	const week = screen.getByRole('button', { name: 'Week 42' });
	fireEvent.click(week);
	await waitFor(() => expect(t.fake.has('Weekly/2026-W42.md')).toBe(true));
	expect(screen.getByRole('button', { name: 'October' }).hasAttribute('disabled')).toBe(true);
	expect(screen.getByRole('button', { name: '2026' }).hasAttribute('disabled')).toBe(true);
});

test('month arrows move the grid and Today returns', async () => {
	const t = await fixture();
	t.view(<NavPane />);
	await screen.findByText('Work');
	fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
	await waitFor(() => expect(screen.getByRole('button', { name: 'November' })).toBeTruthy());
	expect(day('2026-11-15')).toBeTruthy();
	fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
	fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
	await waitFor(() => expect(screen.getByRole('button', { name: 'September' })).toBeTruthy());
	fireEvent.click(screen.getByRole('button', { name: 'Today' }));
	await waitFor(() => expect(screen.getByRole('button', { name: 'October' })).toBeTruthy());
});

test('the profile button appears with several profiles and opens the chooser', async () => {
	const t = await fixture({ profiles: [{ id: 'default', name: 'Default', banner: '', hiddenFolders: [], hiddenTags: [], hiddenFiles: [], hiddenProperties: [], shortcuts: [] }, { id: 'p1', name: 'Work', banner: '', hiddenFolders: [], hiddenTags: [], hiddenFiles: [], hiddenProperties: [], shortcuts: [] }] });
	t.view(<NavPane />);
	await screen.findByText('Work');
	fireEvent.click(screen.getByRole('button', { name: 'Select vault profile' }));
	expect(t.calls).toEqual(['profiles']);
});

test('note menus offer merge and tag actions for the selection', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	fireEvent.click(await screen.findByText('Work'));
	await waitFor(() => expect(document.querySelectorAll('[data-note-path]')).toHaveLength(2));
	t.service.selectNote('Work/a.md', 'only');
	t.service.selectNote('Work/b.md', 'toggle');
	await waitFor(() => expect(document.querySelector('[data-note-path="Work/b.md"]')?.getAttribute('aria-selected')).toBe('true'));
	fireEvent.contextMenu(document.querySelector('[data-note-path="Work/a.md"]')!);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Merge notes' }));
	expect(t.calls).toEqual(['merge']);
	fireEvent.contextMenu(document.querySelector('[data-note-path="Work/a.md"]')!);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Add tag…' }));
	fireEvent.contextMenu(document.querySelector('[data-note-path="Work/a.md"]')!);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove tag…' }));
	fireEvent.contextMenu(document.querySelector('[data-note-path="Work/a.md"]')!);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove all tags' }));
	expect(t.calls).toEqual(['merge', 'add-tag', 'remove-tag', 'clear-tags']);
});

test('merge is disabled for a single note', async () => {
	const t = await fixture();
	t.view(<><NavPane /><ListPane /></>);
	fireEvent.click(await screen.findByText('Work'));
	await waitFor(() => expect(document.querySelectorAll('[data-note-path]')).toHaveLength(2));
	fireEvent.contextMenu(document.querySelector('[data-note-path="Work/a.md"]')!);
	const item = await screen.findByRole('menuitem', { name: 'Merge notes' });
	expect(item.getAttribute('aria-disabled') ?? item.getAttribute('data-disabled')).toBeTruthy();
});

test('folder rows offer templates and create-note commands; tag rows offer rename and delete', async () => {
	const t = await fixture({ createCommands: [{ id: 'm1', name: 'Meeting note', template: '', fileName: 'Meeting', location: 'selected', folder: '' }] });
	await t.settings.update((draft) => { draft.hiddenFolders = []; });
	t.view(<NavPane />);
	fireEvent.contextMenu((await screen.findByText('Work')).closest('[data-nav-key]')!);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Meeting note' }));
	fireEvent.contextMenu((await screen.findByText('Work')).closest('[data-nav-key]')!);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Set folder template…' }));
	fireEvent.contextMenu((await screen.findByText('Work')).closest('[data-nav-key]')!);
	fireEvent.click(await screen.findByRole('menuitem', { name: 'New note from template…' }));
	expect(t.calls).toEqual(['command:m1', 'folder-template:Work', 'template']);
});

test('the list menu runs create-note commands', async () => {
	const t = await fixture({ createCommands: [{ id: 'm1', name: 'Meeting note', template: '', fileName: 'Meeting', location: 'selected', folder: '' }] });
	t.view(<ListPane />);
	fireEvent.pointerDown(await screen.findByRole('button', { name: 'More options' }), { button: 0, ctrlKey: false });
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Meeting note' }));
	expect(t.calls).toEqual(['command:m1']);
});

test('a profile banner is shown above the tree', async () => {
	const t = await fixture({ activeProfile: 'p1', profiles: [{ id: 'p1', name: 'Work', banner: 'Attachments/banner.png', hiddenFolders: [], hiddenTags: [], hiddenFiles: [], hiddenProperties: [], shortcuts: [] }] });
	t.view(<NavPane />);
	await waitFor(() => expect(document.querySelector<HTMLImageElement>('[data-navigator-banner]')?.getAttribute('src')).toBe('Attachments/banner.png'));
});

test('week numbers are in the Tab order, and with Sunday rows and ISO weeks a row opens its ISO week', async () => {
	const rules = normalizePeriodRules({ day: { enabled: true, folder: 'Daily' }, week: { enabled: true, folder: 'Weekly', format: 'GGGG-[W]WW' } });
	const t = await fixture({ calendarWeekStart: 'sunday', periodRules: rules });
	t.view(<NavPane />);
	await screen.findByText('Work');
	// rows start on Sunday: 27 September is the first cell
	expect(document.querySelector('[data-date]')!.getAttribute('data-date')).toBe('2026-09-27');
	const week = screen.getByRole('button', { name: 'Week 42' });
	expect(week.getAttribute('tabindex')).not.toBe('-1');
	week.focus();
	expect(document.activeElement).toBe(week);
	fireEvent.click(week);
	await waitFor(() => expect(t.fake.has('Weekly/2026-W42.md')).toBe(true));
	// the row Sunday 11 – Saturday 17 October is ISO week 42 although its first day (Sunday) belongs to week 41
	expect(screen.getAllByRole('button', { name: /^Week \d+$/ }).map((button) => button.textContent)).toEqual(['40', '41', '42', '43', '44']);
});
