// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { Notice } from 'obsidian';
import type { ModuleContext } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n';
import { makeShortcut, shortcutForContext } from '../core/shortcuts';
import type { NavigatorService } from '../services/navigator';
import type { Period } from '../core/periodic';
import type { NavigatorEnv } from './env';
import type { ProductivityActions } from './actions';

const VIEW = 'nand-navigator-view';

/** Command-palette commands (shown as "NAND: <name>"); they exist only while the module is active. */
export function registerNavigatorCommands({ context, env, service, rebuildCache, actions }: { context: ModuleContext; env: NavigatorEnv; service: NavigatorService; rebuildCache: () => Promise<void>; actions: ProductivityActions }): void {
	const { app } = context;
	const add = (id: string, key: string, run: () => void | Promise<unknown>) => {
		context.commands.add({ id: `navigator-${id}`, nameKey: key, name: t(key), callback: () => { void Promise.resolve(run()).catch(env.report); } });
	};
	const reveal = async (pane?: 'nav' | 'list') => {
		await new Promise<void>((resolve) => app.workspace.onLayoutReady(resolve));
		await app.workspace.ensureSideLeaf(VIEW, 'left', { active: true, reveal: true });
		if (pane) service.focusPane(pane);
	};
	add('open', 'navigator.cmd.open', () => reveal('list'));
	add('reveal-file', 'navigator.cmd.revealFile', async () => {
		const file = app.workspace.getActiveFile();
		if (!file) { new Notice(t('navigator.noActiveFile')); return; }
		await reveal();
		service.reveal(file.path);
	});
	add('new-note', 'navigator.cmd.newNote', () => service.newNote());
	add('new-folder', 'navigator.cmd.newFolder', () => service.newFolder());
	add('move-files', 'navigator.cmd.moveFiles', () => ensureSelection().then(() => service.moveSelected()));
	add('delete-files', 'navigator.cmd.deleteFiles', () => ensureSelection().then(() => service.deleteSelected()));
	add('toggle-layout', 'navigator.cmd.toggleLayout', () => service.toggleLayout());
	add('toggle-orientation', 'navigator.cmd.toggleOrientation', () => service.toggleOrientation());
	add('toggle-descendants', 'navigator.cmd.toggleDescendants', () => service.toggleDescendants());
	add('toggle-compact', 'navigator.cmd.toggleCompact', () => service.toggleCompact());
	add('collapse-all', 'navigator.cmd.collapseAll', () => service.collapseAll());
	add('expand-all', 'navigator.cmd.expandAll', () => service.expandAll());
	add('next-file', 'navigator.cmd.nextFile', () => service.step(1));
	add('previous-file', 'navigator.cmd.previousFile', () => service.step(-1));
	add('back', 'navigator.cmd.back', () => service.back());
	add('forward', 'navigator.cmd.forward', () => service.forward());
	add('rebuild-cache', 'navigator.cmd.rebuildCache', rebuildCache);
	add('search', 'navigator.cmd.search', async () => { await reveal(); service.openSearch(); });
	add('search-vault', 'navigator.cmd.searchVault', async () => {
		await reveal();
		service.applySearch(service.state.getState().search.query);
	});
	add('toggle-hidden', 'navigator.cmd.toggleHidden', () => service.toggleShowHidden());
	add('add-shortcut', 'navigator.cmd.addShortcut', () => addShortcut());
	for (let position = 1; position <= 9; position++) {
		add(`open-shortcut-${position}`, `navigator.cmd.openShortcut${position}`, async () => {
			if (!service.settings.get().shortcuts[position - 1]) return;
			service.openShortcutAt(position);
			if (service.settings.get().shortcuts[position - 1]?.kind !== 'note') await reveal();
		});
	}
	add('toggle-calendar', 'navigator.cmd.toggleCalendar', () => service.toggleCalendar());
	const periods: ReadonlyArray<[Period, string]> = [['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['quarter', 'Quarterly'], ['year', 'Yearly']];
	for (const [period, name] of periods) add(`open-${period}`, `navigator.cmd.open${name}`, () => actions.openPeriod(period));
	add('open-next-period', 'navigator.cmd.openNextPeriod', () => actions.periodic.openRelative(1));
	add('open-previous-period', 'navigator.cmd.openPreviousPeriod', () => actions.periodic.openRelative(-1));
	add('open-parent-period', 'navigator.cmd.openParentPeriod', () => actions.periodic.openParent());
	add('new-note-from-template', 'navigator.cmd.newNoteFromTemplate', () => actions.newNoteFromTemplate());
	add('merge-notes', 'navigator.cmd.mergeNotes', () => ensureSelection().then(() => actions.mergeSelected()));
	add('add-tag', 'navigator.cmd.addTag', () => ensureSelection().then(() => actions.addTagToSelected()));
	add('remove-tag', 'navigator.cmd.removeTag', () => ensureSelection().then(() => actions.removeTagFromSelected()));
	add('clear-tags', 'navigator.cmd.clearTags', () => ensureSelection().then(() => actions.clearTagsOfSelected()));
	add('undo-tag-edit', 'navigator.cmd.undoTagEdit', () => actions.undoTagEdit());
	add('select-profile', 'navigator.cmd.selectProfile', () => actions.chooseProfile());
	for (let position = 1; position <= 3; position++) add(`select-profile-${position}`, `navigator.cmd.selectProfile${position}`, () => actions.selectProfileAt(position));
	registerCreateNoteCommands();
	add('pin-folder-notes', 'navigator.cmd.pinFolderNotes', () => {
		if (!service.settings.get().folderNotes) { new Notice(t('navigator.folderNotesOff')); return; }
		service.pinFolderNotes();
	});
	add('convert-folder-note', 'navigator.cmd.convertFolderNote', async () => {
		const path = await targetNote();
		if (path) await service.convertToFolderNote(path);
	});
	add('set-folder-note', 'navigator.cmd.setFolderNote', async () => {
		const file = app.workspace.getActiveFile();
		if (!file) { new Notice(t('navigator.noActiveFile')); return; }
		await service.setAsFolderNote(file.path);
	});
	add('detach-folder-note', 'navigator.cmd.detachFolderNote', async () => {
		const { context } = service.state.getState();
		if (context.kind !== 'folder' || !service.folderNote(context.key)) { new Notice(t('navigator.noFolderNote')); return; }
		await service.detachFolderNote(context.key);
	});

	/** One palette command per user-defined create-note command, kept in step with the settings while the module runs. */
	function registerCreateNoteCommands(): void {
		const registered = new Map<string, string>();
		const sync = () => {
			const wanted = new Map(service.settings.get().createCommands.map((command) => [command.id, command.name]));
			for (const [id, name] of [...registered]) {
				if (wanted.get(id) === name) continue;
				context.commands.remove?.(`navigator-create-${id}`);
				registered.delete(id);
			}
			for (const [id, name] of wanted) {
				if (registered.has(id)) continue;
				registered.set(id, name);
				context.commands.add({ id: `navigator-create-${id}`, name, callback: () => { void actions.runCreateCommand(id).catch(env.report); } });
			}
		};
		sync();
		context.lifetime.register(service.settings.subscribe(sync));
	}

	/** True while keyboard focus is inside the navigator, so "the current item" means its selection. */
	function navigatorFocused(): boolean {
		return !!app.workspace.containerEl.ownerDocument.activeElement?.closest('[data-navigator-root]');
	}

	/** The note a file command acts on: the list's selected note while the navigator has focus, else the open note. */
	async function targetNote(): Promise<string | undefined> {
		const { selection } = service.state.getState();
		const path = navigatorFocused() && selection.paths.length === 1 ? selection.paths[0] : app.workspace.getActiveFile()?.path;
		if (!path) new Notice(t('navigator.noActiveFile'));
		return path;
	}

	/** Pin the navigator's selected folder, tag or note while it has focus; otherwise the open note. */
	function addShortcut(): void {
		const { context, selection, pane } = service.state.getState();
		const shortcut = navigatorFocused()
			? (pane === 'list' && selection.cursor ? makeShortcut('note', selection.cursor) : shortcutForContext(context))
			: (app.workspace.getActiveFile() ? makeShortcut('note', app.workspace.getActiveFile()!.path) : undefined);
		if (!shortcut) { new Notice(t('navigator.noShortcutTarget')); return; }
		service.toggleShortcut(shortcut);
	}

	/** Commands that act on files use the list selection, or the active note when nothing is selected. */
	async function ensureSelection(): Promise<void> {
		if (service.state.getState().selection.paths.length) return;
		const file = app.workspace.getActiveFile();
		if (file) service.reveal(file.path);
	}
}
