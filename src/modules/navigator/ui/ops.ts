// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { Notice, TFile, TFolder, type App, type TAbstractFile, type WorkspaceLeaf } from 'obsidian';
import { t } from '../../../shared/i18n';
import { ROOT_FOLDER } from '../core/types';
import { addTag, createFolder, createNote, duplicateNote, moveEntries, renameEntry, trashEntries } from '../platform/file-ops';
import type { OpsPort } from '../services/navigator';
import type { DialogRegistry } from './dialog-registry';

/** The workbench is a view of its own; notes must never replace it. */
const WORKBENCH_VIEW_TYPE = 'nand-workbench-view';

/** Where a note opens: the most recent editor tab, or a new tab if that tab is the workbench or pinned. */
function editorLeaf(app: App): WorkspaceLeaf {
	const { workspace } = app;
	const recent = workspace.getMostRecentLeaf(workspace.rootSplit);
	if (recent && recent.view.getViewType() !== WORKBENCH_VIEW_TYPE && !recent.getViewState().pinned) return recent;
	return workspace.getLeaf('tab');
}

function entry(app: App, path: string): TAbstractFile | null {
	return path === ROOT_FOLDER ? null : app.vault.getAbstractFileByPath(path);
}

function entries(app: App, paths: readonly string[]): TAbstractFile[] {
	return paths.flatMap((path) => entry(app, path) ?? []);
}

/** `OpsPort` against Obsidian: files through the vault and file manager, questions through React dialogs. */
export function createObsidianOps(app: App, report: (error: unknown) => void, dialogs: DialogRegistry): OpsPort {
	return {
		async open(path, options) {
			const file = app.vault.getFileByPath(path);
			if (!file) return;
			const leaf = options.newTab ? app.workspace.getLeaf('tab') : editorLeaf(app);
			await leaf.openFile(file, { active: !!options.focus || !!options.newTab });
			if (options.focus) app.workspace.setActiveLeaf(leaf, { focus: true });
		},
		activePath: () => app.workspace.getActiveFile()?.path,
		isFolder: (path) => path === ROOT_FOLDER || app.vault.getAbstractFileByPath(path) instanceof TFolder,
		async createNote(folder, tag) {
			const parent = folder ?? app.fileManager.getNewFileParent(app.workspace.getActiveFile()?.path ?? '').path;
			const file = await createNote(app, parent === '' ? ROOT_FOLDER : parent, t('navigator.untitled'), tag);
			return file.path;
		},
		async createFolder(parent) {
			const name = await (await import('./dialogs')).askName(app, dialogs, { title: t('navigator.newFolder'), label: t('navigator.folderName'), value: t('navigator.untitledFolder'), confirm: t('navigator.create') });
			if (!name) return undefined;
			return (await createFolder(app, parent, name)).path;
		},
		async rename(path, newName) {
			const target = entry(app, path);
			if (!target) throw new Error(t('navigator.missing'));
			return renameEntry(app, target, newName);
		},
		async duplicate(path) {
			const file = app.vault.getFileByPath(path);
			return file ? (await duplicateNote(app, file, t('navigator.copySuffix'))).path : undefined;
		},
		move: (paths, folder) => moveEntries(app, entries(app, paths), folder),
		notifySkipped(paths) {
			const names = paths.slice(0, 3).map((path) => path.slice(path.lastIndexOf('/') + 1)).join(', ');
			new Notice(t('navigator.moveSkipped', { count: paths.length, names: paths.length > 3 ? `${names}…` : names }));
		},
		async chooseFolder() {
			const folders = app.vault.getAllLoadedFiles().filter((file): file is TFolder => file instanceof TFolder).map((folder) => (folder.isRoot() ? ROOT_FOLDER : folder.path));
			return (await import('./dialogs')).chooseFolder(app, dialogs, folders, t('navigator.moveTo'));
		},
		async ensureFolder(path) {
			if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
		},
		async askName(titleKey, value) {
			return (await import('./dialogs')).askName(app, dialogs, { title: t(titleKey), label: t('navigator.name'), value, confirm: t('navigator.ok') });
		},
		notify(key, params) {
			new Notice(t(key, params));
		},
		confirmDelete: async (paths) => (await import('./dialogs')).confirmDelete(app, dialogs, paths.map((path) => path.slice(path.lastIndexOf('/') + 1))),
		trash: (paths) => trashEntries(app, entries(app, paths)),
		async addTag(paths, tag) {
			for (const path of paths) {
				const file = app.vault.getFileByPath(path);
				if (file instanceof TFile) await addTag(app, file, tag);
			}
		},
		copyPath(path) {
			void activeWindow.navigator.clipboard.writeText(path).then(() => new Notice(t('navigator.pathCopied')), report);
		},
		report,
	};
}
