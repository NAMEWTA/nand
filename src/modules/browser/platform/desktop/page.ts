import { BrowserError, clampZoom, type BrowserDownload, type BrowserPageState } from '../../core/model';
import { normalizeBrowserUrl } from '../../core/url';
import {
	electronBrowserApi,
	listenNative,
	type DownloadItem,
	type GuestContents,
	type WebviewElement,
} from './electron-api';
import { BrowserAutomation } from './automation';
import { installGuestPolicy } from './guest-policy';

export interface PageActions {
	open(url: string): void;
	changed(state: BrowserPageState): void;
	visited(url: string, title: string): void;
	permissions?(): Record<string, boolean>;
}
/** Native guest is stable while Preact chrome re-renders. Owns every guest listener. */
export class BrowserPage {
	readonly webview: WebviewElement;
	readonly downloads: BrowserDownload[] = [];
	readonly api;
	guest?: GuestContents;
	automation?: BrowserAutomation;
	disposed = false;
	private cleanups: Array<() => void> = [];
	private guestCleanups: Array<() => void> = [];
	private permissionPolicy?: ReturnType<typeof installGuestPolicy>;
	private navigation?: { cancel: (reason: string) => void };
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
	private startupTimer: number;
	private readonly win: Window;
	constructor(
		readonly state: BrowserPageState,
		container: HTMLElement,
		partition: string,
		private actions: PageActions,
	) {
		const initialUrl = normalizeBrowserUrl(state.url);
		const initialScroll = state.scroll;
		let initialized = false;
		this.win = container.win;
		this.api = electronBrowserApi(this.win);
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
		this.webview.setAttribute('partition', partition);
		this.webview.setAttribute('allowpopups', '');
		this.webview.setAttribute(
			'webpreferences',
			'nodeIntegration=false,contextIsolation=true,sandbox=true,webSecurity=true,disableHtmlFullscreenWindowResize=true',
		);
		const on = (name: string, handler: (event: Event) => void) => {
			this.webview.addEventListener(name, handler);
			this.cleanups.push(() => this.webview.removeEventListener(name, handler));
		};
		on('dom-ready', () => {
			if (this.disposed) return;
			try {
				this.installGuest();
				this.win.clearTimeout(this.startupTimer);
				this.webview.setZoomFactor(state.zoom);
				this.readyResolve();
				if (!initialized) {
					initialized = true;
					this.state.url = initialUrl;
					const load = initialUrl === 'about:blank' ? Promise.resolve() : this.loadUrl(initialUrl);
					void load
						.catch((error: unknown) => {
							if (!this.disposed && (error as { code?: string })?.code !== 'ERR_ABORTED')
								this.fail(error instanceof Error ? error.message : 'browser_load_failed');
						})
						.then(async () => {
							if (this.disposed) return;
							if (initialScroll) {
								try {
									await this.guest?.executeJavaScript(
										`scrollTo(${initialScroll.x},${initialScroll.y})`,
									);
								} catch {
									/* Page navigated. */
								}
							}
							this.loadResolve();
							this.sync();
						});
				} else this.sync();
			} catch (error) {
				this.fail(error instanceof Error ? error.message : String(error));
				this.readyReject(new BrowserError('browser_unavailable'));
				this.loadReject(new BrowserError('browser_unavailable'));
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
		this.startupTimer = this.win.setTimeout(() => {
			this.fail('browser_unavailable');
			this.readyReject(new BrowserError('browser_unavailable'));
			this.loadReject(new BrowserError('browser_unavailable'));
			this.dispose();
		}, 20000);
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
		// Install synchronous main-process policy before the first untrusted page.
		this.webview.setAttribute('src', 'about:blank');
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
	private sync(visited = false): void {
		if (this.disposed) return;
		try {
			const url = this.webview.getURL();
			if (url && !url.startsWith('chrome-error:')) this.state.url = url;
			this.state.title = this.state.url === 'about:blank' ? '' : this.webview.getTitle();
			this.state.canGoBack = this.webview.canGoBack();
			this.state.canGoForward = this.webview.canGoForward();
			if (visited) this.actions.visited(this.state.url, this.state.title);
		} catch {
			/* Before dom-ready. */
		}
		this.emit();
	}
	private installGuest(): void {
		const guest = this.api.webContents.fromId(this.webview.getWebContentsId());
		if (!guest) throw new BrowserError('browser_unavailable');
		if (guest.id === this.guest?.id && this.automation) return;
		this.automation?.dispose();
		for (const cleanup of this.guestCleanups.splice(0)) cleanup();
		this.guest = guest;
		this.automation = new BrowserAutomation(guest, this);
		this.permissionPolicy = installGuestPolicy(this.win, this.api, guest, this.webview.getAttribute('partition')!, (event, value) => {
				if (this.disposed) return;
				if (event === 'open') this.actions.open(value);
				else if (event === 'shortcut') this.shortcut?.(value);
				else if (event === 'permission') { this.permissionDenied = value; this.emit(); }
			}, this.actions.permissions?.());
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
					path: '',
				};
				this.downloads.push(row);
				this.downloadItems.set(id, item);
				const update = (state: unknown) => {
					row.received = item.getReceivedBytes();
					row.total = item.getTotalBytes();
					row.state = String(state);
					row.path = item.getSavePath();
					this.emit();
				};
				const offUpdate = listenNative(item, 'updated', (_e, status) => update(status));
				const offDone = listenNative(item, 'done', (_e, status) => {
					update(status);
					offUpdate();
					offDone();
					this.downloadItems.delete(id);
				});
				this.guestCleanups.push(offUpdate, offDone);
				this.emit();
			}),
		);
	}
	updatePermissions(): void { this.permissionPolicy?.setGrants(this.actions.permissions?.() ?? {}); }
	private loadUrl(url: string): Promise<void> {
		return this.navigateNative(() => this.webview.loadURL(url));
	}
	private navigateNative(work: () => Promise<void>): Promise<void> {
		if (this.disposed) return Promise.reject(new BrowserError('browser_page_closed'));
		// Replacing an in-flight native load retires that guest rather than allowing late events.
		if (this.navigation) { this.navigation.cancel('browser_navigation_cancelled'); return Promise.reject(new BrowserError('browser_page_closed')); }
		return new Promise<void>((resolve, reject) => {
			let settled = false;
			const finish = (error?: unknown) => {
				if (settled) return;
				settled = true;
				this.win.clearTimeout(timer);
				this.navigation = undefined;
				if (error) reject(error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Browser navigation failed')); else resolve();
			};
			const cancel = (reason: string) => {
				finish(new BrowserError(reason));
				this.fail(reason);
				this.dispose();
			};
			const timer = this.win.setTimeout(() => cancel('browser_navigation_timeout'), 30000);
			this.navigation = { cancel };
			try { void work().then(() => finish(), finish); }
			catch (error) { finish(error); }
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
			if ((error as { code?: string })?.code !== 'ERR_ABORTED') throw error;
		}
	}
	private historyNavigation(work: () => void): Promise<void> {
		return this.navigateNative(() => new Promise<void>((resolve, reject) => {
			const cleanup = () => {
				this.webview.removeEventListener('did-stop-loading', done);
				const index = this.cleanups.indexOf(cancel); if (index >= 0) this.cleanups.splice(index, 1);
			};
			const done = () => { cleanup(); resolve(); };
			const cancel = () => { cleanup(); reject(new BrowserError('browser_page_closed')); };
			this.cleanups.push(cancel);
			this.webview.addEventListener('did-stop-loading', done);
			try { work(); } catch (error) { cleanup(); reject(error instanceof Error ? error : new BrowserError('browser_failed')); }
		}));
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
		await this.historyNavigation(() => { if (hard) this.webview.reloadIgnoringCache(); else this.webview.reload(); });
	}
	stop(): void {
		if (this.navigation) { this.navigation.cancel('browser_navigation_cancelled'); return; }
		this.webview.stop();
		this.state.loading = false;
		this.emit();
	}
	zoom(value: number): void {
		this.state.zoom = clampZoom(value);
		if (this.guest) this.webview.setZoomFactor(this.state.zoom);
		this.emit();
	}
	find(text: string, forward = true, next = false): void {
		if (text) this.webview.findInPage(text, { forward, findNext: next });
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
		this.guest = undefined;
	}
}
