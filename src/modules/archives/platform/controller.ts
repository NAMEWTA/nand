import { Component, type App } from 'obsidian';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { ContactsApplication } from '../core/application';
import type { ContactsFiles } from '../core/files';
import { ContactsError } from '../core/model';
import guide from '../core/persist/format-guide.md';
import englishGuide from '../core/persist/format-guide-en.md';
import type { ContactsSettings } from '../../../shared/contacts-settings';
import { getLanguage } from '../../../shared/i18n';
/** Native lifecycle, Vault IO and protection of unsaved editor content. */
export class ContactsController extends Component {
	private readonly application: ContactsApplication;
	private unsubscribe?: () => void;
	constructor(
		readonly app: App,
		getSettings: () => ContactsSettings,
	) {
		super();
		const content = contentFiles(app);
		const files: ContactsFiles = {
			get formatGuide() {
				return getLanguage() === 'en' ? englishGuide : guide;
			},
			ready: async () => {
				if (!app.workspace.layoutReady)
					await new Promise<void>((resolve) => app.workspace.onLayoutReady(resolve));
				await content.refresh();
			},
			getMarkdownFiles: () => content.getMarkdownFiles(),
			getFileByPath: path => content.getFileByPath(path),
			getAbstractFileByPath: path => content.getAbstractFileByPath(path),
			read: file => content.read(file.path),
			cachedRead: file => content.read(file.path),
			process: (file, update) => content.process(file.path, latest => { if (latest === null) throw new ContactsError('missing'); return update(latest); }),
			create: (path, text) => content.create(path, text),
			createBinary: (path, bytes) => content.createBinary(path, bytes),
			listFolder: path => content.listFolder(path),
			trashFolder: path => content.trashFolder(path),
			checkFolderEditors: async path => { try { await content.checkFolderEditors(path); } catch { throw new ContactsError('editorConflict'); } },
			createFolder: path => content.createFolder(path),
			mkdir: path => content.mkdir(path),
			checkEditor: (file, disk) => { try { content.checkEditor(file.path, disk); } catch { throw new ContactsError('editorConflict'); } },
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
		const content = contentFiles(this.app);
		this.unsubscribe = content.subscribe(event => {
			const file = content.getFileByPath(event.path);
			if (event.kind === 'delete') this.application.fileDeleted(event.path, false);
			else if (event.kind === 'rename') this.application.fileRenamed(file, event.oldPath!, event.path);
			else if (file) this.application.fileChanged(file);
		});
	}
	onunload(): void {
		this.unsubscribe?.(); this.unsubscribe = undefined;
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
}
