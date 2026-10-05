import { ItemView, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import { DashboardSurface } from './dashboard-surface';
import type { DashboardHost } from '../host';

/** Original native identity; business presentation is shared with the workbench. */
export class DashboardView extends ItemView {
	readonly surface: DashboardSurface;
	constructor(leaf: WorkspaceLeaf, host: DashboardHost) {
		super(leaf);
		this.surface = this.addChild(new DashboardSurface({
			app: this.app, leaf, contentEl: this.contentEl, containerEl: this.contentEl,
			addAction: (icon, title, callback) => this.addAction(icon, title, callback),
			close: () => this.leaf.detach(),
		}, host));
	}
	getNativeSurfaces(): readonly DashboardSurface[] { return [this.surface]; }
	onOpen(): Promise<void> { return this.surface.onOpen(); }
	onClose(): Promise<void> { return this.surface.onClose(); }
	getState(): Record<string, unknown> { return this.surface.getState(); }
	async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		await this.surface.setState(state, result);
		await super.setState(state, result);
	}
	get plugin(): DashboardSurface['plugin'] { return this.surface.plugin; }
	set plugin(value: DashboardSurface['plugin']) { this.surface.plugin = value; }
	get sync(): DashboardSurface['sync'] { return this.surface.sync; }
	set sync(value: DashboardSurface['sync']) { this.surface.sync = value; }
	get data(): DashboardSurface['data'] { return this.surface.data; }
	set data(value: DashboardSurface['data']) { this.surface.data = value; }
	get cleanupFns(): DashboardSurface['cleanupFns'] { return this.surface.cleanupFns; }
	set cleanupFns(value: DashboardSurface['cleanupFns']) { this.surface.cleanupFns = value; }
	get dndCleanupFns(): DashboardSurface['dndCleanupFns'] { return this.surface.dndCleanupFns; }
	set dndCleanupFns(value: DashboardSurface['dndCleanupFns']) { this.surface.dndCleanupFns = value; }
	get suppressNextRender(): DashboardSurface['suppressNextRender'] { return this.surface.suppressNextRender; }
	set suppressNextRender(value: DashboardSurface['suppressNextRender']) { this.surface.suppressNextRender = value; }
	get vaultEventRefs(): DashboardSurface['vaultEventRefs'] { return this.surface.vaultEventRefs; }
	set vaultEventRefs(value: DashboardSurface['vaultEventRefs']) { this.surface.vaultEventRefs = value; }
	get bannerStatsTimer(): DashboardSurface['bannerStatsTimer'] { return this.surface.bannerStatsTimer; }
	set bannerStatsTimer(value: DashboardSurface['bannerStatsTimer']) { this.surface.bannerStatsTimer = value; }
	get bannerStatsEl(): DashboardSurface['bannerStatsEl'] { return this.surface.bannerStatsEl; }
	set bannerStatsEl(value: DashboardSurface['bannerStatsEl']) { this.surface.bannerStatsEl = value; }
	get vaultChangePaths(): DashboardSurface['vaultChangePaths'] { return this.surface.vaultChangePaths; }
	set vaultChangePaths(value: DashboardSurface['vaultChangePaths']) { this.surface.vaultChangePaths = value; }
	get vaultChangeBroad(): DashboardSurface['vaultChangeBroad'] { return this.surface.vaultChangeBroad; }
	set vaultChangeBroad(value: DashboardSurface['vaultChangeBroad']) { this.surface.vaultChangeBroad = value; }
	get vaultRefreshTimer(): DashboardSurface['vaultRefreshTimer'] { return this.surface.vaultRefreshTimer; }
	set vaultRefreshTimer(value: DashboardSurface['vaultRefreshTimer']) { this.surface.vaultRefreshTimer = value; }
	get VAULT_REFRESH_DEBOUNCE(): DashboardSurface['VAULT_REFRESH_DEBOUNCE'] { return this.surface.VAULT_REFRESH_DEBOUNCE; }
	get BANNER_STATS_DEBOUNCE(): DashboardSurface['BANNER_STATS_DEBOUNCE'] { return this.surface.BANNER_STATS_DEBOUNCE; }
	get bannerStatsResolvedOnce(): DashboardSurface['bannerStatsResolvedOnce'] { return this.surface.bannerStatsResolvedOnce; }
	set bannerStatsResolvedOnce(value: DashboardSurface['bannerStatsResolvedOnce']) { this.surface.bannerStatsResolvedOnce = value; }
	get bannerQuoteIndex(): DashboardSurface['bannerQuoteIndex'] { return this.surface.bannerQuoteIndex; }
	set bannerQuoteIndex(value: DashboardSurface['bannerQuoteIndex']) { this.surface.bannerQuoteIndex = value; }
	get bannerImageIndex(): DashboardSurface['bannerImageIndex'] { return this.surface.bannerImageIndex; }
	set bannerImageIndex(value: DashboardSurface['bannerImageIndex']) { this.surface.bannerImageIndex = value; }
	get sidebarPinned(): DashboardSurface['sidebarPinned'] { return this.surface.sidebarPinned; }
	set sidebarPinned(value: DashboardSurface['sidebarPinned']) { this.surface.sidebarPinned = value; }
	get sidebarExpanded(): DashboardSurface['sidebarExpanded'] { return this.surface.sidebarExpanded; }
	set sidebarExpanded(value: DashboardSurface['sidebarExpanded']) { this.surface.sidebarExpanded = value; }
	get bannerCollapsed(): DashboardSurface['bannerCollapsed'] { return this.surface.bannerCollapsed; }
	set bannerCollapsed(value: DashboardSurface['bannerCollapsed']) { this.surface.bannerCollapsed = value; }
	get pendingScrollCardId(): DashboardSurface['pendingScrollCardId'] { return this.surface.pendingScrollCardId; }
	set pendingScrollCardId(value: DashboardSurface['pendingScrollCardId']) { this.surface.pendingScrollCardId = value; }
	get pendingScrollToLastCardOfColumn(): DashboardSurface['pendingScrollToLastCardOfColumn'] { return this.surface.pendingScrollToLastCardOfColumn; }
	set pendingScrollToLastCardOfColumn(value: DashboardSurface['pendingScrollToLastCardOfColumn']) { this.surface.pendingScrollToLastCardOfColumn = value; }
	get pomodoroService(): DashboardSurface['pomodoroService'] { return this.surface.pomodoroService; }
	set pomodoroService(value: DashboardSurface['pomodoroService']) { this.surface.pomodoroService = value; }
	get pomodoroMiniPanel(): DashboardSurface['pomodoroMiniPanel'] { return this.surface.pomodoroMiniPanel; }
	set pomodoroMiniPanel(value: DashboardSurface['pomodoroMiniPanel']) { this.surface.pomodoroMiniPanel = value; }
	get readingMiniTimer(): DashboardSurface['readingMiniTimer'] { return this.surface.readingMiniTimer; }
	set readingMiniTimer(value: DashboardSurface['readingMiniTimer']) { this.surface.readingMiniTimer = value; }
	get readingService(): DashboardSurface['readingService'] { return this.surface.readingService; }
	set readingService(value: DashboardSurface['readingService']) { this.surface.readingService = value; }
	get habitUnsubscribe(): DashboardSurface['habitUnsubscribe'] { return this.surface.habitUnsubscribe; }
	set habitUnsubscribe(value: DashboardSurface['habitUnsubscribe']) { this.surface.habitUnsubscribe = value; }
	get holidayData(): DashboardSurface['holidayData'] { return this.surface.holidayData; }
	set holidayData(value: DashboardSurface['holidayData']) { this.surface.holidayData = value; }
	get mobileWidgetExpanded(): DashboardSurface['mobileWidgetExpanded'] { return this.surface.mobileWidgetExpanded; }
	set mobileWidgetExpanded(value: DashboardSurface['mobileWidgetExpanded']) { this.surface.mobileWidgetExpanded = value; }
	get mobileWidgetTabsOpen(): DashboardSurface['mobileWidgetTabsOpen'] { return this.surface.mobileWidgetTabsOpen; }
	set mobileWidgetTabsOpen(value: DashboardSurface['mobileWidgetTabsOpen']) { this.surface.mobileWidgetTabsOpen = value; }
	get weatherRefreshTimer(): DashboardSurface['weatherRefreshTimer'] { return this.surface.weatherRefreshTimer; }
	set weatherRefreshTimer(value: DashboardSurface['weatherRefreshTimer']) { this.surface.weatherRefreshTimer = value; }
	get dayRolloverTimer(): DashboardSurface['dayRolloverTimer'] { return this.surface.dayRolloverTimer; }
	set dayRolloverTimer(value: DashboardSurface['dayRolloverTimer']) { this.surface.dayRolloverTimer = value; }
	get lastRenderedDay(): DashboardSurface['lastRenderedDay'] { return this.surface.lastRenderedDay; }
	set lastRenderedDay(value: DashboardSurface['lastRenderedDay']) { this.surface.lastRenderedDay = value; }
	get sidebarWidgetsEl(): DashboardSurface['sidebarWidgetsEl'] { return this.surface.sidebarWidgetsEl; }
	set sidebarWidgetsEl(value: DashboardSurface['sidebarWidgetsEl']) { this.surface.sidebarWidgetsEl = value; }
	get sidebarWidgetsSig(): DashboardSurface['sidebarWidgetsSig'] { return this.surface.sidebarWidgetsSig; }
	set sidebarWidgetsSig(value: DashboardSurface['sidebarWidgetsSig']) { this.surface.sidebarWidgetsSig = value; }
	get isOpening(): DashboardSurface['isOpening'] { return this.surface.isOpening; }
	set isOpening(value: DashboardSurface['isOpening']) { this.surface.isOpening = value; }
	get openingPromise(): DashboardSurface['openingPromise'] { return this.surface.openingPromise; }
	set openingPromise(value: DashboardSurface['openingPromise']) { this.surface.openingPromise = value; }
	get isOpen(): DashboardSurface['isOpen'] { return this.surface.isOpen; }
	set isOpen(value: DashboardSurface['isOpen']) { this.surface.isOpen = value; }
	get lifecycleRevision(): DashboardSurface['lifecycleRevision'] { return this.surface.lifecycleRevision; }
	set lifecycleRevision(value: DashboardSurface['lifecycleRevision']) { this.surface.lifecycleRevision = value; }
	get pendingInitialData(): DashboardSurface['pendingInitialData'] { return this.surface.pendingInitialData; }
	set pendingInitialData(value: DashboardSurface['pendingInitialData']) { this.surface.pendingInitialData = value; }
	get hoverPopover(): DashboardSurface['hoverPopover'] { return this.surface.hoverPopover; }
	set hoverPopover(value: DashboardSurface['hoverPopover']) { this.surface.hoverPopover = value; }
	get popoverModal(): DashboardSurface['popoverModal'] { return this.surface.popoverModal; }
	set popoverModal(value: DashboardSurface['popoverModal']) { this.surface.popoverModal = value; }
	get libraryNewNoteInFlight(): DashboardSurface['libraryNewNoteInFlight'] { return this.surface.libraryNewNoteInFlight; }
	set libraryNewNoteInFlight(value: DashboardSurface['libraryNewNoteInFlight']) { this.surface.libraryNewNoteInFlight = value; }
	get cardNewNoteInFlight(): DashboardSurface['cardNewNoteInFlight'] { return this.surface.cardNewNoteInFlight; }
	set cardNewNoteInFlight(value: DashboardSurface['cardNewNoteInFlight']) { this.surface.cardNewNoteInFlight = value; }
	handleDataUpdate(...args: Parameters<DashboardSurface['handleDataUpdate']>): ReturnType<DashboardSurface['handleDataUpdate']> { return this.surface.handleDataUpdate(...args); }
	refresh(...args: Parameters<DashboardSurface['refresh']>): ReturnType<DashboardSurface['refresh']> { return this.surface.refresh(...args); }
	reloadFromDisk(...args: Parameters<DashboardSurface['reloadFromDisk']>): ReturnType<DashboardSurface['reloadFromDisk']> { return this.surface.reloadFromDisk(...args); }
	applyWorkspaceSwitch(...args: Parameters<DashboardSurface['applyWorkspaceSwitch']>): ReturnType<DashboardSurface['applyWorkspaceSwitch']> { return this.surface.applyWorkspaceSwitch(...args); }
	addSection(...args: Parameters<DashboardSurface['addSection']>): ReturnType<DashboardSurface['addSection']> { return this.surface.addSection(...args); }
	toggleBannerMode(...args: Parameters<DashboardSurface['toggleBannerMode']>): ReturnType<DashboardSurface['toggleBannerMode']> { return this.surface.toggleBannerMode(...args); }
	render(...args: Parameters<DashboardSurface['render']>): ReturnType<DashboardSurface['render']> { return this.surface.render(...args); }
	renderMobileActions(...args: Parameters<DashboardSurface['renderMobileActions']>): ReturnType<DashboardSurface['renderMobileActions']> { return this.surface.renderMobileActions(...args); }
	renderMobileWidgetBar(...args: Parameters<DashboardSurface['renderMobileWidgetBar']>): ReturnType<DashboardSurface['renderMobileWidgetBar']> { return this.surface.renderMobileWidgetBar(...args); }
	refreshMobileWidgetPanel(...args: Parameters<DashboardSurface['refreshMobileWidgetPanel']>): ReturnType<DashboardSurface['refreshMobileWidgetPanel']> { return this.surface.refreshMobileWidgetPanel(...args); }
	openMobileDrawer(...args: Parameters<DashboardSurface['openMobileDrawer']>): ReturnType<DashboardSurface['openMobileDrawer']> { return this.surface.openMobileDrawer(...args); }
	closeMobileDrawer(...args: Parameters<DashboardSurface['closeMobileDrawer']>): ReturnType<DashboardSurface['closeMobileDrawer']> { return this.surface.closeMobileDrawer(...args); }
	setupBannerBehavior(...args: Parameters<DashboardSurface['setupBannerBehavior']>): ReturnType<DashboardSurface['setupBannerBehavior']> { return this.surface.setupBannerBehavior(...args); }
	setupBannerRotation(...args: Parameters<DashboardSurface['setupBannerRotation']>): ReturnType<DashboardSurface['setupBannerRotation']> { return this.surface.setupBannerRotation(...args); }
	renderBannerPinButton(...args: Parameters<DashboardSurface['renderBannerPinButton']>): ReturnType<DashboardSurface['renderBannerPinButton']> { return this.surface.renderBannerPinButton(...args); }
	renderSidebar(...args: Parameters<DashboardSurface['renderSidebar']>): ReturnType<DashboardSurface['renderSidebar']> { return this.surface.renderSidebar(...args); }
	setupSidebarBehavior(...args: Parameters<DashboardSurface['setupSidebarBehavior']>): ReturnType<DashboardSurface['setupSidebarBehavior']> { return this.surface.setupSidebarBehavior(...args); }
	applySidebarSizing(...args: Parameters<DashboardSurface['applySidebarSizing']>): ReturnType<DashboardSurface['applySidebarSizing']> { return this.surface.applySidebarSizing(...args); }
	attachStripHeightHandle(...args: Parameters<DashboardSurface['attachStripHeightHandle']>): ReturnType<DashboardSurface['attachStripHeightHandle']> { return this.surface.attachStripHeightHandle(...args); }
	attachSidebarWidthHandle(...args: Parameters<DashboardSurface['attachSidebarWidthHandle']>): ReturnType<DashboardSurface['attachSidebarWidthHandle']> { return this.surface.attachSidebarWidthHandle(...args); }
	commitSidebarSizing(...args: Parameters<DashboardSurface['commitSidebarSizing']>): ReturnType<DashboardSurface['commitSidebarSizing']> { return this.surface.commitSidebarSizing(...args); }
	createCallbacks(...args: Parameters<DashboardSurface['createCallbacks']>): ReturnType<DashboardSurface['createCallbacks']> { return this.surface.createCallbacks(...args); }
	handleFileDrop(...args: Parameters<DashboardSurface['handleFileDrop']>): ReturnType<DashboardSurface['handleFileDrop']> { return this.surface.handleFileDrop(...args); }
	saveMemoAsNote(...args: Parameters<DashboardSurface['saveMemoAsNote']>): ReturnType<DashboardSurface['saveMemoAsNote']> { return this.surface.saveMemoAsNote(...args); }
	saveTasksToDaily(...args: Parameters<DashboardSurface['saveTasksToDaily']>): ReturnType<DashboardSurface['saveTasksToDaily']> { return this.surface.saveTasksToDaily(...args); }
	archiveCompletedTasks(...args: Parameters<DashboardSurface['archiveCompletedTasks']>): ReturnType<DashboardSurface['archiveCompletedTasks']> { return this.surface.archiveCompletedTasks(...args); }
	openBannerEditModal(...args: Parameters<DashboardSurface['openBannerEditModal']>): ReturnType<DashboardSurface['openBannerEditModal']> { return this.surface.openBannerEditModal(...args); }
	openCardEditModal(...args: Parameters<DashboardSurface['openCardEditModal']>): ReturnType<DashboardSurface['openCardEditModal']> { return this.surface.openCardEditModal(...args); }
	openNotePopover(...args: Parameters<DashboardSurface['openNotePopover']>): ReturnType<DashboardSurface['openNotePopover']> { return this.surface.openNotePopover(...args); }
	openNote(...args: Parameters<DashboardSurface['openNote']>): ReturnType<DashboardSurface['openNote']> { return this.surface.openNote(...args); }
	openNoteInTab(...args: Parameters<DashboardSurface['openNoteInTab']>): ReturnType<DashboardSurface['openNoteInTab']> { return this.surface.openNoteInTab(...args); }
	addColumnWithType(...args: Parameters<DashboardSurface['addColumnWithType']>): ReturnType<DashboardSurface['addColumnWithType']> { return this.surface.addColumnWithType(...args); }
	openAddSectionModal(...args: Parameters<DashboardSurface['openAddSectionModal']>): ReturnType<DashboardSurface['openAddSectionModal']> { return this.surface.openAddSectionModal(...args); }
	openWidgetTypeModal(...args: Parameters<DashboardSurface['openWidgetTypeModal']>): ReturnType<DashboardSurface['openWidgetTypeModal']> { return this.surface.openWidgetTypeModal(...args); }
	openStickyCardTypeModal(...args: Parameters<DashboardSurface['openStickyCardTypeModal']>): ReturnType<DashboardSurface['openStickyCardTypeModal']> { return this.surface.openStickyCardTypeModal(...args); }
	openWeatherConfigModal(...args: Parameters<DashboardSurface['openWeatherConfigModal']>): ReturnType<DashboardSurface['openWeatherConfigModal']> { return this.surface.openWeatherConfigModal(...args); }
	openTrackerConfigModal(...args: Parameters<DashboardSurface['openTrackerConfigModal']>): ReturnType<DashboardSurface['openTrackerConfigModal']> { return this.surface.openTrackerConfigModal(...args); }
	openTemplatePicker(...args: Parameters<DashboardSurface['openTemplatePicker']>): ReturnType<DashboardSurface['openTemplatePicker']> { return this.surface.openTemplatePicker(...args); }
	openLibraryConfigModal(...args: Parameters<DashboardSurface['openLibraryConfigModal']>): ReturnType<DashboardSurface['openLibraryConfigModal']> { return this.surface.openLibraryConfigModal(...args); }
	openDataviewConfigModal(...args: Parameters<DashboardSurface['openDataviewConfigModal']>): ReturnType<DashboardSurface['openDataviewConfigModal']> { return this.surface.openDataviewConfigModal(...args); }
	openWebConfigModal(...args: Parameters<DashboardSurface['openWebConfigModal']>): ReturnType<DashboardSurface['openWebConfigModal']> { return this.surface.openWebConfigModal(...args); }
	openMediaConfigModal(...args: Parameters<DashboardSurface['openMediaConfigModal']>): ReturnType<DashboardSurface['openMediaConfigModal']> { return this.surface.openMediaConfigModal(...args); }
	openWereadConfigModal(...args: Parameters<DashboardSurface['openWereadConfigModal']>): ReturnType<DashboardSurface['openWereadConfigModal']> { return this.surface.openWereadConfigModal(...args); }
	handleMoveCard(...args: Parameters<DashboardSurface['handleMoveCard']>): ReturnType<DashboardSurface['handleMoveCard']> { return this.surface.handleMoveCard(...args); }
	reorderCardsInDOM(...args: Parameters<DashboardSurface['reorderCardsInDOM']>): ReturnType<DashboardSurface['reorderCardsInDOM']> { return this.surface.reorderCardsInDOM(...args); }
	refreshSectionInPlace(...args: Parameters<DashboardSurface['refreshSectionInPlace']>): ReturnType<DashboardSurface['refreshSectionInPlace']> { return this.surface.refreshSectionInPlace(...args); }
	openFolderConfigModal(...args: Parameters<DashboardSurface['openFolderConfigModal']>): ReturnType<DashboardSurface['openFolderConfigModal']> { return this.surface.openFolderConfigModal(...args); }
	handleCardNewNote(...args: Parameters<DashboardSurface['handleCardNewNote']>): ReturnType<DashboardSurface['handleCardNewNote']> { return this.surface.handleCardNewNote(...args); }
	openNotesSectionConfigModal(...args: Parameters<DashboardSurface['openNotesSectionConfigModal']>): ReturnType<DashboardSurface['openNotesSectionConfigModal']> { return this.surface.openNotesSectionConfigModal(...args); }
	handleLibraryNewNote(...args: Parameters<DashboardSurface['handleLibraryNewNote']>): ReturnType<DashboardSurface['handleLibraryNewNote']> { return this.surface.handleLibraryNewNote(...args); }
	openAddActionModal(...args: Parameters<DashboardSurface['openAddActionModal']>): ReturnType<DashboardSurface['openAddActionModal']> { return this.surface.openAddActionModal(...args); }
	openEditActionModal(...args: Parameters<DashboardSurface['openEditActionModal']>): ReturnType<DashboardSurface['openEditActionModal']> { return this.surface.openEditActionModal(...args); }
	deleteColumn(...args: Parameters<DashboardSurface['deleteColumn']>): ReturnType<DashboardSurface['deleteColumn']> { return this.surface.deleteColumn(...args); }
	executeAction(...args: Parameters<DashboardSurface['executeAction']>): ReturnType<DashboardSurface['executeAction']> { return this.surface.executeAction(...args); }
	openProjectSearchModal(...args: Parameters<DashboardSurface['openProjectSearchModal']>): ReturnType<DashboardSurface['openProjectSearchModal']> { return this.surface.openProjectSearchModal(...args); }
	promptAddColumn(...args: Parameters<DashboardSurface['promptAddColumn']>): ReturnType<DashboardSurface['promptAddColumn']> { return this.surface.promptAddColumn(...args); }
	navigateToPath(...args: Parameters<DashboardSurface['navigateToPath']>): ReturnType<DashboardSurface['navigateToPath']> { return this.surface.navigateToPath(...args); }
	registerVaultListeners(...args: Parameters<DashboardSurface['registerVaultListeners']>): ReturnType<DashboardSurface['registerVaultListeners']> { return this.surface.registerVaultListeners(...args); }
	unregisterVaultListeners(...args: Parameters<DashboardSurface['unregisterVaultListeners']>): ReturnType<DashboardSurface['unregisterVaultListeners']> { return this.surface.unregisterVaultListeners(...args); }
	scheduleVaultRefresh(...args: Parameters<DashboardSurface['scheduleVaultRefresh']>): ReturnType<DashboardSurface['scheduleVaultRefresh']> { return this.surface.scheduleVaultRefresh(...args); }
	flushVaultRefresh(...args: Parameters<DashboardSurface['flushVaultRefresh']>): ReturnType<DashboardSurface['flushVaultRefresh']> { return this.surface.flushVaultRefresh(...args); }
	refreshSidebarCalendarNow(...args: Parameters<DashboardSurface['refreshSidebarCalendarNow']>): ReturnType<DashboardSurface['refreshSidebarCalendarNow']> { return this.surface.refreshSidebarCalendarNow(...args); }
	refreshAlbumWidgetsNow(...args: Parameters<DashboardSurface['refreshAlbumWidgetsNow']>): ReturnType<DashboardSurface['refreshAlbumWidgetsNow']> { return this.surface.refreshAlbumWidgetsNow(...args); }
	refreshSectionsFor(...args: Parameters<DashboardSurface['refreshSectionsFor']>): ReturnType<DashboardSurface['refreshSectionsFor']> { return this.surface.refreshSectionsFor(...args); }
	onHabitChanged(...args: Parameters<DashboardSurface['onHabitChanged']>): ReturnType<DashboardSurface['onHabitChanged']> { return this.surface.onHabitChanged(...args); }
	refreshLunarWidgetsInPlace(...args: Parameters<DashboardSurface['refreshLunarWidgetsInPlace']>): ReturnType<DashboardSurface['refreshLunarWidgetsInPlace']> { return this.surface.refreshLunarWidgetsInPlace(...args); }
	refreshDataWidget(...args: Parameters<DashboardSurface['refreshDataWidget']>): ReturnType<DashboardSurface['refreshDataWidget']> { return this.surface.refreshDataWidget(...args); }
	debouncedRefreshBannerStats(...args: Parameters<DashboardSurface['debouncedRefreshBannerStats']>): ReturnType<DashboardSurface['debouncedRefreshBannerStats']> { return this.surface.debouncedRefreshBannerStats(...args); }
	refreshRecentDocs(...args: Parameters<DashboardSurface['refreshRecentDocs']>): ReturnType<DashboardSurface['refreshRecentDocs']> { return this.surface.refreshRecentDocs(...args); }
	runCleanup(...args: Parameters<DashboardSurface['runCleanup']>): ReturnType<DashboardSurface['runCleanup']> { return this.surface.runCleanup(...args); }
	renderScrollToTop(...args: Parameters<DashboardSurface['renderScrollToTop']>): ReturnType<DashboardSurface['renderScrollToTop']> { return this.surface.renderScrollToTop(...args); }
	startWeatherRefresh(...args: Parameters<DashboardSurface['startWeatherRefresh']>): ReturnType<DashboardSurface['startWeatherRefresh']> { return this.surface.startWeatherRefresh(...args); }
	stopWeatherRefresh(...args: Parameters<DashboardSurface['stopWeatherRefresh']>): ReturnType<DashboardSurface['stopWeatherRefresh']> { return this.surface.stopWeatherRefresh(...args); }
	startDayRolloverChecker(...args: Parameters<DashboardSurface['startDayRolloverChecker']>): ReturnType<DashboardSurface['startDayRolloverChecker']> { return this.surface.startDayRolloverChecker(...args); }
	stopDayRolloverChecker(...args: Parameters<DashboardSurface['stopDayRolloverChecker']>): ReturnType<DashboardSurface['stopDayRolloverChecker']> { return this.surface.stopDayRolloverChecker(...args); }
	checkDayRollover(...args: Parameters<DashboardSurface['checkDayRollover']>): ReturnType<DashboardSurface['checkDayRollover']> { return this.surface.checkDayRollover(...args); }
	getViewType(...args: Parameters<DashboardSurface['getViewType']>): ReturnType<DashboardSurface['getViewType']> { return this.surface.getViewType(...args); }
	getDisplayText(...args: Parameters<DashboardSurface['getDisplayText']>): ReturnType<DashboardSurface['getDisplayText']> { return this.surface.getDisplayText(...args); }
	getIcon(...args: Parameters<DashboardSurface['getIcon']>): ReturnType<DashboardSurface['getIcon']> { return this.surface.getIcon(...args); }
	focusWidget(...args: Parameters<DashboardSurface['focusWidget']>): ReturnType<DashboardSurface['focusWidget']> { return this.surface.focusWidget(...args); }
}
