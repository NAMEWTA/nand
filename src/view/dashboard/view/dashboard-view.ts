import { applyControlContrast } from '../appearance/appearance';
import { Events, HoverParent, HoverPopover, ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { h } from 'preact';
import type { DashboardUpdateSource } from '../../../core/dashboard/render-update';
import type { BannerData, DashboardCard, DashboardData, QuickAction } from '../../../core/dashboard/types/index';
import type { HolidayInfo } from '../../../platform/obsidian/calendar/holiday-service';
import { SyncEngine } from '../../../platform/obsidian/dashboard/sync';
import { PomodoroService } from '../../../platform/obsidian/pomodoro/pomodoro-service';
import { ReadingService } from '../../../platform/obsidian/reading/reading-service';
import { onLeafLanguageChanged } from '../../../platform/obsidian/workspace-title';
import { t } from '../../../shared/i18n/index';
import type { DashboardHost } from '../host';
import type { PomodoroMiniPanel } from '../pomodoro/pomodoro-mini-panel';
import type { ReadingMiniTimer } from '../reading/reading-mini-timer';
import type { RenderCallbacks } from '../render-contract';
import { refreshDashboardLanguage } from '../renderer/render-context';
import { NotePopoverModal } from '../ui/note-popover-modal';
import { closeOwnedDashboardPanels, DashboardPanelModal } from '../ui/panel-modal';
import { AnniversaryPanel } from '../widgets/AnniversaryPanel';
import { CountdownPanel } from '../widgets/CountdownPanel';
import {
	addColumnWithType,
	deleteColumn,
	executeAction,
	handleCardNewNote,
	handleLibraryNewNote,
	handleMoveCard,
	navigateToPath,
	openAddActionModal,
	openAddSectionModal,
	openBannerEditModal,
	openCardEditModal,
	openDataviewConfigModal,
	openEditActionModal,
	openFolderConfigModal,
	openLibraryConfigModal,
	openMediaConfigModal,
	openNote,
	openNoteInTab,
	openNotePopover,
	openNotesSectionConfigModal,
	openProjectSearchModal,
	openStickyCardTypeModal,
	openTemplatePicker,
	openTrackerConfigModal,
	openWeatherConfigModal,
	openWebConfigModal,
	openWereadConfigModal,
	openWidgetTypeModal,
	promptAddColumn,
	refreshSectionInPlace,
	reorderCardsInDOM,
} from './actions';
import { renderBannerPinButton, setupBannerBehavior, setupBannerRotation } from './banner-behavior';
import { archiveCompletedTasks, createCallbacks, handleFileDrop, saveMemoAsNote, saveTasksToDaily } from './callbacks';
import {
	addSection,
	applyWorkspaceSwitch,
	handleDataUpdate,
	onClose,
	onOpen,
	refresh,
	reloadFromDisk,
	showModuleDisabled,
	toggleBannerMode,
} from './lifecycle';
import {
	closeMobileDrawer,
	openMobileDrawer,
	refreshMobileWidgetPanel,
	renderMobileActions,
	renderMobileWidgetBar,
} from './mobile';
import { render } from './render';
import {
	applySidebarSizing,
	attachSidebarWidthHandle,
	attachStripHeightHandle,
	commitSidebarSizing,
	renderSidebar,
	setupSidebarBehavior,
} from './sidebar';
import {
	checkDayRollover,
	startDayRolloverChecker,
	startWeatherRefresh,
	stopDayRolloverChecker,
	stopWeatherRefresh,
} from './timers';
import {
	debouncedRefreshBannerStats,
	flushVaultRefresh,
	onHabitChanged,
	refreshAlbumWidgetsNow,
	refreshDataWidget,
	refreshLunarWidgetsInPlace,
	refreshRecentDocs,
	refreshSectionsFor,
	refreshSidebarCalendarNow,
	registerVaultListeners,
	renderScrollToTop,
	runCleanup,
	scheduleVaultRefresh,
	unregisterVaultListeners,
} from './vault-refresh';
import { DASHBOARD_VIEW_TYPE } from './view-type';

export class DashboardView extends ItemView implements HoverParent {
	declare onOpen: () => Promise<void>;
	declare onClose: () => Promise<void>;
	declare handleDataUpdate: (data: DashboardData, source: DashboardUpdateSource) => void;
	declare refresh: () => Promise<void>;
	declare reloadFromDisk: () => Promise<void>;
	declare applyWorkspaceSwitch: () => Promise<void>;
	declare addSection: () => Promise<void>;
	declare toggleBannerMode: () => Promise<void>;
	declare render: (data: DashboardData) => void;
	declare renderMobileActions: (bannerEl: HTMLElement) => void;
	declare renderMobileWidgetBar: (container: HTMLElement) => void;
	declare refreshMobileWidgetPanel: (bar: HTMLElement) => void;
	declare openMobileDrawer: (type: 'quickActions' | 'recent') => void;
	declare closeMobileDrawer: () => void;
	declare setupBannerBehavior: (bannerEl: HTMLElement) => void;
	declare setupBannerRotation: (container: HTMLElement, banner: BannerData) => void;
	declare renderBannerPinButton: (bannerEl: HTMLElement) => void;
	declare renderSidebar: (sidebar: HTMLElement, root: HTMLElement, reuseWidgets: HTMLElement | null) => void;
	declare setupSidebarBehavior: (sidebar: HTMLElement, root: HTMLElement) => void;
	declare applySidebarSizing: (sidebar: HTMLElement) => void;
	declare attachStripHeightHandle: (sidebar: HTMLElement) => void;
	declare attachSidebarWidthHandle: (sidebar: HTMLElement) => void;
	declare commitSidebarSizing: (
		patch: { sidebarWidth?: number; widgetUnitHeight?: number },
		cssVar: string,
		value: string,
	) => void;
	declare createCallbacks: () => RenderCallbacks;
	declare handleFileDrop: (cardId: string, filePath: string) => void;
	declare saveMemoAsNote: (card: DashboardCard) => Promise<void>;
	declare saveTasksToDaily: (card: DashboardCard) => Promise<void>;
	declare archiveCompletedTasks: (columnName: string) => Promise<void>;
	declare openBannerEditModal: (data: DashboardData) => void;
	declare openCardEditModal: (card: DashboardCard) => void;
	declare openNotePopover: (file: TFile, subpath?: string, line?: number) => void;
	declare openNote: (file: TFile, subpath?: string, line?: number) => void;
	declare openNoteInTab: (file: TFile, subpath?: string, line?: number) => Promise<void>;
	declare addColumnWithType: (name: string, sectionType?: string) => Promise<void>;
	declare openAddSectionModal: () => void;
	declare openWidgetTypeModal: (colName: string) => void;
	declare openStickyCardTypeModal: (colName: string) => void;
	declare openWeatherConfigModal: (colName: string) => void;
	declare openTrackerConfigModal: (colName: string) => void;
	declare openTemplatePicker: (colName: string) => void;
	declare openLibraryConfigModal: (colName: string) => void;
	declare openDataviewConfigModal: (colName: string) => void;
	declare openWebConfigModal: (colName: string) => void;
	declare openMediaConfigModal: (colName: string) => void;
	declare openWereadConfigModal: (colName: string) => void;
	declare handleMoveCard: (cardId: string, targetCol: string, targetIdx: number) => Promise<void>;
	declare reorderCardsInDOM: (columnName: string) => boolean;
	declare refreshSectionInPlace: (columnName: string) => boolean;
	declare openFolderConfigModal: (colName: string) => void;
	declare handleCardNewNote: (cardId: string) => Promise<void>;
	declare openNotesSectionConfigModal: (colName: string) => void;
	declare handleLibraryNewNote: (columnName: string, pos?: { x: number; y: number }) => Promise<void>;
	declare openAddActionModal: () => void;
	declare openEditActionModal: (action: QuickAction) => void;
	declare deleteColumn: (columnName: string, columnIndex?: number) => Promise<void>;
	declare executeAction: (action: QuickAction) => Promise<void>;
	declare openProjectSearchModal: (colName: string) => void;
	declare promptAddColumn: () => Promise<void>;
	declare navigateToPath: (path: string) => Promise<void>;
	declare registerVaultListeners: () => void;
	declare unregisterVaultListeners: () => void;
	declare scheduleVaultRefresh: () => void;
	declare flushVaultRefresh: (paths: ReadonlySet<string>, broad: boolean) => void;
	declare refreshSidebarCalendarNow: () => void;
	declare refreshAlbumWidgetsNow: () => void;
	declare refreshSectionsFor: (
		lowerPaths: readonly string[],
		broad: boolean,
		changedMd: boolean,
		changedMedia: boolean,
	) => void;
	declare onHabitChanged: () => void;
	declare refreshLunarWidgetsInPlace: () => void;
	declare refreshDataWidget: (selector: string, render: (container: HTMLElement) => void) => void;
	declare debouncedRefreshBannerStats: () => void;
	declare refreshRecentDocs: () => void;
	declare runCleanup: (preserveSidebarWidgets?: boolean) => void;
	declare renderScrollToTop: (container: HTMLElement) => void;
	declare startWeatherRefresh: () => void;
	declare stopWeatherRefresh: () => void;
	declare startDayRolloverChecker: () => void;
	declare stopDayRolloverChecker: () => void;
	declare checkDayRollover: () => void;

	plugin: DashboardHost;
	sync: SyncEngine;
	data: DashboardData | null = null;
	cleanupFns: Array<() => void> = [];
	dndCleanupFns: Array<() => void> = [];
	suppressNextRender = false;
	vaultEventRefs: Array<{ evt: Events; ref: unknown }> = [];
	bannerStatsTimer: number | null = null;
	bannerStatsEl: HTMLElement | null = null;
	/** Vault changes accumulated across one debounce window: every changed
	 *  file path (renames contribute old AND new), plus a broad flag for
	 *  folder-level events whose own path carries no section-scope meaning.
	 *  One shared trailing debounce fans them out — see scheduleVaultRefresh. */
	vaultChangePaths = new Set<string>();
	vaultChangeBroad = false;
	vaultRefreshTimer: number | null = null;
	readonly VAULT_REFRESH_DEBOUNCE = 500;
	readonly BANNER_STATS_DEBOUNCE = 800;
	/** True after the first `metadataCache` `resolved` event corrected the
	 *  banner stats following startup. One-shot to avoid repeat recomputes. */
	bannerStatsResolvedOnce = false;
	bannerQuoteIndex = 0;
	bannerImageIndex = 0;
	sidebarPinned = this.app.loadLocalStorage('nand.dashboard.sidebar-pinned') === 'true';
	sidebarExpanded = false;
	bannerCollapsed = this.app.loadLocalStorage('nand.dashboard.banner-collapsed') === 'true';
	pendingScrollCardId: string | null = null;
	pendingScrollToLastCardOfColumn: string | null = null;
	pomodoroService: PomodoroService | null = null;
	pomodoroMiniPanel: PomodoroMiniPanel | null = null;
	readingMiniTimer: ReadingMiniTimer | null = null;
	readingService: ReadingService | null = null;
	habitUnsubscribe: (() => void) | null = null;
	holidayData: Record<string, HolidayInfo> = {};
	mobileWidgetExpanded: 'pomodoro' | 'reading' | 'lunar' | 'calendar' | 'habit' | 'expense' | null = null;
	mobileWidgetTabsOpen: boolean = false;
	weatherRefreshTimer: number | null = null;
	dayRolloverTimer: number | null = null;
	lastRenderedDay = new Date().toDateString();
	/** Sidebar widgets DOM detached from the previous render, re-attached when the
	 *  widget signature (see sidebarWidgetSignature) is unchanged - so dashboard
	 *  data mutations never rebuild the widgets. Null right after consumption. */
	sidebarWidgetsEl: HTMLElement | null = null;
	sidebarWidgetsSig: string | null = null;
	isOpening = false;
	openingPromise: Promise<void> | null = null;
	isOpen = false;
	lifecycleRevision = 0;
	pendingInitialData: DashboardData | null = null;

	// HoverParent contract: Obsidian assigns/clears this when showing a Page
	// Preview popover over a dashboard link. Declared so the dashboard can act as
	// the hover owner for `hover-link` events.
	hoverPopover: HoverPopover | null = null;

	// The currently-open centered note editor popover, if any. Tracked so it can
	// be torn down (detaching its embedded leaf) when the view closes.
	popoverModal: NotePopoverModal | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: DashboardHost) {
		super(leaf);
		this.plugin = plugin;
		this.registerEvent(this.app.workspace.on('css-change', () => {
			if (this.isOpen) applyControlContrast(this.contentEl);
		}));
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => {
			if (!this.plugin.settings.modules.dashboard) showModuleDisabled.call(this);
			else if (this.isOpen && this.data) refreshDashboardLanguage(this.contentEl);
		}));
		this.register(
			this.containerEl.onWindowMigrated(() => {
				if (!this.isOpen || !this.data) return;
				this.sidebarWidgetsSig = '';
				this.render(this.data);
			}),
		);
		this.sync = new SyncEngine(this.app, this.plugin.settings);
		this.sync.onDataUpdate((data, source) => {
			this.handleDataUpdate(data, source);
		});
	}

	getViewType(): string {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t('main.dashboard');
	}

	getIcon(): string {
		return 'home';
	}

	/** Source identities survive reordering and do not depend on translated labels. */
	async focusWidget(sourceId: string): Promise<boolean> {
		await this.openingPromise;
		if (!this.isOpen || !this.plugin.settings.modules.dashboard) return false;
		const settings = this.plugin.settings;
		const countdown = settings.countdownEnabled
			? settings.countdowns.find((entry) => `widget:${entry.id}` === sourceId)
			: undefined;
		const anniversary = settings.anniversaryEnabled
			? settings.anniversaries.find((entry) => `widget:${entry.id}` === sourceId)
			: undefined;
		if (!countdown && !anniversary) return false;
		const key = countdown ? `countdown-${countdown.id}` : `anniversary-${anniversary!.id}`;
		const widget = Array.from(this.contentEl.querySelectorAll<HTMLElement>('[data-widget-key]')).find(
			(el) => el.dataset.widgetKey === key,
		);
		closeOwnedDashboardPanels(this.app, this);
		const sidebar = widget?.closest<HTMLElement>('.dashboard-sidebar');
		if (sidebar) {
			this.sidebarExpanded = true;
			sidebar.classList.remove('dashboard-sidebar--collapsed');
			sidebar.classList.add('dashboard-sidebar--expanded');
		}
		if (widget && widget.getClientRects().length > 0) {
			widget.tabIndex = -1;
			widget.scrollIntoView({ block: 'center', inline: 'nearest' });
			widget.focus({ preventScroll: true });
			return true;
		}
		// The sidebar is hidden on phones/narrow panes; show the same panel in native chrome.
		const modal = new DashboardPanelModal(
			this.app,
			`dashboard-sidebar-widget dashboard-sidebar-${countdown ? 'countdown' : 'anniversary'}`,
			(_close, root) => {
				root.dataset.widgetKey = key;
				const win = root.ownerDocument.defaultView!;
				return countdown
					? h(CountdownPanel, { config: countdown, win })
					: h(AnniversaryPanel, { config: anniversary!, win });
			},
			this,
		);
		modal.open();
		modal.contentEl.tabIndex = -1;
		modal.contentEl.focus({ preventScroll: true });
		return true;
	}

	/** Reentrancy guard: a second toolbar click while the title prompt is open
	 *  must not stack a second dialog (overlay stacking is a known bug class). */
	libraryNewNoteInFlight = false;
	cardNewNoteInFlight = false;
}

DashboardView.prototype.onOpen = function () {
	if (this.isOpening && this.openingPromise) return this.openingPromise;
	const opening = onOpen.call(this).finally(() => {
		if (this.openingPromise === opening) this.openingPromise = null;
	});
	this.openingPromise = opening;
	return opening;
};
DashboardView.prototype.onClose = onClose;
DashboardView.prototype.handleDataUpdate = handleDataUpdate;
DashboardView.prototype.refresh = refresh;
DashboardView.prototype.reloadFromDisk = reloadFromDisk;
DashboardView.prototype.applyWorkspaceSwitch = applyWorkspaceSwitch;
DashboardView.prototype.addSection = addSection;
DashboardView.prototype.toggleBannerMode = toggleBannerMode;
DashboardView.prototype.render = render;
DashboardView.prototype.renderMobileActions = renderMobileActions;
DashboardView.prototype.renderMobileWidgetBar = renderMobileWidgetBar;
DashboardView.prototype.refreshMobileWidgetPanel = refreshMobileWidgetPanel;
DashboardView.prototype.openMobileDrawer = openMobileDrawer;
DashboardView.prototype.closeMobileDrawer = closeMobileDrawer;
DashboardView.prototype.setupBannerBehavior = setupBannerBehavior;
DashboardView.prototype.setupBannerRotation = setupBannerRotation;
DashboardView.prototype.renderBannerPinButton = renderBannerPinButton;
DashboardView.prototype.renderSidebar = renderSidebar;
DashboardView.prototype.setupSidebarBehavior = setupSidebarBehavior;
DashboardView.prototype.applySidebarSizing = applySidebarSizing;
DashboardView.prototype.attachStripHeightHandle = attachStripHeightHandle;
DashboardView.prototype.attachSidebarWidthHandle = attachSidebarWidthHandle;
DashboardView.prototype.commitSidebarSizing = commitSidebarSizing;
DashboardView.prototype.createCallbacks = createCallbacks;
DashboardView.prototype.handleFileDrop = handleFileDrop;
DashboardView.prototype.saveMemoAsNote = saveMemoAsNote;
DashboardView.prototype.saveTasksToDaily = saveTasksToDaily;
DashboardView.prototype.archiveCompletedTasks = archiveCompletedTasks;
DashboardView.prototype.openBannerEditModal = openBannerEditModal;
DashboardView.prototype.openCardEditModal = openCardEditModal;
DashboardView.prototype.openNotePopover = openNotePopover;
DashboardView.prototype.openNote = openNote;
DashboardView.prototype.openNoteInTab = openNoteInTab;
DashboardView.prototype.addColumnWithType = addColumnWithType;
DashboardView.prototype.openAddSectionModal = openAddSectionModal;
DashboardView.prototype.openWidgetTypeModal = openWidgetTypeModal;
DashboardView.prototype.openStickyCardTypeModal = openStickyCardTypeModal;
DashboardView.prototype.openWeatherConfigModal = openWeatherConfigModal;
DashboardView.prototype.openTrackerConfigModal = openTrackerConfigModal;
DashboardView.prototype.openTemplatePicker = openTemplatePicker;
DashboardView.prototype.openLibraryConfigModal = openLibraryConfigModal;
DashboardView.prototype.openDataviewConfigModal = openDataviewConfigModal;
DashboardView.prototype.openWebConfigModal = openWebConfigModal;
DashboardView.prototype.openMediaConfigModal = openMediaConfigModal;
DashboardView.prototype.openWereadConfigModal = openWereadConfigModal;
DashboardView.prototype.handleMoveCard = handleMoveCard;
DashboardView.prototype.reorderCardsInDOM = reorderCardsInDOM;
DashboardView.prototype.refreshSectionInPlace = refreshSectionInPlace;
DashboardView.prototype.openFolderConfigModal = openFolderConfigModal;
DashboardView.prototype.handleCardNewNote = handleCardNewNote;
DashboardView.prototype.openNotesSectionConfigModal = openNotesSectionConfigModal;
DashboardView.prototype.handleLibraryNewNote = handleLibraryNewNote;
DashboardView.prototype.openAddActionModal = openAddActionModal;
DashboardView.prototype.openEditActionModal = openEditActionModal;
DashboardView.prototype.deleteColumn = deleteColumn;
DashboardView.prototype.executeAction = executeAction;
DashboardView.prototype.openProjectSearchModal = openProjectSearchModal;
DashboardView.prototype.promptAddColumn = promptAddColumn;
DashboardView.prototype.navigateToPath = navigateToPath;
DashboardView.prototype.registerVaultListeners = registerVaultListeners;
DashboardView.prototype.unregisterVaultListeners = unregisterVaultListeners;
DashboardView.prototype.scheduleVaultRefresh = scheduleVaultRefresh;
DashboardView.prototype.flushVaultRefresh = flushVaultRefresh;
DashboardView.prototype.refreshSidebarCalendarNow = refreshSidebarCalendarNow;
DashboardView.prototype.refreshAlbumWidgetsNow = refreshAlbumWidgetsNow;
DashboardView.prototype.refreshSectionsFor = refreshSectionsFor;
DashboardView.prototype.onHabitChanged = onHabitChanged;
DashboardView.prototype.refreshLunarWidgetsInPlace = refreshLunarWidgetsInPlace;
DashboardView.prototype.refreshDataWidget = refreshDataWidget;
DashboardView.prototype.debouncedRefreshBannerStats = debouncedRefreshBannerStats;
DashboardView.prototype.refreshRecentDocs = refreshRecentDocs;
DashboardView.prototype.runCleanup = runCleanup;
DashboardView.prototype.renderScrollToTop = renderScrollToTop;
DashboardView.prototype.startWeatherRefresh = startWeatherRefresh;
DashboardView.prototype.stopWeatherRefresh = stopWeatherRefresh;
DashboardView.prototype.startDayRolloverChecker = startDayRolloverChecker;
DashboardView.prototype.stopDayRolloverChecker = stopDayRolloverChecker;
DashboardView.prototype.checkDayRollover = checkDayRollover;
