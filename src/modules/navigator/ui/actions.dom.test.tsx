// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Notice, type TFile } from 'obsidian';
import { setLanguage } from '../../../shared/i18n';
import { createFakeApp } from '../platform/fake-app';
import { createNoteFactory } from '../platform/note-factory';
import { createPeriodicNotes } from '../platform/periodic-notes';
import { FakeVault, createTestService, note } from '../services/test-support';
import { createProductivityActions } from './actions';
import { DialogRegistry } from './dialog-registry';

vi.mock('obsidian', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), Platform: { isMacOS: false, isPhone: false, isMobile: false }, parseYaml: (await import('yaml')).parse, getFrontMatterInfo: (await import('../platform/simple-yaml')).getSimpleFrontMatterInfo }));

beforeAll(() => {
	Object.assign(globalThis, { activeDocument: document, activeWindow: window });
	HTMLElement.prototype.scrollIntoView = () => {};
	globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(() => { (Notice as unknown as { messages: unknown[] }).messages.length = 0; });

const messages = () => (Notice as unknown as { messages: unknown[] }).messages;

async function fixture(contents: Record<string, string>, tags: Record<string, string[]>, settings: Record<string, unknown> = {}, answers: { name?: string } = {}) {
	setLanguage('en');
	const fake = createFakeApp(contents);
	const app = Object.assign(fake.app, { workspace: { containerEl: document.body, getActiveViewOfType: () => null, getActiveFile: () => null } });
	const vault = new FakeVault(
		Object.keys(contents).map((path, index) => note(path, 100 - index, tags[path] ?? [])),
		['/', ...new Set(Object.keys(contents).flatMap((path) => (path.includes('/') ? [path.slice(0, path.lastIndexOf('/'))] : [])))],
	);
	const t = await createTestService(vault, { settings });
	const opened: string[] = [];
	const factory = createNoteFactory({ app, settings: t.settings, ask: () => Promise.resolve(undefined), open: (file: TFile) => { opened.push(file.path); return Promise.resolve(); }, notify: () => undefined, defaultName: () => 'Untitled', addTag: () => Promise.resolve() });
	const periodic = createPeriodicNotes({ app, settings: t.settings, factory, openFile: () => Promise.resolve(), entry: (path) => vault.get(path), notify: () => undefined, report: () => undefined });
	const dialogs = new DialogRegistry();
	const actions = createProductivityActions({
		app,
		service: t.service,
		factory,
		periodic,
		dialogs,
		report: (error) => { throw error instanceof Error ? error : new Error(String(error)); },
		isStopped: () => false,
		askName: (_title, value) => Promise.resolve(answers.name ?? value),
		open: (path) => { opened.push(path); return Promise.resolve(); },
	});
	return { ...t, fake, vault, actions, opened, dialogs };
}

const button = (name: string) => screen.findByRole('button', { name });

test('merge joins the selected notes in list order into a new note and trashes the originals only when ticked', async () => {
	const t = await fixture({ 'Notes/A.md': 'alpha', 'Notes/B.md': 'beta', 'Notes/C.md': 'gamma' }, {}, { sortBy: 'name', sortDirection: 'asc', groupBy: 'none' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/C.md', 'only');
	t.service.selectNote('Notes/A.md', 'toggle');
	const done = t.actions.mergeSelected();
	expect(await screen.findByText('Merge 2 notes?')).toBeTruthy();
	expect(screen.getByText('Notes/A.md')).toBeTruthy();
	fireEvent.click(await button('Merge'));
	await done;
	expect(t.fake.read('Notes/A merged.md')).toBe('# A\n\nalpha\n\n# C\n\ngamma\n');
	expect(t.fake.trashed).toEqual([]);
	expect(t.opened).toEqual(['Notes/A merged.md']);

	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/C.md', 'only');
	t.service.selectNote('Notes/A.md', 'toggle');
	const again = t.actions.mergeSelected();
	await screen.findByText('Merge 2 notes?');
	fireEvent.click(screen.getByRole('checkbox', { name: 'Move the original notes to the trash' }));
	fireEvent.click(await button('Merge'));
	await again;
	expect(t.fake.trashed).toEqual(['Notes/A.md', 'Notes/C.md']);
	expect(t.fake.has('Notes/A merged 2.md')).toBe(true);
});

test('cancelling the merge dialog changes nothing, and a single note cannot be merged', async () => {
	const t = await fixture({ 'Notes/A.md': 'alpha', 'Notes/B.md': 'beta' }, {}, { sortBy: 'name', sortDirection: 'asc' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	await t.actions.mergeSelected();
	expect(messages()).toContain('Select at least two Markdown notes to merge.');
	t.service.selectNote('Notes/B.md', 'toggle');
	const pending = t.actions.mergeSelected();
	await screen.findByText('Merge 2 notes?');
	fireEvent.click(await button('Cancel'));
	await pending;
	expect(t.fake.files.size).toBe(2);
});

test('adding a tag to the selection writes it to every selected note', async () => {
	const t = await fixture({ 'Notes/A.md': 'a', 'Notes/B.md': 'b', 'Notes/C.md': '---\ntags: [old]\n---\nc' }, { 'Notes/C.md': ['old'] }, { sortBy: 'name', sortDirection: 'asc' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	t.service.selectNote('Notes/B.md', 'toggle');
	const done = t.actions.addTagToSelected();
	const input = await screen.findByRole('combobox', { name: 'Search tags' }).catch(() => screen.findByPlaceholderText('Search tags'));
	fireEvent.change(input, { target: { value: 'project/x' } });
	fireEvent.click(await screen.findByText('Create tag #project/x'));
	await done;
	expect(t.fake.read('Notes/A.md')).toBe('---\ntags:\n  - project/x\n---\na');
	expect(t.fake.read('Notes/B.md')).toContain('project/x');
	expect(t.fake.read('Notes/C.md')).toBe('---\ntags: [old]\n---\nc');
});

test('an invalid tag name is refused with a message', async () => {
	const t = await fixture({ 'Notes/A.md': 'a' }, {}, {});
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	const done = t.actions.addTagToSelected();
	const input = await screen.findByPlaceholderText('Search tags');
	fireEvent.change(input, { target: { value: '2026' } });
	// "2026" is only digits: no create row is offered, so nothing can be picked
	await waitFor(() => expect(screen.queryByText('Create tag #2026')).toBeNull());
	t.dialogs.stop();
	await done;
	expect(t.fake.read('Notes/A.md')).toBe('a');
});

test('removing the only tag of the selection is immediate and can be undone from the notice', async () => {
	const t = await fixture({ 'Notes/A.md': '---\ntags: [todo]\n---\nBody #todo', 'Notes/B.md': 'plain' }, { 'Notes/A.md': ['todo'] }, { sortBy: 'name', sortDirection: 'asc' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	await t.actions.removeTagFromSelected();
	expect(t.fake.read('Notes/A.md')).toBe('Body');
	const fragment = messages().at(-1) as DocumentFragment;
	expect(fragment.textContent).toContain('Changed tags in 1 note(s).');
	fragment.querySelector('button')!.click();
	await waitFor(() => expect(t.fake.read('Notes/A.md')).toBe('---\ntags:\n  - todo\n---\nBody #todo'));
});

test('rename tag asks to confirm, changes children too, and undo restores', async () => {
	const t = await fixture(
		{ 'Notes/A.md': '---\ntags: [todo]\n---\nBody #todo/later', 'Notes/B.md': 'x #other' },
		{ 'Notes/A.md': ['todo', 'todo/later'], 'Notes/B.md': ['other'] },
		{},
		{ name: '#done' },
	);
	const done = t.actions.renameTag('todo');
	expect(await screen.findByText('Rename #todo to #done?')).toBeTruthy();
	expect(screen.getByText('1 note(s) change, including child tags. You can undo this right afterwards.')).toBeTruthy();
	fireEvent.click(await button('Rename tag…'));
	await done;
	expect(t.fake.read('Notes/A.md')).toBe('---\ntags:\n  - done\n---\nBody #done/later');
	expect(t.fake.read('Notes/B.md')).toBe('x #other');
	await t.actions.undoTagEdit();
	expect(t.fake.read('Notes/A.md')).toBe('---\ntags:\n  - todo\n---\nBody #todo/later');
	await t.actions.undoTagEdit();
	expect(messages().at(-1)).toBe('There is no tag change to undo.');
});

test('rename refuses an invalid new name and deleting a tag needs the confirmation', async () => {
	const t = await fixture({ 'Notes/A.md': 'x #todo' }, { 'Notes/A.md': ['todo'] }, {}, { name: 'a b' });
	await t.actions.renameTag('todo');
	expect(messages().at(-1)).toBe('This is not a valid tag name. Use letters, digits, _ - and / (not only digits).');
	expect(t.fake.read('Notes/A.md')).toBe('x #todo');
	const pending = t.actions.deleteTag('todo');
	await screen.findByText('Delete tag #todo?');
	fireEvent.click(await button('Cancel'));
	await pending;
	expect(t.fake.read('Notes/A.md')).toBe('x #todo');
	const confirmed = t.actions.deleteTag('todo');
	await screen.findByText('Delete tag #todo?');
	fireEvent.click(await button('Delete tag'));
	await confirmed;
	expect(t.fake.read('Notes/A.md')).toBe('x');
});

test('clearing tags is confirmed first', async () => {
	const t = await fixture({ 'Notes/A.md': '---\ntags: [a, b]\n---\nBody #c' }, { 'Notes/A.md': ['a', 'b', 'c'] }, {});
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	const pending = t.actions.clearTagsOfSelected();
	await screen.findByText('Remove all tags from 1 note(s)?');
	fireEvent.click(await button('Remove all tags'));
	await pending;
	expect(t.fake.read('Notes/A.md')).toBe('Body');
});

test('stopping the navigator closes a tag dialog without touching notes', async () => {
	const t = await fixture({ 'Notes/A.md': 'x #todo' }, { 'Notes/A.md': ['todo'] }, {});
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	const pending = t.actions.clearTagsOfSelected();
	await screen.findByText('Remove all tags from 1 note(s)?');
	t.dialogs.stop();
	await pending;
	expect(t.fake.read('Notes/A.md')).toBe('x #todo');
});

test('a folder template is picked from the template notes and can be limited to its folder or removed', async () => {
	const t = await fixture({ 'T/Meeting.md': 'tpl', 'T/Daily.md': 'tpl2', 'Work/a.md': 'a' }, {}, { templateFolder: 'T' });
	const pick = t.actions.setFolderTemplate('Work');
	fireEvent.click(await screen.findByText('Meeting'));
	await screen.findByText('Template for Work');
	fireEvent.click(screen.getByRole('checkbox', { name: 'This folder only (not its subfolders)' }));
	fireEvent.click(await button('Save'));
	await pick;
	expect(t.settings.get().folderTemplates).toEqual([{ folder: 'Work', template: 'T/Meeting.md', exact: true }]);
	expect(t.actions.hasFolderTemplate('Work')).toBe(true);
	const remove = t.actions.setFolderTemplate('Work');
	fireEvent.click(await screen.findByText('No template'));
	await remove;
	expect(t.settings.get().folderTemplates).toEqual([]);
});

test('new note from template lists the template notes and creates the note in the open folder', async () => {
	const t = await fixture({ 'T/Meeting.md': '# {{title}}', 'Work/a.md': 'a' }, {}, { templateFolder: 'T' });
	t.service.selectContext({ kind: 'folder', key: 'Work' });
	const done = t.actions.newNoteFromTemplate();
	fireEvent.click(await screen.findByText('Meeting'));
	await done;
	expect(t.fake.read('Work/Untitled.md')).toBe('# Untitled');
	expect(t.opened).toEqual(['Work/Untitled.md']);
});

test('without templates the user is told where to set the folder', async () => {
	const t = await fixture({ 'Work/a.md': 'a' }, {}, { templateFolder: 'Nope' });
	await t.actions.newNoteFromTemplate();
	expect(messages().at(-1)).toBe('No templates found. Set the template folder in the navigator settings.');
});

test('the profile chooser switches profiles', async () => {
	const t = await fixture({ 'Work/a.md': 'a' }, {}, { profiles: [{ id: 'p1', name: 'Personal', banner: '', hiddenFolders: [], hiddenTags: [], hiddenFiles: [], hiddenProperties: [], shortcuts: [] }] });
	const done = t.actions.chooseProfile();
	fireEvent.click(await screen.findByText('Personal'));
	await done;
	await waitFor(() => expect(t.settings.get().activeProfile).toBe('p1'));
	await t.actions.selectProfileAt(1);
	await waitFor(() => expect(t.settings.get().activeProfile).toBe('default'));
});

test('a failure midway reports it, keeps what was written restorable, and the undo command brings it back', async () => {
	const t = await fixture({ 'Notes/A.md': '---\ntags: [probe]\n---\nA #probe', 'Notes/B.md': '---\ntags: [probe]\n---\nB', 'Notes/C.md': 'C' }, { 'Notes/A.md': ['probe'], 'Notes/B.md': ['probe'] }, {}, { name: 'changed' });
	const original = t.fake.app.fileManager.processFrontMatter.bind(t.fake.app.fileManager);
	t.fake.app.fileManager.processFrontMatter = (file: TFile, edit: (fm: Record<string, unknown>) => void) => (file.path === 'Notes/B.md' ? Promise.reject(new Error('disk full')) : original(file, edit));
	const errors: unknown[] = [];
	const failing = createProductivityActions({
		app: t.fake.app, service: t.service, factory: createNoteFactory({ app: t.fake.app, settings: t.settings, ask: () => Promise.resolve(undefined), open: () => Promise.resolve(), notify: () => undefined, defaultName: () => 'Untitled', addTag: () => Promise.resolve() }),
		periodic: createPeriodicNotes({ app: t.fake.app, settings: t.settings, factory: createNoteFactory({ app: t.fake.app, settings: t.settings, ask: () => Promise.resolve(undefined), open: () => Promise.resolve(), notify: () => undefined, defaultName: () => 'Untitled', addTag: () => Promise.resolve() }), openFile: () => Promise.resolve(), entry: () => undefined, notify: () => undefined, report: () => undefined }),
		dialogs: t.dialogs, report: (error) => { errors.push(error); }, isStopped: () => false, askName: () => Promise.resolve('changed'), open: () => Promise.resolve(),
	});
	const pending = failing.renameTag('probe');
	await screen.findByText('Rename #probe to #changed?');
	fireEvent.click(await button('Rename tag…'));
	await pending;
	expect(errors).toHaveLength(1);
	expect(messages().some((message) => typeof message === 'string' && message.includes('Notes/B.md could not be written'))).toBe(true);
	expect(t.fake.read('Notes/A.md')).toContain('changed');
	await failing.undoTagEdit();
	expect(t.fake.read('Notes/A.md')).toBe('---\ntags:\n  - probe\n---\nA #probe');
});

test('each undo prompt undoes its own edit, and stopping the navigator closes the prompts and refuses the undo', async () => {
	const t = await fixture({ 'Notes/A.md': 'a #one', 'Notes/B.md': 'b #two' }, { 'Notes/A.md': ['one'], 'Notes/B.md': ['two'] }, { sortBy: 'name', sortDirection: 'asc' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	let stopped = false;
	const actions = createProductivityActions({
		app: t.fake.app, service: t.service,
		factory: createNoteFactory({ app: t.fake.app, settings: t.settings, ask: () => Promise.resolve(undefined), open: () => Promise.resolve(), notify: () => undefined, defaultName: () => 'Untitled', addTag: () => Promise.resolve() }),
		periodic: createPeriodicNotes({ app: t.fake.app, settings: t.settings, factory: createNoteFactory({ app: t.fake.app, settings: t.settings, ask: () => Promise.resolve(undefined), open: () => Promise.resolve(), notify: () => undefined, defaultName: () => 'Untitled', addTag: () => Promise.resolve() }), openFile: () => Promise.resolve(), entry: () => undefined, notify: () => undefined, report: () => undefined }),
		dialogs: t.dialogs, report: () => undefined, isStopped: () => stopped, askName: () => Promise.resolve('x'), open: () => Promise.resolve(),
	});
	t.service.selectNote('Notes/A.md', 'only');
	await actions.removeTagFromSelected();
	const first = messages().at(-1) as DocumentFragment;
	t.service.selectNote('Notes/B.md', 'only');
	await actions.removeTagFromSelected();
	const second = messages().at(-1) as DocumentFragment;
	expect(t.fake.read('Notes/A.md')).toBe('a');
	expect(t.fake.read('Notes/B.md')).toBe('b');
	// the older prompt restores the older edit only
	first.querySelector('button')!.click();
	await waitFor(() => expect(t.fake.read('Notes/A.md')).toBe('a #one'));
	expect(t.fake.read('Notes/B.md')).toBe('b');
	actions.dispose();
	stopped = true;
	second.querySelector('button')!.click();
	await new Promise((resolve) => setTimeout(resolve, 20));
	expect(t.fake.read('Notes/B.md')).toBe('b');
	await actions.undoTagEdit();
	expect(t.fake.read('Notes/B.md')).toBe('b');
});

test('an old prompt whose edit was already undone does nothing, and cannot remove a newer edit\'s restore point', async () => {
	const t = await fixture({ 'Notes/A.md': 'a #one', 'Notes/B.md': 'b #two' }, { 'Notes/A.md': ['one'], 'Notes/B.md': ['two'] }, { sortBy: 'name', sortDirection: 'asc' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	await t.actions.removeTagFromSelected();
	const first = messages().at(-1) as DocumentFragment;
	await t.actions.undoTagEdit();
	expect(t.fake.read('Notes/A.md')).toBe('a #one');
	t.service.selectNote('Notes/B.md', 'only');
	await t.actions.removeTagFromSelected();
	expect(t.fake.read('Notes/B.md')).toBe('b');
	// the first prompt is still on screen: its button must not touch the second edit
	first.querySelector('button')!.click();
	await new Promise((resolve) => setTimeout(resolve, 30));
	expect(t.fake.read('Notes/B.md')).toBe('b');
	await t.actions.undoTagEdit();
	expect(t.fake.read('Notes/B.md')).toBe('b #two');
});

test('the undo names the notes it had to leave alone because they changed since', async () => {
	const t = await fixture({ 'Notes/A.md': 'a #one', 'Notes/B.md': 'b #one' }, { 'Notes/A.md': ['one'], 'Notes/B.md': ['one'] }, { sortBy: 'name', sortDirection: 'asc' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	t.service.selectNote('Notes/B.md', 'toggle');
	await t.actions.removeTagFromSelected();
	await t.fake.app.vault.modify(t.fake.app.vault.getFileByPath('Notes/B.md')!, 'b edited by me');
	await t.actions.undoTagEdit();
	expect(t.fake.read('Notes/A.md')).toBe('a #one');
	expect(t.fake.read('Notes/B.md')).toBe('b edited by me');
	expect(messages().at(-1)).toBe('Restored 1 note(s). Left alone because they changed since: Notes/B.md.');
});

test('a note whose tag index is behind its text is reported and left untouched', async () => {
	const t = await fixture({ 'Notes/A.md': 'inserted\na #one' }, { 'Notes/A.md': ['one'] }, { sortBy: 'name', sortDirection: 'asc' });
	t.fake.setTags('Notes/A.md', [{ tag: '#one', start: 2, end: 6 }]);
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	vi.useFakeTimers({ toFake: ['setTimeout'] });
	const pending = t.actions.removeTagFromSelected();
	await vi.advanceTimersByTimeAsync(2000);
	await pending;
	vi.useRealTimers();
	expect(t.fake.read('Notes/A.md')).toBe('inserted\na #one');
	expect(String(messages().at(-1))).toContain('left unchanged because Obsidian\'s tag index was behind their text: Notes/A.md');
});

test('a note that changes while the merge dialog is open stops the merge', async () => {
	const t = await fixture({ 'Notes/A.md': 'alpha', 'Notes/B.md': 'beta' }, {}, { sortBy: 'name', sortDirection: 'asc', groupBy: 'none' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	t.service.selectNote('Notes/B.md', 'toggle');
	const done = t.actions.mergeSelected();
	await screen.findByText('Merge 2 notes?');
	await t.fake.app.vault.modify(t.fake.app.vault.getFileByPath('Notes/A.md')!, 'alpha changed during the dialog');
	fireEvent.click(screen.getByRole('checkbox', { name: 'Move the original notes to the trash' }));
	fireEvent.click(await button('Merge'));
	await done;
	expect(t.fake.files.size).toBe(2);
	expect(t.fake.trashed).toEqual([]);
	expect(messages().at(-1)).toBe('These notes changed while the dialog was open, so nothing was merged. Run the merge again.');
});

test('a note with properties NAND cannot handle safely stops the merge before the dialog and names the note', async () => {
	const t = await fixture({ 'Notes/A.md': '---\n!!set {important: null}\n---\nalpha', 'Notes/B.md': 'beta' }, {}, { sortBy: 'name', sortDirection: 'asc', groupBy: 'none' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	t.service.selectNote('Notes/B.md', 'toggle');
	const real = (await import('obsidian')) as unknown as { parseYaml: (text: string) => unknown };
	const original = real.parseYaml;
	const { parse } = await import('yaml');
	real.parseYaml = (text: string) => parse(text, { schema: 'yaml-1.1' }) as unknown;
	try { await t.actions.mergeSelected(); } finally { real.parseYaml = original; }
	expect(document.querySelector('[role=dialog]')).toBeNull();
	expect(String(messages().at(-1))).toBe('The properties of Notes/A.md cannot be handled safely (invalid YAML or a value type NAND does not support), so nothing was merged and no note was removed.');
	expect(t.fake.files.size).toBe(2);
	expect(t.fake.trashed).toEqual([]);
});

test('a merge result that does not match the originals keeps both and names the result', async () => {
	const t = await fixture({ 'Notes/A.md': '---\nwhen: [!!timestamp 2026-10-17]\n---\nalpha', 'Notes/B.md': '---\nwhen: ["2026-10-17T00:00:00.000Z"]\n---\nbeta' }, {}, { sortBy: 'name', sortDirection: 'asc', groupBy: 'none' });
	t.service.selectContext({ kind: 'folder', key: 'Notes' });
	t.service.selectNote('Notes/A.md', 'only');
	t.service.selectNote('Notes/B.md', 'toggle');
	const real = (await import('obsidian')) as unknown as { parseYaml: (text: string) => unknown };
	const original = real.parseYaml;
	const { parse } = await import('yaml');
	real.parseYaml = (text: string) => parse(text, { schema: 'yaml-1.1' }) as unknown;
	try {
		const done = t.actions.mergeSelected();
		await screen.findByText('Merge 2 notes?');
		fireEvent.click(screen.getByRole('checkbox', { name: 'Move the original notes to the trash' }));
		fireEvent.click(await button('Merge'));
		await done;
	} finally { real.parseYaml = original; }
	expect(String(messages().at(-1))).toBe('The merge result does not fully match the original notes, so the original notes were kept. Please check Notes/A merged.md.');
	expect(t.fake.has('Notes/A.md') && t.fake.has('Notes/B.md') && t.fake.has('Notes/A merged.md')).toBe(true);
	expect(t.fake.trashed).toEqual([]);
});
