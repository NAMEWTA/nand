// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { FakeVault, createTestService, note } from './test-support';

const vault = () => new FakeVault(
	[note('a/1.md', 5, ['x']), note('a/2.md', 4), note('a/3.md', 3), note('b/4.md', 2, ['x/y']), note('5.md', 1)],
	['/', 'a', 'b', 'a/sub'],
);
const paths = (service: Awaited<ReturnType<typeof createTestService>>['service']) => service.listItems().flatMap((item) => (item.kind === 'note' ? [item.path] : []));

test('selecting a folder lists its notes newest first; selection is cleared', async () => {
	const { service } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	expect(paths(service)).toEqual(['a/1.md', 'a/2.md', 'a/3.md']);
	service.selectNote('a/2.md', 'only');
	service.selectContext({ kind: 'folder', key: 'b' });
	expect(service.state.getState().selection.paths).toEqual([]);
});

test('list keys move, extend, select all and home/end', async () => {
	const { service } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.perform('moveDown', 'list');
	expect(service.state.getState().selection.paths).toEqual(['a/1.md']);
	service.perform('moveDown', 'list');
	service.perform('extendDown', 'list');
	expect(service.state.getState().selection.paths).toEqual(['a/2.md', 'a/3.md']);
	service.perform('selectAll', 'list');
	expect(service.state.getState().selection.paths).toHaveLength(3);
	service.perform('home', 'list');
	expect(service.state.getState().selection.paths).toEqual(['a/1.md']);
	service.perform('rangeToEnd', 'list');
	expect(service.state.getState().selection.paths).toEqual(['a/1.md', 'a/2.md', 'a/3.md']);
	service.perform('end', 'list');
	expect(service.state.getState().selection.cursor).toBe('a/3.md');
});

test('mod and shift click build multi-selections', async () => {
	const { service } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectNote('a/1.md', 'only');
	service.selectNote('a/3.md', 'toggle');
	expect(service.state.getState().selection.paths).toEqual(['a/1.md', 'a/3.md']);
	service.selectNote('a/1.md', 'only');
	service.selectNote('a/3.md', 'range');
	expect(service.state.getState().selection.paths).toEqual(['a/1.md', 'a/2.md', 'a/3.md']);
});

test('nav keys: down selects the next row, right expands then focuses the list, left collapses then goes to the parent', async () => {
	const { service } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.perform('expandOrFocusList', 'nav');
	expect(service.navTree().rows.some((row) => row.key === 'folder:a/sub')).toBe(true);
	service.perform('moveDown', 'nav');
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'a/sub' });
	service.perform('collapseOrParent', 'nav');
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'a' });
	service.perform('collapseOrParent', 'nav');
	expect(service.navTree().rows.some((row) => row.key === 'folder:a/sub')).toBe(false);
	service.perform('expandOrFocusList', 'nav');
	service.perform('expandOrFocusList', 'nav');
	expect(service.state.getState().pane).toBe('list');
	expect(service.state.getState().selection.paths).toEqual(['a/1.md']);
});

test('rename commits through ops and follows the renamed path; conflicts reject', async () => {
	const { service, calls } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectNote('a/2.md', 'only');
	service.perform('rename', 'list');
	expect(service.state.getState().renaming).toEqual({ path: 'a/2.md', folder: false });
	await expect(service.commitRename('taken')).rejects.toThrow('exists');
	expect(service.state.getState().renaming).not.toBeNull();
	await service.commitRename('two');
	expect(calls).toContainEqual(['rename', 'a/2.md', 'two']);
	expect(service.state.getState().selection.paths).toEqual(['a/two.md']);
	expect(service.state.getState().renaming).toBeNull();
});

test('delete selects the next note and honours the confirm setting', async () => {
	const v = vault();
	let asked = 0;
	const { service, calls } = await createTestService(v, { settings: { confirmDelete: true }, ops: { confirmDelete: () => { asked++; return Promise.resolve(asked > 1); } } });
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectNote('a/1.md', 'only');
	await service.deleteSelected();
	expect(calls.some((call) => call[0] === 'trash')).toBe(false);
	await service.deleteSelected();
	expect(calls).toContainEqual(['trash', ['a/1.md']]);
	expect(service.state.getState().selection.paths).toEqual(['a/2.md']);
});

test('new note goes to the selected folder, or tags a note created inside a tag', async () => {
	const { service, calls } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'b' });
	await service.newNote();
	expect(calls).toContainEqual(['createNote', 'b', undefined]);
	service.selectContext({ kind: 'tag', key: 'x/y' });
	await service.newNote();
	expect(calls).toContainEqual(['createNote', undefined, 'x/y']);
});

test('drops move notes into folders and tag notes, using the tag spelling from the vault', async () => {
	const v = new FakeVault([note('n.md', 1, ['Work/Plan'])], ['/', 'a']);
	const { service, calls } = await createTestService(v);
	await service.dropOnFolder(['n.md'], 'a');
	expect(calls).toContainEqual(['move', ['n.md'], 'a']);
	await service.dropOnTag(['n.md'], 'work/plan');
	expect(calls).toContainEqual(['addTag', ['n.md'], 'Work/Plan']);
});

test('pinning keeps notes first in their context and follows renames', async () => {
	const { service, settings } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.togglePin(['a/3.md']);
	expect(service.isPinned('a/3.md')).toBe(true);
	expect(paths(service)[0]).toBe('a/3.md');
	service.onRenamed('a/3.md', 'a/three.md');
	await settings.update(() => undefined);
	expect(settings.get().pinned['folder:a']).toEqual(['a/three.md']);
	service.togglePin(['a/three.md']);
	expect(settings.get().pinned).toEqual({});
});

test('renaming or deleting the selected folder moves the context', async () => {
	const { service } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a/sub' });
	service.onRenamed('a', 'z');
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'z/sub' });
	service.onDeleted('z/sub');
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'z' });
});

test('history walks back and forward without re-recording', async () => {
	const { service } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectContext({ kind: 'folder', key: 'b' });
	service.back();
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'a' });
	service.back();
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: '/' });
	service.forward();
	service.forward();
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'b' });
	service.forward();
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'b' });
});

test('reveal expands ancestors, switches context when needed and keeps a multi-selection', async () => {
	const { service } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'b' });
	service.reveal('a/2.md');
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'a' });
	expect(service.state.getState().selection.paths).toEqual(['a/2.md']);
	service.selectNote('a/1.md', 'toggle');
	service.reveal('a/2.md');
	expect(service.state.getState().selection.paths).toEqual(['a/2.md', 'a/1.md']);
});

test('step selects the next and previous note and opens it', async () => {
	const { service, calls } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.step(1);
	service.step(1);
	service.step(-1);
	expect(calls.filter((call) => call[0] === 'open').map((call) => call[1])).toEqual(['a/1.md', 'a/2.md', 'a/1.md']);
});

test('custom keys replace the defaults for an action', async () => {
	const { service, settings } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	await settings.update((draft) => { draft.keymap = { moveDown: ['j'] }; });
	const resolve = (key: string) => service.keymap().resolve({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, 'list');
	expect(resolve('j')).toBe('moveDown');
	expect(resolve('ArrowDown')).toBeUndefined();
});

test('after a move the selection continues with the next note of the list', async () => {
	const v = vault();
	const { service, calls } = await createTestService(v);
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectNote('a/2.md', 'only');
	await service.moveSelected('b');
	expect(calls).toContainEqual(['move', ['a/2.md'], 'b']);
	expect(service.state.getState().selection.paths).toEqual(['a/3.md']);
	expect(paths(service)).toEqual(['a/1.md', 'a/3.md']);
});

test('moving the last note selects the previous one; moving everything clears the selection', async () => {
	const { service } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectNote('a/3.md', 'only');
	await service.moveSelected('b');
	expect(service.state.getState().selection.paths).toEqual(['a/2.md']);
	service.perform('selectAll', 'list');
	await service.moveSelected('b');
	expect(service.state.getState().selection.paths).toEqual([]);
});

test('a move that leaves some notes behind reports them and selects among what remains', async () => {
	const v = new FakeVault([note('a/1.md', 5), note('a/clash.md', 4), note('a/3.md', 3)], ['/', 'a', 'b']);
	const { service, calls } = await createTestService(v);
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectNote('a/1.md', 'only');
	service.selectNote('a/clash.md', 'toggle');
	await service.moveSelected('b');
	expect(calls).toContainEqual(['skipped', ['a/clash.md']]);
	expect(service.state.getState().selection.paths).toEqual(['a/clash.md']);
	expect(paths(service)).toEqual(['a/clash.md', 'a/3.md']);
});

test('dragging an unselected note keeps the current selection', async () => {
	const { service } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectNote('a/1.md', 'only');
	await service.dropOnFolder(['a/3.md'], 'b');
	expect(service.state.getState().selection.paths).toEqual(['a/1.md']);
});

test('focusing the list in single-pane mode shows it first', async () => {
	const { service, settings } = await createTestService(vault(), { settings: { layout: 'single', singleView: 'nav' } });
	service.focusPane('list');
	expect(settings.get().singleView).toBe('list');
	expect(service.state.getState().pane).toBe('list');
	const nonce = service.state.getState().focusNonce;
	service.focusPane('nav');
	expect(settings.get().singleView).toBe('nav');
	expect(service.state.getState().focusNonce).toBe(nonce + 1);
});

test('selection and history survive stopping and starting the service', async () => {
	const v = vault();
	const first = await createTestService(v);
	first.service.selectContext({ kind: 'folder', key: 'a' });
	first.service.selectContext({ kind: 'folder', key: 'b' });
	first.service.selectContext({ kind: 'folder', key: 'a' });
	first.service.selectNote('a/1.md', 'only');
	first.service.selectNote('a/3.md', 'range');
	first.service.dispose();
	await first.settings.update(() => undefined);
	const second = await createTestService(v, { reuse: first.settings });
	expect(second.service.state.getState().context).toEqual({ kind: 'folder', key: 'a' });
	expect(second.service.state.getState().selection).toEqual({ paths: ['a/1.md', 'a/2.md', 'a/3.md'], anchor: 'a/1.md', cursor: 'a/3.md' });
	second.service.back();
	expect(second.service.state.getState().context).toEqual({ kind: 'folder', key: 'b' });
	second.service.back();
	second.service.back();
	expect(second.service.state.getState().context).toEqual({ kind: 'folder', key: '/' });
});

test('restoring drops notes that no longer exist and falls back to a fresh history when it does not match', async () => {
	const v = vault();
	const first = await createTestService(v);
	first.service.selectContext({ kind: 'folder', key: 'a' });
	first.service.selectNote('a/2.md', 'only');
	first.service.selectNote('a/3.md', 'toggle');
	first.service.dispose();
	v.change(v.files.filter((entry) => entry.path !== 'a/3.md'));
	const second = await createTestService(v, { reuse: first.settings });
	expect(second.service.state.getState().selection.paths).toEqual(['a/2.md']);
	expect(second.service.state.getState().selection.cursor).toBeNull();
	await first.settings.update((draft) => { draft.history = ['folder:b']; draft.historyIndex = 0; });
	const third = await createTestService(v, { reuse: first.settings });
	expect(third.service.state.getState().history).toEqual({ entries: ['folder:a'], index: 0 });
});

test('state is saved after a short delay with the window timers and flushed on dispose', async () => {
	const { service, settings, timers } = await createTestService(vault(), { timers: true });
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectNote('a/1.md', 'only');
	expect(settings.get().selectedNotes).toEqual([]);
	timers!.run();
	expect(settings.get().selectedNotes).toEqual(['a/1.md']);
	service.selectNote('a/2.md', 'only');
	expect(timers!.pending).toBe(1);
	service.dispose();
	expect(timers!.pending).toBe(0);
	expect(settings.get().selectedNotes).toEqual(['a/2.md']);
});

test('renaming or deleting a folder repairs the saved history', async () => {
	const { service, settings } = await createTestService(vault());
	service.selectContext({ kind: 'folder', key: 'a' });
	service.selectContext({ kind: 'folder', key: 'a/sub' });
	service.selectContext({ kind: 'folder', key: 'b' });
	service.onRenamed('a', 'z');
	await settings.update(() => undefined);
	expect(settings.get().history).toEqual(['folder:/', 'folder:z', 'folder:z/sub', 'folder:b']);
	service.onDeleted('z/sub');
	await settings.update(() => undefined);
	expect(settings.get().history).toEqual(['folder:/', 'folder:z', 'folder:b']);
	expect(settings.get().historyIndex).toBe(2);
});

test('history position survives unrelated renames and deletions, also with repeated contexts', async () => {
	const { service, settings } = await createTestService(vault());
	for (const key of ['a', 'b', 'a', 'a/sub']) service.selectContext({ kind: 'folder', key });
	service.back();
	service.back();
	service.back();
	expect(service.state.getState().history).toEqual({ entries: ['folder:/', 'folder:a', 'folder:b', 'folder:a', 'folder:a/sub'], index: 1 });
	service.onRenamed('zzz/unrelated.md', 'zzz/other.md');
	service.onDeleted('zzz/other.md');
	expect(service.state.getState().history.index).toBe(1);
	service.forward();
	expect(service.state.getState().context).toEqual({ kind: 'folder', key: 'b' });
	// A rename that merges neighbouring entries keeps the visit.
	service.back();
	service.onRenamed('a/sub', 'a');
	await settings.update(() => undefined);
	expect(service.state.getState().history.entries[service.state.getState().history.index]).toBe('folder:a');
});

test('deleting the folder of the current visit continues from the nearest earlier visit', async () => {
	const { service } = await createTestService(vault());
	for (const key of ['a', 'b', 'a/sub']) service.selectContext({ kind: 'folder', key });
	service.onDeleted('a/sub');
	const { entries, index } = service.state.getState().history;
	expect(entries[index]).toBe('folder:a');
	expect(entries).not.toContain('folder:a/sub');
});

test('a saved selection is restored when the vault finishes loading, and a partial one never overwrites the saved one', async () => {
	const v = vault();
	const first = await createTestService(v);
	first.service.selectContext({ kind: 'folder', key: 'a' });
	first.service.selectNote('a/1.md', 'only');
	first.service.selectNote('a/3.md', 'toggle');
	first.service.dispose();
	const all = v.files;
	// Cold start: the service is created before any file is known.
	v.change([]);
	const second = await createTestService(v, { reuse: first.settings });
	expect(second.service.state.getState().selection.paths).toEqual([]);
	second.service.dispose();
	expect(first.settings.get().selectedNotes).toEqual(['a/1.md', 'a/3.md']);
	const third = await createTestService(v, { reuse: first.settings });
	v.change([all[0]!]);
	expect(third.service.state.getState().selection.paths).toEqual(['a/1.md']);
	v.change(all);
	expect(third.service.state.getState().selection).toEqual({ paths: ['a/1.md', 'a/3.md'], anchor: 'a/3.md', cursor: 'a/3.md' });
	third.service.dispose();
	expect(first.settings.get().selectedNotes).toEqual(['a/1.md', 'a/3.md']);
});

test('a choice made before the vault finishes loading wins over the saved selection', async () => {
	const v = vault();
	const first = await createTestService(v);
	first.service.selectContext({ kind: 'folder', key: 'a' });
	first.service.selectNote('a/1.md', 'only');
	first.service.dispose();
	const all = v.files;
	v.change([note('a/2.md', 4)]);
	const second = await createTestService(v, { reuse: first.settings });
	second.service.selectNote('a/2.md', 'only');
	v.change(all);
	expect(second.service.state.getState().selection.paths).toEqual(['a/2.md']);
});

test('navigating before the saved notes appear cancels the restore, even when the selection is still empty', async () => {
	const v = vault();
	const first = await createTestService(v);
	first.service.selectContext({ kind: 'folder', key: 'a' });
	first.service.selectNote('a/1.md', 'only');
	first.service.dispose();
	const all = v.files;
	v.change([note('b/4.md', 2)]);
	const second = await createTestService(v, { reuse: first.settings });
	expect(second.service.state.getState().context).toEqual({ kind: 'folder', key: 'a' });
	second.service.selectContext({ kind: 'folder', key: 'b' });
	v.change(all);
	expect(second.service.state.getState().selection.paths).toEqual([]);
	second.service.dispose();
	// The saved selection is not rewritten by a restore that no longer applies.
	expect(first.settings.get().selectedNotes).toEqual([]);
});

test('history navigation and revealing also cancel a pending restore', async () => {
	for (const act of [(s: Awaited<ReturnType<typeof createTestService>>['service']) => s.back(), (s: Awaited<ReturnType<typeof createTestService>>['service']) => s.reveal('b/4.md', { select: false })]) {
		const v = vault();
		const first = await createTestService(v);
		first.service.selectContext({ kind: 'folder', key: 'b' });
		first.service.selectContext({ kind: 'folder', key: 'a' });
		first.service.selectNote('a/1.md', 'only');
		first.service.dispose();
		const all = v.files;
		v.change([note('b/4.md', 2)]);
		const second = await createTestService(v, { reuse: first.settings });
		act(second.service);
		v.change(all);
		expect(second.service.state.getState().selection.paths).not.toContain('a/1.md');
	}
});
