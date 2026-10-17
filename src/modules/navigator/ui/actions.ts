// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { Notice, TFile, type App } from 'obsidian';
import { t } from '../../../shared/i18n';
import { setFolderTemplate } from '../core/folder-templates';
import { notePaths } from '../core/note-list';
import type { Period } from '../core/periodic';
import { cleanTag, isTagOrChild, removeMapper, renameMapper, validTagName } from '../core/tag-edit';
import { ROOT_FOLDER } from '../core/types';
import { addTag } from '../platform/file-ops';
import { mergeable, mergeFiles, planMerge } from '../platform/merge-ops';
import type { NoteFactory } from '../platform/note-factory';
import type { PeriodicNotes } from '../platform/periodic-notes';
import { clearTags, editTags, undoTagEdit, type TagEditResult } from '../platform/tag-ops';
import { UndoLedger } from './undo-ledger';
import { listTemplateFiles } from '../platform/templates';
import type { NavigatorService } from '../services/navigator';
import type { DialogRegistry } from './dialog-registry';

/** What menus, the calendar and commands can ask the navigator to do beyond browsing. */
export interface ProductivityActions {
	periodic: PeriodicNotes;
	/** Open (creating if needed) the note of a period; `date` defaults to today. */
	openPeriod: (period: Period, date?: Date, options?: { newTab?: boolean }) => Promise<void>;
	newNoteFromTemplate: () => Promise<void>;
	runCreateCommand: (id: string) => Promise<void>;
	mergeSelected: () => Promise<void>;
	addTagToSelected: () => Promise<void>;
	removeTagFromSelected: () => Promise<void>;
	clearTagsOfSelected: () => Promise<void>;
	renameTag: (tag: string) => Promise<void>;
	deleteTag: (tag: string) => Promise<void>;
	undoTagEdit: () => Promise<void>;
	chooseProfile: () => Promise<void>;
	selectProfileAt: (position: number) => Promise<void>;
	/** Pick the template notes in this folder are created from; "none" removes it. */
	setFolderTemplate: (folder: string) => Promise<void>;
	hasFolderTemplate: (folder: string) => boolean;
	/** Close the undo prompts and refuse further edits; called when the navigator stops. */
	dispose: () => void;
}

export interface ActionDeps {
	app: App;
	service: NavigatorService;
	factory: NoteFactory;
	periodic: PeriodicNotes;
	dialogs: DialogRegistry;
	report: (error: unknown) => void;
	isStopped: () => boolean;
	askName: (titleKey: string, value: string) => Promise<string | undefined>;
	/** Open a note in the editor. */
	open: (path: string) => Promise<void>;
}

const NONE = '__none__';

export function createProductivityActions(deps: ActionDeps): ProductivityActions {
	const { app, service, factory, periodic, dialogs } = deps;
	/** Tag edits that can still be undone; each undo prompt is bound to its own entry and everything expires after 30 s. */
	const ledger = new UndoLedger({ set: (callback, ms) => window.setTimeout(callback, ms), clear: (handle) => window.clearTimeout(handle as number) });
	const more = () => import('./dialogs-more');
	const settings = () => service.settings.get();
	const notify = (key: string, params?: Record<string, string | number>) => { new Notice(t(key, params)); };

	/** The folder new notes go to: the navigator's folder, or the open note's folder for tag and property views. */
	function targetFolder(): string {
		const { context } = service.state.getState();
		if (context.kind === 'folder') return context.key;
		const active = app.workspace.getActiveFile();
		return active?.parent?.isRoot() === false ? active.parent.path : ROOT_FOLDER;
	}

	/** The selected notes in the order the list shows them. */
	function selectedFiles(): TFile[] {
		const selected = new Set(service.state.getState().selection.paths);
		const ordered = notePaths(service.listItems()).filter((path) => selected.has(path));
		return ordered.flatMap((path) => app.vault.getFileByPath(path) ?? []);
	}

	const allTags = (): string[] => {
		const seen = new Map<string, string>();
		for (const note of service.visibleNotes()) for (const tag of note.tags) if (!seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
		return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
	};

	const tagItems = (tags: readonly string[]) => tags.map((tag) => ({ value: tag, label: `#${tag}` }));

	const nameList = (paths: readonly string[]) => paths.slice(0, 5).join(', ') + (paths.length > 5 ? '…' : '');

	async function undoTransaction(id: number): Promise<void> {
		const records = ledger.records(id);
		if (deps.isStopped() || !records) return;
		const { restored, skipped, remaining } = await undoTagEdit(app, records);
		if (remaining.length) { ledger.update(id, remaining); notify('navigator.tagEditUndoFailed', { count: remaining.length }); return; }
		ledger.retire(id);
		if (skipped.length) notify('navigator.tagEditUndonePartly', { count: restored, names: nameList(skipped) });
		else notify('navigator.tagEditUndone', { count: restored });
	}

	async function finishTagEdit(result: TagEditResult): Promise<void> {
		const { records, failed, skipped, unreadable } = result;
		if (failed) {
			deps.report(failed.error);
			notify('navigator.tagEditFailed', { count: records.length, path: failed.path });
		}
		if (skipped.length) notify('navigator.tagEditSkipped', { count: skipped.length, names: nameList(skipped) });
		if (unreadable.length) notify('navigator.tagEditUnreadable', { count: unreadable.length, names: nameList(unreadable) });
		if (!records.length) { if (!failed && !skipped.length && !unreadable.length) notify('navigator.tagEditNothing'); return; }
		let notice: Notice | undefined;
		const id = ledger.add(records, () => { notice?.hide(); notice = undefined; });
		if (failed) return;
		const doc = activeDocument;
		const fragment = doc.createDocumentFragment();
		const text = doc.createElement('span');
		text.textContent = t('navigator.tagEditDone', { count: records.length });
		const undo = doc.createElement('button');
		undo.textContent = t('navigator.tagEditUndo');
		undo.className = 'mod-cta';
		// The prompt belongs to this edit only: once the edit is undone or has expired the button does nothing.
		undo.addEventListener('click', () => { void undoTransaction(id).catch(deps.report); });
		fragment.append(text, undo);
		notice = new Notice(fragment, 30_000);
	}

	const actions: ProductivityActions = {
		periodic,
		async openPeriod(period, date = new Date(), options) {
			await periodic.open(period, date, options);
		},
		async newNoteFromTemplate() {
			const { chooseItem } = await more();
			const folder = targetFolder();
			const files = listTemplateFiles(app, settings().templateFolder);
			if (!files.length) { notify('navigator.noTemplates'); return; }
			const template = await chooseItem(app, dialogs, {
				title: t('navigator.newNoteFromTemplate'),
				placeholder: t('navigator.searchTemplates'),
				empty: t('navigator.noTemplates'),
				items: files.map((path) => ({ value: path, label: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), hint: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : undefined })),
			});
			if (!template || deps.isStopped()) return;
			const file = await factory.createFromChosenTemplate(folder, template);
			if (file) service.reveal(file.path, { select: false });
		},
		async runCreateCommand(id) {
			const command = settings().createCommands.find((entry) => entry.id === id);
			if (!command) return;
			await factory.runCreateCommand(command, targetFolder());
		},
		async mergeSelected() {
			const files = mergeable(selectedFiles());
			if (files.length < 2) { notify('navigator.mergeNeedTwo'); return; }
			const { confirmAction } = await more();
			const plan = await planMerge(app, files);
			if ('unreadable' in plan) { notify('navigator.mergeUnreadable', { path: plan.unreadable }); return; }
			const answer = await confirmAction(app, dialogs, {
				title: t('navigator.mergeTitle', { count: files.length }),
				description: plan.conflicts.length ? `${t('navigator.mergeDescription')} ${t('navigator.mergeConflicts', { keys: plan.conflicts.join(', ') })}` : t('navigator.mergeDescription'),
				lines: files.map((file) => file.path),
				confirmLabel: t('navigator.mergeConfirm'),
				checkbox: { label: t('navigator.mergeDelete'), checked: false },
			});
			if (!answer.confirmed || deps.isStopped()) return;
			// The notes are read again here: whatever changed while the dialog was open stops the merge instead of being lost.
			const outcome = await mergeFiles(app, files, { suffix: t('navigator.mergedSuffix'), deleteOriginals: answer.checked, expected: plan.fingerprint });
			if (outcome.status === 'changed') { notify('navigator.mergeChanged'); return; }
			if (outcome.status === 'unreadable') { notify('navigator.mergeUnreadable', { path: outcome.path }); return; }
			if (outcome.status === 'lossy') { notify('navigator.mergeLossy', { path: outcome.path }); return; }
			await deps.open(outcome.file.path);
			service.reveal(outcome.file.path);
			notify('navigator.mergeDone', { count: files.length, name: outcome.file.basename });
			if (outcome.originalsKept) notify('navigator.mergeOriginalsKept');
		},
		async addTagToSelected() {
			const files = selectedFiles().filter((file) => file.extension === 'md');
			if (!files.length) { notify('navigator.noSelection'); return; }
			const { chooseItem } = await more();
			const tag = await chooseItem(app, dialogs, {
				title: t('navigator.addTagTitle', { count: files.length }),
				placeholder: t('navigator.searchTags'),
				empty: t('navigator.noTags'),
				items: tagItems(allTags()),
				create: { label: (query) => t('navigator.createTag', { tag: cleanTag(query) }), valid: (query) => validTagName(cleanTag(query)) },
			});
			if (!tag || deps.isStopped()) return;
			const clean = cleanTag(tag);
			if (!validTagName(clean)) { notify('navigator.tagInvalid'); return; }
			for (const file of files) await addTag(app, file, clean);
			notify('navigator.tagAdded', { tag: clean, count: files.length });
		},
		async removeTagFromSelected() {
			const files = selectedFiles().filter((file) => file.extension === 'md');
			if (!files.length) { notify('navigator.noSelection'); return; }
			const present = new Set(files.map((file) => file.path));
			const tags = new Map<string, string>();
			for (const note of service.visibleNotes()) if (present.has(note.path)) for (const tag of note.tags) if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
			const list = [...tags.values()].sort((a, b) => a.localeCompare(b));
			if (!list.length) { notify('navigator.noTagsOnSelection'); return; }
			let tag = list[0];
			if (list.length > 1) {
				const { chooseItem } = await more();
				tag = await chooseItem(app, dialogs, { title: t('navigator.removeTagTitle'), placeholder: t('navigator.searchTags'), empty: t('navigator.noTags'), items: tagItems(list) });
			}
			if (!tag || deps.isStopped()) return;
			await finishTagEdit(await editTags(app, files, removeMapper(tag, false), { shouldStop: deps.isStopped }));
		},
		async clearTagsOfSelected() {
			const files = selectedFiles().filter((file) => file.extension === 'md');
			if (!files.length) { notify('navigator.noSelection'); return; }
			const { confirmAction } = await more();
			const answer = await confirmAction(app, dialogs, {
				title: t('navigator.clearTagsTitle', { count: files.length }),
				description: t('navigator.clearTagsDescription'),
				confirmLabel: t('navigator.clearTags'),
				danger: true,
			});
			if (!answer.confirmed || deps.isStopped()) return;
			await finishTagEdit(await clearTags(app, files, { shouldStop: deps.isStopped }));
		},
		async renameTag(tag) {
			const next = await deps.askName('navigator.renameTag', tag);
			if (next === undefined || deps.isStopped()) return;
			const clean = cleanTag(next);
			if (clean === tag) return;
			if (!validTagName(clean)) { notify('navigator.tagInvalid'); return; }
			const affected = taggedFiles(tag);
			const { confirmAction } = await more();
			const answer = await confirmAction(app, dialogs, {
				title: t('navigator.renameTagTitle', { from: tag, to: clean }),
				description: t('navigator.tagEditDescription', { count: affected.length }),
				confirmLabel: t('navigator.renameTag'),
			});
			if (!answer.confirmed || deps.isStopped()) return;
			await finishTagEdit(await editTags(app, affected, renameMapper(tag, clean), { shouldStop: deps.isStopped }));
		},
		async deleteTag(tag) {
			const affected = taggedFiles(tag);
			const { confirmAction } = await more();
			const answer = await confirmAction(app, dialogs, {
				title: t('navigator.deleteTagTitle', { tag }),
				description: t('navigator.tagEditDescription', { count: affected.length }),
				confirmLabel: t('navigator.deleteTag'),
				danger: true,
			});
			if (!answer.confirmed || deps.isStopped()) return;
			await finishTagEdit(await editTags(app, affected, removeMapper(tag, true), { shouldStop: deps.isStopped }));
		},
		async undoTagEdit() {
			const latest = ledger.latest();
			if (latest === undefined) { notify('navigator.nothingToUndo'); return; }
			await undoTransaction(latest);
		},
		async chooseProfile() {
			const profiles = service.profiles();
			const { chooseItem } = await more();
			const id = await chooseItem(app, dialogs, {
				title: t('navigator.selectProfile'),
				placeholder: t('navigator.searchProfiles'),
				empty: t('navigator.noProfiles'),
				items: profiles.map((profile) => ({ value: profile.id, label: profile.name, hint: profile.active ? t('navigator.profileActive') : undefined })),
			});
			if (id && !deps.isStopped()) service.switchProfile(id);
		},
		async selectProfileAt(position) {
			const profile = service.profiles()[position - 1];
			if (profile) service.switchProfile(profile.id);
			else await actions.chooseProfile();
		},
		async setFolderTemplate(folder) {
			const { chooseItem, confirmAction } = await more();
			const files = listTemplateFiles(app, settings().templateFolder);
			const current = settings().folderTemplates.find((entry) => entry.folder === folder);
			const picked = await chooseItem(app, dialogs, {
				title: t('navigator.setFolderTemplate'),
				placeholder: t('navigator.searchTemplates'),
				empty: t('navigator.noTemplates'),
				items: [
					...(current ? [{ value: NONE, label: t('navigator.removeFolderTemplate'), hint: current.template }] : []),
					...files.map((path) => ({ value: path, label: path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, ''), hint: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : undefined })),
				],
			});
			if (!picked || deps.isStopped()) return;
			if (picked === NONE) {
				await service.settings.update((draft) => { draft.folderTemplates = setFolderTemplate(draft.folderTemplates, { folder, template: '', exact: false }); });
				return;
			}
			const answer = await confirmAction(app, dialogs, {
				title: t('navigator.folderTemplateScope', { folder: folder === ROOT_FOLDER ? t('navigator.rootFolder') : folder }),
				description: picked,
				confirmLabel: t('navigator.save'),
				checkbox: { label: t('navigator.folderTemplateOnly'), checked: current?.exact ?? false },
			});
			if (!answer.confirmed || deps.isStopped()) return;
			await service.settings.update((draft) => { draft.folderTemplates = setFolderTemplate(draft.folderTemplates, { folder, template: picked, exact: answer.checked }); });
		},
		hasFolderTemplate: (folder) => settings().folderTemplates.some((entry) => entry.folder === folder),
		dispose() {
			ledger.clear();
		},
	};

	/** Every note that has the tag or one below it. */
	function taggedFiles(tag: string): TFile[] {
		return service.index.notes().filter((note) => note.ext === 'md' && note.tags.some((entry) => isTagOrChild(entry, tag))).flatMap((note) => app.vault.getFileByPath(note.path) ?? []);
	}

	return actions;
}
