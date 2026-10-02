import { Notice, setIcon, type App, type View, type WorkspaceLeaf } from 'obsidian';
import { TerminalView, TERMINAL_VIEW_TYPE } from '../../../view/terminal/terminal-view';
import type { TerminalInstance } from '../../../view/terminal/runtime/terminal-instance';
import {
	getAlwaysOnTopTerminalLabelKey,
	getAlwaysOnTopTerminalMenuState,
} from '../../../view/terminal/runtime/always-on-top-terminal-display';
import { errorLog } from '../../../platform/desktop/logger';
import { t } from '../../../shared/i18n/terminal-accessor';
const ALWAYS_ON_TOP_TAB_BADGE_CLASS = 'terminal-always-on-top-tab-badge';

type ElectronBrowserWindowLike = {
	setAlwaysOnTop: (flag: boolean, level?: string) => void;
	isAlwaysOnTop?: () => boolean;
	focus?: () => void;
};

type ElectronRuntime = {
	remote?: {
		getCurrentWindow?: () => ElectronBrowserWindowLike;
	};
};

type ElectronRemoteRuntime = {
	getCurrentWindow?: () => ElectronBrowserWindowLike;
};

/** Owns leaf/window placement; moving a renderer never changes process ownership. */
export class TerminalWindowNavigation {
	trackedLeaf: WorkspaceLeaf | null = null;
	private pendingRestoredTerminals = new WeakMap<WorkspaceLeaf, TerminalInstance>();
	restoreOnOpen(leaf: WorkspaceLeaf, terminal: TerminalInstance): void {
		this.pendingRestoredTerminals.set(leaf, terminal);
	}
	constructor(
		private app: App,
		private getActiveTerminalView: () => TerminalView | null,
		private isTerminalView: (view: View | null | undefined) => view is TerminalView,
	) {}
	async toggleAlwaysOnTopTerminal(terminalView?: TerminalView | null): Promise<void> {
		const existingView = this.getTrackedAlwaysOnTopTerminalView();
		if (existingView) {
			if (!terminalView || terminalView.leaf === existingView.leaf) {
				await this.restoreAlwaysOnTopTerminalToMainWindow(existingView);
				return;
			}

			await this.focusAlwaysOnTopTerminal(existingView);
			return;
		}

		const sourceView = terminalView ?? this.getActiveTerminalView();
		if (!sourceView) {
			new Notice(t('notices.presetScript.terminalUnavailable'));
			return;
		}

		const sourceTerminal = await sourceView.waitForTerminalInstance().catch(() => null);
		if (!sourceTerminal) {
			new Notice(t('terminal.notInitialized'));
			return;
		}

		let targetWindow = sourceView.leaf.getContainer?.().win;
		if (this.isLeafInMainWindow(sourceView.leaf)) {
			try {
				targetWindow = this.app.workspace.moveLeafToPopout(sourceView.leaf, {
					size: {
						width: 960,
						height: 640,
					},
				}).win;
			} catch (error) {
				errorLog('[TerminalAgentController] Failed to move terminal to popout window:', error);
				const message = error instanceof Error ? error.message : String(error);
				new Notice(t('notices.terminal.alwaysOnTopOpenFailed', { message }), 5000);
				return;
			}
		}

		this.trackedLeaf = sourceView.leaf;
		this.updateAlwaysOnTopTabBadges();
		await this.waitForTerminalWindowMigration(sourceView, targetWindow);
		this.app.workspace.setActiveLeaf(sourceView.leaf, { focus: true });
		targetWindow?.focus();
		await this.applyAlwaysOnTopToLeaf(sourceView.leaf, targetWindow);
		this.updateAlwaysOnTopTabBadges();
		sourceTerminal.focus();
	}

	getAlwaysOnTopTerminalLabel(terminalView?: TerminalView | null): string {
		const trackedView = this.getTrackedAlwaysOnTopTerminalView();
		const state = getAlwaysOnTopTerminalMenuState(
			!!trackedView,
			!!terminalView && trackedView?.leaf === terminalView.leaf,
		);
		return t(getAlwaysOnTopTerminalLabelKey(state));
	}

	isAlwaysOnTopTerminal(terminalView?: TerminalView | null): boolean {
		const trackedView = this.getTrackedAlwaysOnTopTerminalView();
		return !!terminalView && trackedView?.leaf === terminalView.leaf;
	}

	handleTerminalViewClosed(terminalView: TerminalView): void {
		if (this.trackedLeaf === terminalView.leaf) {
			this.trackedLeaf = null;
			this.updateAlwaysOnTopTabBadges();
		}
	}

	private getTrackedAlwaysOnTopTerminalView(): TerminalView | null {
		const leaf = this.trackedLeaf;
		if (leaf && this.isTerminalView(leaf.view)) {
			return leaf.view;
		}

		this.trackedLeaf = null;
		this.updateAlwaysOnTopTabBadges();
		return null;
	}

	private async focusAlwaysOnTopTerminal(terminalView: TerminalView): Promise<void> {
		const targetWindow = terminalView.leaf.getContainer?.().win;
		await this.waitForTerminalWindowMigration(terminalView, targetWindow);
		this.app.workspace.setActiveLeaf(terminalView.leaf, { focus: true });
		targetWindow?.focus();
		await this.applyAlwaysOnTopToLeaf(terminalView.leaf, targetWindow);
		this.updateAlwaysOnTopTabBadges();
		terminalView.getTerminalInstance()?.focus();
	}

	private async restoreAlwaysOnTopTerminalToMainWindow(terminalView: TerminalView): Promise<void> {
		const terminal = terminalView.releaseTerminalInstance();
		if (!terminal) {
			new Notice(t('terminal.notInitialized'));
			return;
		}

		const sourceLeaf = terminalView.leaf;
		const sourceWindow = sourceLeaf.getContainer?.().win;
		const browserWindow = await this.waitForBrowserWindowForLeaf(sourceLeaf, sourceWindow, 500);
		if (browserWindow?.isAlwaysOnTop?.()) {
			this.setBrowserWindowAlwaysOnTop(browserWindow, false);
		} else if (browserWindow) {
			this.setBrowserWindowAlwaysOnTop(browserWindow, false);
		}

		this.trackedLeaf = null;
		this.updateAlwaysOnTopTabBadges();

		const { workspace } = this.app;
		const mainLeaf = this.getLeafForRestoredTerminal();
		this.pendingRestoredTerminals.set(mainLeaf, terminal);
		await mainLeaf.setViewState({
			type: TERMINAL_VIEW_TYPE,
			active: true,
		});

		const restoredView = await this.waitForTerminalViewInLeaf(mainLeaf);
		if (!restoredView) {
			errorLog('[TerminalAgentController] Failed to restore always-on-top terminal: target view did not load');
			this.pendingRestoredTerminals.delete(mainLeaf);
			await this.recoverReleasedTerminalInSourceView(terminalView, terminal, sourceWindow);
			new Notice(t('notices.terminal.alwaysOnTopRestoreFailed'), 5000);
			return;
		}

		this.pendingRestoredTerminals.delete(mainLeaf);
		restoredView.copyWorkbenchStateFrom(terminalView);
		if (restoredView.getTerminalInstance() !== terminal) {
			restoredView.adoptTerminalInstance(terminal);
		}
		workspace.setActiveLeaf(mainLeaf, { focus: true });
		terminal.focus();
		sourceLeaf.detach();
	}

	consumePendingRestoredTerminal(leaf: WorkspaceLeaf): TerminalInstance | null {
		const terminal = this.pendingRestoredTerminals.get(leaf);
		if (!terminal) {
			return null;
		}

		this.pendingRestoredTerminals.delete(leaf);
		return terminal;
	}

	private getLeafForRestoredTerminal(): WorkspaceLeaf {
		const { workspace } = this.app;
		const previousActiveLeaf = workspace.getMostRecentLeaf();
		const rootLeaf = workspace.getMostRecentLeaf(workspace.rootSplit);
		if (rootLeaf) {
			workspace.setActiveLeaf(rootLeaf, { focus: false });
		}
		const leaf = workspace.getLeaf('tab');
		if (previousActiveLeaf && previousActiveLeaf !== rootLeaf) {
			workspace.setActiveLeaf(previousActiveLeaf, { focus: false });
		}
		return leaf;
	}

	private async waitForTerminalViewInLeaf(leaf: WorkspaceLeaf, timeoutMs = 2000): Promise<TerminalView | null> {
		const deadline = Date.now() + timeoutMs;
		do {
			await leaf.loadIfDeferred?.();
			if (this.isTerminalView(leaf.view)) {
				return leaf.view;
			}
			await this.delay(50);
		} while (Date.now() < deadline);

		return this.isTerminalView(leaf.view) ? leaf.view : null;
	}

	private async recoverReleasedTerminalInSourceView(
		terminalView: TerminalView,
		terminal: TerminalInstance,
		sourceWindow?: Window,
	): Promise<void> {
		terminalView.adoptTerminalInstance(terminal);
		this.trackedLeaf = terminalView.leaf;
		this.updateAlwaysOnTopTabBadges();
		await this.applyAlwaysOnTopToLeaf(terminalView.leaf, sourceWindow);
		terminal.focus();
	}

	private updateAlwaysOnTopTabBadges(): void {
		this.removeAlwaysOnTopTabBadges(activeDocument);
		for (const leaf of this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE)) {
			const leafDocument = leaf.view?.containerEl?.ownerDocument;
			if (leafDocument && leafDocument !== activeDocument) {
				this.removeAlwaysOnTopTabBadges(leafDocument);
			}
		}

		const leaf = this.trackedLeaf;
		if (!leaf || !this.isTerminalView(leaf.view)) {
			return;
		}

		const tabHeader = this.getLeafTabHeader(leaf);
		if (!tabHeader) {
			return;
		}

		const badge = tabHeader.ownerDocument.createElement('span');
		badge.addClass(ALWAYS_ON_TOP_TAB_BADGE_CLASS);
		badge.setAttribute('aria-label', t('terminal.contextMenu.alreadyPinnedToTop'));
		badge.setAttribute('title', t('terminal.contextMenu.alreadyPinnedToTop'));
		setIcon(badge, 'lock');

		const titleEl = tabHeader.querySelector('.workspace-tab-header-inner-title');
		if (titleEl) {
			titleEl.insertAdjacentElement('afterend', badge);
			return;
		}

		tabHeader.querySelector('.workspace-tab-header-inner')?.appendChild(badge);
	}

	private removeAlwaysOnTopTabBadges(targetDocument: Document): void {
		targetDocument.querySelectorAll(`.${ALWAYS_ON_TOP_TAB_BADGE_CLASS}`).forEach((badge) => badge.remove());
	}

	private getLeafTabHeader(leaf: WorkspaceLeaf): HTMLElement | null {
		const leafWithTabHeader = leaf as WorkspaceLeaf & {
			tabHeaderEl?: HTMLElement;
			tabHeaderInnerTitleEl?: HTMLElement;
		};
		const tabHeader =
			leafWithTabHeader.tabHeaderEl ??
			leafWithTabHeader.tabHeaderInnerTitleEl?.closest<HTMLElement>('.workspace-tab-header') ??
			leaf.view?.containerEl
				?.closest<HTMLElement>('.workspace-leaf')
				?.querySelector<HTMLElement>('.workspace-tab-header');

		return tabHeader ?? null;
	}

	private isLeafInMainWindow(leaf: WorkspaceLeaf): boolean {
		const leafWindow = leaf.getContainer?.().win;
		const mainWindow = this.app.workspace.rootSplit?.win;
		return !leafWindow || !mainWindow || leafWindow === mainWindow;
	}

	private async waitForTerminalWindowMigration(terminalView: TerminalView, targetWindow?: Window): Promise<void> {
		const deadline = Date.now() + 1500;
		do {
			terminalView.handleHostWindowChanged({ focus: false });
			const leafWindow = terminalView.leaf.getContainer?.().win;
			if (!targetWindow || leafWindow === targetWindow) {
				break;
			}
			await this.delay(50);
		} while (Date.now() < deadline);

		await this.delay(100);
		terminalView.handleHostWindowChanged({ focus: false });
	}

	private async applyAlwaysOnTopToLeaf(leaf: WorkspaceLeaf, targetWindow?: Window): Promise<void> {
		const browserWindow = await this.waitForBrowserWindowForLeaf(leaf, targetWindow);
		if (!browserWindow) {
			new Notice(t('notices.terminal.alwaysOnTopUnavailable'), 5000);
			return;
		}

		this.setBrowserWindowAlwaysOnTop(browserWindow, true);
	}

	private async waitForBrowserWindowForLeaf(
		leaf: WorkspaceLeaf,
		targetWindow?: Window,
		timeoutMs = 2000,
	): Promise<ElectronBrowserWindowLike | null> {
		const deadline = Date.now() + timeoutMs;
		do {
			const browserWindow = this.getBrowserWindowForLeaf(leaf, targetWindow);
			if (browserWindow) {
				return browserWindow;
			}
			await this.delay(50);
		} while (Date.now() < deadline);

		return null;
	}

	private getBrowserWindowForLeaf(leaf: WorkspaceLeaf, targetWindow?: Window): ElectronBrowserWindowLike | null {
		const containerWindow = targetWindow ?? leaf.getContainer?.().win;
		return this.getBrowserWindowForDomWindow(containerWindow ?? window);
	}

	private getBrowserWindowForDomWindow(targetWindow: Window | undefined): ElectronBrowserWindowLike | null {
		if (!targetWindow) return null;

		const targetRequire = this.getWindowRequire(targetWindow);
		if (targetRequire) {
			const browserWindow = this.getBrowserWindowFromRequire(targetRequire);
			if (browserWindow) return browserWindow;
		}

		const currentRequire = this.getCurrentRequire();
		if (targetWindow === window && currentRequire) {
			return this.getBrowserWindowFromRequire(currentRequire);
		}

		return null;
	}

	private getWindowRequire(targetWindow: Window): NodeJS.Require | null {
		const candidate = targetWindow as Window & { require?: NodeJS.Require };
		return typeof candidate.require === 'function' ? candidate.require : null;
	}

	private getCurrentRequire(): NodeJS.Require | null {
		try {
			return require;
		} catch {
			return null;
		}
	}

	private getBrowserWindowFromRequire(runtimeRequire: NodeJS.Require): ElectronBrowserWindowLike | null {
		const electron = this.getElectronRuntime(runtimeRequire);
		const browserWindow = electron.remote?.getCurrentWindow?.() ?? null;
		if (browserWindow) return browserWindow;

		const electronRemote = this.getElectronRemoteRuntime(runtimeRequire);
		return electronRemote.getCurrentWindow?.() ?? null;
	}

	private getElectronRuntime(runtimeRequire: NodeJS.Require): ElectronRuntime {
		try {
			return runtimeRequire('electron') as ElectronRuntime;
		} catch {
			return {};
		}
	}

	private getElectronRemoteRuntime(runtimeRequire: NodeJS.Require): ElectronRemoteRuntime {
		try {
			return runtimeRequire('@electron/remote') as ElectronRemoteRuntime;
		} catch {
			return {};
		}
	}

	private setBrowserWindowAlwaysOnTop(browserWindow: ElectronBrowserWindowLike, enabled: boolean): void {
		try {
			browserWindow.setAlwaysOnTop(enabled, 'floating');
		} catch (error) {
			errorLog('[TerminalAgentController] Failed to set terminal window always-on-top:', error);
			new Notice(t('notices.terminal.alwaysOnTopUnavailable'), 5000);
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => window.setTimeout(resolve, ms));
	}

	/**
	 * Register all commands
	 */
}
