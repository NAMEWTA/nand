import { Component, MarkdownView, TFile, TFolder, type App } from 'obsidian';
import { ContactsApplication } from '../core/application';
import type { ContactsFile, ContactsFiles } from '../core/files';
import { ContactsError } from '../core/model';
import type { ArchiveFolderEntry } from '../core/resources';
import guide from '../core/persist/format-guide.md';
import englishGuide from '../core/persist/format-guide-en.md';
import type { ContactsSettings } from '../../../shared/contacts-settings';
import { getLanguage } from '../../../shared/i18n';
/** Native lifecycle, Vault IO and protection of unsaved editor content. */
export class ContactsController extends Component {
	private readonly application: ContactsApplication;
	constructor(
		readonly app: App,
		getSettings: () => ContactsSettings,
	) {
		super();
		const native = (file: ContactsFile): TFile => {
			if (!(file instanceof TFile)) throw new ContactsError('missing');
			return file;
		};
		const files: ContactsFiles = {
			get formatGuide() {
				return getLanguage() === 'en' ? englishGuide : guide;
			},
			ready: async () => {
				if (!app.workspace.layoutReady)
					await new Promise<void>((resolve) => app.workspace.onLayoutReady(resolve));
			},
			getMarkdownFiles: () => app.vault.getMarkdownFiles(),
			getFileByPath: (path) => app.vault.getFileByPath(path),
			getAbstractFileByPath: (path) => app.vault.getAbstractFileByPath(path),
			read: (file) => app.vault.read(native(file)),
			cachedRead: (file) => app.vault.cachedRead(native(file)),
			process: (file, update) => app.vault.process(native(file), update),
			create: (path, content) => app.vault.create(path, content),
			createBinary: (path, content) => app.vault.createBinary(path, content),
			listFolder: (path) => this.listFolder(path),
			trashFolder: async (path) => {
				const folder = app.vault.getAbstractFileByPath(path);
				if (!(folder instanceof TFolder)) throw new ContactsError('missing');
				await app.fileManager.trashFile(folder);
			},
			checkFolderEditors: (path) => this.checkFolderEditors(path),
			createFolder: async (path) => {
				await app.vault.createFolder(path);
			},
			mkdir: (path) => this.mkdir(path),
			checkEditor: (file, disk) => this.checkEditor(native(file), disk),
		};
		this.application = new ContactsApplication(files, getSettings);
	}
	get index() {
		return this.application.index;
	}
	get queue() {
		return this.application.queue;
	}
	get root() {
		return this.application.root;
	}
	get error() {
		return this.application.error;
	}
	get loading() {
		return this.application.loading;
	}
	onload(): void {
		this.application.activate();
		const refresh = (file: unknown) => {
			if (file instanceof TFile) this.application.fileChanged(file);
		};
		this.registerEvent(this.app.vault.on('create', refresh));
		this.registerEvent(this.app.vault.on('modify', refresh));
		this.registerEvent(
			this.app.vault.on('delete', (file) => this.application.fileDeleted(file.path, !(file instanceof TFile))),
		);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) =>
				this.application.fileRenamed(file instanceof TFile ? file : null, oldPath, file.path),
			),
		);
	}
	onunload(): void {
		this.application.dispose();
	}
	saveReminder = (
		...args: Parameters<ContactsApplication['saveReminder']>
	): ReturnType<ContactsApplication['saveReminder']> => this.application.saveReminder(...args);
	subscribe = (...args: Parameters<ContactsApplication['subscribe']>): ReturnType<ContactsApplication['subscribe']> =>
		this.application.subscribe(...args);
	ensureLoaded = (
		...args: Parameters<ContactsApplication['ensureLoaded']>
	): ReturnType<ContactsApplication['ensureLoaded']> => this.application.ensureLoaded(...args);
	reload = (...args: Parameters<ContactsApplication['reload']>): ReturnType<ContactsApplication['reload']> =>
		this.application.reload(...args);
	snapshot = (...args: Parameters<ContactsApplication['snapshot']>): ReturnType<ContactsApplication['snapshot']> =>
		this.application.snapshot(...args);
	save = (...args: Parameters<ContactsApplication['save']>): ReturnType<ContactsApplication['save']> =>
		this.application.save(...args);
	create = (...args: Parameters<ContactsApplication['create']>): ReturnType<ContactsApplication['create']> =>
		this.application.create(...args);
	remove = (...args: Parameters<ContactsApplication['remove']>): ReturnType<ContactsApplication['remove']> =>
		this.application.remove(...args);
	deletion = (...args: Parameters<ContactsApplication['deletion']>) => this.application.deletion(...args);
	resources = (...args: Parameters<ContactsApplication['resources']>) => this.application.resources(...args);
	createNote = (...args: Parameters<ContactsApplication['createNote']>) => this.application.createNote(...args);
	importResources = (...args: Parameters<ContactsApplication['importResources']>) =>
		this.application.importResources(...args);
	ref = (...args: Parameters<ContactsApplication['ref']>): ReturnType<ContactsApplication['ref']> =>
		this.application.ref(...args);
	choices = (...args: Parameters<ContactsApplication['choices']>): ReturnType<ContactsApplication['choices']> =>
		this.application.choices(...args);
	countFolder = (
		...args: Parameters<ContactsApplication['countFolder']>
	): ReturnType<ContactsApplication['countFolder']> => this.application.countFolder(...args);
	private checkEditor(file: TFile, disk: string): void {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (
				leaf.view instanceof MarkdownView &&
				leaf.view.file === file &&
				leaf.view.getMode() === 'source' &&
				leaf.view.editor.getValue() !== disk
			)
				throw new ContactsError('editorConflict');
		}
	}
	private listFolder(path: string): ArchiveFolderEntry[] {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!(folder instanceof TFolder)) throw new ContactsError('missing');
		const entries: ArchiveFolderEntry[] = [];
		const pending = [...folder.children];
		while (pending.length) {
			const entry = pending.pop()!;
			if (entry instanceof TFolder) {
				entries.push({ path: entry.path, folder: true, size: 0, modified: 0 });
				pending.push(...entry.children);
			} else if (entry instanceof TFile)
				entries.push({ path: entry.path, folder: false, size: entry.stat.size, modified: entry.stat.mtime });
		}
		return entries;
	}
	private async checkFolderEditors(path: string): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (
				!(view instanceof MarkdownView) ||
				!view.file?.path.startsWith(path + '/') ||
				view.getMode() !== 'source'
			)
				continue;
			const file = view.file;
			this.checkEditor(file, await this.app.vault.read(file));
		}
	}
	private async mkdir(path: string): Promise<void> {
		let current = '';
		for (const segment of path.split('/')) {
			current = current ? current + '/' + segment : segment;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing && !(existing instanceof TFolder)) throw new ContactsError('invalidFolder');
			if (!existing) {
				try {
					await this.app.vault.createFolder(current);
				} catch (error) {
					if (!(this.app.vault.getAbstractFileByPath(current) instanceof TFolder)) throw error;
				}
			}
		}
	}
}
