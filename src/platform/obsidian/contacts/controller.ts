import { Component, MarkdownView, TFile, TFolder, type App } from 'obsidian';
import { ContactsApplication } from '../../../core/contacts/application';
import type { ContactsFile, ContactsFiles } from '../../../core/contacts/files';
import { ContactsError } from '../../../core/contacts/model';
import guide from '../../../core/contacts/persist/format-guide.md';
import englishGuide from '../../../core/contacts/persist/format-guide-en.md';
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
			get formatGuide() { return getLanguage() === 'en' ? englishGuide : guide; },
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
			trashFile: (file) => app.fileManager.trashFile(native(file)),
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
				this.application.fileRenamed(file instanceof TFile ? file : null, oldPath),
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
