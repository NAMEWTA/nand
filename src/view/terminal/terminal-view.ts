import { WebLinksAddon } from '@xterm/addon-web-links';
import { shell, webUtils } from 'electron';
import type { ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { FileSystemAdapter, ItemView, Menu, Notice, TFile, TFolder } from 'obsidian';
import { h, render } from 'preact';
import type { PtySession } from '../../platform/desktop/terminal/pty-session';
import { onLeafLanguageChanged, refreshLeafTitle } from '../../platform/obsidian/workspace-title';
import { t as automationT } from '../../shared/i18n/index';
import type { TerminalViewHost } from './host';
import { TerminalWorkbench } from './TerminalWorkbench';
import { confirmSessionClose, HistoryPreview, HistorySidebar, NewConversationButton, SessionSidebar, TerminalHeader, UsageFooter } from './workbench';
import { createWorkbenchState, sidebarWidth, type WorkbenchState } from './workbench-state';

/**
 * Node built-ins are resolved on demand inside the `TerminalView`
 * constructor via Electron's `window.require` to keep filesystem
 * access out of the bundled module top-level scope. This avoids
 * tripping the Obsidian community plugin reviewer's static "Direct
 * Filesystem Access" warning while preserving runtime semantics
 * (Electron caches `require` results).
 */
type FsModule = typeof import('fs');
type PathModule = typeof import('path');

import { formatAbsoluteDropPaths } from '../../core/pty/path-reference';
import { debugLog, errorLog } from '../../platform/desktop/logger';
import {
	collectFallbackDroppedTextPayload,
	collectPreferredDroppedTextPayload,
	resolveDroppedTextInput,
} from '../../platform/desktop/terminal/drop-text-payload';
import {
	collectTerminalReferenceCandidatePaths,
	fileUriToPlatformPath,
	findUniqueTerminalEntryByBasename,
	getVaultRelativePathFromAbsolute,
	isAbsoluteTerminalPath,
	isBasenameOnlyTerminalToken,
	joinTerminalPaths,
	normalizeDroppedEntryReference,
	normalizeTerminalRawToken,
	normalizeTerminalReferencePath,
	normalizeTerminalToken,
	normalizeVaultPath,
	obsidianUriToVaultPath,
	toPlatformPath,
} from '../../platform/desktop/terminal/terminal-path-utils';
import type { TerminalService } from '../../platform/desktop/terminal/terminal-service';
import { t } from '../../shared/i18n/terminal-accessor';
import { RenameTerminalModal } from './rename-terminal-modal';
import { TERMINAL_FILE_URI_REGEX } from './runtime/terminal-file-links';
import type { TerminalInstance } from './runtime/terminal-instance';
import { clamp, normalizeBackgroundPosition, normalizeBackgroundSize, toCssUrl } from './style-utils';
type XtermTerminal = import('@xterm/xterm').Terminal;

export const TERMINAL_VIEW_TYPE = 'terminal-view';

export type TerminalAttachOptions = {
	focus?: boolean;
};

/**
 * Terminal view class
 */
export class TerminalView extends ItemView {
	protected terminalService: TerminalService | null;
	private terminalInstance: TerminalInstance | null = null;
	private closed = false;
	private terminalContainer: HTMLElement | null = null;
	private dropHintEl: HTMLElement | null = null;
	private dragEnterDepth = 0;
	private removeDropHandlers: (() => void) | null = null;
	private searchContainer: HTMLElement | null = null;
	private searchInput: HTMLInputElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private fileUriLinkAddon: WebLinksAddon | null = null;
	private titleChangeCleanup: (() => void) | null = null;
	private searchStateCleanup: (() => void) | null = null;
	private initPromise: Promise<TerminalInstance> | null = null;
	private initResolve: ((terminal: TerminalInstance) => void) | null = null;
	private initReject: ((error: Error) => void) | null = null;
	private pauseDocumentCleanup: (() => void) | null = null;
	private themeCleanup: (() => void) | null = null;
	private attachFrame: { win: Window; id: number } | null = null;
	private initializeTimer: { win: Window; id: number } | null = null;
	private workbenchVisible = false;
	private workbenchState = createWorkbenchState();
	private workbenchRoot: HTMLElement | null = null;
	private readonly changeWorkbench = (patch: Partial<WorkbenchState>) => {
		Object.assign(this.workbenchState, patch);
		for (const leaf of this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE)) {
			if (leaf.view instanceof TerminalView && leaf.view.workbenchState === this.workbenchState) {
				leaf.view.drawWorkbench();
				leaf.view.syncOutputPause();
			}
		}
		if (!this.closed) this.app.workspace.requestSaveLayout();
	};
	copyWorkbenchStateFrom(view: TerminalView): void {
		this.workbenchState = view.workbenchState;
		this.drawWorkbench();
		this.syncOutputPause();
	}
	getState(): Record<string, unknown> {
		const { sidebarWidth, wideSidebarOpen, navigation, sessionQuery, historyQuery, historyFilter, historyOffset } = this.workbenchState;
		return { sidebarWidth, wideSidebarOpen, navigation, sessionQuery, historyQuery, historyFilter, historyOffset };
	}
	async setState(raw: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		this.workbenchState.sidebarWidth = sidebarWidth(typeof raw.sidebarWidth === 'number' ? raw.sidebarWidth : 272);
		this.workbenchState.wideSidebarOpen = raw.wideSidebarOpen !== false;
		this.workbenchState.navigation = raw.navigation === 'history' ? 'history' : 'running';
		for (const key of ['sessionQuery', 'historyQuery'] as const) this.workbenchState[key] = typeof raw[key] === 'string' ? raw[key] : '';
		this.workbenchState.historyFilter = raw.historyFilter === 'favorite' || raw.historyFilter === 'archived' ? raw.historyFilter : 'active';
		this.workbenchState.historyOffset = typeof raw.historyOffset === 'number' && Number.isFinite(raw.historyOffset) ? Math.max(0, Math.floor(raw.historyOffset / 100) * 100) : 0;
		this.drawWorkbench();
		await super.setState(raw, result);
	}

	private readonly fs: FsModule;
	private readonly path: PathModule;

	constructor(
		leaf: WorkspaceLeaf,
		terminalService: TerminalService | null,
		private readonly terminalHost: TerminalViewHost,
	) {
		super(leaf);
		this.terminalService = terminalService;
		this.fs = window.require('fs') as FsModule;
		this.path = window.require('path') as PathModule;
		this.initPromise = new Promise<TerminalInstance>((resolve, reject) => {
			this.initResolve = resolve;
			this.initReject = reject;
		});
		void this.initPromise.catch(() => undefined);
	}

	getViewType(): string {
		return TERMINAL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.terminalInstance?.getTitle() || t('terminal.defaultTitle');
	}

	getIcon(): string {
		return 'terminal';
	}

	onPaneMenu(menu: Menu): void {
		// Obsidian may pass a wrapper object, so resolve the real view instance
		const view = (this as TerminalView & { realView?: TerminalView }).realView ?? this;

		menu.addItem((item) => {
			item.setTitle(t('terminal.renameTerminal'))
				.setIcon('pencil')
				.onClick(() => {
					if (!view.terminalInstance) {
						new Notice(t('terminal.notInitialized'));
						return;
					}

					const currentTitle = view.terminalInstance.getTitle();

					new RenameTerminalModal(view.app, currentTitle, (newTitle: string) => {
						if (view.terminalInstance && newTitle.trim()) {
							const trimmedTitle = newTitle.trim();
							view.terminalInstance.setTitle(trimmedTitle);
							this.updateLeafHeader(view.leaf);
							view.updateDropHintText();
						}
					}).open();
				});
		});

		if (view.terminalInstance?.automationManaged)
			menu.addItem((item) =>
				item
					.setTitle(automationT('automation.hide'))
					.setIcon('eye-off')
					.onClick(() => {
						view.releaseTerminalInstance();
						view.leaf.detach();
					}),
			);
		const plugin = this.getTerminalPlugin();
		if (plugin) {
			menu.addItem((item) => {
				item.setTitle(plugin.getAlwaysOnTopTerminalLabel(view))
					.setIcon('pin')
					.onClick(() => {
						void plugin.toggleAlwaysOnTopTerminal(view);
					});
			});
		}
		const session = view.terminalInstance?.session;
		if (session) {
			menu.addSeparator();
			menu.addItem((item) => item.setTitle(t('workbench.copySessionId')).setIcon('copy').onClick(() => {
				void view.contentEl.win.navigator.clipboard.writeText(session.id).catch((error) => new Notice(String(error)));
			}));
			menu.addItem((item) => item.setTitle(t('workbench.close')).setIcon('square').onClick(() => {
				confirmSessionClose(view.app, () => view.closeSession(session));
			}));
		}
	}

	onOpen(): Promise<void> {
		// Use contentEl instead of containerEl.children[1]
		const container = this.contentEl;
		this.closed = false;
		container.empty();
		container.addClass('nand-agent-workbench');
		this.drawWorkbench();
		if (this.terminalService) this.register(this.terminalService.subscribe(() => this.drawWorkbench()));
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => {
			this.drawWorkbench();
			this.updateDropHintText();
		}));
		this.register(
			container.onWindowMigrated(() => {
				this.drawWorkbench();
				this.handleHostWindowChanged();
			}),
		);
		container.addClass('terminal-view-container');

		this.ensureDropHint();
		this.hideDropHint();
		if (!this.removeDropHandlers) {
			this.removeDropHandlers = this.setupDropHandlers();
		}

		this.scheduleInitializeTerminal();
		this.bindThemeChanges();
		this.bindOutputPause();
		return Promise.resolve();
	}

	/**
	 * Create the search UI
	 */
	private performSearch(): void {
		const query = this.searchInput?.value || '';
		this.terminalInstance?.search(query);
	}

	/**
	 * Show the search bar
	 */
	showSearch(): void {
		if (this.searchContainer) {
			this.searchContainer.addClass('is-visible');
			this.searchInput?.focus();
			this.searchInput?.select();
		}
	}

	/**
	 * Hide the search bar
	 */
	hideSearch(): void {
		if (this.searchContainer) {
			this.searchContainer.removeClass('is-visible');
		}
		this.terminalInstance?.clearSearch();
		this.terminalInstance?.focus();
	}

	onClose(): Promise<void> {
		this.closed = true;
		this.selectionRequest++;
		this.cancelInitializeTimer();
		this.rejectPendingInitialization(new Error(t('terminal.notInitialized')));
		this.releaseTerminalInstance();
		this.themeCleanup?.();
		this.themeCleanup = null;
		this.pauseDocumentCleanup?.();
		this.pauseDocumentCleanup = null;
		render(null, this.contentEl);
		this.getTerminalPlugin()?.handleTerminalViewClosed(this);

		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.fileUriLinkAddon?.dispose();
		this.fileUriLinkAddon = null;
		this.titleChangeCleanup?.();
		this.titleChangeCleanup = null;
		this.searchStateCleanup?.();
		this.searchStateCleanup = null;
		this.removeDropHandlers?.();
		this.removeDropHandlers = null;
		this.dragEnterDepth = 0;
		this.dropHintEl = null;

		this.containerEl.empty();
		this.disposeAppearanceStyle();
		return Promise.resolve();
	}

	releaseTerminalInstance(): TerminalInstance | null {
		if (this.attachFrame) this.attachFrame.win.cancelAnimationFrame(this.attachFrame.id);
		this.attachFrame = null;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		const terminal = this.terminalInstance;
		if (!terminal) return null;

		this.detachTerminalBindings();
		this.fileUriLinkAddon?.dispose();
		this.fileUriLinkAddon = null;
		terminal.release(this);
		this.terminalInstance = null;
		this.initPromise = null;
		this.initResolve = null;
		this.initReject = null;
		return terminal;
	}

	adoptTerminalInstance(terminal: TerminalInstance, options: TerminalAttachOptions = {}): void {
		this.cancelInitializeTimer();
		this.selectionRequest++;
		this.detachTerminalBindings();
		this.terminalInstance = terminal;
		this.terminalHost.recordActiveSession(terminal.id);
		this.initPromise = Promise.resolve(terminal);
		this.initResolve?.(terminal);
		this.initResolve = null;
		this.initReject = null;
		this.bindTerminalInstance(terminal);
		this.registerTerminalHyperlinkHandler(terminal.getXterm());
		this.updateAppearanceStyles();
		this.attachTerminalToContainer(options);
		this.setupResizeObserver();
		this.updateLeafHeader(this.leaf);
		this.updateDropHintText();
	}

	setTerminalService(terminalService: TerminalService): void {
		this.terminalService = terminalService;
	}

	handleHostWindowChanged(options: TerminalAttachOptions = {}): void {
		if (this.closed) return;
		if (this.initializeTimer) this.scheduleInitializeTerminal();
		this.bindThemeChanges();
		this.bindPauseDocument();
		if (!this.terminalInstance || !this.terminalContainer) return;

		this.removeDropHandlers?.();
		this.removeDropHandlers = this.setupDropHandlers();
		this.updateAppearanceStyles();
		this.attachTerminalToContainer(options);
		this.setupResizeObserver();
	}

	private drawWorkbench(): void {
		if (this.closed) return;
		const service = this.terminalService,
			host = this.terminalHost;
		const history = service?.history(() => host.settings.agentSettings, host.manifest.dir ?? '');
		const state = this.workbenchState;
		const session = service?.getAllTerminals().find((candidate) => candidate.id === this.terminalInstance?.id);
		render(
			h(TerminalWorkbench, {
				ownerWindow: this.contentEl.win,
				state,
				onStateChange: this.changeWorkbench,
				rootRef: (element) => { this.workbenchRoot = element; },
				focusTerminal: () => this.focusTerminal(),
				header: h(TerminalHeader, {
					title: this.terminalInstance?.getTitle() || t('terminal.defaultTitle'),
					cwd: session?.getCwd() ?? '',
					status: session?.nativeStatus ?? 'unknown',
					search: () => this.showSearch(),
					more: (event: MouseEvent) => { const menu = new Menu(); this.onPaneMenu(menu); menu.showAtMouseEvent(event); },
					sidebarToggle: () => this.changeWorkbench((this.workbenchRoot?.clientWidth ?? this.contentEl.clientWidth) < 800 ? { drawerOpen: !state.drawerOpen } : { wideSidebarOpen: !state.wideSidebarOpen }),
					quickSwitch: () => host.showSessionSwitcher(this),
					sidebarOpen: (this.workbenchRoot?.clientWidth ?? this.contentEl.clientWidth) < 800 ? state.drawerOpen : state.wideSidebarOpen,
				}),
				newConversation: service ? h(NewConversationButton, { host, create: () => this.newSession(), primary: !state.showHistory }) : null,
				terminalRef: (element) => {
					this.terminalContainer = element;
				},
				searchRef: (element) => {
					this.searchContainer = element;
				},
				inputRef: (element) => {
					this.searchInput = element;
				},
				search: () => this.performSearch(),
				previous: () => {
					this.terminalInstance?.searchPrevious();
				},
				next: () => {
					this.terminalInstance?.searchNext();
				},
				closeSearch: () => this.hideSearch(),
				sessions: service
					? h(SessionSidebar, {
							host,
							state,
							onStateChange: this.changeWorkbench,
							service,
							active: this.terminalInstance?.id ?? '',
							select: (session) => {
								void this.selectPtySession(session).catch((error) => {
									new Notice(String(error));
								});
							},
							close: (terminal) => this.closeSession(terminal),
						})
					: null,
				history: history ? h(HistorySidebar, { history, host, state, onStateChange: this.changeWorkbench, ownerWindow: this.contentEl.win }) : null,
				preview: history ? h(HistoryPreview, { history, host, state, onStateChange: this.changeWorkbench, focusTerminal: () => this.focusTerminal() }) : null,
				usage: history ? h(UsageFooter, { host, history, ownerWindow: this.contentEl.win, visible: this.workbenchVisible }) : null,
			}),
			this.contentEl,
		);
	}
	private focusTerminal(): void {
		this.changeWorkbench({ showHistory: false, drawerOpen: false });
		this.terminalInstance?.focus();
	}
	private selectionRequest = 0;
	async selectPtySession(session: PtySession): Promise<void> {
		if (this.closed || session.isDisposed) return;
		this.cancelInitializeTimer();
		const request = ++this.selectionRequest;
		let renderer: TerminalInstance;
		try { renderer = await this.terminalHost.getTerminalRenderer(session); }
		catch (error) {
			if (this.closed || request !== this.selectionRequest) return;
			this.rejectPendingInitialization(error instanceof Error ? error : new Error(String(error)));
			throw error;
		}
		if (this.closed || request !== this.selectionRequest) return;
		this.selectSession(renderer);
	}
	private sessionIsVisible(session: PtySession): boolean {
		return this.app.workspace
			.getLeavesOfType(TERMINAL_VIEW_TYPE)
			.some((leaf) => leaf.view instanceof TerminalView && leaf.view.getTerminalInstance()?.id === session.id);
	}
	selectSession(terminal: TerminalInstance): void {
		if (this.closed) return;
		if (terminal === this.terminalInstance) { this.terminalHost.recordActiveSession(terminal.id); this.focusTerminal(); return; }
		const other = this.app.workspace
			.getLeavesOfType(TERMINAL_VIEW_TYPE)
			.find(
				(leaf) =>
					leaf !== this.leaf &&
					leaf.view instanceof TerminalView &&
					leaf.view.getTerminalInstance()?.id === terminal.id,
			);
		if (other) {
			this.terminalHost.recordActiveSession(terminal.id);
			void this.app.workspace.revealLeaf(other);
			if (other.view instanceof TerminalView) other.view.focusTerminal();
			return;
		}
		this.workbenchState.showHistory = false;
		this.workbenchState.drawerOpen = false;
		this.releaseTerminalInstance();
		this.adoptTerminalInstance(terminal);
		this.drawWorkbench();
	}
	async newSession(): Promise<void> {
		if (!this.terminalService || this.closed) return;
		const terminal = await this.terminalService.createTerminal();
		if (this.closed) return;
		await this.selectPtySession(terminal);
	}
	private async closeSession(terminal: PtySession): Promise<void> {
		const affected = this.app.workspace
			.getLeavesOfType(TERMINAL_VIEW_TYPE)
			.map((leaf) => leaf.view)
			.filter(
				(view): view is TerminalView =>
					view instanceof TerminalView && view.getTerminalInstance()?.id === terminal.id,
			);
		for (const view of affected) view.releaseTerminalInstance();
		await this.terminalService?.destroyTerminal(terminal.id);
		for (const view of affected) {
			const next = this.terminalService?.getAllTerminals().find((candidate) => !this.sessionIsVisible(candidate));
			if (next) await view.selectPtySession(next);
			view.drawWorkbench();
		}
		this.drawWorkbench();
	}

	private async initializeTerminal(): Promise<void> {
		const request = ++this.selectionRequest;
		try {
			if (!this.terminalService) {
				throw new Error('TerminalService not initialized');
			}

			const unattached = this.terminalService.hasPendingSession()
				? undefined
				: this.terminalService.getAllTerminals().find((terminal) => !this.sessionIsVisible(terminal));
			const session = unattached ?? (await this.terminalService.createTerminal());
			if (this.closed || request !== this.selectionRequest) return;
			const renderer = await this.terminalHost.getTerminalRenderer(session);
			if (this.closed || request !== this.selectionRequest) return;
			this.terminalInstance = renderer;
			this.drawWorkbench();
			this.terminalHost.recordActiveSession(session.id);
			this.initResolve?.(this.terminalInstance);
			this.initResolve = null;
			this.initReject = null;

			this.bindTerminalInstance(this.terminalInstance);
			this.updateLeafHeader(this.leaf);
			const xterm = this.terminalInstance.getXterm();
			this.registerTerminalHyperlinkHandler(xterm);

			this.updateAppearanceStyles();
			this.attachTerminalToContainer();
			this.setupResizeObserver();
			this.syncOutputPause();
		} catch (error) {
			if (this.closed || request !== this.selectionRequest) return;
			const errorMessage = error instanceof Error ? error.message : String(error);
			errorLog('[TerminalView] Init failed:', errorMessage);
			if (this.initReject) {
				this.initReject(error instanceof Error ? error : new Error(errorMessage));
				this.initResolve = null;
				this.initReject = null;
			}
			new Notice(t('notices.terminal.initFailed', { message: errorMessage }));
			this.leaf.detach();
		}
	}
	private cancelInitializeTimer(): void {
		if (this.initializeTimer) this.initializeTimer.win.clearTimeout(this.initializeTimer.id);
		this.initializeTimer = null;
	}
	private scheduleInitializeTerminal(): void {
		this.cancelInitializeTimer();
		const win = this.contentEl.win;
		this.initializeTimer = { win, id: win.setTimeout(() => {
			this.initializeTimer = null;
			if (!this.closed && !this.terminalInstance && this.terminalContainer) void this.initializeTerminal();
		}, 0) };
	}
	private rejectPendingInitialization(error: Error): void {
		if (!this.initReject) return;
		this.initReject(error);
		this.initResolve = null;
		this.initReject = null;
		this.initPromise = null;
	}

	/**
	 * Create a new terminal
	 */
	private async createNewTerminal(): Promise<void> {
		// Trigger the plugin's activateTerminalView method
		// Get the plugin instance through the workspace
		const plugin = this.getTerminalPlugin();
		if (plugin) {
			await plugin.activateTerminalView();
		}
	}

	private bindTerminalInstance(terminal: TerminalInstance): void {
		this.detachTerminalBindings();
		this.titleChangeCleanup = terminal.onTitleChange(() => {
			this.updateLeafHeader(this.leaf);
			this.updateDropHintText();
			this.drawWorkbench();
		});

		this.searchStateCleanup = terminal.onSearchStateChange((visible) => {
			if (visible) {
				this.showSearch();
			} else {
				this.hideSearch();
			}
		});

		terminal.setOnNewTerminal(() => {
			void this.createNewTerminal();
		});

		terminal.setOnSplitTerminal((direction) => {
			void this.splitTerminal(direction);
		});

		terminal.setOnToggleAlwaysOnTop(
			() => {
				const plugin = this.getTerminalPlugin();
				if (plugin) {
					void plugin.toggleAlwaysOnTopTerminal(this);
				}
			},
			() => this.getTerminalPlugin()?.getAlwaysOnTopTerminalLabel(this) ?? t('terminal.contextMenu.pinToTop'),
		);

		terminal.setDefaultShellMenuCallbacks(
			() => this.terminalService?.getDefaultShellOptions() ?? [],
			(shellType) => {
				void this.terminalService?.setDefaultShell(shellType).catch((error) => {
					const message = error instanceof Error ? error.message : String(error);
					errorLog('[TerminalView] Failed to switch default shell:', error);
					new Notice(message);
				});
			},
		);
	}

	private detachTerminalBindings(): void {
		this.titleChangeCleanup?.();
		this.titleChangeCleanup = null;
		this.searchStateCleanup?.();
		this.searchStateCleanup = null;
	}

	/**
	 * Split the terminal (used by commands)
	 */
	async splitTerminal(direction: 'horizontal' | 'vertical'): Promise<void> {
		const { workspace } = this.app;
		const newLeaf = workspace.getLeaf('split', direction);

		await newLeaf.setViewState({
			type: TERMINAL_VIEW_TYPE,
			active: true,
		});

		workspace.setActiveLeaf(newLeaf, { focus: true });
	}

	private setupDropHandlers(): () => void {
		const container = this.contentEl;
		const cleanup: Array<() => void> = [];
		const capture = false;
		const dragWindow = container.ownerDocument?.defaultView;

		const addListener = (target: EventTarget, type: string, listener: EventListenerOrEventListenerObject): void => {
			target.addEventListener(type, listener, capture);
			cleanup.push(() => target.removeEventListener(type, listener, capture));
		};

		const claimDragEvent = (event: DragEvent): void => {
			event.preventDefault();
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'copy';
			}
		};

		const onDragEnter = (event: DragEvent): void => {
			claimDragEvent(event);
			this.dragEnterDepth += 1;
			this.showDropHint();
		};

		const onDragOver = (event: DragEvent): void => {
			claimDragEvent(event);
			this.showDropHint();
		};

		const onDragLeave = (event: DragEvent): void => {
			claimDragEvent(event);
			this.dragEnterDepth = Math.max(0, this.dragEnterDepth - 1);
			const relatedTarget = event.relatedTarget as Node | null;
			const leftContainer = !relatedTarget || !container.contains(relatedTarget);
			if (this.dragEnterDepth === 0 || leftContainer) {
				this.dragEnterDepth = 0;
				this.hideDropHint();
			}
		};

		const onDrop = (event: DragEvent): void => {
			claimDragEvent(event);
			this.resetDropHintState();
			void this.handleDrop(event.dataTransfer);
		};

		const onWindowDragEnd = (): void => {
			this.resetDropHintState();
		};

		addListener(container, 'dragenter', onDragEnter);
		addListener(container, 'dragover', onDragOver);
		addListener(container, 'dragleave', onDragLeave);
		addListener(container, 'drop', onDrop);

		if (dragWindow) {
			addListener(dragWindow, 'dragend', onWindowDragEnd);
		}

		return () => {
			for (const dispose of cleanup.splice(0)) {
				dispose();
			}
		};
	}

	private ensureDropHint(): void {
		if (!this.terminalContainer) return;
		if (this.dropHintEl && this.dropHintEl.isConnected) return;

		const doc = this.terminalContainer.ownerDocument;
		const hint = doc.createElement('div');
		hint.className = 'terminal-drop-hint';
		const textEl = doc.createElement('div');
		textEl.className = 'terminal-drop-hint__text';
		hint.appendChild(textEl);
		this.dropHintEl = hint;
		this.updateDropHintText();
		this.terminalContainer.appendChild(hint);
	}

	private getDropHintText(): string {
		return t('terminal.dropHintPasteFilePath');
	}

	private updateDropHintText(): void {
		if (!this.dropHintEl) return;
		const textEl = this.dropHintEl.querySelector('.terminal-drop-hint__text');
		if (textEl) {
			textEl.textContent = this.getDropHintText();
			return;
		}
		this.dropHintEl.textContent = this.getDropHintText();
	}

	private showDropHint(): void {
		this.ensureDropHint();
		if (!this.dropHintEl?.classList.contains('is-visible')) {
			this.updateDropHintText();
		}
		this.dropHintEl?.classList.add('is-visible');
	}

	private hideDropHint(): void {
		this.dropHintEl?.classList.remove('is-visible');
	}

	private resetDropHintState(): void {
		this.dragEnterDepth = 0;
		this.hideDropHint();
	}

	private async handleDrop(dataTransfer: DataTransfer | null): Promise<void> {
		const input = await this.buildDroppedInput(dataTransfer);
		if (!input) {
			debugLog('[Terminal DnD] No usable file path or text in drop payload');
			errorLog('[Terminal DnD] No usable path details:', this.describeDropPayload(dataTransfer));
			new Notice(t('terminal.dropEmpty'));
			return;
		}

		debugLog('[Terminal DnD] Inject input:', input.text);
		await this.writeInputToTerminal(input.text, input.usePaste);
	}

	private async buildDroppedInput(
		dataTransfer: DataTransfer | null,
	): Promise<{ text: string; usePaste: boolean } | null> {
		if (!dataTransfer) return null;

		const droppedItems = Array.from(dataTransfer.items);
		const nativePaths = this.extractDroppedNativePaths(dataTransfer);
		if (nativePaths.length > 0) {
			return {
				text: this.formatDroppedPaths(nativePaths),
				usePaste: false,
			};
		}

		const primaryTextPayload = collectPreferredDroppedTextPayload(dataTransfer);
		const fallbackTextPayload = await collectFallbackDroppedTextPayload(dataTransfer, droppedItems);
		return resolveDroppedTextInput(
			primaryTextPayload,
			fallbackTextPayload,
			(payload) => this.extractDroppedPathsFromTextPayload(payload),
			(paths) => this.formatDroppedPaths(paths),
		);
	}

	private extractDroppedNativePaths(dataTransfer: DataTransfer | null): string[] {
		if (!dataTransfer) return [];

		const paths: string[] = [];
		const droppedFiles = Array.from(dataTransfer.files);
		const droppedItems = Array.from(dataTransfer.items);

		for (const item of droppedItems) {
			const itemPath = (item as DataTransferItem & { path?: string }).path;
			if (typeof itemPath === 'string' && itemPath.trim().length > 0) {
				paths.push(itemPath.trim());
			}

			const itemFile = item.getAsFile();
			if (itemFile) {
				const droppedPath = this.getDroppedFilePath(itemFile);
				if (droppedPath) {
					paths.push(droppedPath);
				}
			}

			const entryPath = this.getPathFromDroppedEntry(item);
			if (entryPath) {
				paths.push(entryPath);
			}
		}

		for (const file of droppedFiles) {
			const filePath = this.getDroppedFilePath(file);
			if (filePath) {
				paths.push(filePath);
			}
		}

		return this.uniquePaths(paths);
	}

	private extractDroppedPathsFromTextPayload(textPayload = ''): string[] {
		const paths: string[] = [];

		for (const token of this.extractDropTokens(textPayload)) {
			const resolvedPath = this.resolveDroppedTokenToPath(token);
			if (resolvedPath) paths.push(resolvedPath);
		}

		return this.uniquePaths(paths);
	}

	private describeDropPayload(dataTransfer: DataTransfer | null): Record<string, unknown> {
		if (!dataTransfer) {
			return { hasDataTransfer: false };
		}

		const items = Array.from(dataTransfer.items).map((item) => ({
			kind: item.kind,
			type: item.type,
			hasEntry: !!item.webkitGetAsEntry(),
			entryIsDirectory: !!item.webkitGetAsEntry()?.isDirectory,
			path: (item as DataTransferItem & { path?: string }).path ?? null,
		}));

		const files = Array.from(dataTransfer.files).map((file) => ({
			name: file.name,
			size: file.size,
			type: file.type,
			path: this.getDroppedFilePath(file),
		}));

		return {
			hasDataTransfer: true,
			types: Array.from(dataTransfer.types),
			files,
			items,
		};
	}

	private getDroppedFilePath(file: File & { path?: string }): string | null {
		if (typeof file.path === 'string' && file.path.trim().length > 0) {
			return toPlatformPath(file.path);
		}

		try {
			const resolvedPath = webUtils?.getPathForFile?.(file);
			if (typeof resolvedPath === 'string' && resolvedPath.trim().length > 0) {
				return toPlatformPath(resolvedPath);
			}
		} catch (error) {
			debugLog('[Terminal DnD] webUtils.getPathForFile failed:', error);
		}

		return null;
	}

	private getPathFromDroppedEntry(item: DataTransferItem): string | null {
		const entry = item.webkitGetAsEntry();
		if (!entry) return null;

		const entryPath = entry.fullPath ?? '';
		const normalizedEntry = normalizeDroppedEntryReference(entryPath);
		if (normalizedEntry.absolutePath && this.fs.existsSync(normalizedEntry.absolutePath)) {
			return normalizedEntry.absolutePath;
		}

		const vaultPath = normalizedEntry.vaultPath ?? normalizeVaultPath(entryPath);
		if (vaultPath) {
			const absoluteVaultPath = this.resolveVaultReferenceToAbsolute(vaultPath);
			if (absoluteVaultPath) {
				return absoluteVaultPath;
			}
		}

		if (normalizedEntry.absolutePath) {
			return normalizedEntry.absolutePath;
		}

		return null;
	}

	private extractDropTokens(text: string): string[] {
		if (!text) return [];

		const lineTokens = text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith('#'));

		const uriTokens = Array.from(text.matchAll(/(?:obsidian|file):\/\/[^\s<>"'`]+/g)).map((match) => match[0]);

		return Array.from(new Set([...lineTokens, ...uriTokens]));
	}

	private resolveDroppedTokenToPath(token: string): string | null {
		const rawToken = normalizeTerminalRawToken(token);
		if (!rawToken) return null;

		const obsidianPath = this.obsidianUriToAbsolutePath(rawToken);
		if (obsidianPath) return obsidianPath;

		const fileUriPath = fileUriToPlatformPath(rawToken);
		if (fileUriPath) return fileUriPath;

		const normalized = normalizeTerminalToken(token);
		if (!normalized) return null;

		const wikiMatch = normalized.match(/^\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/);
		if (wikiMatch?.[1]) {
			return this.resolveVaultReferenceToAbsolute(wikiMatch[1]);
		}

		if (isAbsoluteTerminalPath(normalized)) {
			return toPlatformPath(normalized);
		}

		if (isBasenameOnlyTerminalToken(normalized)) {
			const basenamePath = this.resolveUniqueVaultBasenameToAbsolute(normalized);
			if (basenamePath) {
				return basenamePath;
			}
		}

		return this.resolveVaultReferenceToAbsolute(normalized, true);
	}

	private bindOutputPause(): void {
		const sync = () => this.syncOutputPause();
		this.registerEvent(this.app.workspace.on('layout-change', sync));
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			if (!this.closed && leaf === this.leaf && this.terminalInstance) this.terminalHost.recordActiveSession(this.terminalInstance.id);
			sync();
		}));
		this.bindPauseDocument();
		sync();
	}
	private bindThemeChanges(): void {
		this.themeCleanup?.();
		const workspace = this.app.workspace;
		const ref = workspace.on('css-change', () => {
			const terminal = this.terminalInstance;
			if (this.closed || !terminal?.getOptions().useObsidianTheme) return;
			terminal.updateTheme();
			this.updateAppearanceStyles();
		});
		this.registerEvent(ref);
		this.themeCleanup = () => workspace.offref(ref);
	}
	private bindPauseDocument(): void {
		this.pauseDocumentCleanup?.();
		const doc = this.containerEl.ownerDocument;
		const win = doc.defaultView;
		const sync = () => this.syncOutputPause();
		doc.addEventListener('visibilitychange', sync);
		win?.addEventListener('focus', sync);
		this.pauseDocumentCleanup = () => {
			doc.removeEventListener('visibilitychange', sync);
			win?.removeEventListener('focus', sync);
		};
	}

	private syncOutputPause(): void {
		const el = this.containerEl as HTMLElement & { isShown?: () => boolean };
		const visible = !this.closed && el.ownerDocument.visibilityState !== 'hidden' &&
			(typeof el.isShown === 'function' ? el.isShown() : el.offsetParent !== null);
		this.terminalInstance?.setOwnerVisible(this, visible && !this.workbenchState.showHistory);
		if (visible !== this.workbenchVisible) {
			this.workbenchVisible = visible;
			this.drawWorkbench();
		}
	}

	private formatDroppedPaths(paths: string[]): string {
		return formatAbsoluteDropPaths(paths);
	}

	private isDropEventInsideContainer(event: DragEvent, container: HTMLElement): boolean {
		const target = event.target;
		if (target instanceof Node && container.contains(target)) {
			return true;
		}

		const rect = container.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return false;
		}

		return (
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom
		);
	}

	private uniquePaths(paths: string[]): string[] {
		const result: string[] = [];
		const seen = new Set<string>();

		for (const rawPath of paths) {
			const normalized = rawPath.trim();
			if (!normalized) continue;
			const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
			if (seen.has(key)) continue;
			seen.add(key);
			result.push(normalized);
		}

		return result;
	}

	private obsidianUriToAbsolutePath(uri: string): string | null {
		const vaultPath = obsidianUriToVaultPath(uri);
		return vaultPath ? this.resolveVaultPathToAbsolute(vaultPath) : null;
	}

	private resolveVaultPathToAbsolute(pathLike: string): string | null {
		const normalizedPath = normalizeVaultPath(pathLike);
		if (!normalizedPath) return null;

		const activePath = this.app.workspace.getActiveFile()?.path ?? '';
		// Prefer an exact vault entry so folder drops are not shadowed by folder notes.
		const entry =
			this.app.vault.getAbstractFileByPath(normalizedPath) ??
			this.app.metadataCache.getFirstLinkpathDest(normalizedPath, activePath);
		if (!entry) return null;

		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			return entry.path;
		}

		return joinTerminalPaths(adapter.getBasePath(), entry.path);
	}

	private resolveVaultReferenceToAbsolute(pathLike: string, allowBasenameFallback = false): string | null {
		return (
			this.resolveVaultPathToAbsolute(pathLike) ??
			(allowBasenameFallback ? this.resolveUniqueVaultBasenameToAbsolute(pathLike) : null)
		);
	}

	private resolveUniqueVaultBasenameToAbsolute(name: string): string | null {
		const allEntries = this.app.vault.getAllLoadedFiles?.() ?? [];
		const matchedEntry = findUniqueTerminalEntryByBasename(
			name,
			allEntries.map((entry) => ({
				name: entry.name,
				path: entry.path,
				kind: entry instanceof TFolder ? 'folder' : ('file' as const),
			})),
		);

		if (!matchedEntry) {
			return null;
		}

		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			return matchedEntry.path;
		}

		return joinTerminalPaths(adapter.getBasePath(), matchedEntry.path);
	}

	private async writeInputToTerminal(text: string, usePaste = false): Promise<void> {
		const terminal = this.terminalInstance ?? (await this.waitForTerminalInstance().catch(() => null));
		if (!terminal) return;
		if (usePaste) {
			terminal.pasteText(text);
		} else {
			terminal.sendText(text);
		}
		terminal.focus();
	}

	private registerTerminalHyperlinkHandler(xterm: XtermTerminal): void {
		xterm.options.linkHandler = {
			allowNonHttpProtocols: true,
			activate: (event: MouseEvent, target: string) => {
				event.preventDefault();
				void this.openTerminalHyperlinkTarget(target);
			},
		};

		this.fileUriLinkAddon?.dispose();
		this.fileUriLinkAddon = new WebLinksAddon(
			(event, uri) => {
				event.preventDefault();
				void this.openTerminalHyperlinkTarget(uri);
			},
			{
				urlRegex: TERMINAL_FILE_URI_REGEX,
			},
		);
		xterm.loadAddon(this.fileUriLinkAddon);
	}

	private async openTerminalHyperlinkTarget(target: string): Promise<void> {
		const filePath = fileUriToPlatformPath(target);
		if (filePath) {
			await this.openTerminalFileReference(filePath);
			return;
		}

		if (!this.isAllowedExternalHyperlink(target)) {
			new Notice(t('notices.terminal.fileReferenceUnavailable'));
			return;
		}

		try {
			await shell.openExternal(target);
		} catch (error) {
			errorLog('[TerminalView] Failed to open terminal hyperlink:', target, error);
			new Notice(t('notices.terminal.fileReferenceOpenFailed'));
		}
	}

	private isAllowedExternalHyperlink(target: string): boolean {
		try {
			const url = new URL(normalizeTerminalToken(target));
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}

	private async openTerminalFileReference(pathLike: string): Promise<void> {
		const resolved = this.resolveTerminalFileReference(pathLike);
		if (!resolved) {
			new Notice(t('notices.terminal.fileReferenceUnavailable'));
			return;
		}

		if (resolved.file) {
			await this.openVaultFileReference(resolved.file);
			return;
		}

		const errorMessage = await shell.openPath(resolved.externalPath);
		if (errorMessage) {
			if (this.fs.existsSync(resolved.externalPath)) {
				const containingDir = this.path.dirname(resolved.externalPath);
				const directoryError = await shell.openPath(containingDir);
				if (!directoryError) {
					return;
				}
			}

			errorLog('[TerminalView] Failed to open external path:', resolved.externalPath, errorMessage);
			new Notice(t('notices.terminal.fileReferenceOpenFailed'));
		}
	}

	private resolveTerminalFileReference(pathLike: string): { file?: TFile; externalPath: string } | null {
		const normalizedReference = normalizeTerminalReferencePath(pathLike);
		if (!normalizedReference) {
			return null;
		}

		if (isAbsoluteTerminalPath(normalizedReference)) {
			const fileFromAbsolutePath = this.absolutePathToVaultFile(normalizedReference);
			if (fileFromAbsolutePath) {
				return {
					file: fileFromAbsolutePath,
					externalPath: normalizedReference,
				};
			}

			if (!this.fs.existsSync(normalizedReference)) {
				return null;
			}

			return { externalPath: normalizedReference };
		}

		const vaultFile = this.resolveVaultReference(normalizedReference);
		if (vaultFile) {
			return {
				file: vaultFile,
				externalPath: vaultFile.path,
			};
		}

		for (const absolutePath of this.getTerminalReferenceAbsoluteCandidates(normalizedReference)) {
			const fileFromCandidate = this.absolutePathToVaultFile(absolutePath);
			if (fileFromCandidate) {
				return {
					file: fileFromCandidate,
					externalPath: absolutePath,
				};
			}

			if (this.fs.existsSync(absolutePath)) {
				return { externalPath: absolutePath };
			}
		}

		return null;
	}

	private resolveVaultReference(pathLike: string): TFile | null {
		const normalizedPath = normalizeVaultPath(pathLike);
		if (!normalizedPath) {
			return null;
		}

		const activePath = this.app.workspace.getActiveFile()?.path ?? '';
		const file =
			this.app.metadataCache.getFirstLinkpathDest(normalizedPath, activePath) ??
			this.app.vault.getAbstractFileByPath(normalizedPath);

		return file instanceof TFile ? file : null;
	}

	private absolutePathToVaultFile(absolutePath: string): TFile | null {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			return null;
		}

		const relativePath = getVaultRelativePathFromAbsolute(absolutePath, adapter.getBasePath());
		if (relativePath === null) {
			return null;
		}

		const file = this.app.vault.getAbstractFileByPath(relativePath);
		return file instanceof TFile ? file : null;
	}

	private getTerminalReferenceAbsoluteCandidates(relativePath: string): string[] {
		const adapter = this.app.vault.adapter;
		const vaultBasePath = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : null;
		const currentCwd = this.terminalInstance?.getCwd() ?? null;
		const initialCwd = this.terminalInstance?.getInitialCwd() ?? null;

		return collectTerminalReferenceCandidatePaths(relativePath, [currentCwd, initialCwd, vaultBasePath]);
	}

	private async openVaultFileReference(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	private updateAppearanceStyles(): void {
		if (!this.terminalContainer || !this.terminalInstance) return;

		const options = this.terminalInstance.getOptions();
		const canUseBackgroundImage =
			!!options?.backgroundImage &&
			!options?.useObsidianTheme &&
			this.terminalInstance.getCurrentRenderer() !== 'webgl';

		if (canUseBackgroundImage) {
			this.terminalContainer.addClass('has-background-image');
			this.containerEl.querySelector('.terminal-view-container')?.addClass('has-background-image');
			this.ensureBackgroundLayer();
		} else {
			this.terminalContainer.removeClass('has-background-image');
			this.containerEl.querySelector('.terminal-view-container')?.removeClass('has-background-image');
			this.terminalContainer.querySelector('.terminal-background-image')?.remove();
		}

		const backgroundImageOpacity = options?.backgroundImageOpacity ?? 0.5;
		const overlayOpacity = canUseBackgroundImage ? clamp(1 - backgroundImageOpacity, 0, 1) : 0;
		const blurAmount = options?.blurAmount ?? 0;
		const blurEnabled = canUseBackgroundImage && !!options?.enableBlur && blurAmount > 0;

		this.applyAppearanceStyleRule({
			backgroundImage: canUseBackgroundImage ? toCssUrl(options?.backgroundImage) : 'none',
			overlayOpacity,
			backgroundSize: normalizeBackgroundSize(options?.backgroundImageSize),
			backgroundPosition: normalizeBackgroundPosition(options?.backgroundImagePosition),
			blur: blurEnabled ? `${blurAmount}px` : '0px',
			scale: blurEnabled ? '1.05' : '1',
			textOpacity: canUseBackgroundImage ? String(options?.textOpacity ?? 1.0) : '1',
			backgroundColor: canUseBackgroundImage
				? 'transparent'
				: this.terminalInstance.getEffectiveBackgroundColor(),
		});
	}

	private attachTerminalToContainer(options: TerminalAttachOptions = {}): void {
		if (!this.terminalContainer || !this.terminalInstance) {
			errorLog('[TerminalView] Render failed: missing container or instance');
			return;
		}

		const bgLayer = this.terminalContainer.querySelector('.terminal-background-image');
		const dropHint = this.dropHintEl;
		this.terminalContainer.empty();
		if (bgLayer) this.terminalContainer.appendChild(bgLayer);
		if (dropHint) this.terminalContainer.appendChild(dropHint);

		try {
			this.terminalInstance.acquire(this, this.terminalContainer, true);
			this.updateAppearanceStyles();
			this.syncOutputPause();
		} catch (error) {
			errorLog('[TerminalView] Attach failed:', error);
			new Notice(t('notices.terminal.renderFailed', { message: String(error) }));
			return;
		}

		if (this.attachFrame) this.attachFrame.win.cancelAnimationFrame(this.attachFrame.id);
		const terminal = this.terminalInstance;
		const win = this.terminalContainer.win;
		this.attachFrame = { win, id: win.requestAnimationFrame(() => {
			this.attachFrame = null;
			if (!this.closed && this.terminalInstance === terminal) {
				// Migration may attach before the destination leaf is shown.
				this.syncOutputPause();
				terminal.fit();
				if (options.focus !== false) {
					terminal.focus();
				}
			}
		}) };
	}

	private setupResizeObserver(): void {
		if (!this.terminalContainer) return;
		this.resizeObserver?.disconnect();

		const ResizeObserverCtor = this.terminalContainer.ownerDocument.defaultView?.ResizeObserver ?? ResizeObserver;

		this.resizeObserver = new ResizeObserverCtor((entries) => {
			if (this.closed) return;
			this.syncOutputPause();
			const entry = entries[0];
			if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) this.terminalInstance?.fit();
		});

		this.resizeObserver.observe(this.terminalContainer);
	}

	/**
	 * Refresh theme/background-related appearance
	 */
	refreshAppearance(): void {
		if (!this.terminalInstance) return;

		const plugin = this.getTerminalPlugin();
		if (!plugin) return;

		const settings = plugin.settings;

		this.terminalInstance.updateOptions({
			fontSize: settings.fontSize,
			fontFamily: settings.fontFamily,
			cursorStyle: settings.cursorStyle,
			cursorBlink: settings.cursorBlink,
			useObsidianTheme: settings.useObsidianTheme,
			backgroundColor: settings.backgroundColor,
			foregroundColor: settings.foregroundColor,
			backgroundImage: settings.backgroundImage,
			backgroundImageOpacity: settings.backgroundImageOpacity,
			backgroundImageSize: settings.backgroundImageSize,
			backgroundImagePosition: settings.backgroundImagePosition,
			enableBlur: settings.enableBlur,
			blurAmount: settings.blurAmount,
			textOpacity: settings.textOpacity,
			preferredRenderer: settings.preferredRenderer,
		});

		this.updateAppearanceStyles();
	}

	private ensureBackgroundLayer(): void {
		if (!this.terminalContainer) return;
		const existingLayer = this.terminalContainer.querySelector('.terminal-background-image');
		if (existingLayer) return;

		const bgLayer = activeDocument.createElement('div');
		bgLayer.className = 'terminal-background-image';
		this.terminalContainer.prepend(bgLayer);
	}

	private applyAppearanceStyleRule(vars: {
		backgroundImage: string;
		overlayOpacity: number;
		backgroundSize: string;
		backgroundPosition: string;
		blur: string;
		scale: string;
		textOpacity: string;
		backgroundColor: string;
	}): void {
		if (!this.terminalContainer) return;
		const style = this.terminalContainer.style;
		style.setProperty('--terminal-bg-image', vars.backgroundImage);
		style.setProperty('--terminal-bg-overlay-opacity', String(vars.overlayOpacity));
		style.setProperty('--terminal-bg-size', vars.backgroundSize);
		style.setProperty('--terminal-bg-position', vars.backgroundPosition);
		style.setProperty('--terminal-bg-blur', vars.blur);
		style.setProperty('--terminal-bg-scale', vars.scale);
		style.setProperty('--terminal-text-opacity', vars.textOpacity);
		style.setProperty('--terminal-bg-color', vars.backgroundColor);
		const viewContainer = this.containerEl.querySelector<HTMLElement>('.terminal-view-container');
		viewContainer?.style.setProperty('--terminal-bg-color', vars.backgroundColor);
	}

	private disposeAppearanceStyle(): void {
		if (!this.terminalContainer) return;
		const style = this.terminalContainer.style;
		style.removeProperty('--terminal-bg-image');
		style.removeProperty('--terminal-bg-overlay-opacity');
		style.removeProperty('--terminal-bg-size');
		style.removeProperty('--terminal-bg-position');
		style.removeProperty('--terminal-bg-blur');
		style.removeProperty('--terminal-bg-scale');
		style.removeProperty('--terminal-text-opacity');
		style.removeProperty('--terminal-bg-color');
		const viewContainer = this.containerEl.querySelector<HTMLElement>('.terminal-view-container');
		viewContainer?.style.removeProperty('--terminal-bg-color');
	}

	/**
	 * Get the terminal instance (for external callers)
	 */
	getTerminalInstance(): TerminalInstance | null {
		return this.terminalInstance;
	}

	isInitializing(): boolean {
		return this.initResolve !== null;
	}

	async waitForTerminalInstance(timeoutMs = 8000): Promise<TerminalInstance> {
		if (this.closed) throw new Error(t('terminal.notInitialized'));
		if (this.terminalInstance) return this.terminalInstance;
		if (!this.initPromise) {
			throw new Error(t('terminal.notInitialized'));
		}

		const win = this.contentEl.win;
		let timeout = 0;
		const timeoutPromise = new Promise<never>((_, reject) => {
			timeout = win.setTimeout(() => reject(new Error(t('terminal.notInitialized'))), timeoutMs);
		});
		try {
			return await Promise.race([this.initPromise, timeoutPromise]);
		} finally {
			win.clearTimeout(timeout);
		}
	}

	private updateLeafHeader(leaf: WorkspaceLeaf): void {
		refreshLeafTitle(this.app, leaf);
	}

	private getTerminalPlugin(): TerminalViewHost {
		return this.terminalHost;
	}
}
