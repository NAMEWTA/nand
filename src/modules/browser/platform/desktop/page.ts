import { BrowserError, clampZoom, type BrowserDownload, type BrowserPageState } from '../../core/model';
import { normalizeBrowserUrl } from '../../core/url';
import {
	electronBrowserApi,
	listenNative,
	type DownloadItem,
	type GuestContents,
	type GuestHistory,
	type WebviewElement,
} from './electron-api';
import { BrowserAutomation } from './automation';
import { watchDownload } from './download-progress';
import { installGuestPolicy } from './guest-policy';
import { prepareHistoryGuest } from './history-guest';
import type { VaultSessionLease } from '../../../../host/desktop/browser-session';

export interface PageActions {
	open(url: string): void;
	changed(state: BrowserPageState): void;
	visited(url: string, title: string): void;
	permissions?(): Record<string, boolean>;
}
/** Native guest remains in its retained host while React chrome re-renders. Owns every guest listener. */
export class BrowserPage {
	readonly profileId: string;
	readonly webview: WebviewElement;
	readonly downloads: BrowserDownload[] = [];
	readonly api;
	guest?: GuestContents;
	automation?: BrowserAutomation;
	disposed = false;
	private cleanups: Array<() => void> = [];
	private guestCleanups: Array<() => void> = [];
	private permissionPolicy?: ReturnType<typeof installGuestPolicy>;
	private sessionLease?: VaultSessionLease;
	private navigation?: { cancel: (reason: string, retire?: boolean) => void };
	permissionDenied = '';
	private downloadItems = new Map<string, DownloadItem>();
	shortcut?: (key: string) => void;
	private listeners = new Set<() => void>();
	private readyResolve!: () => void;
	private readyReject!: (error: Error) => void;
	readonly ready: Promise<void>;
	readonly initialLoad: Promise<void>;
	private loadResolve!: () => void;
	private loadReject!: (error: Error) => void;
	private startupTimer?: number;
	private readonly win: Window;
	/** Kept in memory before the owner window closes; never stores Chromium pageState. */
	history?: GuestHistory;
	private restoringHistory: boolean;
	private rendererReady = false;
	constructor(
		readonly state: BrowserPageState,
		container: HTMLElement,
		prepareSession: () => Promise<VaultSessionLease>,
		private actions: PageActions,
		private readonly brokerWindow: Window = container.win,
		history?: GuestHistory,
	) {
		this.history = history;
		this.restoringHistory = !!history;
		this.profileId = state.profileId ?? 'default';
		const initialUrl = normalizeBrowserUrl(state.url);
		const initialScroll = state.scroll;
		let initialized = false;
		this.win = container.win;
		this.api = electronBrowserApi(this.brokerWindow);
		this.ready = new Promise((resolve, reject) => {
			this.readyResolve = resolve;
			this.readyReject = reject;
		});
		void this.ready.catch(() => undefined);
		this.initialLoad = new Promise((resolve, reject) => {
			this.loadResolve = resolve;
			this.loadReject = reject;
		});
		void this.initialLoad.catch(() => undefined);
		this.webview = container.createEl('webview' as 'div', {
			cls: 'nand-browser-webview',
		}) as unknown as WebviewElement;
		this.webview.setAttribute('allowpopups', '');
		// Electron guests are transparent by default; an opaque canvas lets pages without a background
		// keep the browser's readable default instead of showing NAND's dark surface (Orca does the same).
		this.webview.setAttribute(
			'webpreferences',
			'nodeIntegration=false,contextIsolation=true,sandbox=true,webSecurity=true,disableHtmlFullscreenWindowResize=true,transparent=false',
		);
		// Native IPC and state callbacks use the persistent renderer; DOM listeners
		// and layout timers still belong to the guest's own window.
		const on = (name: string, handler: (event: Event) => void) => {
			const listener = (event: Event) => {
				if (this.win === this.brokerWindow) handler(event);
				else
					this.brokerWindow.setTimeout(() => {
						if (!this.disposed) handler(event);
					}, 0);
			};
			this.webview.addEventListener(name, listener);
			this.cleanups.push(() => this.webview.removeEventListener(name, listener));
		};
		on('zoom-changed', (event) => {
			this.zoom(
				this.state.zoom + ((event as Event & { zoomDirection: string }).zoomDirection === 'in' ? 0.1 : -0.1),
			);
		});
		const startInitialLoad = () => {
			if (initialized) return;
			initialized = true;
			this.state.url = initialUrl;
			const load = history
				? this.navigateNative(() => this.guest!.navigationHistory.restore(history))
				: initialUrl === 'about:blank'
					? Promise.resolve()
					: this.loadUrl(initialUrl);
			void load
				.catch((error: unknown) => {
					const code = (error as { code?: string })?.code;
					if (code !== 'ERR_ABORTED' && code !== 'browser_navigation_cancelled') throw error;
				})
				.then(async () => {
					// Main-process restore can begin before the renderer exists. Scroll and
					// page consumers must also wait for the renderer's dom-ready event.
					await this.ready;
					if (this.disposed) return;
					this.restoringHistory = false;
					if (initialScroll) {
						try {
							await this.guest?.executeJavaScript(`scrollTo(${initialScroll.x},${initialScroll.y})`);
						} catch {
							/* Page navigated. */
						}
					}
					this.loadResolve();
					this.sync();
				})
				.catch((error: unknown) => this.failInitialization(error));
		};
		on('dom-ready', () => {
			if (this.disposed) return;
			try {
				this.installGuest();
				this.webview.setZoomFactor(this.state.zoom);
				this.rendererReady = true;
				this.win.clearTimeout(this.startupTimer);
				startInitialLoad();
				this.readyResolve();
				this.sync();
			} catch (error) {
				this.failInitialization(error);
			}
		});
		on('did-start-loading', () => {
			this.state.loading = true;
			this.state.error = null;
			this.automation?.invalidate();
			this.emit();
		});
		on('did-stop-loading', () => {
			this.state.loading = false;
			this.sync();
		});
		for (const name of ['did-navigate', 'did-navigate-in-page', 'page-title-updated'])
			on(name, () => this.sync(true));
		on('did-fail-load', (event) => {
			const failure = event as Event & { isMainFrame?: boolean; errorCode?: number; errorDescription?: string };
			if (failure.isMainFrame === false || failure.errorCode === -3) return;
			this.fail(failure.errorDescription || 'browser_load_failed');
		});
		on('render-process-gone', () => {
			this.automation?.dispose();
			this.automation = undefined;
			this.fail('browser_guest_crashed');
			this.dispose();
		});
		on('page-favicon-updated', (event) => {
			const url = (event as Event & { favicons?: string[] }).favicons?.[0];
			this.state.favicon = url && /^https?:\/\//.test(url) ? url : '';
			this.emit();
		});
		on('found-in-page', (event) => {
			const result = (event as Event & { result?: { matches: number; activeMatchOrdinal: number } }).result;
			if (result) {
				this.findResult = result;
				this.emit();
			}
		});
		let readingScroll = false;
		const scrollTimer = this.win.setInterval(() => {
			if (readingScroll || !this.guest || this.state.loading || this.disposed || !this.webview.clientWidth)
				return;
			readingScroll = true;
			void Promise.resolve()
				.then(() => this.guest?.executeJavaScript('({x:scrollX,y:scrollY})'))
				.then((value) => {
					const scroll = value as { x: number; y: number };
					if (
						!this.disposed &&
						Number.isFinite(scroll?.x) &&
						Number.isFinite(scroll?.y) &&
						(scroll.x !== this.state.scroll?.x || scroll.y !== this.state.scroll?.y)
					) {
						this.state.scroll = scroll;
						this.emit();
					}
				})
				.catch(() => undefined)
				.finally(() => {
					readingScroll = false;
				});
		}, 1000);
		this.cleanups.push(() => this.win.clearInterval(scrollTimer));
		// Bind the native Session before creating a guest, including its initial blank page.
		void prepareSession()
			.then((lease) => {
				if (this.disposed) {
					lease.dispose();
					return;
				}
				this.sessionLease = lease;
				lease.onDownloadError(() => {
					if (!this.disposed) this.fail('browser_session_download');
				});
				lease.bind(this.webview);
				if (history)
					this.cleanups.push(
						prepareHistoryGuest(this.brokerWindow, this.webview, (id) => {
							if (this.disposed) return;
							try {
								// restore() requires a guest that has never loaded, so it must
								// begin at attachment. No renderer-side webview methods here.
								this.installGuest(id);
								startInitialLoad();
							} catch (error) {
								this.failInitialization(error);
							}
						}),
					);
				this.startupTimer = this.win.setTimeout(
					() => this.failInitialization(new BrowserError('browser_unavailable')),
					20000,
				);
				this.webview.setAttribute('src', 'about:blank');
			})
			.catch((error: unknown) => this.failInitialization(error));
	}
	findResult = { matches: 0, activeMatchOrdinal: 0 };
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	emit(): void {
		if (!this.disposed) {
			this.actions.changed({ ...this.state });
			for (const fn of this.listeners) fn();
		}
	}
	private fail(error: string): void {
		this.state.error = error;
		this.state.loading = false;
		this.emit();
	}
	private failInitialization(error: unknown): void {
		if (this.disposed) return;
		const failure = error instanceof Error ? error : new BrowserError('browser_unavailable');
		this.fail(failure.message);
		this.readyReject(failure);
		this.loadReject(failure);
		// A rejected ready promise cannot be reused. Release the native instance so
		// Retry creates a new guest instead of reloading this half-initialized one.
		this.dispose();
	}
	private sync(visited = false): void {
		if (this.disposed || this.restoringHistory) return;
		try {
			if (this.guest) {
				// Navigation events can precede dom-ready. Read the main-process guest,
				// keeping recovery current without calling renderer-only webview methods.
				const entries = this.guest.navigationHistory.getAllEntries().map(({ url, title }) => ({ url, title }));
				const index = this.guest.navigationHistory.getActiveIndex();
				if (entries.length) this.history = { entries, index };
				const url = this.guest.getURL();
				if (url && !url.startsWith('chrome-error:')) this.state.url = url;
				this.state.title = this.state.url === 'about:blank' ? '' : this.guest.getTitle();
				this.state.canGoBack = index > 0;
				this.state.canGoForward = index >= 0 && index < entries.length - 1;
				if (visited) this.actions.visited(this.state.url, this.state.title);
			}
		} catch {
			/* Native guest is closing. Keep the last complete navigation snapshot. */
		}
		this.emit();
	}
	private installGuest(id = this.webview.getWebContentsId()): void {
		const guest = this.api.webContents.fromId(id);
		if (!guest) throw new BrowserError('browser_unavailable');
		if (guest.id === this.guest?.id && this.automation) return;
		this.automation?.dispose();
		for (const cleanup of this.guestCleanups.splice(0)) cleanup();
		this.guest = guest;
		this.automation = new BrowserAutomation(guest, this);
		if (!this.sessionLease) throw new BrowserError('browser_unavailable');
		this.sessionLease.protect(guest.id);
		this.permissionPolicy = installGuestPolicy(
			this.brokerWindow,
			this.api,
			guest,
			this.sessionLease.storagePath,
			(event, value) => {
				if (this.disposed) return;
				if (event === 'open') this.actions.open(value);
				else if (event === 'shortcut') this.shortcut?.(value);
				else if (event === 'permission') {
					this.permissionDenied = value;
					this.emit();
				}
			},
			this.actions.permissions?.(),
		);
		this.guestCleanups.push(() => this.permissionPolicy?.dispose());
		this.guestCleanups.push(
			listenNative(guest.session, 'will-download', (_event, value, owner) => {
				if ((owner as GuestContents)?.id !== guest.id || this.disposed) return;
				const item = value as DownloadItem;
				const id = crypto.randomUUID();
				const row: BrowserDownload = {
					id,
					name: item.getFilename(),
					received: 0,
					total: item.getTotalBytes(),
					state: 'progressing',
					url: item.getURL?.(),
					updatedAt: Date.now(),
					path: '',
				};
				this.downloads.push(row);
				this.downloadItems.set(id, item);
				const update = (state: unknown) => {
					const now = Date.now(),
						received = item.getReceivedBytes();
					row.speed = (received - row.received) / Math.max(0.001, (now - (row.updatedAt ?? now)) / 1000);
					row.updatedAt = now;
					row.received = received;
					row.total = item.getTotalBytes();
					row.state = String(state);
					row.path = item.getSavePath();
					this.emit();
				};
				this.guestCleanups.push(watchDownload(item, update, () => this.downloadItems.delete(id)));
				this.emit();
			}),
		);
	}
	updatePermissions(): void {
		this.permissionPolicy?.setGrants(this.actions.permissions?.() ?? {});
	}
	private loadUrl(url: string): Promise<void> {
		return this.navigateNative(() => this.webview.loadURL(url));
	}
	private navigateNative(work: () => Promise<void>): Promise<void> {
		if (this.disposed) return Promise.reject(new BrowserError('browser_page_closed'));
		// A new navigation replaces the pending operation while retaining the guest.
		if (this.navigation) this.navigation.cancel('browser_navigation_cancelled', false);
		return new Promise<void>((resolve, reject) => {
			let settled = false;
			const finish = (error?: unknown) => {
				if (settled) return;
				settled = true;
				this.win.clearTimeout(timer);
				this.navigation = undefined;
				if (error)
					reject(
						error instanceof Error
							? error
							: new Error(typeof error === 'string' ? error : 'Browser navigation failed'),
					);
				else resolve();
			};
			const cancel = (reason: string, retire = true) => {
				finish(new BrowserError(reason));
				if (retire) {
					this.fail(reason);
					this.dispose();
				}
			};
			const timer = this.win.setTimeout(() => cancel('browser_navigation_timeout'), 30000);
			this.navigation = { cancel };
			try {
				void work().then(() => finish(), finish);
			} catch (error) {
				finish(error);
			}
		});
	}
	async navigate(url: string): Promise<void> {
		const next = normalizeBrowserUrl(url);
		await this.ready;
		this.state.url = next;
		this.state.error = null;
		this.automation?.invalidate();
		try {
			await this.loadUrl(next);
		} catch (error) {
			if (
				(error as { code?: string })?.code !== 'ERR_ABORTED' &&
				(error as { code?: string })?.code !== 'browser_navigation_cancelled'
			)
				throw error;
		}
	}
	private historyNavigation(work: () => void): Promise<void> {
		return this.navigateNative(
			() =>
				new Promise<void>((resolve, reject) => {
					const cleanup = () => {
						this.webview.removeEventListener('did-stop-loading', done);
						const index = this.cleanups.indexOf(cancel);
						if (index >= 0) this.cleanups.splice(index, 1);
					};
					const done = () => {
						cleanup();
						resolve();
					};
					const cancel = () => {
						cleanup();
						reject(new BrowserError('browser_page_closed'));
					};
					this.cleanups.push(cancel);
					this.webview.addEventListener('did-stop-loading', done);
					try {
						work();
					} catch (error) {
						cleanup();
						reject(error instanceof Error ? error : new BrowserError('browser_failed'));
					}
				}),
		);
	}
	async back(): Promise<void> {
		if (this.state.canGoBack) {
			this.automation?.invalidate();
			await this.historyNavigation(() => this.webview.goBack());
		}
	}
	async forward(): Promise<void> {
		if (this.state.canGoForward) {
			this.automation?.invalidate();
			await this.historyNavigation(() => this.webview.goForward());
		}
	}
	async reload(hard = false): Promise<void> {
		this.state.error = null;
		this.automation?.invalidate();
		await this.historyNavigation(() => {
			if (hard) this.webview.reloadIgnoringCache();
			else this.webview.reload();
		});
	}
	stop(): void {
		this.navigation?.cancel('browser_navigation_cancelled', false);
		this.webview.stop();
		this.state.loading = false;
		this.emit();
	}
	zoom(value: number): void {
		this.state.zoom = clampZoom(value);
		if (this.rendererReady) this.webview.setZoomFactor(this.state.zoom);
		this.emit();
	}
	find(text: string, forward = true, next = false, matchCase = false): void {
		if (text) this.webview.findInPage(text, { forward, findNext: !next, matchCase });
		else this.webview.stopFindInPage('clearSelection');
	}
	async screenshot(full = false): Promise<string> {
		await this.ready;
		if (!this.automation) throw new BrowserError('browser_unavailable');
		return this.automation.screenshot(full);
	}
	downloadAction(id: string, action: 'cancel' | 'open' | 'show' | 'dismiss'): void {
		const row = this.downloads.find((d) => d.id === id);
		if (!row) return;
		if (action === 'cancel') this.downloadItems.get(id)?.cancel();
		if (row.state === 'completed' && row.path) {
			if (action === 'open') void this.api.shell.openPath(row.path);
			if (action === 'show') this.api.shell.showItemInFolder(row.path);
		}
		if (action === 'dismiss' && row.state !== 'progressing') this.downloads.splice(this.downloads.indexOf(row), 1);
		this.emit();
	}
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.rendererReady = false;
		this.navigation?.cancel('browser_page_closed');
		this.win.clearTimeout(this.startupTimer);
		this.readyReject(new BrowserError('browser_page_closed'));
		this.loadReject(new BrowserError('browser_page_closed'));
		this.automation?.dispose();
		for (const fn of [...this.guestCleanups.splice(0), ...this.cleanups.splice(0)]) fn();
		for (const item of this.downloadItems.values()) {
			try {
				item.cancel();
			} catch {
				/* Completed. */
			}
		}
		this.shortcut = undefined;
		this.downloadItems.clear();
		this.listeners.clear();
		try {
			this.webview.stop();
		} catch {
			/* Native guest already closed. */
		}
		// Removing the element owns guest destruction; do not close it twice across IPC.
		this.webview.remove();
		this.sessionLease?.dispose();
		this.sessionLease = undefined;
		this.guest = undefined;
	}
}
