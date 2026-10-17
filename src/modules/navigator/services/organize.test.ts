// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { describe, expect, test } from 'vitest';
import { makeShortcut } from '../core/shortcuts';
import { FakeVault, createTestService, note } from './test-support';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 15, 12).getTime();

const vault = () => new FakeVault(
	[
		note('Work/plan.md', NOW - DAY, ['work'], { aliases: ['Roadmap'], props: { status: ['Active'] }, hasTask: true }),
		note('Work/sync.md', NOW - 3 * DAY, ['work/meeting'], { props: { status: ['Done'] } }),
		note('Work/Sub/deep.md', NOW - 5 * DAY, [], { props: { status: ['active'] } }),
		note('Home/journal.md', NOW - 40 * DAY, ['life']),
		note('Archive/old.md', NOW - 400 * DAY, ['archive']),
		note('root.md', NOW - 2 * DAY),
	],
	['/', 'Work', 'Work/Sub', 'Home', 'Archive'],
);
const paths = (service: Awaited<ReturnType<typeof createTestService>>['service']) => service.listItems().flatMap((item) => (item.kind === 'note' ? [item.path] : []));
const keys = (service: Awaited<ReturnType<typeof createTestService>>['service']) => service.navTree().rows.map((row) => row.key);

describe('search', () => {
	test('the filter applies to the selected folder and everything below it, only while the search is open', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.selectContext({ kind: 'folder', key: 'Work' });
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/sync.md']);
		service.openSearch();
		service.setSearchQuery('active');
		expect(paths(service)).toEqual([]);
		service.setSearchQuery('roadmap');
		expect(paths(service)).toEqual(['Work/plan.md']);
		service.setSearchQuery('.status=active');
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/Sub/deep.md']);
		service.closeSearch();
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/sync.md']);
		service.openSearch();
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/Sub/deep.md']);
	});

	test('dates, tags and filters work against the index', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.selectContext({ kind: 'folder', key: '/' });
		service.openSearch();
		for (const [query, expected] of [
			['#work', ['Work/plan.md', 'Work/sync.md']],
			['has:task', ['Work/plan.md']],
			['@last7d', ['Work/plan.md', 'root.md', 'Work/sync.md', 'Work/Sub/deep.md']],
			['@2025', ['Archive/old.md']],
			['folder:/Home', ['Home/journal.md']],
			['-#', ['root.md', 'Work/Sub/deep.md']],
			['#work OR #life', ['Work/plan.md', 'Work/sync.md', 'Home/journal.md']],
		] as const) {
			service.setSearchQuery(query);
			expect(paths(service), query).toEqual(expected);
		}
	});

	test('the default date field follows the sort order', async () => {
		const files = [note('a.md', NOW - 10 * DAY), note('b.md', NOW - 10 * DAY)];
		files[0] = { ...files[0]!, ctime: NOW };
		const { service } = await createTestService(new FakeVault(files), { now: NOW });
		service.openSearch();
		service.setSearchQuery('@today');
		expect(paths(service)).toEqual([]);
		service.setListOptions({ sortBy: 'created' });
		expect(paths(service)).toEqual(['a.md']);
	});

	test('clicking tags and properties builds the query: AND, OR, and off again', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.toggleSearchFilter('#work', 'and');
		expect(service.state.getState().search).toEqual({ open: true, query: '#work' });
		service.toggleSearchFilter('.status=done', 'or');
		expect(service.state.getState().search.query).toBe('#work OR .status=done');
		service.toggleSearchFilter('#work', 'and');
		expect(service.state.getState().search.query).toBe('.status=done');
		// With the search closed the old query is not in effect, so a click starts a new one.
		service.closeSearch();
		service.toggleSearchFilter('#life', 'and');
		expect(service.state.getState().search).toEqual({ open: true, query: '#life' });
	});

	test('the query and whether search is open are saved for this device', async () => {
		const v = vault();
		const first = await createTestService(v, { now: NOW });
		first.service.openSearch();
		first.service.setSearchQuery('#work @thisweek');
		first.service.dispose();
		const second = await createTestService(v, { reuse: first.settings, now: NOW });
		expect(second.service.state.getState().search).toEqual({ open: true, query: '#work @thisweek' });
		expect(first.settings.get().searchQuery).toBe('#work @thisweek');
	});

	test('search the whole vault selects the root and keeps the query', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.selectContext({ kind: 'folder', key: 'Home' });
		service.applySearch('#work');
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: '/' });
		expect(service.state.getState().search).toEqual({ open: true, query: '#work' });
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/sync.md']);
	});

	test('leaving the field for the list selects the first result', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.selectContext({ kind: 'folder', key: 'Work' });
		service.openSearch();
		service.setSearchQuery('sync');
		service.focusListFromSearch();
		expect(service.state.getState().selection.paths).toEqual(['Work/sync.md']);
		expect(service.state.getState().pane).toBe('list');
	});
});

describe('shortcuts', () => {
	test('folders, notes, tags, properties and searches can be pinned, opened and removed', async () => {
		const { service, calls } = await createTestService(vault(), { now: NOW });
		service.toggleShortcut(makeShortcut('folder', 'Work'));
		service.toggleShortcut(makeShortcut('note', 'root.md'));
		service.toggleShortcut(makeShortcut('tag', 'work'));
		service.toggleShortcut(makeShortcut('property', 'property:status=active'));
		service.toggleShortcut(makeShortcut('search', '#work @thisweek', 'Weekly'));
		const rows = service.navTree().rows.filter((row) => row.kind === 'shortcut');
		expect(rows.map((row) => row.label)).toEqual(['Work', 'root', '#work', 'status: active', 'Weekly']);
		service.openShortcutAt(1);
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'Work' });
		service.openShortcutAt(3);
		expect(service.state.getState().context).toEqual({ kind: 'tag', key: 'work' });
		service.openShortcutAt(4);
		expect(service.state.getState().context).toEqual({ kind: 'property', key: 'status', value: 'active' });
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/Sub/deep.md']);
		service.openShortcutAt(2);
		expect(calls.some(([name, path]) => name === 'open' && path === 'root.md')).toBe(true);
		service.openShortcutAt(5);
		expect(service.state.getState().search).toEqual({ open: true, query: '#work @thisweek' });
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: '/' });
		service.openShortcutAt(9);
		service.removeShortcut('tag:work');
		expect(service.settings.get().shortcuts.map((entry) => entry.id)).toEqual(['folder:Work', 'note:root.md', 'property:property:status=active', 'search:#work @thisweek']);
	});

	test('shortcuts reorder by dragging and rename', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		for (const name of ['Work', 'Home', 'Archive']) service.toggleShortcut(makeShortcut('folder', name));
		service.moveShortcut('folder:Archive', 'folder:Work');
		expect(service.settings.get().shortcuts.map((entry) => entry.key)).toEqual(['Archive', 'Work', 'Home']);
		service.moveShortcut('folder:Archive', null);
		expect(service.settings.get().shortcuts.map((entry) => entry.key)).toEqual(['Work', 'Home', 'Archive']);
		service.renameShortcut('folder:Home', 'My home');
		expect(service.navTree().rows.find((row) => row.key === 'shortcut:folder:Home')?.label).toBe('My home');
		service.renameShortcut('folder:Home', '  ');
		expect(service.navTree().rows.find((row) => row.key === 'shortcut:folder:Home')?.label).toBe('Home');
	});

	test('they follow renamed folders and vanish with deleted ones; a shortcut to a missing note is marked', async () => {
		const v = vault();
		const { service } = await createTestService(v, { now: NOW });
		service.toggleShortcut(makeShortcut('folder', 'Work'));
		service.toggleShortcut(makeShortcut('note', 'Work/plan.md'));
		service.toggleShortcut(makeShortcut('note', 'ghost.md'));
		expect(service.navTree().rows.find((row) => row.key === 'shortcut:note:ghost.md')?.missing).toBe(true);
		service.onRenamed('Work', 'Job');
		expect(service.settings.get().shortcuts.map((entry) => entry.id)).toEqual(['folder:Job', 'note:Job/plan.md', 'note:ghost.md']);
		service.onDeleted('Job');
		expect(service.settings.get().shortcuts.map((entry) => entry.id)).toEqual(['note:ghost.md']);
	});

	test('the first shortcut group is shown above the folders', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.toggleShortcut(makeShortcut('folder', 'Home'));
		expect(keys(service).slice(0, 3)).toEqual(['section:shortcuts', 'shortcut:folder:Home', 'section:folders']);
	});
});

describe('recent notes', () => {
	test('opened notes are listed newest first up to the limit, and clicking one opens and reveals it', async () => {
		const { service, calls } = await createTestService(vault(), { now: NOW, settings: { recentLimit: 2 } });
		for (const path of ['Work/plan.md', 'root.md', 'Home/journal.md', 'root.md']) service.recordRecent(path);
		service.recordRecent('missing.md');
		expect(service.settings.get().recent).toEqual(['root.md', 'Home/journal.md', 'Work/plan.md']);
		expect(service.navTree().rows.filter((row) => row.kind === 'recent').map((row) => row.path)).toEqual(['root.md', 'Home/journal.md']);
		service.openRecent('Home/journal.md');
		expect(calls.some(([name, path]) => name === 'open' && path === 'Home/journal.md')).toBe(true);
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'Home' });
		service.removeRecent('root.md');
		expect(service.settings.get().recent).toEqual(['Home/journal.md', 'Work/plan.md']);
		service.clearRecent();
		expect(keys(service).includes('section:recent')).toBe(false);
	});

	test('the list can be switched off, and renames and deletions are followed', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.recordRecent('Work/plan.md');
		service.onRenamed('Work', 'Job');
		expect(service.settings.get().recent).toEqual(['Job/plan.md']);
		service.onDeleted('Job/plan.md');
		expect(service.settings.get().recent).toEqual([]);
		service.recordRecent('root.md');
		await service.settings.update((draft) => { draft.showRecent = false; });
		expect(keys(service).includes('section:recent')).toBe(false);
	});
});

describe('sections', () => {
	test('collapsing hides the rows, and the order can be changed', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.toggleSection('folders');
		expect(keys(service).filter((key) => key.startsWith('folder:'))).toEqual([]);
		expect(service.settings.get().collapsedSections).toEqual(['folders']);
		service.toggleSection('folders');
		expect(keys(service).some((key) => key === 'folder:Work')).toBe(true);
		service.moveSection('tags', 'folders');
		const sections = keys(service).filter((key) => key.startsWith('section:'));
		expect(sections).toEqual(['section:tags', 'section:folders', 'section:properties']);
	});
});

describe('properties', () => {
	test('the browser lists keys and values and selecting one lists its notes', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		const key = service.navTree().rows.find((row) => row.kind === 'property');
		expect(key).toMatchObject({ path: 'status', count: 3, hasChildren: true });
		service.setExpanded(key!, true);
		expect(keys(service)).toContain('property:status=active');
		service.activateRow(service.navTree().rows.find((row) => row.key === 'property:status=active')!);
		expect(service.state.getState().context).toEqual({ kind: 'property', key: 'status', value: 'active' });
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/Sub/deep.md']);
		service.expandAll();
		service.collapseAll();
		expect(service.state.getState().expandedProperties.size).toBe(0);
	});

	test('the property section can be turned off or limited to chosen keys', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		await service.settings.update((draft) => { draft.propertyKeys = ['nothing']; });
		expect(keys(service).includes('section:properties')).toBe(false);
		await service.settings.update((draft) => { draft.propertyKeys = []; draft.showProperties = false; });
		expect(keys(service).includes('section:properties')).toBe(false);
	});

	test('notes can be grouped by a property', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.selectContext({ kind: 'folder', key: 'Work' });
		await service.settings.update((draft) => { draft.includeDescendants = true; });
		service.setListOptions({ groupBy: 'property', groupProperty: 'status' });
		const headers = service.listItems().flatMap((item) => (item.kind === 'header' ? [[item.value, item.count]] : []));
		expect(headers).toEqual([['Active', 2], ['Done', 1]]);
	});
});

describe('hidden items', () => {
	test('rules hide folders, tags, files and properties from the trees and lists while the index keeps them', async () => {
		const v = vault();
		const { service } = await createTestService(v, { now: NOW });
		await service.settings.update((draft) => { draft.hiddenFolders = ['Archive']; draft.hiddenTags = ['life']; });
		expect(keys(service)).not.toContain('folder:Archive');
		expect(keys(service)).not.toContain('tag:archive');
		expect(keys(service)).not.toContain('tag:life');
		service.selectContext({ kind: 'folder', key: '/' });
		await service.settings.update((draft) => { draft.includeDescendants = true; });
		expect(paths(service)).toEqual(['Work/plan.md', 'root.md', 'Work/sync.md', 'Work/Sub/deep.md']);
		expect(v.notes()).toHaveLength(6);
		await service.settings.update((draft) => { draft.hiddenFiles = ['root.md']; draft.hiddenProperties = ['status=done']; });
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/Sub/deep.md']);
	});

	test('show hidden brings everything back, and hide-from-menu adds a rule', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.hideEntry('folder', 'Archive');
		service.hideEntry('folder', 'Archive');
		service.hideEntry('tag', 'life');
		service.hideEntry('file', 'root.md');
		expect(service.settings.get().hiddenFolders).toEqual(['/Archive']);
		expect(service.settings.get().hiddenTags).toEqual(['life']);
		expect(service.settings.get().hiddenFiles).toEqual(['/root.md']);
		expect(keys(service)).not.toContain('folder:Archive');
		service.toggleShowHidden();
		expect(keys(service)).toContain('folder:Archive');
		expect(service.hidden().folder('Archive')).toBe(true);
		service.toggleShowHidden();
		expect(keys(service)).not.toContain('folder:Archive');
	});
});

describe('per-context appearance', () => {
	test('an override applies to its context only and menu changes follow it', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.setAppearance({ kind: 'folder', key: 'Work' }, { sortBy: 'name', sortDirection: 'asc', compact: true });
		service.selectContext({ kind: 'folder', key: 'Work' });
		expect(service.appearance()).toMatchObject({ sortBy: 'name', sortDirection: 'asc', compact: true, previewRows: 2 });
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/sync.md']);
		service.setListOptions({ sortDirection: 'desc' });
		expect(service.settings.get().appearances['folder:Work']?.sortDirection).toBe('desc');
		expect(service.settings.get().sortDirection).toBe('desc');
		service.setListOptions({ previewRows: 4 });
		expect(service.settings.get().previewRows).toBe(4);
		expect(service.settings.get().appearances['folder:Work']?.previewRows).toBeUndefined();
		service.toggleCompact();
		expect(service.settings.get().appearances['folder:Work']?.compact).toBe(false);
		expect(service.settings.get().compact).toBe(false);
		service.selectContext({ kind: 'folder', key: 'Home' });
		expect(service.appearance()).toMatchObject({ sortBy: 'modified', compact: false, previewRows: 4 });
		service.setAppearance({ kind: 'folder', key: 'Work' }, undefined);
		expect(service.settings.get().appearances).toEqual({});
	});

	test('include-subfolders is per context and the group property travels with its grouping', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.setAppearance({ kind: 'folder', key: 'Work' }, { includeDescendants: true, groupBy: 'property', groupProperty: 'status' });
		service.selectContext({ kind: 'folder', key: 'Work' });
		expect(paths(service)).toEqual(['Work/plan.md', 'Work/Sub/deep.md', 'Work/sync.md']);
		service.setListOptions({ groupBy: 'property', groupProperty: 'other' });
		expect(service.settings.get().appearances['folder:Work']).toMatchObject({ groupProperty: 'other' });
		expect(service.settings.get().groupProperty).toBe('');
		service.selectContext({ kind: 'folder', key: 'Home' });
		expect(service.appearance().includeDescendants).toBe(false);
	});

	test('overrides follow a renamed folder and go with a deleted one', async () => {
		const { service } = await createTestService(vault(), { now: NOW });
		service.setAppearance({ kind: 'folder', key: 'Work' }, { compact: true });
		service.setAppearance({ kind: 'tag', key: 'work' }, { compact: true });
		service.onRenamed('Work', 'Job');
		expect(Object.keys(service.settings.get().appearances).sort()).toEqual(['folder:Job', 'tag:work']);
		service.onDeleted('Job');
		expect(Object.keys(service.settings.get().appearances)).toEqual(['tag:work']);
	});
});

describe('folder notes', () => {
	const folderVault = () => new FakeVault(
		[note('Alpha/Alpha.md', 5), note('Alpha/other.md', 4), note('Beta/readme.md', 3), note('loose.md', 2)],
		['/', 'Alpha', 'Beta'],
	);

	test('selecting a folder opens its folder note when enabled', async () => {
		const { service, calls } = await createTestService(folderVault(), { settings: { folderNotes: true } });
		expect(service.folderNote('Alpha')?.path).toBe('Alpha/Alpha.md');
		expect(service.folderNote('Beta')).toBeUndefined();
		service.activateRow(service.navTree().rows.find((row) => row.key === 'folder:Alpha')!);
		expect(calls.filter(([name]) => name === 'open')).toEqual([['open', 'Alpha/Alpha.md', {}]]);
		service.activateRow(service.navTree().rows.find((row) => row.key === 'folder:Beta')!);
		expect(calls.filter(([name]) => name === 'open')).toHaveLength(1);
	});

	test('nothing is a folder note while the feature is off, or when opening on click is off', async () => {
		const off = await createTestService(folderVault());
		expect(off.service.folderNote('Alpha')).toBeUndefined();
		const quiet = await createTestService(folderVault(), { settings: { folderNotes: true, folderNoteOpenOnClick: false } });
		quiet.service.activateRow(quiet.service.navTree().rows.find((row) => row.key === 'folder:Alpha')!);
		expect(quiet.calls.some(([name]) => name === 'open')).toBe(false);
	});

	test('set as folder note renames the note after its folder, and refuses to overwrite', async () => {
		const { service, calls } = await createTestService(folderVault(), { settings: { folderNotes: true } });
		await service.setAsFolderNote('Beta/readme.md');
		expect(calls).toContainEqual(['rename', 'Beta/readme.md', 'Beta']);
		await service.setAsFolderNote('Alpha/other.md');
		expect(calls).toContainEqual(['notify', 'navigator.folderNoteExists', { name: 'Alpha' }]);
		await service.setAsFolderNote('loose.md');
		expect(calls).toContainEqual(['notify', 'navigator.folderNoteNone', undefined]);
	});

	test('detach renames the folder note to a chosen name', async () => {
		const { service, calls } = await createTestService(folderVault(), { settings: { folderNotes: true } });
		await service.detachFolderNote('Alpha');
		expect(calls).toContainEqual(['askName', 'Alpha (Alpha)']);
		expect(calls).toContainEqual(['rename', 'Alpha/Alpha.md', 'Alpha (Alpha)']);
	});

	test('convert creates a folder named like the note and moves the note inside', async () => {
		const { service, calls } = await createTestService(folderVault(), { settings: { folderNotes: true } });
		await service.convertToFolderNote('loose.md');
		expect(calls).toContainEqual(['ensureFolder', 'loose']);
		expect(calls).toContainEqual(['move', ['loose.md'], 'loose']);
		await service.convertToFolderNote('Alpha/other.md');
		expect(calls).toContainEqual(['ensureFolder', 'Alpha/other']);
	});

	test('a fixed folder note name is honoured', async () => {
		const { service } = await createTestService(new FakeVault([note('Alpha/index.md', 5), note('Beta/Beta.md', 3)], ['/', 'Alpha', 'Beta']), { settings: { folderNotes: true, folderNoteName: 'index' } });
		expect(service.folderNote('Alpha')?.path).toBe('Alpha/index.md');
		expect(service.folderNote('Beta')).toBeUndefined();
	});

	test('pinning all folder notes pins each one in its folder', async () => {
		const { service } = await createTestService(folderVault(), { settings: { folderNotes: true } });
		service.pinFolderNotes();
		service.pinFolderNotes();
		expect(service.settings.get().pinned).toEqual({ 'folder:Alpha': ['Alpha/Alpha.md'] });
		service.selectContext({ kind: 'folder', key: 'Alpha' });
		expect(service.listItems()[0]).toMatchObject({ kind: 'header', section: 'pinned' });
	});
});

describe('the selection only holds notes the list shows', () => {
	const pair = () => new FakeVault([note('Alpha.md', 5), note('Beta.md', 4), note('Alpine.md', 3)], ['/']);
	const trashed = (calls: Array<[string, ...unknown[]]>) => calls.filter(([name]) => name === 'trash').map(([, paths]) => paths);

	test('searching away the selected note clears it; Enter picks a visible one and Delete only deletes that', async () => {
		const { service, calls } = await createTestService(pair(), { now: NOW });
		service.selectNote('Alpha.md', 'only');
		service.openSearch();
		service.setSearchQuery('beta');
		expect(service.state.getState().selection).toEqual({ paths: [], anchor: null, cursor: null });
		service.focusListFromSearch();
		expect(service.state.getState().selection.paths).toEqual(['Beta.md']);
		await service.deleteSelected();
		expect(trashed(calls)).toEqual([['Beta.md']]);
	});

	test('with no result nothing can be deleted, moved or copied', async () => {
		const { service, calls } = await createTestService(pair(), { now: NOW });
		service.selectNote('Alpha.md', 'only');
		service.openSearch();
		service.setSearchQuery('zzz');
		expect(service.state.getState().selection.paths).toEqual([]);
		service.perform('delete', 'list');
		await service.deleteSelected();
		await service.moveSelected('Target');
		await service.duplicateSelected();
		expect(calls.filter(([name]) => ['trash', 'move', 'duplicate'].includes(name))).toEqual([]);
	});

	test('a multi-selection keeps the notes that still match, with cursor and anchor on them', async () => {
		const { service } = await createTestService(pair(), { now: NOW });
		service.selectNote('Alpha.md', 'only');
		service.selectNote('Alpine.md', 'toggle');
		service.selectNote('Beta.md', 'toggle');
		service.openSearch();
		service.setSearchQuery('al');
		const { selection } = service.state.getState();
		expect(selection.paths).toEqual(['Alpha.md', 'Alpine.md']);
		expect(selection.paths).toContain(selection.cursor);
		expect(selection.paths).toContain(selection.anchor);
		// Showing everything again does not bring the dropped note back.
		service.setSearchQuery('');
		expect(service.state.getState().selection.paths).toEqual(['Alpha.md', 'Alpine.md']);
	});

	test('closing the search or changing the query to include the note leaves a valid selection alone', async () => {
		const { service } = await createTestService(pair(), { now: NOW });
		service.selectNote('Alpha.md', 'only');
		service.openSearch();
		service.setSearchQuery('alpha');
		expect(service.state.getState().selection.paths).toEqual(['Alpha.md']);
		service.closeSearch();
		expect(service.state.getState().selection.paths).toEqual(['Alpha.md']);
	});

	test('a new hiding rule drops hidden notes from the selection', async () => {
		const { service, calls } = await createTestService(pair(), { now: NOW });
		service.selectNote('Alpha.md', 'only');
		service.selectNote('Beta.md', 'toggle');
		await service.settings.update((draft) => { draft.hiddenFiles = ['Alpha.md']; });
		expect(service.state.getState().selection.paths).toEqual(['Beta.md']);
		await service.deleteSelected();
		expect(trashed(calls)).toEqual([['Beta.md']]);
	});

	test('a selection that went stale anyway is filtered again when a file operation runs', async () => {
		const { service, calls } = await createTestService(pair(), { now: NOW });
		service.openSearch();
		service.setSearchQuery('beta');
		// Simulate state that slipped past the sync: the selection names a note outside the list.
		service.state.setState({ selection: { paths: ['Alpha.md', 'Beta.md'], anchor: 'Alpha.md', cursor: 'Beta.md' } });
		await service.deleteSelected();
		expect(trashed(calls)).toEqual([['Beta.md']]);
		service.state.setState({ selection: { paths: ['Alpha.md'], anchor: 'Alpha.md', cursor: 'Alpha.md' } });
		await service.moveSelected('Target');
		await service.duplicateSelected();
		expect(calls.some(([name, paths]) => name === 'move' && JSON.stringify(paths).includes('Alpha'))).toBe(false);
		expect(calls.some(([name]) => name === 'duplicate')).toBe(false);
		expect(service.dragPaths('Beta.md')).toEqual(['Beta.md']);
	});

	test('a rename keeps the selection on the renamed note', async () => {
		const { service } = await createTestService(pair(), { now: NOW });
		service.selectNote('Beta.md', 'only');
		service.startRename('Beta.md', false);
		await service.commitRename('Gamma');
		expect(service.state.getState().selection.paths).toEqual(['Gamma.md']);
	});
});

describe('hiding rules reach the recent list and shortcuts', () => {
	const v = () => new FakeVault(
		[note('public.md', 5, ['open']), note('secret.md', 4, ['private']), note('Vault/in.md', 3), note('flagged.md', 2, [], { props: { private: ['yes'] } }), note('other.md', 1)],
		['/', 'Vault'],
	);
	const recentPaths = (service: Awaited<ReturnType<typeof createTestService>>['service']) => service.navTree().rows.filter((row) => row.kind === 'recent').map((row) => row.path);
	const open = (service: Awaited<ReturnType<typeof createTestService>>['service']) => { for (const path of ['other.md', 'flagged.md', 'Vault/in.md', 'secret.md', 'public.md']) service.recordRecent(path); };

	test('hidden files, folders, tags and properties leave the recent list but stay in the history', async () => {
		const { service } = await createTestService(v(), { now: NOW, settings: { recentLimit: 30 } });
		open(service);
		expect(recentPaths(service)).toEqual(['public.md', 'secret.md', 'Vault/in.md', 'flagged.md', 'other.md']);
		await service.settings.update((draft) => { draft.hiddenFiles = ['secret.md']; draft.hiddenFolders = ['Vault']; draft.hiddenTags = []; draft.hiddenProperties = ['private']; });
		expect(recentPaths(service)).toEqual(['public.md', 'other.md']);
		expect(service.settings.get().recent).toHaveLength(5);
		await service.settings.update((draft) => { draft.hiddenFiles = []; draft.hiddenFolders = []; draft.hiddenTags = ['private']; draft.hiddenProperties = []; });
		expect(recentPaths(service)).toEqual(['public.md', 'Vault/in.md', 'flagged.md', 'other.md']);
	});

	test('the limit counts visible notes only', async () => {
		const { service } = await createTestService(v(), { now: NOW, settings: { recentLimit: 2, hiddenFiles: ['public.md'] } });
		open(service);
		expect(recentPaths(service)).toEqual(['secret.md', 'Vault/in.md']);
	});

	test('"show hidden" brings them back marked as hidden, and clicking a hidden one is refused otherwise', async () => {
		const { service, calls } = await createTestService(v(), { now: NOW, settings: { recentLimit: 30, hiddenFiles: ['secret.md'] } });
		open(service);
		expect(recentPaths(service)).not.toContain('secret.md');
		service.openRecent('secret.md');
		expect(calls.some(([name, path]) => name === 'open' && path === 'secret.md')).toBe(false);
		service.toggleShowHidden();
		const row = service.navTree().rows.find((entry) => entry.key === 'recent:secret.md');
		expect(row).toMatchObject({ hidden: true });
		service.openRecent('secret.md');
		expect(calls.some(([name, path]) => name === 'open' && path === 'secret.md')).toBe(true);
	});

	test('shortcuts to hidden notes and folders follow the rules too', async () => {
		const { service } = await createTestService(v(), { now: NOW, settings: { hiddenFiles: ['secret.md'], hiddenFolders: ['Vault'] } });
		for (const shortcut of [makeShortcut('note', 'secret.md'), makeShortcut('note', 'public.md'), makeShortcut('folder', 'Vault'), makeShortcut('tag', 'private')]) service.toggleShortcut(shortcut);
		const rows = () => service.navTree().rows.filter((row) => row.kind === 'shortcut').map((row) => row.key);
		expect(rows()).toEqual(['shortcut:note:public.md', 'shortcut:tag:private']);
		service.openShortcut(makeShortcut('note', 'secret.md'));
		service.toggleShowHidden();
		expect(rows()).toEqual(['shortcut:note:secret.md', 'shortcut:note:public.md', 'shortcut:folder:Vault', 'shortcut:tag:private']);
		expect(service.navTree().rows.find((row) => row.key === 'shortcut:folder:Vault')).toMatchObject({ hidden: true });
	});
});

describe('keyboard access to every navigation row', () => {
	const kv = () => new FakeVault([note('Work/a.md', NOW - DAY, ['x'], { props: { status: ['on'] } }), note('b.md', NOW - 2 * DAY)], ['/', 'Work']);
	const setup = async () => {
		const t = await createTestService(kv(), { now: NOW });
		for (const entry of [makeShortcut('folder', 'Work'), makeShortcut('note', 'b.md')]) t.service.toggleShortcut(entry);
		t.service.recordRecent('b.md');
		return t;
	};
	const focusKey = (service: Awaited<ReturnType<typeof createTestService>>['service']) => service.state.getState().navFocus;

	test('arrows visit section titles, shortcut and recent rows; they only take focus, the selection stays', async () => {
		const { service } = await setup();
		service.selectContext({ kind: 'folder', key: '/' });
		service.perform('home', 'nav');
		expect(focusKey(service)).toBe('section:shortcuts');
		service.perform('moveDown', 'nav');
		expect(focusKey(service)).toBe('shortcut:folder:Work');
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: '/' });
		service.perform('moveDown', 'nav');
		service.perform('moveDown', 'nav');
		service.perform('moveDown', 'nav');
		expect(focusKey(service)).toBe('recent:b.md');
		service.perform('moveDown', 'nav');
		service.perform('moveDown', 'nav');
		expect(focusKey(service)).toBeNull();
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: '/' });
		service.perform('end', 'nav');
		expect(service.navTree().rows.at(-1)?.key).toMatch(/^(property|tag|untagged)/);
	});

	test('Enter or Right on a shortcut or recent row opens it', async () => {
		const { service, calls } = await setup();
		service.perform('home', 'nav');
		service.perform('moveDown', 'nav');
		service.perform('expandOrFocusList', 'nav');
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'Work' });
		service.perform('home', 'nav');
		service.perform('moveDown', 'nav');
		service.perform('moveDown', 'nav');
		expect(focusKey(service)).toBe('shortcut:note:b.md');
		service.perform('open', 'nav');
		expect(calls.some(([name, path]) => name === 'open' && path === 'b.md')).toBe(true);
	});

	test('a folded section can be reopened from the keyboard, and "expand all" opens all of them', async () => {
		const { service } = await setup();
		for (const id of ['shortcuts', 'recent', 'folders', 'tags', 'properties'] as const) service.toggleSection(id);
		expect(service.navTree().rows.every((row) => row.kind === 'section')).toBe(true);
		service.perform('home', 'nav');
		expect(focusKey(service)).toBe('section:shortcuts');
		service.perform('expandOrFocusList', 'nav');
		expect(service.settings.get().collapsedSections).not.toContain('shortcuts');
		service.perform('expandOrFocusList', 'nav');
		expect(focusKey(service)).toBe('shortcut:folder:Work');
		service.perform('collapseOrParent', 'nav');
		expect(focusKey(service)).toBe('section:shortcuts');
		service.perform('collapseOrParent', 'nav');
		expect(service.settings.get().collapsedSections).toContain('shortcuts');
		service.perform('open', 'nav');
		expect(service.settings.get().collapsedSections).not.toContain('shortcuts');
		service.toggleSection('shortcuts');
		service.expandAll();
		expect(service.settings.get().collapsedSections).toEqual([]);
	});

	test('Delete removes the shortcut or recent row, F2 renames a shortcut', async () => {
		const { service, calls } = await setup();
		service.perform('home', 'nav');
		service.perform('moveDown', 'nav');
		service.perform('delete', 'nav');
		expect(service.settings.get().shortcuts.map((entry) => entry.id)).toEqual(['note:b.md']);
		expect(focusKey(service)).toBe('shortcut:folder:Work');
		await new Promise((resolve) => setTimeout(resolve, 0));
		service.perform('home', 'nav');
		service.perform('moveDown', 'nav');
		service.perform('rename', 'nav');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(calls).toContainEqual(['askName', 'b']);
		service.perform('end', 'nav');
		service.perform('moveUp', 'nav');
		const recent = service.navTree().rows.find((row) => row.kind === 'recent')!;
		service.state.setState({ navFocus: recent.key });
		service.perform('delete', 'nav');
		expect(service.settings.get().recent).toEqual([]);
	});

	test('the context-menu key asks the pane to open its menu on the row the keyboard is on', async () => {
		const { service } = await setup();
		service.perform('home', 'nav');
		const before = service.state.getState().menuRequest;
		service.perform('contextMenu', 'nav');
		expect(service.state.getState().menuRequest).toMatchObject({ pane: 'nav' });
		expect(service.state.getState().menuRequest).not.toBe(before);
		service.selectContext({ kind: 'folder', key: 'Work' });
		service.perform('contextMenu', 'list');
		expect(service.state.getState().menuRequest?.pane).toBe('nav');
		service.selectNote('Work/a.md', 'only');
		service.perform('contextMenu', 'list');
		expect(service.state.getState().menuRequest?.pane).toBe('list');
	});
});

describe('lists for dashboard widgets', () => {
	const lv = () => new FakeVault([note('Work/plan.md', 5), note('secret.md', 4), note('home.md', 3, ['idea'])], ['/', 'Work']);

	test('the snapshot holds recent notes and shortcuts with titles, minus hidden and missing ones', async () => {
		const { service } = await createTestService(lv(), { now: NOW, settings: { recentLimit: 2, hiddenFiles: ['secret.md'] } });
		for (const path of ['home.md', 'secret.md', 'Work/plan.md']) service.recordRecent(path);
		for (const shortcut of [makeShortcut('folder', 'Work'), makeShortcut('note', 'secret.md'), makeShortcut('note', 'gone.md'), makeShortcut('tag', 'idea'), makeShortcut('search', '#a OR #b', 'Mine')]) service.toggleShortcut(shortcut);
		expect(service.listsSnapshot()).toEqual({
			recent: [{ path: 'Work/plan.md', title: 'plan' }, { path: 'home.md', title: 'home' }],
			shortcuts: [
				{ kind: 'folder', key: 'Work', title: 'Work' },
				{ kind: 'tag', key: 'idea', title: '#idea' },
				{ kind: 'search', key: '#a OR #b', title: 'Mine' },
			],
		});
		service.toggleShowHidden();
		expect(service.listsSnapshot().shortcuts.map((entry) => entry.key)).toContain('secret.md');
	});

	test('the recent list follows its settings', async () => {
		const { service } = await createTestService(lv(), { now: NOW });
		service.recordRecent('home.md');
		expect(service.listsSnapshot().recent).toHaveLength(1);
		await service.settings.update((draft) => { draft.showRecent = false; });
		expect(service.listsSnapshot().recent).toEqual([]);
	});

	test('subscribers hear about real changes only, and the snapshot object is stable in between', async () => {
		const { service } = await createTestService(lv(), { now: NOW });
		const heard: string[] = [];
		const stop = service.subscribeLists(() => heard.push('changed'));
		const first = service.listsSnapshot();
		await service.settings.update((draft) => { draft.sortBy = 'name'; });
		expect(heard).toEqual([]);
		expect(service.listsSnapshot()).toBe(first);
		service.recordRecent('home.md');
		expect(heard).toHaveLength(1);
		service.toggleShortcut(makeShortcut('folder', 'Work'));
		expect(heard).toHaveLength(2);
		service.hideEntry('file', 'home.md');
		expect(heard).toHaveLength(3);
		expect(service.listsSnapshot().recent).toEqual([]);
		stop();
		service.recordRecent('Work/plan.md');
		expect(heard).toHaveLength(3);
	});

	test('opening targets goes through the same paths as the navigator rows', async () => {
		const { service, calls } = await createTestService(lv(), { now: NOW });
		service.openShortcut(makeShortcut('note', 'home.md'));
		expect(calls.some(([name, path]) => name === 'open' && path === 'home.md')).toBe(true);
		service.openShortcut(makeShortcut('folder', 'Work'));
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'Work' });
		service.openShortcut(makeShortcut('search', '#x'));
		expect(service.state.getState().search).toEqual({ open: true, query: '#x' });
	});
});

describe('after the navigator stopped', () => {
	test('a name prompt that is answered late does not rename anything', async () => {
		const answer: { resolve: (name: string | undefined) => void } = { resolve: () => undefined };
		const v = new FakeVault([note('Folder/Folder.md', 5)], ['/', 'Folder']);
		const { service, calls } = await createTestService(v, { now: NOW, settings: { folderNotes: true }, ops: { askName: () => new Promise((resolve) => { answer.resolve = resolve; }) } });
		const pending = service.detachFolderNote('Folder');
		service.dispose();
		answer.resolve('AfterStop');
		await pending;
		expect(calls.some(([name]) => name === 'rename')).toBe(false);
	});

	test('a folder picker or delete confirmation answered late changes nothing', async () => {
		const pick: { resolve: (folder: string | undefined) => void } = { resolve: () => undefined };
		const v = new FakeVault([note('a.md', 5)], ['/', 'Target']);
		const { service, calls } = await createTestService(v, { now: NOW, ops: { chooseFolder: () => new Promise((resolve) => { pick.resolve = resolve; }) } });
		service.selectNote('a.md', 'only');
		const moving = service.moveSelected();
		service.dispose();
		pick.resolve('Target');
		await moving;
		expect(calls.some(([name]) => name === 'move')).toBe(false);
		const confirm: { resolve: (ok: boolean) => void } = { resolve: () => undefined };
		const second = await createTestService(v, { now: NOW, settings: { confirmDelete: true }, ops: { confirmDelete: () => new Promise((resolve) => { confirm.resolve = resolve; }) } });
		second.service.selectNote('a.md', 'only');
		const deleting = second.service.deleteSelected();
		second.service.dispose();
		confirm.resolve(true);
		await deleting;
		expect(second.calls.some(([name]) => name === 'trash')).toBe(false);
	});
});

describe('restored selections and the search', () => {
	test('a restore still waiting for a missing note cannot keep an invisible cursor once the user searches', async () => {
		const v = new FakeVault([note('A.md', 5), note('B.md', 4)], ['/']);
		const first = await createTestService(v, { now: NOW });
		first.service.selectNote('A.md', 'only');
		await first.settings.update((draft) => { draft.selectedNotes = ['A.md', 'late.md']; draft.selectionCursor = 'A.md'; draft.selectionAnchor = 'A.md'; });
		first.service.dispose();
		const second = await createTestService(v, { now: NOW, reuse: first.settings });
		expect(second.service.state.getState().selection.paths).toEqual(['A.md']);
		second.service.openSearch();
		second.service.setSearchQuery('B');
		expect(second.service.state.getState().selection.paths).toEqual([]);
		second.service.focusListFromSearch();
		expect(second.service.state.getState().selection.paths).toEqual(['B.md']);
		second.service.startRename('B.md', false);
		// F2 and Enter use the visible cursor only.
		second.service.cancelRename();
		second.service.perform('rename', 'list');
		expect(second.service.state.getState().renaming).toEqual({ path: 'B.md', folder: false });
		// The late note arriving afterwards is not brought back into the selection.
		v.change([...v.files, note('late.md', 3)]);
		expect(second.service.state.getState().selection.paths).toEqual(['B.md']);
	});

	test('Enter from the search with a stale cursor selects the first result, and F2 never renames an unseen note', async () => {
		const v = new FakeVault([note('A.md', 5), note('B.md', 4)], ['/']);
		const { service } = await createTestService(v, { now: NOW });
		service.selectNote('A.md', 'only');
		service.openSearch();
		service.setSearchQuery('B');
		service.state.setState({ selection: { paths: ['A.md'], anchor: 'A.md', cursor: 'A.md' } });
		service.perform('rename', 'list');
		expect(service.state.getState().renaming).toBeNull();
		service.focusListFromSearch();
		expect(service.state.getState().selection.paths).toEqual(['B.md']);
	});
});

describe('shortcut targets are checked wherever they are opened from', () => {
	const tv = () => new FakeVault([note('Public/x.md', 5, ['open'], { props: { status: ['live'] } }), note('Secret/y.md', 4, ['hush'])], ['/', 'Public', 'Secret']);

	test('hidden, missing and vanished folders, tags and properties are refused', async () => {
		const { service } = await createTestService(tv(), { now: NOW, settings: { hiddenFolders: ['Secret'] } });
		service.selectContext({ kind: 'folder', key: 'Public' });
		for (const shortcut of [makeShortcut('folder', 'Secret'), makeShortcut('folder', 'Missing'), makeShortcut('tag', 'hush'), makeShortcut('tag', 'nothing'), makeShortcut('property', 'property:status=gone')]) {
			service.openShortcut(shortcut);
			expect(service.state.getState().context, shortcut.id).toEqual({ kind: 'folder', key: 'Public' });
		}
		service.openShortcut(makeShortcut('folder', '/'));
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: '/' });
		service.openShortcut(makeShortcut('tag', 'open'));
		expect(service.state.getState().context).toEqual({ kind: 'tag', key: 'open' });
		service.openShortcut(makeShortcut('property', 'property:status=live'));
		expect(service.state.getState().context).toEqual({ kind: 'property', key: 'status', value: 'live' });
		service.toggleShowHidden();
		service.openShortcut(makeShortcut('folder', 'Secret'));
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'Secret' });
	});

	test('a target hidden after the dashboard took its snapshot is refused when opened', async () => {
		const { service } = await createTestService(tv(), { now: NOW });
		service.toggleShortcut(makeShortcut('folder', 'Secret'));
		const stale = service.listsSnapshot().shortcuts[0]!;
		expect(stale.key).toBe('Secret');
		service.hideEntry('folder', 'Secret');
		service.selectContext({ kind: 'folder', key: 'Public' });
		service.openShortcut(makeShortcut(stale.kind, stale.key));
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'Public' });
		expect(service.listsSnapshot().shortcuts).toEqual([]);
	});

	test('tag and property shortcuts whose target is gone are marked missing and left out of the dashboard list', async () => {
		const { service } = await createTestService(tv(), { now: NOW });
		for (const shortcut of [makeShortcut('tag', 'open'), makeShortcut('tag', 'nothing'), makeShortcut('property', 'property:status=gone')]) service.toggleShortcut(shortcut);
		expect(service.navTree().rows.filter((row) => row.kind === 'shortcut').map((row) => [row.key, !!row.missing])).toEqual([['shortcut:tag:open', false], ['shortcut:tag:nothing', true], ['shortcut:property:property:status=gone', true]]);
		expect(service.listsSnapshot().shortcuts.map((entry) => entry.key)).toEqual(['open']);
	});

	test('"open shortcut N" counts the shortcuts that are shown', async () => {
		const { service, calls } = await createTestService(tv(), { now: NOW, settings: { hiddenFolders: ['Secret'] } });
		for (const shortcut of [makeShortcut('folder', 'Secret'), makeShortcut('folder', 'Public'), makeShortcut('note', 'Public/x.md')]) service.toggleShortcut(shortcut);
		service.openShortcutAt(1);
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'Public' });
		service.openShortcutAt(2);
		expect(calls.some(([name, path]) => name === 'open' && path === 'Public/x.md')).toBe(true);
		service.selectContext({ kind: 'folder', key: '/' });
		service.openShortcutAt(3);
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: '/' });
		service.toggleShowHidden();
		service.openShortcutAt(1);
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'Secret' });
		// Reordering changes the numbers too.
		service.moveShortcut('folder:Public', 'folder:Secret');
		service.openShortcutAt(1);
		expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'Public' });
	});
});
