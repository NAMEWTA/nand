import {
	Command,
	Component,
	Platform,
	TAbstractFile,
	TFile,
	TFolder,
	View,
	WorkspaceFloating,
	WorkspaceLeaf,
	WorkspaceRoot,
} from 'obsidian';
import type { IconicDialogs } from '../dialog-port';

import AppIconManager from '../managers/app-icon-manager';
import BookmarkIconManager from '../managers/bookmark-icon-manager';
import EditorIconManager from '../managers/editor-icon-manager';
import FileIconManager from '../managers/file-icon-manager';
import IconManager from '../managers/icon-manager';
import MenuManager from '../managers/menu-manager';
import PropertyIconManager from '../managers/property-icon-manager';
import RibbonIconManager from '../managers/ribbon-icon-manager';
import type { RuleItem } from '../managers/rule-manager';
import RuleManager, { RuleTrigger } from '../managers/rule-manager';
import SuggestionDialogIconManager from '../managers/suggestion-dialog-icon-manager';
import SuggestionIconManager from '../managers/suggestion-icon-manager';
import TabIconManager from '../managers/tab-icon-manager';
import TagIconManager from '../managers/tag-icon-manager';
import { internalApp, internalLeaf, isHtmlElement } from '../utils/obsidian-internal';
import ObsidianUtils, {
	ObsidianBookmark,
	ObsidianProperty,
	ObsidianRibbonItem,
	ObsidianTag,
} from '../utils/obsidian-utils';

import type { ViewUpdate } from '@codemirror/view';
import { ViewPlugin } from '@codemirror/view';
import type { EventRef, MarkdownPostProcessorContext, Modal, Plugin } from 'obsidian';
import type { IconicSettings } from '../../../../core/icons/settings/model';
import {
	PLUGIN_TAB_TYPES,
	type AppItem,
	type AppItemId,
	type BookmarkItem,
	type Category,
	type FileItem,
	type PropertyItem,
	type TagItem,
} from '../../../../core/icons/types';

import { STRINGS } from '../../../../shared/i18n/icons-accessor';
import { onLanguageChanged } from '../../../../shared/i18n/index';
import { IconicStore } from '../persistence/store';
import { type RibbonItem, type TabItem } from '../view-types';
export type * from '../../../../core/icons/types';
export { PLUGIN_TAB_TYPES } from '../../../../core/icons/types';
export { STRINGS } from '../../../../shared/i18n/icons-accessor';
export { EMOJI_KEYWORDS, EMOJIS, ICON_KEYWORDS, ICONS } from '../resources';
const IMAGE_EXTENSIONS = ['bmp', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', '3gp', 'flac', 'ogg', 'oga', 'opus'];

export default class IconicController {
	openRuleEditor(page: Category, rule: RuleItem, callback: (rule: RuleItem | null) => void): void {
		this.dialogsPort.openRuleEditor(page, rule, callback);
	}

	menuManager?: MenuManager;
	ruleManager?: RuleManager;
	appIconManager?: AppIconManager;
	tabIconManager?: TabIconManager;
	fileIconManager?: FileIconManager;
	bookmarkIconManager?: BookmarkIconManager;
	tagIconManager?: TagIconManager;
	propertyIconManager?: PropertyIconManager;
	editorIconManager?: EditorIconManager;
	ribbonIconManager?: RibbonIconManager;
	suggestionIconManager?: SuggestionIconManager;
	suggestionDialogIconManager?: SuggestionDialogIconManager;
	dialogCommands: Command[] = [];
	private readonly store: IconicStore;
	private scope?: Component;
	private active = false;
	private ready = false;
	private disposed = false;
	private booted = false;
	private generation = 0;
	private ribbon?: HTMLElement;
	private readonly dialogs = new Set<Modal>();
	private readonly bodies = new Set<HTMLElement>();
	private readonly bodyThemes = new Map<HTMLElement, { original: string | null; applied: string | null }>();
	private readonly registeredCommands: Array<{ registered: Command; definition: Command }> = [];

	readonly dialogsPort: IconicDialogs;
	constructor(
		private readonly host: Plugin,
		createDialogs: (controller: IconicController) => IconicDialogs,
	) {
		this.dialogsPort = createDialogs(this);
		this.store = new IconicStore(host.app, host.manifest);
	}
	get app(): Plugin['app'] {
		return this.host.app;
	}
	get manifest(): Plugin['manifest'] {
		return this.host.manifest;
	}
	get settings(): IconicSettings {
		return this.store.settings;
	}
	isActive(): boolean {
		return this.active;
	}

	async onload(): Promise<void> {
		if (!this.booted) {
			this.booted = true;
			this.dialogsPort.registerCommands();
			this.host.register(
				onLanguageChanged(() => {
					for (const { registered, definition } of this.registeredCommands) {
						registered.name = `${this.manifest.name}: ${definition.name}`;
					}
				}),
			);

			this.host.registerEditorExtension(
				ViewPlugin.define(() => ({
					update: (update: ViewUpdate): void => {
						if (this.active) this.editorIconManager?.updateEditor(update);
					},
				})),
			);
			this.host.registerMarkdownPostProcessor((element: HTMLElement, _context: MarkdownPostProcessorContext) => {
				if (this.active) this.editorIconManager?.processReading(element);
			});
		}
		await this.activate();
	}

	registerEvent(event: EventRef): void {
		this.scope?.registerEvent(event);
	}
	register(cleanup: () => void): void {
		this.scope?.register(cleanup);
	}
	trackDialog(dialog: Modal): void {
		this.dialogs.add(dialog);
	}
	forgetDialog(dialog: Modal): void {
		this.dialogs.delete(dialog);
	}

	addCommand(command: Command): Command {
		const callback = command.callback;
		const check = command.checkCallback;
		const registered = this.host.addCommand({
			...command,
			// Dialog hotkeys also call callback directly.
			callback: callback
				? () => {
						if (this.active && this.ready) {
							const result: unknown = callback();
							return result;
						}
						return undefined;
					}
				: undefined,
			checkCallback: (checking) => {
				if (!this.active || !this.ready) return false;
				if (check) return check(checking);
				if (!checking) callback?.();
				return true;
			},
		});
		this.registeredCommands.push({ registered, definition: command });
		return registered;
	}

	async activate(): Promise<void> {
		if (this.disposed || this.active) return;
		const generation = ++this.generation;
		await this.store.flush();
		await this.store.load();
		if (this.disposed || generation !== this.generation) return;
		this.active = true;
		this.scope = new Component();
		this.scope.load();
		this.store.watch(this.scope, () => {
			if (!this.active) return;
			this.refreshManagers();
			this.refreshBody();
		});
		this.register(
			onLanguageChanged(() => {
				if (this.ribbon) this.ribbon.setAttribute('aria-label', STRINGS.commands.openRulebook);
			}),
		);
		this.registerEvent(
			this.app.workspace.on('window-open', (_workspaceWindow, win) => {
				this.bodies.add(win.document.body);
				this.refreshBody();
			}),
		);
		this.registerEvent(
			this.app.workspace.on('window-close', (_workspaceWindow, win) => {
				this.bodies.delete(win.document.body);
				this.bodyThemes.delete(win.document.body);
			}),
		);
		this.app.workspace.onLayoutReady(() => {
			if (!this.active || generation !== this.generation) return;
			this.ready = true;
			this.startManagers();
			this.refreshBody();

			this.registerEvent(
				this.app.vault.on('create', (tAbstractFile) => {
					const page = tAbstractFile instanceof TFile ? 'file' : 'folder';
					// If a created file/folder triggers a new ruling, refresh icons
					if (this.ruleManager?.triggerRulings(page, 'rename', 'move', 'modify')) {
						this.refreshManagers(page);
					}
				}),
			);

			this.registerEvent(
				this.app.vault.on('rename', (tAbstractFile, oldPath) => {
					const { path } = tAbstractFile;
					const fileIcon = this.settings.fileIcons[oldPath];
					if (fileIcon) {
						this.settings.fileIcons[path] = fileIcon;
						delete this.settings.fileIcons[oldPath];
						void this.saveSettings();
					}
					const { filename, tree } = this.splitFilePath(path);
					const { filename: oldFilename, tree: oldTree } = this.splitFilePath(oldPath);
					const page = tAbstractFile instanceof TFile ? 'file' : 'folder';
					// If a renamed file/folder triggers a new ruling, refresh icons
					if (filename !== oldFilename && this.ruleManager?.triggerRulings(page, 'rename')) {
						this.refreshManagers(page);
						// If a moved file/folder triggers a new ruling, refresh icons
					} else if (tree !== oldTree && this.ruleManager?.triggerRulings(page, 'move')) {
						this.refreshManagers(page);
					}
				}),
			);

			this.registerEvent(
				this.app.vault.on('modify', (tAbstractFile) => {
					this.onFileModify(tAbstractFile);
				}),
			);
			this.registerEvent(
				internalApp(this.app).metadataCache.on('changed', (tAbstractFile) => {
					this.onFileModify(tAbstractFile);
				}),
			);

			this.registerEvent(
				this.app.vault.on('delete', (tAbstractFile) => {
					const { path } = tAbstractFile;
					delete this.settings.fileIcons[path];
					void this.saveSettings();
					// If a deleted file/folder was associated with a ruling, update rulings
					const page = tAbstractFile instanceof TFile ? 'file' : 'folder';
					if (this.ruleManager?.checkRuling(page, path)) {
						this.ruleManager.updateRulings(page);
					}
				}),
			);
		});

		this.registerEvent(
			this.app.workspace.on('css-change', () => {
				this.refreshManagers();
				this.refreshBody();
			}),
		);

		// RIBBON: Open rulebook
		this.ribbon = this.host.addRibbonIcon('lucide-book-image', STRINGS.commands.openRulebook, () =>
			this.dialogsPort.openRulePicker(),
		);
	}
	async deactivate(): Promise<void> {
		this.stop();
		await this.store.flush();
	}

	onunload(): void {
		this.disposed = true;
		this.stop();
		void this.store.flush().catch((error: unknown) => console.error('NAND icons: save failed', error));
	}

	private stop(): void {
		++this.generation;
		if (!this.active) return;
		this.active = false;
		this.ready = false;
		this.scope?.unload();
		this.scope = undefined;
		for (const dialog of this.dialogs) dialog.close();
		this.dialogs.clear();
		this.stopManagers();
		this.ribbon?.remove();
		this.ribbon = undefined;
		this.bodies.clear();
		this.bodyThemes.clear();
	}

	saveSettings(): Promise<void> {
		return this.store.save();
	}
	/**
	 * Refresh icon managers after a file/folder is modified.
	 */
	private onFileModify(tAbstractFile: TAbstractFile): void {
		const page = tAbstractFile instanceof TFile ? 'file' : 'folder';
		// If a modified file/folder triggers a new ruling, refresh icons
		if (this.ruleManager?.triggerRulings(page, 'modify')) {
			this.refreshManagers(page);
		}
	}

	/**
	 * Initialize all manager instances.
	 */
	private startManagers(): void {
		this.menuManager = new MenuManager();
		this.ruleManager = new RuleManager(this);
		try {
			this.appIconManager = new AppIconManager(this);
		} catch (e) {
			console.error(e);
		}
		try {
			this.tabIconManager = new TabIconManager(this);
		} catch (e) {
			console.error(e);
		}
		try {
			this.fileIconManager = new FileIconManager(this);
		} catch (e) {
			console.error(e);
		}
		try {
			this.tagIconManager = new TagIconManager(this);
		} catch (e) {
			console.error(e);
		}
		try {
			this.bookmarkIconManager = new BookmarkIconManager(this);
		} catch (e) {
			console.error(e);
		}
		try {
			this.propertyIconManager = new PropertyIconManager(this);
		} catch (e) {
			console.error(e);
		}
		try {
			this.editorIconManager = new EditorIconManager(this);
		} catch (e) {
			console.error(e);
		}
		try {
			this.ribbonIconManager = new RibbonIconManager(this);
		} catch (e) {
			console.error(e);
		}
		try {
			this.suggestionIconManager = new SuggestionIconManager(this);
		} catch (e) {
			console.error(e);
		}
		try {
			this.suggestionDialogIconManager = new SuggestionDialogIconManager(this);
		} catch (e) {
			console.error(e);
		}
	}

	/**
	 * Refresh all icon managers, or a specific group of them.
	 */
	refreshManagers(...categories: Category[]): void {
		if (categories.length === 0) {
			categories = ['app', 'tab', 'file', 'folder', 'tag', 'property', 'ribbon'];
		}
		const managers = new Set<IconManager | undefined>();

		if (categories.includes('app')) {
			managers.add(this.appIconManager);
		}
		if (categories.includes('tab')) {
			managers.add(this.tabIconManager);
		}
		if (categories.includes('file')) {
			managers.add(this.tabIconManager);
			managers.add(this.fileIconManager);
			managers.add(this.bookmarkIconManager);
			managers.add(this.editorIconManager);
		}
		if (categories.includes('folder')) {
			managers.add(this.fileIconManager);
			managers.add(this.bookmarkIconManager);
		}
		if (categories.includes('tag')) {
			managers.add(this.tagIconManager);
			managers.add(this.editorIconManager);
		}
		if (categories.includes('property')) {
			managers.add(this.propertyIconManager);
			managers.add(this.editorIconManager);
		}
		if (categories.includes('ribbon')) {
			managers.add(this.ribbonIconManager);
		}

		managers.delete(undefined);
		for (const manager of managers) manager?.refreshIcons();
	}

	/**
	 * Refresh any classes or attributes on every document body.
	 * @param unloading Remove all classes if true
	 */
	refreshBody(unloading?: boolean): void {
		// Check all open windows
		const bodyEls = this.bodies;
		bodyEls.add(this.app.workspace.containerEl.ownerDocument.body);
		this.app.workspace.iterateAllLeaves((leaf) => {
			const bodyEl: unknown = internalLeaf(leaf).containerEl?.doc?.body;
			if (isHtmlElement(bodyEl)) bodyEls.add(bodyEl);
		});

		// Refresh classes and theme attribute
		for (const bodyEl of bodyEls) {
			bodyEl.toggleClass('nand-iconic-enabled', !unloading);
			bodyEl.toggleClass('iconic-bigger-icons', unloading ? false : this.isSettingEnabled('biggerIcons'));
			bodyEl.toggleClass('iconic-clickable-icons', unloading ? false : this.isSettingEnabled('clickableIcons'));
			bodyEl.toggleClass('iconic-markdown-tab-icons', unloading ? false : this.settings.showMarkdownTabIcons);
			bodyEl.toggleClass('iconic-uncolor-hover', unloading ? false : this.settings.uncolorHover);
			bodyEl.toggleClass('iconic-uncolor-drag', unloading ? false : this.settings.uncolorDrag);
			bodyEl.toggleClass('iconic-uncolor-select', unloading ? false : this.settings.uncolorSelect);

			const theme = internalApp(this.app).customCss?.theme;
			let previous = this.bodyThemes.get(bodyEl);
			if (unloading) {
				if (previous && bodyEl.getAttribute('data-theme') === previous.applied) {
					if (previous.original === null) bodyEl.removeAttribute('data-theme');
					else bodyEl.setAttribute('data-theme', previous.original);
				}
				continue;
			}
			if (!previous) {
				previous = { original: bodyEl.getAttribute('data-theme'), applied: null };
				this.bodyThemes.set(bodyEl, previous);
			}
			previous.applied = theme ?? null;
			if (theme) {
				bodyEl.setAttr('data-theme', theme);
			} else {
				bodyEl.removeAttribute('data-theme');
			}
		}
	}

	/**
	 * Check whether setting is enabled for the current platform.
	 */
	isSettingEnabled(setting: keyof IconicSettings): boolean {
		const state = this.settings[setting];
		return (
			state === 'on' || (Platform.isDesktop && state === 'desktop') || (Platform.isMobile && state === 'mobile')
		);
	}

	/**
	 * Check whether a community plugin is installed and enabled.
	 */
	isPluginEnabled(pluginId: string): boolean {
		const plugins: unknown = internalApp(this.app).plugins?.plugins;
		return ObsidianUtils.isObject(plugins) ? pluginId in plugins : false;
	}

	/**
	 * Get app item definition.
	 */
	getAppItem(appItemId: AppItemId, unloading?: boolean): AppItem {
		const appIcon = this.settings.appIcons[appItemId] ?? {};
		let name, iconDefault;
		switch (appItemId) {
			case 'help': {
				name = STRINGS.appItems.help;
				iconDefault = 'help';
				break;
			}
			case 'settings': {
				name = STRINGS.appItems.settings;
				iconDefault = 'lucide-settings';
				break;
			}
			case 'pin': {
				name = STRINGS.appItems.pin;
				iconDefault = 'lucide-pin';
				break;
			}
			case 'sidebarLeft': {
				name = STRINGS.appItems.sidebarLeft;
				iconDefault = 'sidebar-toggle-button-icon';
				break;
			}
			case 'sidebarRight': {
				name = STRINGS.appItems.sidebarRight;
				iconDefault = 'sidebar-toggle-button-icon';
				break;
			}
			case 'minimize':
				name = STRINGS.appItems.minimize;
				break;
			case 'maximize':
				name = STRINGS.appItems.maximize;
				break;
			case 'unmaximize':
				name = STRINGS.appItems.unmaximize;
				break;
			case 'close':
				name = STRINGS.appItems.close;
				break;
		}
		return {
			id: appItemId,
			name: name ?? '',
			category: 'app',
			iconDefault: iconDefault ?? null,
			icon: unloading ? null : (appIcon.icon ?? null),
			color: unloading ? null : (appIcon.color ?? null),
		};
	}

	/**
	 * Get array of tab definitions.
	 */
	getTabItems(unloading?: boolean): TabItem[] {
		const tabIcons: TabItem[] = [];
		this.app.workspace.iterateAllLeaves((leaf) => {
			tabIcons.push(this.defineTabItem(leaf, unloading));
		});
		return tabIcons;
	}

	/**
	 * Get tab definition.
	 */
	getTabItem(tabId: string, unloading?: boolean): TabItem | null {
		let tab: TabItem | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (tab) return;
			const tabType = leaf.view.getViewType();
			if (tabType === tabId || (leaf.view.getState().file === tabId && !PLUGIN_TAB_TYPES.includes(tabType))) {
				tab = this.defineTabItem(leaf, unloading);
			}
		});
		return tab;
	}

	/**
	 * Create tab definition.
	 */
	private defineTabItem(leaf: WorkspaceLeaf, unloading?: boolean): TabItem {
		let iconEl: HTMLElement | null = internalLeaf(leaf).tabHeaderInnerIconEl;
		if (Platform.isMobile) {
			if (
				internalLeaf(leaf).containerEl?.parentElement ===
				internalApp(this.app).workspace.leftSplit.activeTabContentEl
			) {
				iconEl = internalApp(this.app).workspace.leftSplit.activeTabIconEl;
			} else if (
				internalLeaf(leaf).containerEl?.parentElement ===
				internalApp(this.app).workspace.rightSplit.activeTabContentEl
			) {
				iconEl = internalApp(this.app).workspace.rightSplit.activeTabIconEl;
			}
		}

		const tabType = leaf.view.getViewType();

		const isActive =
			leaf.view === this.app.workspace.getActiveViewOfType(View) ||
			internalLeaf(leaf).tabHeaderEl?.hasClass('is-active') === true;
		const isRoot = leaf.getRoot() instanceof WorkspaceRoot || leaf.getRoot() instanceof WorkspaceFloating;

		const isStacked = internalLeaf(leaf).parent?.isStacked === true;
		const filePath = leaf.view.getState().file; // Used because view.file is undefined on deferred views

		if (filePath && !PLUGIN_TAB_TYPES.includes(tabType)) {
			const fileId = typeof filePath === 'string' ? filePath : '';
			const fileIcon = this.settings.fileIcons[fileId] ?? {};
			const isMarkdown = tabType === 'markdown';
			return {
				id: fileId,
				name: leaf.getDisplayText(),
				category: 'file',
				iconDefault:
					isRoot && isMarkdown && !isStacked && !fileIcon.color && !this.settings.showAllFileIcons
						? null
						: leaf.view.getIcon(),
				icon: unloading ? null : (fileIcon.icon ?? null),
				color: unloading ? null : (fileIcon.color ?? null),
				isActive: isActive,
				isRoot: isRoot,
				isStacked: isStacked,
				iconEl: iconEl ?? null,

				tabEl: internalLeaf(leaf).tabHeaderEl ?? null,
			};
		} else {
			const tabIcon = this.settings.tabIcons[tabType] ?? {};
			let iconDefault;
			switch (tabType) {
				case 'empty':
					iconDefault = !isRoot || isStacked || tabIcon.color ? leaf.view.getIcon() : null;
					break;
				default:
					iconDefault = leaf.view.getIcon();
					break;
			}
			return {
				id: tabType,
				name: leaf.getDisplayText(),
				category: 'tab',
				iconDefault: iconDefault,
				icon: unloading ? null : (tabIcon.icon ?? null),
				color: unloading ? null : (tabIcon.color ?? null),
				isActive: isActive,
				isRoot: isRoot,
				isStacked: isStacked,
				iconEl: iconEl ?? null,

				tabEl: internalLeaf(leaf).tabHeaderEl ?? null,
			};
		}
	}

	/**
	 * Get array of file definitions.
	 */
	getFileItems(unloading?: boolean): FileItem[] {
		const tFiles = this.app.vault.getAllLoadedFiles();
		const rootFolder = tFiles.find((tFile) => tFile.path === '/');
		if (rootFolder) tFiles.remove(rootFolder);
		return tFiles.map((tFile) => this.defineFileItem(tFile, tFile.path, unloading));
	}

	/**
	 * Get file definition.
	 */
	getFileItem(fileId: string, unloading?: boolean): FileItem {
		const { path } = this.splitFilePath(fileId); // Ignore subpath
		const tFile = this.app.vault.getAbstractFileByPath(path);
		return this.defineFileItem(tFile, fileId, unloading);
	}

	/**
	 * Create file definition.
	 */
	private defineFileItem(tFile: TAbstractFile | null, fileId: string, unloading?: boolean): FileItem {
		const { filename, basename, extension } = this.splitFilePath(fileId);
		const fileIcon = this.settings.fileIcons[fileId] ?? {};
		let iconDefault = null;

		if (tFile instanceof TFile && (fileIcon.color || this.settings.showAllFileIcons)) {
			if (extension === 'canvas') {
				iconDefault = 'lucide-layout-dashboard';
			} else if (extension === 'pdf') {
				iconDefault = 'lucide-file-text';
			} else if (IMAGE_EXTENSIONS.includes(extension)) {
				iconDefault = 'lucide-image';
			} else if (AUDIO_EXTENSIONS.includes(extension)) {
				iconDefault = 'lucide-file-audio';
			} else {
				iconDefault = 'lucide-file';
			}
		} else if (
			tFile instanceof TFolder &&
			((fileIcon.color && !this.settings.minimalFolderIcons) || this.settings.showAllFolderIcons)
		) {
			iconDefault = 'lucide-folder-closed';
		}

		return {
			id: fileId,
			name: extension === 'md' ? basename : filename,
			category: tFile instanceof TFolder ? 'folder' : 'file',
			iconDefault: unloading ? null : iconDefault,
			icon: unloading ? null : (fileIcon.icon ?? null),
			color: unloading ? null : (fileIcon.color ?? null),
			items:
				tFile instanceof TFolder
					? tFile.children.map((tChild) => this.defineFileItem(tChild, tChild.path, unloading))
					: null,
		};
	}

	/**
	 * Split a filepath into its hierarchical components.
	 */
	splitFilePath(fileId = ''): {
		path: string; // Folder tree + Filename
		tree: string; // Folder tree only
		filename: string; // Name.Extension
		basename: string; // Name only
		extension: string; // Extension only
		subpath: string; // #Subpath after extension
	} {
		const subpathExts = ['md', 'base', 'pdf']; // Extensions with linkable subpaths
		const subpathStart = Math.max(
			...subpathExts.map((ext) => {
				const index = fileId.lastIndexOf(`.${ext}#`);
				return index > -1 ? index + ext.length + 1 : -1;
			}),
		);
		const subpath = subpathStart > -1 ? fileId.substring(subpathStart, fileId.length) : '';
		const path = subpathStart > -1 ? fileId.substring(0, subpathStart) : fileId;

		const [, tree = '', filename = ''] = path.match(new RegExp('^(.*\\/)?(.*)$', 's')) ?? [];
		const extensionStart = filename.lastIndexOf('.');
		const extension = filename.substring(extensionStart > -1 ? extensionStart + 1 : filename.length) || '';
		const basename = filename.substring(0, extensionStart > -1 ? extensionStart : filename.length) || '';

		return { path, tree, filename, basename, extension, subpath };
	}

	/**
	 * Get array of bookmark definitions.
	 */
	getBookmarkItems(unloading?: boolean): BookmarkItem[] {
		const oBmarks = ObsidianUtils.getObsidianBookmarks(this.app);
		return oBmarks.map((oBmark) => this.defineBookmarkItem(oBmark, unloading));
	}

	/**
	 * Get bookmark definition.
	 */
	getBookmarkItem(bmarkId: string, bmarkCategory: Category, unloading?: boolean): BookmarkItem | null {
		const oBmark = ObsidianUtils.getObsidianBookmark(this.app, bmarkCategory, bmarkId);
		return oBmark ? this.defineBookmarkItem(oBmark, unloading) : null;
	}

	/**
	 * Create bookmark definition.
	 */
	private defineBookmarkItem(oBmark: ObsidianBookmark, unloading?: boolean): BookmarkItem {
		let id = '';
		let name = '';
		let category: Category = 'file';
		let icon: string | null = null;
		let color: string | null = null;
		let iconDefault: string | null = null;

		switch (oBmark.type) {
			case 'file': {
				const { path, filename, basename, extension } = this.splitFilePath(oBmark.path ?? '');
				const subpath = oBmark.subpath ?? '';
				id = path + subpath;
				name = (extension === 'md' ? basename : filename) + subpath;
				category = 'file';
				icon = this.settings.fileIcons[id]?.icon ?? null;
				color = this.settings.fileIcons[id]?.color ?? null;
				iconDefault = this.getDefaultBookmarkIcon(extension, subpath, unloading);
				break;
			}
			case 'folder': {
				category = 'folder';
				id = oBmark.path ?? '';
				name = oBmark.title ?? '';
				icon = this.settings.fileIcons[id]?.icon ?? null;
				color = this.settings.fileIcons[id]?.color ?? null;
				iconDefault = 'lucide-folder';
				break;
			}
			case 'group': {
				category = 'group';
				id = oBmark.ctime.toString();
				name = oBmark.title ?? '';
				icon = this.settings.bookmarkIcons[id]?.icon ?? null;
				color = this.settings.bookmarkIcons[id]?.color ?? null;
				if ((color && !this.settings.minimalFolderIcons) || this.settings.showAllFolderIcons) {
					iconDefault = 'lucide-folder-closed';
				}
				break;
			}
			case 'search': {
				category = 'search';
				id = oBmark.ctime.toString();
				name = oBmark.query ?? '';
				icon = this.settings.bookmarkIcons[id]?.icon ?? null;
				color = this.settings.bookmarkIcons[id]?.color ?? null;
				iconDefault = 'lucide-search';
				break;
			}
			case 'graph': {
				category = 'graph';
				id = oBmark.ctime.toString();
				name = oBmark.title ?? '';
				icon = this.settings.bookmarkIcons[id]?.icon ?? null;
				color = this.settings.bookmarkIcons[id]?.color ?? null;
				iconDefault = 'lucide-git-fork';
				break;
			}
			case 'url': {
				id = oBmark.ctime.toString();
				name = oBmark.url ?? '';
				icon = this.settings.bookmarkIcons[id]?.icon ?? null;
				color = this.settings.bookmarkIcons[id]?.color ?? null;
				iconDefault = 'lucide-globe-2';
			}
		}

		return {
			id,
			name,
			category,
			iconDefault,
			icon: unloading ? null : icon,
			color: unloading ? null : color,
			items: oBmark.items?.map((oBmark) => this.defineBookmarkItem(oBmark, unloading)) ?? null,
		};
	}

	/**
	 * Get the default bookmark icon for a given file extension and file subpath.
	 */
	private getDefaultBookmarkIcon(extension: string, subpath: string, unloading?: boolean): string {
		// Vanilla bookmark icons
		if (extension === 'canvas') {
			return 'lucide-layout-dashboard';
		} else if (subpath.startsWith('#^')) {
			return 'lucide-toy-brick';
		} else if (subpath.startsWith('#')) {
			return 'lucide-heading';
		} else if (unloading) {
			return 'lucide-file';
		}
		// Derived from the vanilla tab icons for these filetypes
		if (extension === 'pdf') {
			return 'lucide-file-text';
		} else if (IMAGE_EXTENSIONS.includes(extension)) {
			return 'lucide-image';
		} else if (AUDIO_EXTENSIONS.includes(extension)) {
			return 'lucide-file-audio';
		}
		// Generic icon
		return 'lucide-file';
	}

	/**
	 * Get array of tag definitions.
	 */
	getTagItems(unloading?: boolean): TagItem[] {
		const oTags = ObsidianUtils.getObsidianTags(this.app);
		if (!oTags) return [];
		return oTags?.map((oTag) => this.defineTagItem(oTag, unloading));
	}

	/**
	 * Get tag definition.
	 */
	getTagItem(tagId: string, unloading?: boolean): TagItem | null {
		const oTag = ObsidianUtils.getObsidianTag(this.app, tagId);
		if (!oTag) return null;
		return this.defineTagItem(oTag, unloading);
	}

	/**
	 * Create tag definition.
	 */
	private defineTagItem(oTag: ObsidianTag, unloading?: boolean): TagItem {
		const [hashtag] = oTag;
		const tagId = hashtag.replace('#', '');
		const tagIcon = this.settings.tagIcons[tagId];

		return {
			id: tagId,
			name: hashtag,
			category: 'tag',
			iconDefault: null,
			icon: unloading ? null : (tagIcon?.icon ?? null),
			color: unloading ? null : (tagIcon?.color ?? null),
		};
	}

	/**
	 * Get array of property definitions.
	 */
	getPropertyItems(unloading?: boolean): PropertyItem[] {
		const oProps = ObsidianUtils.getObsidianProperties(this.app);
		return oProps.map((oProp) => this.definePropertyItem(oProp, unloading));
	}

	/**
	 * Get property definition.
	 * @param propId Case-insensitive property ID
	 */
	getPropertyItem(propId: string, unloading?: boolean): PropertyItem | null {
		const oProp = ObsidianUtils.getObsidianProperty(this.app, propId);
		if (!oProp) return null;
		return this.definePropertyItem(oProp, unloading);
	}

	/**
	 * Create property definition.
	 */
	private definePropertyItem(oProp: ObsidianProperty, unloading?: boolean): PropertyItem {
		const { name, widget } = oProp[1];
		const propIcon = this.settings.propertyIcons[name];
		const iconDefault = ObsidianUtils.getDefaultPropertyIcon(this.app, widget);
		return {
			id: name,
			name: name,
			category: 'property',
			iconDefault: iconDefault,
			icon: unloading ? null : (propIcon?.icon ?? null),
			color: unloading ? null : (propIcon?.color ?? null),
			type: widget,
		};
	}

	/**
	 * Get array of ribbon item definitions.
	 */
	getRibbonItems(unloading?: boolean): RibbonItem[] {
		const oRibbonItems = ObsidianUtils.getObsidianRibbonItems(this.app);
		return oRibbonItems.map((oRibbonItem) => this.defineRibbonItem(oRibbonItem, unloading));
	}

	/**
	 * Get ribbon item definition.
	 */
	getRibbonItem(itemId: string, unloading?: boolean): RibbonItem | null {
		const oRibbonItem = ObsidianUtils.getObsidianRibbonItem(this.app, itemId);
		if (!oRibbonItem) return null;
		return this.defineRibbonItem(oRibbonItem, unloading);
	}

	/**
	 * Create ribbon item definition.
	 */
	private defineRibbonItem(oRibbonItem: ObsidianRibbonItem, unloading?: boolean): RibbonItem {
		const ribbonIcon = this.settings.ribbonIcons[oRibbonItem.id];

		return {
			id: oRibbonItem.id,
			name: oRibbonItem.title,
			category: 'ribbon',
			iconDefault: oRibbonItem.icon,
			icon: unloading ? null : (ribbonIcon?.icon ?? null),
			color: unloading ? null : (ribbonIcon?.color ?? null),
			isHidden: oRibbonItem.hidden,
			iconEl: oRibbonItem.buttonEl,
		};
	}

	/**
	 * Save app icon changes to settings.
	 */
	saveAppIcon(appItem: AppItem, icon: string | null, color: string | null): void {
		this.updateIconSetting(this.settings.appIcons, appItem.id, icon, color);
		void this.saveSettings();
	}

	/**
	 * Save tab icon changes to settings.
	 */
	saveTabIcon(tab: TabItem, icon: string | null, color: string | null): void {
		this.updateIconSetting(this.settings.tabIcons, tab.id, icon, color);
		void this.saveSettings();
	}

	/**
	 * Save file icon changes to settings.
	 */
	saveFileIcon(file: FileItem, icon: string | null, color: string | null): void {
		const triggers: Set<RuleTrigger> = new Set();
		const fileBase = this.settings.fileIcons[file.id];
		if (icon !== fileBase?.icon) triggers.add('icon');
		if (color !== fileBase?.color) triggers.add('color');
		this.updateIconSetting(this.settings.fileIcons, file.id, icon, color);
		void this.saveSettings();
		this.ruleManager?.triggerRulings('file', ...triggers);
	}

	/**
	 * Save multiple file icon changes to settings.
	 * @param icon If undefined, leave icons unchanged
	 * @param color If undefined, leave colors unchanged
	 */
	saveFileIcons(files: FileItem[], icon: string | null | undefined, color: string | null | undefined): void {
		const triggers: Set<RuleTrigger> = new Set();
		for (const file of files) {
			if (icon !== undefined) file.icon = icon;
			if (color !== undefined) file.color = color;
			const bmarkBase = this.settings.fileIcons[file.id];
			if (icon !== bmarkBase?.icon) triggers.add('icon');
			if (color !== bmarkBase?.color) triggers.add('color');
			this.updateIconSetting(this.settings.fileIcons, file.id, file.icon, file.color);
		}
		void this.saveSettings();
		this.ruleManager?.triggerRulings('file', ...triggers);
	}

	/**
	 * Save bookmark icon changes to settings.
	 */
	saveBookmarkIcon(bmark: BookmarkItem, icon: string | null, color: string | null): void {
		const triggers: Set<RuleTrigger> = new Set();
		switch (bmark.category) {
			case 'file': // Fallthrough
			case 'folder': {
				const bmarkBase = this.settings.fileIcons[bmark.id];
				if (icon !== bmarkBase?.icon) triggers.add('icon');
				if (color !== bmarkBase?.color) triggers.add('color');
				this.updateIconSetting(this.settings.fileIcons, bmark.id, icon, color);
				break;
			}
			default: {
				this.updateIconSetting(this.settings.bookmarkIcons, bmark.id, icon, color);
				break;
			}
		}
		void this.saveSettings();
		this.ruleManager?.triggerRulings('file', ...triggers);
	}

	/**
	 * Save multiple bookmark icon changes to settings.
	 * @param icon If undefined, leave icons unchanged
	 * @param color If undefined, leave colors unchanged
	 */
	saveBookmarkIcons(bmarks: BookmarkItem[], icon: string | null | undefined, color: string | null | undefined): void {
		const triggers: Set<RuleTrigger> = new Set();
		for (const bmark of bmarks) {
			if (icon !== undefined) bmark.icon = icon;
			if (color !== undefined) bmark.color = color;
			switch (bmark.category) {
				case 'file': // Fallthrough
				case 'folder': {
					const bmarkBase = this.settings.fileIcons[bmark.id];
					if (icon !== bmarkBase?.icon) triggers.add('icon');
					if (color !== bmarkBase?.color) triggers.add('color');
					this.updateIconSetting(this.settings.fileIcons, bmark.id, bmark.icon, bmark.color);
					break;
				}
				default: {
					this.updateIconSetting(this.settings.bookmarkIcons, bmark.id, bmark.icon, bmark.color);
					break;
				}
			}
		}
		void this.saveSettings();
		this.ruleManager?.triggerRulings('file', ...triggers);
	}

	/**
	 * Save tag icon changes to settings.
	 */
	saveTagIcon(tag: TagItem, icon: string | null, color: string | null): void {
		this.updateIconSetting(this.settings.tagIcons, tag.id, icon, color);
		void this.saveSettings();
	}

	/**
	 * Save property icon changes to settings.
	 */
	savePropertyIcon(prop: PropertyItem, icon: string | null, color: string | null): void {
		this.updateIconSetting(this.settings.propertyIcons, prop.id, icon, color);
		void this.saveSettings();
	}

	/**
	 * Save multiple property icon changes to settings.
	 * @param icon If undefined, leave icons unchanged
	 * @param color If undefined, leave colors unchanged
	 */
	savePropertyIcons(props: PropertyItem[], icon: string | null | undefined, color: string | null | undefined): void {
		for (const prop of props) {
			if (icon !== undefined) prop.icon = icon;
			if (color !== undefined) prop.color = color;
			this.updateIconSetting(this.settings.propertyIcons, prop.id, prop.icon, prop.color);
		}
		void this.saveSettings();
	}

	/**
	 * Save ribbon icon changes to settings.
	 */
	saveRibbonIcon(ribbonItem: RibbonItem, icon: string | null, color: string | null): void {
		this.updateIconSetting(this.settings.ribbonIcons, ribbonItem.id, icon, color);
		void this.saveSettings();
	}

	/**
	 * Update icon in a given settings object.
	 */
	private updateIconSetting(
		settings: Record<string, Partial<{ icon?: string; color?: string }>>,
		itemId: string,
		icon: string | null,
		color: string | null,
	): void {
		if (icon || color) {
			if (!settings[itemId]) settings[itemId] = {};

			if (icon) settings[itemId].icon = icon;
			else delete settings[itemId].icon;
			if (color) settings[itemId].color = color;
			else delete settings[itemId].color;
		} else {
			delete settings[itemId];
		}
	}

	private stopManagers(): void {
		this.menuManager?.unload();
		this.ruleManager?.unload();
		this.appIconManager?.unload();
		this.tabIconManager?.unload();
		this.fileIconManager?.unload();
		this.bookmarkIconManager?.unload();
		this.tagIconManager?.unload();
		this.propertyIconManager?.unload();
		this.editorIconManager?.unload();
		this.ribbonIconManager?.unload();
		this.suggestionIconManager?.unload();
		this.suggestionDialogIconManager?.unload();
		this.refreshBody(true);
		this.menuManager = undefined;
		this.ruleManager = undefined;
		this.appIconManager = undefined;
		this.tabIconManager = undefined;
		this.fileIconManager = undefined;
		this.bookmarkIconManager = undefined;
		this.tagIconManager = undefined;
		this.propertyIconManager = undefined;
		this.editorIconManager = undefined;
		this.ribbonIconManager = undefined;
		this.suggestionIconManager = undefined;
		this.suggestionDialogIconManager = undefined;
	}
}
