// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import '../../../../scripts/navigator-test-moment';
import { expect, test, vi } from 'vitest';
import type { TFile } from 'obsidian';
import { defaultPeriodRules, normalizePeriodRules } from '../core/periodic';
import { removeMapper, renameMapper } from '../core/tag-edit';
import { navigatorSchema } from '../settings';
import { formatDate } from '../core/moment-format';
import { createFakeApp } from './fake-app';
import { mergeable, mergeFiles, planMerge, type MergePlan } from './merge-ops';
import { createNoteFactory } from './note-factory';
import { createPeriodicNotes } from './periodic-notes';
import { clearTags, editTags, undoTagEdit } from './tag-ops';

vi.mock('obsidian', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), parseYaml: (await import('yaml')).parse, getFrontMatterInfo: (await import('./simple-yaml')).getSimpleFrontMatterInfo }));

function memorySettings(overrides: Record<string, unknown> = {}) {
	let value = { ...navigatorSchema.defaults(), ...overrides } as ReturnType<typeof navigatorSchema.defaults>;
	return {
		get: () => value,
		update: (change: (draft: typeof value) => void) => { const draft = structuredClone(value); change(draft); value = draft; return Promise.resolve(); },
		subscribe: () => () => undefined,
	};
}

async function merged(app: Parameters<typeof mergeFiles>[0], files: Parameters<typeof mergeFiles>[1], deleteOriginals: boolean, expected?: readonly string[]) {
	const outcome = await mergeFiles(app, files, { suffix: 'merged', deleteOriginals, expected });
	if (outcome.status !== 'merged') throw new Error(outcome.status);
	return outcome.file;
}

test('merging creates one note next to the first and trashes the originals only when asked', async () => {
	const fake = createFakeApp({ 'Notes/One.md': '---\ntags: [a]\n---\nfirst', 'Notes/Two.md': 'second', 'Notes/pic.png': 'bin' });
	const files = mergeable(['Notes/One.md', 'Notes/pic.png', 'Notes/Two.md'].map((path) => fake.app.vault.getFileByPath(path)));
	expect(files.map((file) => file.path)).toEqual(['Notes/One.md', 'Notes/Two.md']);
	const kept = await merged(fake.app, files, false);
	expect(kept.path).toBe('Notes/One merged.md');
	expect(fake.read('Notes/One merged.md')).toBe('---\ntags:\n  - a\n---\n# One\n\nfirst\n\n# Two\n\nsecond\n');
	expect(fake.trashed).toEqual([]);
	const again = await merged(fake.app, files, true);
	expect(again.path).toBe('Notes/One merged 2.md');
	expect(fake.trashed).toEqual(['Notes/One.md', 'Notes/Two.md']);
});

function factoryFor(fake: ReturnType<typeof createFakeApp>, settings = memorySettings(), answers: Record<string, string | undefined> = {}) {
	const opened: Array<{ path: string; cursor?: number }> = [];
	const asked: string[] = [];
	const factory = createNoteFactory({
		app: fake.app,
		settings: settings as never,
		ask: (label) => { asked.push(label); return Promise.resolve(answers[label]); },
		open: (file: TFile, options) => { opened.push({ path: file.path, cursor: options.cursor }); return Promise.resolve(); },
		notify: () => undefined, defaultName: () => 'Untitled',
		addTag: () => Promise.resolve(),
	});
	return { factory, opened, asked };
}

test('a note created in a folder with a folder template is filled from it, nearest template first', async () => {
	const fake = createFakeApp({ 'T/all.md': 'ALL {{title}}', 'T/daily.md': '---\ncreated: "{{today:YYYY}}"\n---\n- [ ] {{cursor}}\n' });
	const settings = memorySettings({
		templateFolder: 'T',
		folderTemplates: [{ folder: '/', template: 'all', exact: false }, { folder: 'Journal', template: 'daily', exact: false }],
	});
	const { factory, opened } = factoryFor(fake, settings);
	await factory.createNote({ folder: 'Misc', name: 'Idea' });
	expect(fake.read('Misc/Idea.md')).toBe('ALL Idea');
	await factory.createNote({ folder: 'Journal/2026', name: 'Entry' });
	expect(fake.read('Journal/2026/Entry.md')).toMatch(/^---\ncreated: "\d{4}"\n---\n- \[ \] \n$/);
	expect(opened.at(-1)).toEqual({ path: 'Journal/2026/Entry.md', cursor: expect.any(Number) });
	expect(opened.at(-1)?.cursor).toBe(fake.read('Journal/2026/Entry.md')!.indexOf('- [ ] ') + 6);
});

test('names are made unique unless the note is periodic', async () => {
	const fake = createFakeApp({ 'a/Note.md': '' });
	const { factory } = factoryFor(fake);
	expect((await factory.createNote({ folder: 'a', name: 'Note', open: false }))?.path).toBe('a/Note 2.md');
	await expect(factory.createNote({ folder: 'a', name: 'Note', exact: true, open: false })).rejects.toThrow();
});

test('create-note commands ask every prompt once and continue the number sequence', async () => {
	const fake = createFakeApp({ 'T/meeting.md': '---\ntitle: "{{prompt:Title}}"\n---\n{{number:00}} {{title}}\n', 'Meetings/Weekly sync 01.md': '', 'Meetings/Weekly sync 02.md': '' });
	const settings = memorySettings({ templateFolder: 'T' });
	const { factory, asked } = factoryFor(fake, settings, { Title: 'Weekly sync' });
	const command = { id: 'm', name: 'Meeting', template: 'meeting', fileName: '{{prompt:Title}} {{number:00}}', location: 'folder' as const, folder: 'Meetings' };
	const file = await factory.runCreateCommand(command, '/');
	expect(asked).toEqual(['Title']);
	expect(file?.path).toBe('Meetings/Weekly sync 03.md');
	expect(fake.read('Meetings/Weekly sync 03.md')).toBe('---\ntitle: "Weekly sync"\n---\n03 Weekly sync 03\n');
});

test('cancelling a prompt creates nothing', async () => {
	const fake = createFakeApp();
	const { factory } = factoryFor(fake, memorySettings(), { Title: undefined });
	const command = { id: 'm', name: 'M', template: '', fileName: '{{prompt:Title}}', location: 'selected' as const, folder: '' };
	expect(await factory.runCreateCommand(command, 'Inbox')).toBeUndefined();
	expect(fake.files.size).toBe(0);
});

test('the selected-folder location uses the navigator folder', async () => {
	const fake = createFakeApp();
	const { factory } = factoryFor(fake);
	const command = { id: 'n', name: 'N', template: '', fileName: 'Note {{number}}', location: 'selected' as const, folder: '' };
	expect((await factory.runCreateCommand(command, 'Inbox'))?.path).toBe('Inbox/Note 1.md');
	expect((await factory.runCreateCommand(command, 'Inbox'))?.path).toBe('Inbox/Note 2.md');
});

test('periodic notes are created with their template, at the exact path, and opened when they exist', async () => {
	const fake = createFakeApp({ 'T/week.md': '# Week {{date:ww}} of {{date:gggg}}\n{{monday:YYYY-MM-DD}} .. {{sunday:YYYY-MM-DD}}\n' });
	const rules = normalizePeriodRules({ day: { enabled: true, folder: 'Daily', format: 'YYYY/MM/YYYY-MM-DD' }, week: { enabled: true, folder: 'Weekly', format: 'gggg-[W]ww', template: 'T/week.md' } });
	const settings = memorySettings({ periodRules: rules, calendarWeekStart: 'monday', templateFolder: 'T' });
	const { factory } = factoryFor(fake, settings);
	const openedFiles: string[] = [];
	const periodic = createPeriodicNotes({
		app: fake.app,
		settings: settings as never,
		factory,
		openFile: (file) => { openedFiles.push(file.path); return Promise.resolve(); },
		entry: () => undefined,
		notify: vi.fn(),
		report: vi.fn(),
	});
	expect(await periodic.open('day', new Date(2026, 9, 15))).toBe(true);
	expect(fake.has('Daily/2026/10/2026-10-15.md')).toBe(true);
	expect(await periodic.open('week', new Date(2026, 9, 15))).toBe(true);
	expect(fake.read('Weekly/2026-W42.md')).toBe('# Week 42 of 2026\n2026-10-12 .. 2026-10-18\n');
	await periodic.open('week', new Date(2026, 9, 14));
	expect(openedFiles).toEqual(['Weekly/2026-W42.md']);
	expect(periodic.identify('Daily/2026/10/2026-10-15.md')).toMatchObject({ period: 'day' });
	expect(periodic.pathFor('week', new Date(2026, 9, 18))).toBe('Weekly/2026-W42.md');
});

test('a disabled period tells the user instead of creating a note', async () => {
	const fake = createFakeApp();
	const notify = vi.fn();
	const settings = memorySettings({ periodRules: defaultPeriodRules() });
	const periodic = createPeriodicNotes({ app: fake.app, settings: settings as never, factory: factoryFor(fake).factory, openFile: () => Promise.resolve(), entry: () => undefined, notify, report: vi.fn() });
	expect(await periodic.open('year', new Date(2026, 0, 1))).toBe(false);
	expect(notify).toHaveBeenCalledWith('navigator.periodOff.year');
	expect(fake.files.size).toBe(0);
});

test('the Daily notes core plugin supplies the daily rule and a template found in the Templates core plugin folder', async () => {
	const fake = createFakeApp({ 'CoreTemplates/Daily.md': 'Core daily {{date:YYYY-MM-DD}} {{title}}' });
	Object.assign(fake.app, {
		internalPlugins: {
			getPluginById: (id: string) => (id === 'daily-notes'
				? { enabled: true, instance: { options: { folder: '/Core/Daily/', format: 'YYYY.MM.DD', template: 'Daily' } } }
				: id === 'templates' ? { enabled: true, instance: { options: { folder: 'CoreTemplates' } } } : undefined),
		},
	});
	const settings = memorySettings({ calendarSource: 'core', calendarWeekStart: 'monday' });
	const { factory } = factoryFor(fake, settings);
	const periodic = createPeriodicNotes({ app: fake.app, settings: settings as never, factory, openFile: () => Promise.resolve(), entry: () => undefined, notify: vi.fn(), report: vi.fn() });
	expect(periodic.pathFor('day', new Date(2026, 9, 15))).toBe('Core/Daily/2026.10.15.md');
	await periodic.open('day', new Date(2026, 9, 15));
	expect(fake.read('Core/Daily/2026.10.15.md')).toBe('Core daily 2026-10-15 2026.10.15');
	// the navigator's own rule applies again when the source is switched
	await settings.update((draft) => { draft.calendarSource = 'nand'; });
	expect(periodic.pathFor('day', new Date(2026, 9, 15))).toBe('2026-10-15.md');
});

test('with the core plugin off the navigator rule stays in force even when the core source is chosen', async () => {
	const fake = createFakeApp();
	const settings = memorySettings({ calendarSource: 'core' });
	const periodic = createPeriodicNotes({ app: fake.app, settings: settings as never, factory: factoryFor(fake).factory, openFile: () => Promise.resolve(), entry: () => undefined, notify: vi.fn(), report: vi.fn() });
	expect(periodic.pathFor('day', new Date(2026, 9, 15))).toBe('2026-10-15.md');
});

test('merging keeps the first note\'s other properties and says which of the others cannot be carried over', async () => {
	const fake = createFakeApp({ 'N/A.md': '---\nstatus: draft\naliases: [Alpha]\ntags: [x]\n---\nA body', 'N/B.md': '---\nstatus: done\naliases: [Beta]\ntag: y\nsource: web\n---\nB body' });
	const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const plan = (await planMerge(fake.app, files)) as MergePlan;
	expect(plan.conflicts).toEqual(['status']);
	const file = await merged(fake.app, files, true, plan.fingerprint);
	const text = fake.read(file.path)!;
	expect(text).toContain('status: draft');
	expect(text).toContain('  - Alpha\n  - Beta');
	expect(text).toContain('source: web');
	expect(text).toContain('tags:\n  - x\n  - y');
	expect(text).toContain('# A\n\nA body\n\n# B\n\nB body');
	expect(fake.trashed).toEqual(['N/A.md', 'N/B.md']);
});

test('the originals are kept when the merged note\'s properties cannot be written', async () => {
	const fake = createFakeApp({ 'N/A.md': '---\nstatus: draft\n---\nA', 'N/B.md': 'B' });
	fake.app.fileManager.processFrontMatter = () => Promise.reject(new Error('locked'));
	const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	await expect(merged(fake.app, files, true)).rejects.toThrow('locked');
	expect(fake.trashed).toEqual([]);
});

test('a note that changed while the confirmation was open stops the merge and nothing is written or trashed', async () => {
	const fake = createFakeApp({ 'N/A.md': '---\nstatus: draft\n---\nA', 'N/B.md': 'B' });
	const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const plan = (await planMerge(fake.app, files)) as MergePlan;
	// a property is changed and another added from elsewhere while the dialog is open
	await fake.app.fileManager.processFrontMatter(files[0]!, (fm: Record<string, unknown>) => { fm['status'] = 'published'; fm['newProperty'] = 'must survive'; });
	const outcome = await mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true, expected: plan.fingerprint });
	expect(outcome).toEqual({ status: 'changed' });
	expect(fake.files.size).toBe(2);
	expect(fake.trashed).toEqual([]);
	// planning again sees the new properties and the merge then carries them
	const fresh = (await planMerge(fake.app, files)) as MergePlan;
	const file = await merged(fake.app, files, false, fresh.fingerprint);
	expect(fake.read(file.path)).toContain('status: published');
	expect(fake.read(file.path)).toContain('newProperty: must survive');
});

test('an original edited while the merged note was being made is kept, not trashed', async () => {
	const fake = createFakeApp({ 'N/A.md': 'A', 'N/B.md': 'B' });
	const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const create = fake.app.vault.create;
	fake.app.vault.create = async (path: string, content: string) => { const made = await create(path, content); await fake.app.vault.modify(files[1]!, 'B edited meanwhile'); return made; };
	const outcome = await mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true });
	expect(outcome).toMatchObject({ status: 'merged', originalsKept: true });
	expect(fake.trashed).toEqual([]);
	expect(fake.read('N/B.md')).toBe('B edited meanwhile');
});

test('properties are read from the current text of each note, not from the metadata cache', async () => {
	const fake = createFakeApp({ 'N/A.md': '---\nstatus: draft\n---\nA', 'N/B.md': 'B' });
	fake.setFrontmatter('N/A.md', { status: 'stale cache value' });
	const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const file = await merged(fake.app, files, false);
	expect(fake.read(file.path)).toContain('status: draft');
});

test('a note whose frontmatter is not valid YAML stops the merge', async () => {
	const fake = createFakeApp({ 'N/A.md': '---\nstatus: draft\n---\nA', 'N/B.md': 'B' });
	const real = (await import('obsidian')) as unknown as { parseYaml: (text: string) => unknown };
	const original = real.parseYaml;
	real.parseYaml = () => { throw new Error('bad yaml'); };
	try {
		const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
		expect(await planMerge(fake.app, files)).toEqual({ unreadable: 'N/A.md' });
		expect(await mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true })).toEqual({ status: 'unreadable', path: 'N/A.md' });
	} finally {
		real.parseYaml = original;
	}
	expect(fake.files.size).toBe(2);
});

const noWait = { wait: () => Promise.resolve() };

test('tag edits change the frontmatter and the reported inline tags only, and can be undone', async () => {
	const fake = createFakeApp({
		'a.md': '---\ntags:\n  - todo\n  - keep\n---\nText #todo here\n```\n#todo\n```\n',
		'b.md': '---\ntags: [todo/sub]\n---\nplain',
		'c.md': 'nothing #other',
	});
	// Obsidian does not report the tag inside the fence
	fake.setTags('a.md', [{ tag: '#todo', start: '---\ntags:\n  - todo\n  - keep\n---\nText '.length, end: '---\ntags:\n  - todo\n  - keep\n---\nText #todo'.length }]);
	const files = ['a.md', 'b.md', 'c.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const { records, skipped } = await editTags(fake.app, files, renameMapper('todo', 'done'), noWait);
	expect(skipped).toEqual([]);
	expect(records.map((record) => record.path)).toEqual(['a.md', 'b.md']);
	expect(fake.read('a.md')).toBe('---\ntags:\n  - done\n  - keep\n---\nText #done here\n```\n#todo\n```\n');
	expect(fake.read('b.md')).toBe('---\ntags:\n  - done/sub\n---\nplain');
	expect(fake.read('c.md')).toBe('nothing #other');
	const undone = await undoTagEdit(fake.app, records);
	expect(undone).toEqual({ restored: 2, skipped: [], remaining: [] });
	expect(fake.read('a.md')).toBe('---\ntags:\n  - todo\n  - keep\n---\nText #todo here\n```\n#todo\n```\n');
	expect(fake.read('b.md')).toBe('---\ntags:\n  - todo/sub\n---\nplain');
});

test('code that only looks like tags is never touched because only reported positions are edited', async () => {
	const text = '#nestprobe\n\n- item\n\n      #nestprobe\n\n>     #nestprobe\n`code`#tailprobe trailing prose\n';
	const fake = createFakeApp({ 'a.md': text });
	fake.setTags('a.md', [{ tag: '#nestprobe', start: 0, end: 10 }]);
	await editTags(fake.app, [fake.app.vault.getFileByPath('a.md')!], renameMapper('nestprobe', 'nestchanged'), noWait);
	expect(fake.read('a.md')).toBe(text.replace('#nestprobe', '#nestchanged'));
	const tail = createFakeApp({ 'b.md': '`code`#tailprobe trailing prose\n' });
	await editTags(tail.app, [tail.app.vault.getFileByPath('b.md')!], removeMapper('tailprobe', true), noWait);
	expect(tail.read('b.md')).toBe('`code` trailing prose\n');
});

test('a cache that is behind the file is waited for, then the note is skipped untouched and reported', async () => {
	const fake = createFakeApp({ 'a.md': 'new line\n#edge here' });
	fake.setTags('a.md', [{ tag: '#edge', start: 0, end: 5 }]);
	let waits = 0;
	const result = await editTags(fake.app, [fake.app.vault.getFileByPath('a.md')!], renameMapper('edge', 'x'), { retries: 3, wait: () => { waits++; return Promise.resolve(); } });
	expect(result.skipped).toEqual(['a.md']);
	expect(result.records).toEqual([]);
	expect(waits).toBe(3);
	expect(fake.read('a.md')).toBe('new line\n#edge here');
	const caught = await editTags(fake.app, [fake.app.vault.getFileByPath('a.md')!], renameMapper('edge', 'x'), { wait: () => { fake.setTags('a.md', undefined); return Promise.resolve(); } });
	expect(caught.skipped).toEqual([]);
	expect(fake.read('a.md')).toBe('new line\n#x here');
});

test('undo never overwrites an independent edit: the changed part is skipped and listed', async () => {
	const fake = createFakeApp({ 'a.md': '---\ntags: [probe]\n---\nbody #probe' });
	const file = fake.app.vault.getFileByPath('a.md')!;
	const { records } = await editTags(fake.app, [file], renameMapper('probe', 'changed'), noWait);
	expect(fake.read('a.md')).toBe('---\ntags:\n  - changed\n---\nbody #changed');
	await fake.app.vault.process(file, (data) => `${data}\nwritten later by someone else`);
	const undone = await undoTagEdit(fake.app, records);
	expect(undone.skipped).toEqual(['a.md']);
	expect(undone.restored).toBe(1);
	expect(fake.read('a.md')).toBe('---\ntags:\n  - probe\n---\nbody #changed\nwritten later by someone else');
});

test('undo leaves tag properties alone when they were changed after the edit', async () => {
	const fake = createFakeApp({ 'a.md': '---\ntags: [probe]\n---\nplain' });
	const file = fake.app.vault.getFileByPath('a.md')!;
	const { records } = await editTags(fake.app, [file], renameMapper('probe', 'changed'), noWait);
	await fake.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm['tags'] = ['mine']; });
	const undone = await undoTagEdit(fake.app, records);
	expect(undone).toMatchObject({ restored: 0, skipped: ['a.md'] });
	expect(fake.read('a.md')).toContain('mine');
});

test('an edit that lands between the body write and the property write is not lost by the undo', async () => {
	const fake = createFakeApp({ 'a.md': '---\ntags: [probe]\n---\nbody #probe' });
	const file = fake.app.vault.getFileByPath('a.md')!;
	const original = fake.app.fileManager.processFrontMatter.bind(fake.app.fileManager);
	let injected = false;
	fake.app.fileManager.processFrontMatter = async (target: TFile, edit: (fm: Record<string, unknown>) => void) => {
		if (!injected) { injected = true; await fake.app.vault.process(target, (data) => `${data}\nseparate user edit`); }
		return original(target, edit);
	};
	const { records } = await editTags(fake.app, [file], renameMapper('probe', 'changed'), noWait);
	expect(fake.read('a.md')).toBe('---\ntags:\n  - changed\n---\nbody #changed\nseparate user edit');
	fake.app.fileManager.processFrontMatter = original;
	const undone = await undoTagEdit(fake.app, records);
	expect(fake.read('a.md')).toContain('separate user edit');
	expect(undone.skipped).toEqual(['a.md']);
	expect(fake.read('a.md')).toContain('tags:\n  - probe');
});

test('clearing tags removes frontmatter and inline tags', async () => {
	const fake = createFakeApp({ 'a.md': '---\ntags: [x, y]\n---\nBody #z' });
	await clearTags(fake.app, [fake.app.vault.getFileByPath('a.md')!], noWait);
	expect(fake.read('a.md')).toBe('Body');
});

test('a write that fails midway still returns every note written so far, and the undo works', async () => {
	const fake = createFakeApp({ 'a.md': '---\ntags: [probe]\n---\nbody #probe', 'b.md': '---\ntags: [probe]\n---\nb', 'c.md': 'c #probe' });
	const files = ['a.md', 'b.md', 'c.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const original = fake.app.fileManager.processFrontMatter.bind(fake.app.fileManager);
	fake.app.fileManager.processFrontMatter = (file: TFile, edit: (fm: Record<string, unknown>) => void) => (file.path === 'b.md' ? Promise.reject(new Error('disk full')) : original(file, edit));
	const result = await editTags(fake.app, files, renameMapper('probe', 'changed'), noWait);
	expect(result.failed?.path).toBe('b.md');
	expect(result.records.map((record) => record.path)).toEqual(['a.md']);
	expect(fake.read('c.md')).toBe('c #probe');
	const undone = await undoTagEdit(fake.app, result.records);
	expect(undone.restored).toBe(1);
	expect(fake.read('a.md')).toBe('---\ntags:\n  - probe\n---\nbody #probe');
});

test('a note whose body was written before the property write failed is still restorable, and a failing undo can be retried', async () => {
	const fake = createFakeApp({ 'a.md': '---\ntags: [probe]\n---\nbody #probe' });
	const file = fake.app.vault.getFileByPath('a.md')!;
	const original = fake.app.fileManager.processFrontMatter.bind(fake.app.fileManager);
	fake.app.fileManager.processFrontMatter = () => Promise.reject(new Error('locked'));
	const result = await editTags(fake.app, [file], renameMapper('probe', 'changed'), noWait);
	expect(result.failed?.path).toBe('a.md');
	expect(result.records).toHaveLength(1);
	expect(fake.read('a.md')).toContain('body #changed');
	const process = fake.app.vault.process;
	fake.app.vault.process = () => Promise.reject(new Error('locked'));
	const first = await undoTagEdit(fake.app, result.records);
	expect(first.remaining).toHaveLength(1);
	fake.app.vault.process = process;
	fake.app.fileManager.processFrontMatter = original;
	const second = await undoTagEdit(fake.app, first.remaining);
	expect(second).toMatchObject({ restored: 1, remaining: [] });
	expect(fake.read('a.md')).toBe('---\ntags: [probe]\n---\nbody #probe');
});

function periodicFor(fake: ReturnType<typeof createFakeApp>, settings: ReturnType<typeof memorySettings>) {
	const opened: string[] = [];
	const notices: string[] = [];
	const periodic = createPeriodicNotes({
		app: fake.app,
		settings: settings as never,
		factory: factoryFor(fake, settings).factory,
		openFile: (file) => { opened.push(file.path); return Promise.resolve(); },
		entry: () => undefined,
		notify: (key) => { notices.push(key); },
		report: vi.fn(),
	});
	return { periodic, opened, notices };
}

test('an ISO week pattern opens the ISO week even when the first day of the week is Sunday or Saturday', async () => {
	for (const weekStart of ['sunday', 'saturday', 'monday'] as const) {
		const fake = createFakeApp({ 'T/week.md': '{{date}} {{monday:YYYY-MM-DD}} {{sunday:YYYY-MM-DD}}' });
		const rules = normalizePeriodRules({ week: { enabled: true, folder: 'W', format: 'GGGG-[W]WW', template: 'T/week.md' } });
		const { periodic } = periodicFor(fake, memorySettings({ periodRules: rules, calendarWeekStart: weekStart }));
		await periodic.open('week', new Date(2026, 9, 14));
		expect(fake.read('W/2026-W42.md')).toBe('2026-W42 2026-10-12 2026-10-18');
		expect(periodic.pathFor('week', new Date(2026, 9, 18))).toBe('W/2026-W42.md');
	}
});

test('next, previous and parent notes work with ISO weeks and a Sunday first day', async () => {
	const fake = createFakeApp({ 'D/2026-10-18.md': '', 'W/2026-W42.md': '', 'W/2026-W43.md': '' });
	const rules = normalizePeriodRules({ day: { enabled: true, folder: 'D' }, week: { enabled: true, folder: 'W', format: 'GGGG-[W]WW' } });
	const settings = memorySettings({ periodRules: rules, calendarWeekStart: 'sunday' });
	const { periodic, opened } = periodicFor(fake, settings);
	let active = 'D/2026-10-18.md';
	(fake.app.workspace as { getActiveFile: () => unknown }).getActiveFile = () => ({ path: active });
	await periodic.openParent();
	expect(opened.at(-1)).toBe('W/2026-W42.md');
	active = 'W/2026-W42.md';
	await periodic.openRelative(1);
	expect(opened.at(-1)).toBe('W/2026-W43.md');
});

test('a pattern that gives every period the same name is refused with a message and creates nothing', async () => {
	const fake = createFakeApp();
	const rules = normalizePeriodRules({ day: { enabled: true, folder: '', format: '[Daily]' } });
	const { periodic, notices } = periodicFor(fake, memorySettings({ periodRules: rules }));
	expect(await periodic.open('day', new Date(2026, 9, 15))).toBe(false);
	expect(notices).toEqual(['navigator.periodFormatInvalid']);
	expect(fake.files.size).toBe(0);
});

test('Moment formats the core Daily notes plugin accepts work for the daily rule', async () => {
	const fake = createFakeApp();
	const rules = normalizePeriodRules({ day: { enabled: true, folder: 'D', format: 'Do MMMM YYYY' } });
	const { periodic } = periodicFor(fake, memorySettings({ periodRules: rules }));
	const date = new Date(2026, 9, 15);
	expect(periodic.pathFor('day', date)).toBe(`D/${formatDate(date, 'Do MMMM YYYY')}.md`);
	expect(periodic.pathFor('day', date)).toMatch(/^D\/15\w\w October 2026\.md$/);
	expect(periodic.pathFor('day', date)).not.toBe(periodic.pathFor('day', new Date(2026, 9, 16)));
});

test('Templater mode does not ask NAND prompts for the template, only for the file name', async () => {
	const fake = createFakeApp({ 'T/t.md': '<% 1 %> {{prompt:Body}}' });
	const created: string[] = [];
	const plugins = { 'templater-obsidian': { templater: { create_new_note_from_template: async (_template: TFile, _folder: unknown, name: string) => { created.push(name); return fake.add(`Out/${name}.md`, 'made by templater'); } } } };
	Object.assign(fake.app, { plugins: { plugins } });
	const settings = memorySettings({ templateFolder: 'T' });
	const { factory, asked } = factoryFor(fake, settings, { Who: 'Ann' });
	const command = { id: 'x', name: 'X', template: 't', fileName: 'note {{prompt:Who}}', location: 'folder' as const, folder: 'Out' };
	await factory.runCreateCommand(command, '/');
	expect(asked).toEqual(['Who']);
	expect(created).toEqual(['note Ann']);
	const builtin = memorySettings({ templateFolder: 'T', templateEngine: 'builtin' });
	const second = factoryFor(createFakeApp({ 'T/t.md': '{{prompt:Body}}!' }), builtin, { Body: 'hi', Who: 'Bo' });
	await second.factory.runCreateCommand(command, '/');
	expect(second.asked).toEqual(['Who', 'Body']);
});

test('notes made without a name use the translated default name', async () => {
	const fake = createFakeApp({ 'T/t.md': 'x' });
	const settings = memorySettings({ templateFolder: 'T' });
	const factory = createNoteFactory({ app: fake.app, settings: settings as never, ask: () => Promise.resolve(undefined), open: () => Promise.resolve(), notify: () => undefined, defaultName: () => '未命名', addTag: () => Promise.resolve() });
	expect((await factory.createFromChosenTemplate('Inbox', 'T/t.md'))?.path).toBe('Inbox/未命名.md');
	const command = { id: 'n', name: 'N', template: '', fileName: '', location: 'folder' as const, folder: 'Inbox' };
	expect((await factory.runCreateCommand(command, '/'))?.path).toBe('Inbox/未命名 2.md');
});

test('a tag property that the user set to null after a removal is an independent edit, not "still removed"', async () => {
	const fake = createFakeApp({ 'a.md': '---\ntags: [nullprobe]\n---\nBody' });
	const file = fake.app.vault.getFileByPath('a.md')!;
	const { records } = await editTags(fake.app, [file], removeMapper('nullprobe', true), noWait);
	expect(fake.read('a.md')).toBe('Body');
	// the key is missing now; someone sets it to an empty (null) value
	await fake.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm['tags'] = null; });
	expect(fake.read('a.md')).toBe('---\ntags:\n---\nBody');
	const undone = await undoTagEdit(fake.app, records);
	expect(undone).toMatchObject({ restored: 0, skipped: ['a.md'] });
	expect(fake.read('a.md')).toBe('---\ntags:\n---\nBody');
});

test('undo tells a missing property from null, an empty list and an empty value, and still restores an untouched edit', async () => {
	for (const independent of [[], '' as unknown, null]) {
		const fake = createFakeApp({ 'a.md': '---\ntags: [probe]\n---\nBody' });
		const file = fake.app.vault.getFileByPath('a.md')!;
		const { records } = await editTags(fake.app, [file], removeMapper('probe', true), noWait);
		await fake.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm['tags'] = independent; });
		expect((await undoTagEdit(fake.app, records)).restored).toBe(0);
	}
	const fake = createFakeApp({ 'a.md': '---\ntags: [probe]\n---\nBody' });
	const { records } = await editTags(fake.app, [fake.app.vault.getFileByPath('a.md')!], removeMapper('probe', true), noWait);
	expect((await undoTagEdit(fake.app, records)).restored).toBe(1);
	expect(fake.read('a.md')).toContain('  - probe');
});

test('a renamed tag property keeps its exact before-state: undo restores a key that existed, removes one that did not', async () => {
	const fake = createFakeApp({ 'a.md': '---\ntag: probe\n---\nBody' });
	const file = fake.app.vault.getFileByPath('a.md')!;
	const { records } = await editTags(fake.app, [file], renameMapper('probe', 'changed'), noWait);
	expect(fake.read('a.md')).toContain('tag:');
	expect((await undoTagEdit(fake.app, records)).restored).toBe(1);
	expect(fake.read('a.md')).toContain('tag: probe');
});

test('tag properties with a quoted key are found through the parsed frontmatter', async () => {
	const fake = createFakeApp({ 'a.md': '---\n"tags": [quotedprobe]\n---\nBody', 'b.md': "---\n'tag': quotedprobe\n---\nB", 'c.md': '---\nnot_tags: [quotedprobe]\n---\nC' });
	const files = ['a.md', 'b.md', 'c.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const { records } = await editTags(fake.app, files, renameMapper('quotedprobe', 'quotedchanged'), noWait);
	expect(records.map((record) => record.path)).toEqual(['a.md', 'b.md']);
	expect(fake.read('a.md')).toContain('quotedchanged');
	expect(fake.read('b.md')).toContain('quotedchanged');
	expect(fake.read('c.md')).toBe('---\nnot_tags: [quotedprobe]\n---\nC');
});

test('notes whose frontmatter is not valid, or has no tag properties, are not rewritten', async () => {
	const fake = createFakeApp({ 'a.md': '---\nstatus: x\n---\nBody', 'b.md': 'no frontmatter' });
	let writes = 0;
	const original = fake.app.fileManager.processFrontMatter.bind(fake.app.fileManager);
	fake.app.fileManager.processFrontMatter = (file: TFile, edit: (fm: Record<string, unknown>) => void) => { writes++; return original(file, edit); };
	await editTags(fake.app, ['a.md', 'b.md'].map((path) => fake.app.vault.getFileByPath(path)!), removeMapper('x', true), noWait);
	expect(writes).toBe(0);
});

test('merge keeps properties named position or like prototype members, from the first and from later notes', async () => {
	const fake = createFakeApp({ 'N/A.md': '---\nposition: 7\nconstructor: Builder\nstatus: published\n---\nA', 'N/B.md': '---\ntoString: later\nhasOwnProperty: yes\n---\nB' });
	const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const plan = (await planMerge(fake.app, files)) as MergePlan;
	expect(plan.conflicts).toEqual([]);
	const file = await merged(fake.app, files, true, plan.fingerprint);
	const text = fake.read(file.path)!;
	for (const line of ['position: 7', 'constructor: Builder', 'status: published', 'toString: later', 'hasOwnProperty: yes']) expect(text).toContain(line);
	expect(fake.trashed).toEqual(['N/A.md', 'N/B.md']);
});

test('a template that would write damaged or different frontmatter creates nothing and says why', async () => {
	const fake = createFakeApp({ 'T/plain.md': '---\ntitle: {{prompt:Title}}\n---\nbody', 'T/quoted.md': '---\ntitle: "{{prompt:Title}}"\n---\nbody', 'T/comment.md': '---\ntitle: x {{prompt:Title}}\n---\nbody' });
	const notices: Array<[string, unknown]> = [];
	const settings = memorySettings({ templateFolder: 'T' });
	const make = (answer: string) => createNoteFactory({ app: fake.app, settings: settings as never, ask: () => Promise.resolve(answer), open: () => Promise.resolve(), notify: (key, params) => { notices.push([key, params]); }, defaultName: () => 'Untitled', addTag: () => Promise.resolve() });
	// a colon makes a plain value a mapping: invalid
	expect(await make('a: b').createNote({ folder: 'Out', name: 'one', template: 'plain', open: false })).toBeUndefined();
	// a comment marker silently shortens the value: different
	expect(await make('# y').createNote({ folder: 'Out', name: 'two', template: 'comment', open: false })).toBeUndefined();
	expect(fake.has('Out/one.md')).toBe(false);
	expect(fake.has('Out/two.md')).toBe(false);
	expect(notices.map(([key]) => key)).toEqual(['navigator.templateYamlInvalid', 'navigator.templateYamlDifferent']);
	expect(notices[0]![1]).toEqual({ template: 'plain' });
	// the same answers in a quoted value are escaped and written
	expect((await make('a: "b" # y').createNote({ folder: 'Out', name: 'three', template: 'quoted', open: false }))?.path).toBe('Out/three.md');
	expect(fake.read('Out/three.md')).toBe('---\ntitle: "a: \\"b\\" # y"\n---\nbody');
});

/** Run with Obsidian's reader returning real YAML 1.1 types (Set, Map, ...) for a note's frontmatter. */
async function withYaml11<T>(run: () => Promise<T>): Promise<T> {
	const real = (await import('obsidian')) as unknown as { parseYaml: (text: string) => unknown };
	const original = real.parseYaml;
	const { parse } = await import('yaml');
	real.parseYaml = (text: string) => parse(text, { schema: 'yaml-1.1' }) as unknown;
	try { return await run(); } finally { real.parseYaml = original; }
}

test('a note whose frontmatter root is a YAML set stops the merge: nothing is created, nothing is trashed', async () => {
	const fake = createFakeApp({ 'N/RootSetA.md': '---\n!!set {important: null}\n---\nA body\n', 'N/B.md': 'B body\n' });
	const files = ['N/RootSetA.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	await withYaml11(async () => {
		expect(await planMerge(fake.app, files)).toEqual({ unreadable: 'N/RootSetA.md' });
		expect(await mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true })).toEqual({ status: 'unreadable', path: 'N/RootSetA.md' });
	});
	expect(fake.files.size).toBe(2);
	expect(fake.trashed).toEqual([]);
	expect(fake.read('N/RootSetA.md')).toBe('---\n!!set {important: null}\n---\nA body\n');
});

test('a set, map or binary value inside the properties stops the merge too, in any note', async () => {
	for (const yaml of ['x: 1\nextra: !!set {a: null}', 'm: !!omap [a: 1]', 'b: !!binary aGk=']) {
		const fake = createFakeApp({ 'N/A.md': 'A', 'N/B.md': `---\n${yaml}\n---\nB` });
		const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
		await withYaml11(async () => { expect(await mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true })).toMatchObject({ status: 'unreadable', path: 'N/B.md' }); });
		expect(fake.files.size).toBe(2);
		expect(fake.trashed).toEqual([]);
	}
});

test('tag edits leave a note with properties they cannot handle completely alone, and report it', async () => {
	const fake = createFakeApp({ 'a.md': '---\ntags: [probe]\nextra: !!set {k: null}\n---\nbody #probe', 'b.md': 'plain #probe' });
	const files = ['a.md', 'b.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const result = await withYaml11(() => editTags(fake.app, files, renameMapper('probe', 'changed'), noWait));
	expect(result.unreadable).toEqual(['a.md']);
	expect(result.records.map((record) => record.path)).toEqual(['b.md']);
	expect(fake.read('a.md')).toBe('---\ntags: [probe]\nextra: !!set {k: null}\n---\nbody #probe');
	expect(fake.read('b.md')).toBe('plain #changed');
});

test('a note whose frontmatter root is a date (or any other non-mapping) stops the merge', async () => {
	for (const yaml of ['!!timestamp 2026-10-17', '2026-10-17', '- a\n- b', 'just text']) {
		const fake = createFakeApp({ 'N/A.md': `---\n${yaml}\n---\nA body\n`, 'N/B.md': 'B body\n' });
		const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
		await withYaml11(async () => { expect(await mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true })).toEqual({ status: 'unreadable', path: 'N/A.md' }); });
		expect(fake.files.size).toBe(2);
		expect(fake.trashed).toEqual([]);
	}
});

test('lists with non-finite numbers stop the merge', async () => {
	const nonfinite = createFakeApp({ 'N/A.md': '---\nnumbers: [null]\n---\nA', 'N/B.md': '---\nnumbers: [.nan]\n---\nB' });
	const nonfiniteFiles = ['N/A.md', 'N/B.md'].map((path) => nonfinite.app.vault.getFileByPath(path)!);
	await withYaml11(async () => { expect(await mergeFiles(nonfinite.app, nonfiniteFiles, { suffix: 'merged', deleteOriginals: true })).toEqual({ status: 'unreadable', path: 'N/B.md' }); });
	expect(nonfinite.files.size).toBe(2);
	expect(nonfinite.trashed).toEqual([]);
});

const dateSources = { 'N/A.md': '---\nwhen: [!!timestamp 2026-10-17]\n---\nA', 'N/B.md': '---\nwhen: ["2026-10-17T00:00:00.000Z"]\n---\nB' };

test('a result that does not read back as planned (a date written as text) is kept, the originals stay and the path is reported', async () => {
	const fake = createFakeApp(dateSources);
	const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	// this host writes the date list entry back in another form, as the real one does
	const outcome = await withYaml11(() => mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true }));
	expect(outcome).toEqual({ status: 'lossy', path: 'N/A merged.md' });
	// nothing is trashed: neither the originals nor the result
	expect(fake.trashed).toEqual([]);
	expect(fake.has('N/A merged.md')).toBe(true);
	expect(fake.read('N/A.md')).toBe(dateSources['N/A.md']);
	expect(fake.read('N/B.md')).toBe(dateSources['N/B.md']);
});

test('a lossy result is kept whether someone edited it before or after the proof read it', async () => {
	for (const timing of ['before the first read', 'after the first read'] as const) {
		const fake = createFakeApp(dateSources);
		const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
		const original = fake.app.vault.read;
		let reads = 0;
		fake.app.vault.read = async (file: TFile) => {
			if (file.path !== 'N/A merged.md') return original(file);
			reads++;
			// an edit that is already in the text the proof reads, or one that arrives right after it
			if (timing === 'before the first read' && reads === 1) await fake.app.vault.process(file, (data) => `${data}\nedited by someone`);
			const text = await original(file);
			if (timing === 'after the first read' && reads === 1) await fake.app.vault.process(file, (data) => `${data}\nedited by someone`);
			return text;
		};
		const outcome = await withYaml11(() => mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true }));
		expect(outcome, timing).toEqual({ status: 'lossy', path: 'N/A merged.md' });
		expect(fake.trashed, timing).toEqual([]);
		expect(fake.read('N/A merged.md'), timing).toContain('edited by someone');
		expect(fake.has('N/A.md') && fake.has('N/B.md'), timing).toBe(true);
	}
});

test('an ordinary merge passes the proof after writing and still recycles the originals', async () => {
	const fake = createFakeApp({ 'N/A.md': '---\nstatus: draft\naliases: [Alpha]\n---\nA body', 'N/B.md': '---\naliases: [Beta]\n---\nB body' });
	const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const outcome = await mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true });
	expect(outcome).toMatchObject({ status: 'merged', originalsKept: false });
	expect(fake.trashed).toEqual(['N/A.md', 'N/B.md']);
});

test('a result whose body or properties differ from the plan is never accepted, whatever the cause', async () => {
	const fake = createFakeApp({ 'N/A.md': '---\nstatus: draft\n---\nA body', 'N/B.md': 'B body' });
	const files = ['N/A.md', 'N/B.md'].map((path) => fake.app.vault.getFileByPath(path)!);
	const original = fake.app.fileManager.processFrontMatter.bind(fake.app.fileManager);
	// the host drops a property while writing
	fake.app.fileManager.processFrontMatter = (file: TFile, edit: (fm: Record<string, unknown>) => void) => original(file, (fm) => { edit(fm); delete fm['status']; });
	const outcome = await mergeFiles(fake.app, files, { suffix: 'merged', deleteOriginals: true });
	expect(outcome).toEqual({ status: 'lossy', path: 'N/A merged.md' });
	expect(fake.trashed).toEqual([]);
	expect(fake.has('N/A merged.md') && fake.has('N/A.md') && fake.has('N/B.md')).toBe(true);
});
