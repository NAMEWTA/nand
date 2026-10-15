import { createStore } from 'zustand/vanilla';
import { Notice, Menu, type App } from 'obsidian';
import type { BrowserHost, BrowserPageHandle, BrowserViewState } from '../api';
import { BrowserError, newPageState, type BrowserAgentDeliveryPort, type BrowserSettings } from '../core/model';
import type { BrowserProfile } from '../core/profiles';
import type { NativeHelperSqlite } from '../../agent/api';
import { terminalWebLinkAction } from '../core/link-policy';
import type { CookieImportResult } from '../core/cookies';
import type { SettingsHandle } from '../../../shared/settings/store';
import { normalizeBrowserNavigationUrl } from '../core/url';
import { BrowserProfileStore } from '../platform/profile-store';
import { BrowserStore } from '../platform/store';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { deviceId } from '../../../host/obsidian/storage/device-id';
import { acquireDebugger } from '../platform/desktop/debugger-lease';
import { BrowserPage } from '../platform/desktop/page';
import { RetainedPage } from '../platform/desktop/retained-page';
import { inSessionBroker } from '../platform/desktop/session-window';
import { prepareBrowserSession, type PreparedBrowserSession } from '../platform/desktop/prepared-session';
import { electronBrowserApi } from '../platform/desktop/electron-api';
import { t } from '../../../shared/i18n';
import { browserAgentMaterial } from '../core/agent-material';

export interface BrowserWorkspacePort {
	open(url?: string, profileId?: string, reuse?: boolean): Promise<string>;
	close(pageId: string): Promise<void>;
	list(): Array<{ id: string; title: string; url: string; profileId: string }>;
	activate(pageId: string): void;
}
export class BrowserEngine implements BrowserHost {
	readonly profiles = createStore<{ profiles: BrowserProfile[]; defaultProfileId: string }>(() => ({
		profiles: [],
		defaultProfileId: 'default',
	}));
	readonly metadata: BrowserProfileStore;
	readonly historyStore: BrowserStore;
	readonly ready: Promise<void>;
	private pages = new Map<string, PageHandle>();
	private sessions = new Map<string, Promise<PreparedBrowserSession>>();
	private stopped = false;
	private identity: 'cleaned' | 'native';
	private abort = new AbortController();
	private imports = new Map<string, Promise<CookieImportResult>>();
	private off: () => void;
	constructor(
		readonly app: App,
		readonly settings: SettingsHandle<BrowserSettings>,
		readonly agents: BrowserAgentDeliveryPort,
		readonly workspace: BrowserWorkspacePort,
		private helper: () => Promise<NativeHelperSqlite>,
		readonly renderChrome: BrowserHost['renderChrome'],
		readonly openSettings: () => void,
	) {
		this.identity = settings.get().identity;
		const refresh = () => {
			this.profiles.setState({
				profiles: this.metadata.list(),
				defaultProfileId: settings.get().defaultProfileId,
			});
		};
		this.metadata = new BrowserProfileStore(
			privateVaultStorage(app),
			`.nand/browser/${deviceId(app)}/profiles.json`,
			refresh,
		);
		this.historyStore = new BrowserStore(app, () => {
			for (const page of this.pages.values()) page.native?.updatePermissions();
			this.profiles.setState({});
		});
		this.ready = Promise.all([this.metadata.ready, this.historyStore.ready]).then(refresh);
		this.off = settings.subscribe(refresh);
	}
	private preparedSession(profile: string): Promise<PreparedBrowserSession> {
		const existing = this.sessions.get(profile);
		if (existing) return existing;
		const pending = inSessionBroker(this.window, () =>
			prepareBrowserSession(this.app, this.window, profile, this.abort.signal),
		).then((session) => {
			if (this.stopped) {
				session.dispose();
				throw new BrowserError('browser_disabled');
			}
			return session;
		});
		this.sessions.set(profile, pending);
		void pending.catch(() => {
			if (this.sessions.get(profile) === pending) this.sessions.delete(profile);
		});
		return pending;
	}
	async preparePageSession(win: Window, profile: string) {
		const lease = (await this.preparedSession(profile)).acquire(win);
		try {
			const identity = (await import('../platform/desktop/user-agent')).installUserAgent(
				this.window,
				lease.storagePath,
				this.identity,
			);
			return {
				...lease,
				dispose: () => {
					identity.dispose();
					lease.dispose();
				},
			};
		} catch (error) {
			lease.dispose();
			throw error;
		}
	}
	get window(): Window {
		return this.app.workspace.containerEl.win;
	}
	requireProfile(id: string) {
		if (this.stopped) throw new BrowserError('browser_disabled');
		const p = this.metadata.get(id);
		if (p.state !== 'ready') throw new BrowserError('browser_profile_deleting');
		return p;
	}
	resolveInput(input: string) {
		const s = this.settings.get();
		return normalizeBrowserNavigationUrl(input, s.searchEngine, s.customSearchTemplate);
	}
	createPage(init: { url?: string; profileId?: string; zoom?: number; restoreId?: string }): BrowserPageHandle {
		const id = init.restoreId ?? crypto.randomUUID();
		const found = this.pages.get(id);
		if (found) return found;
		const settings = this.settings.get(),
			profileId = init.profileId ?? settings.defaultProfileId;
		this.requireProfile(profileId);
		const url = this.resolveInput(init.url ?? settings.homePage);
		if (url === null) throw new BrowserError('browser_invalid_url');
		const page = new PageHandle(
			this,
			newPageState(id, { url, profileId, zoom: init.zoom ?? settings.defaultZoom }),
		);
		this.pages.set(id, page);
		return page;
	}
	getPage(id: string) {
		return this.pages.get(id);
	}
	disposePage(id: string) {
		this.pages.get(id)?.dispose();
		this.pages.delete(id);
	}
	createProfile(name: string) {
		return this.metadata.create(name);
	}
	renameProfile(id: string, name: string) {
		this.requireProfile(id);
		return this.metadata.rename(id, name);
	}
	affectedPages(id: string) {
		return this.workspace.list().filter((p) => p.profileId === id);
	}
	async deleteProfile(id: string, confirmedPageIds: readonly string[]) {
		if (id === 'default') throw new BrowserError('browser_profile_default');
		const expected = this.affectedPages(id)
			.map((p) => p.id)
			.sort();
		if (JSON.stringify(expected) !== JSON.stringify([...confirmedPageIds].sort()))
			throw new BrowserError('browser_profile_pages_changed');
		if (this.stopped) throw new BrowserError('browser_disabled');
		this.metadata.get(id);
		await this.metadata.markDeleting(id);
		await this.imports.get(id)?.catch(() => undefined);
		for (const page of this.affectedPages(id)) await this.workspace.close(page.id);
		for (const page of [...this.pages.values()]) if (page.profileId === id) this.disposePage(page.id);
		const prepared = await this.preparedSession(id);
		const lease = prepared.acquire(this.window);
		try {
			await lease.session.clearStorageData();
			await lease.session.clearCache();
			await lease.clearRecovery();
		} finally {
			lease.dispose();
			prepared.dispose();
			this.sessions.delete(id);
		}
		await this.historyStore.removeProfilePermissions(id);
		await this.metadata.remove(id);
		if (this.settings.get().defaultProfileId === id)
			await this.settings.update((s) => {
				s.defaultProfileId = 'default';
			});
	}
	private async session<T>(id: string, action: (path: string) => Promise<T>): Promise<T> {
		this.requireProfile(id);
		const lease = (await this.preparedSession(id)).acquire(this.window);
		try {
			return await action(lease.storagePath);
		} finally {
			lease.dispose();
		}
	}
	async clearCookies(id: string, origin?: string) {
		await this.session(id, async (path) =>
			(await import('../platform/desktop/cookies/write')).cookieSession(this.window).clear(path, origin),
		);
	}
	async cookieCount(id: string) {
		return this.session(id, async (path) =>
			(await import('../platform/desktop/cookies/write')).cookieSession(this.window).count(path),
		);
	}
	async detectBrowsers() {
		return (await import('../platform/desktop/cookies/detect')).detectBrowsers();
	}
	private import(id: string, work: (directory: string) => Promise<CookieImportResult>): Promise<CookieImportResult> {
		if (this.imports.has(id)) return Promise.reject(new Error(t('browser.cookie.busy')));
		const operation = this.session(id, work).then(async (result) => {
			if (result.imported) await this.metadata.setSource(id, result.source);
			return result;
		});
		this.imports.set(id, operation);
		void operation.finally(() => this.imports.delete(id)).catch(() => undefined);
		return operation;
	}
	importCookiesFromBrowser(source: { family: string; profileDir?: string }, id: string) {
		return this.import(id, async (directory) => {
			const sources = await this.detectBrowsers(),
				browser = sources.find((b) => b.family === source.family);
			if (!browser) throw new Error(t('browser.cookie.notFound'));
			const { browserTempPath } = await import('../platform/desktop/paths');
			return (await import('../platform/desktop/cookies/import')).importBrowserCookies(
				this.window,
				browser,
				source.profileDir,
				directory,
				await browserTempPath(this.app),
				await this.helper(),
				this.abort.signal,
			);
		});
	}
	importCookiesFromFile(path: string, id: string) {
		return this.import(id, async (directory) =>
			(await import('../platform/desktop/cookies/import')).importCookieFile(this.window, path, directory),
		);
	}
	async chooseCookieFile() {
		return (await import('../platform/desktop/paths')).chooseCookieFile(this.window);
	}
	permissions(id: string) {
		const prefix = id + '|';
		return Object.fromEntries(
			Object.entries(this.historyStore.permissions)
				.filter(([key]) => key.startsWith(prefix))
				.map(([key, value]) => [key.slice(prefix.length), value]),
		);
	}
	async grant(id: string, origin: string, permission: string, allowed: boolean) {
		this.requireProfile(id);
		await this.historyStore.grant(id + '|' + origin, permission, allowed);
		for (const p of this.pages.values())
			if (p.profileId === id) {
				p.native?.updatePermissions();
				if (p.native) p.native.permissionDenied = '';
				p.store.setState({ permissionDenied: '' });
			}
	}
	copyText(text: string) {
		electronBrowserApi(this.window).clipboard.writeText(text);
	}
	copyImage(data: string) {
		const api = electronBrowserApi(this.window);
		api.clipboard.writeImage(api.nativeImage.createFromDataURL(data));
	}
	async attach(sessionId: string, text: string, image?: string | string[]) {
		const images = typeof image === 'string' ? [image] : (image ?? []);
		const files = (
			await Promise.all(
				images.map(async (data) =>
					(await import('../platform/desktop/image-artifacts')).saveBrowserImage(this.app, data),
				),
			)
		).flat();
		await this.agents.attach(sessionId, browserAgentMaterial(text, []), files);
	}
	routeLink(url: string, event: MouseEvent, source: 'terminal' | 'note' = 'terminal') {
		const normalized = normalizeBrowserNavigationUrl(url);
		if (!normalized || !/^https?:/.test(normalized)) return;
		const action = terminalWebLinkAction(this.settings.get(), event, source);
		const open = (target: 'nand' | 'system') => {
			if (target === 'system') void electronBrowserApi(this.window).shell.openExternal(normalized);
			else void this.workspace.open(normalized, undefined, true).catch((error) => new Notice(String(error)));
		};
		if (action === 'menu') {
			const menu = new Menu();
			menu.addItem((i) =>
				i
					.setTitle(t('browser.link.nand'))
					.setIcon('globe')
					.onClick(() => open('nand')),
			);
			menu.addItem((i) =>
				i
					.setTitle(t('browser.external'))
					.setIcon('external-link')
					.onClick(() => open('system')),
			);
			menu.addItem((i) =>
				i
					.setTitle(t('browser.copyUrl'))
					.setIcon('copy')
					.onClick(() => this.copyText(normalized)),
			);
			menu.showAtMouseEvent(event);
			return;
		}
		open(action);
	}
	async dispose() {
		if (this.stopped) return;
		this.stopped = true;
		this.abort.abort();
		this.off();
		for (const page of this.pages.values()) page.dispose();
		this.pages.clear();
		await Promise.allSettled([...this.imports.values()]);
		await Promise.allSettled([...this.sessions.values()].map(async (session) => (await session).dispose()));
		this.sessions.clear();
		await Promise.all([this.metadata.shutdown(), this.historyStore.shutdown()]);
	}
}
export class PageHandle implements BrowserPageHandle {
	readonly store;
	native?: BrowserPage;
	private history?: BrowserPage['history'];
	private retained?: RetainedPage;
	private placeholder?: HTMLElement;
	private disposed = false;
	private viewportRelease?: () => void;
	private shortcut?: (key: string) => void;
	constructor(
		private host: BrowserEngine,
		state: ReturnType<typeof newPageState>,
	) {
		this.store = createStore<BrowserViewState>(() => ({
			...state,
			downloads: [],
			find: { matches: 0, activeMatchOrdinal: 0 },
			permissionDenied: '',
			annotations: [],
		}));
	}
	get id() {
		return this.store.getState().id;
	}
	get url() {
		return this.store.getState().url;
	}
	get title() {
		return this.store.getState().title;
	}
	get profileId() {
		return this.store.getState().profileId ?? 'default';
	}
	mount(placeholder: HTMLElement) {
		if (this.disposed) return;
		this.placeholder = placeholder;
		if (this.retained?.doc !== placeholder.ownerDocument) {
			this.history = this.native?.history ?? this.history;
			this.viewportRelease?.();
			this.viewportRelease = undefined;
			this.store.setState({ viewport: undefined });
			this.native?.dispose();
			this.retained?.dispose();
			this.native = undefined;
			this.retained = undefined;
		}
		if (!this.native || this.native.disposed) {
			this.history = this.native?.history ?? this.history;
			this.viewportRelease?.();
			this.viewportRelease = undefined;
			this.store.setState({ viewport: undefined });
			this.native?.dispose();
			this.retained?.dispose();
			this.retained = new RetainedPage(placeholder.ownerDocument, this.id);
			const profileId = this.profileId,
				retained = this.retained;
			this.native = new BrowserPage(
				{ ...this.store.getState() },
				retained.element,
				() => this.host.preparePageSession(placeholder.win, profileId),
				{
					changed: (state) => {
						if (this.retained !== retained) return;
						const page = this.native;
						this.store.setState({
							...state,
							downloads: page ? page.downloads.map((download) => ({ ...download })) : [],
							find: page ? { ...page.findResult } : { matches: 0, activeMatchOrdinal: 0 },
							permissionDenied: page?.permissionDenied ?? '',
						});
						if (state.error) retained.unmount();
						else if (this.placeholder?.ownerDocument === retained.doc) retained.mount(this.placeholder);
						else retained.unmount();
					},
					visited: (url, title) => this.host.historyStore.record(url, title),
					permissions: () => this.host.permissions(profileId),
					open: (url) => {
						void this.host.workspace.open(url, profileId).catch((error) => new Notice(String(error)));
					},
				},
				this.host.window,
				this.history,
			);
			this.native.shortcut = (key) => this.shortcut?.(key);
		}
		if (!this.store.getState().error) this.retained?.mount(placeholder);
	}
	viewportWidth() {
		return this.native?.webview.clientWidth ?? 1000;
	}
	viewportBounds() {
		return this.native?.webview.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 };
	}
	setAnnotations(items: BrowserViewState['annotations']) {
		this.store.setState({ annotations: items });
	}
	async setViewport(size?: { width: number; height: number }) {
		const page = this.page();
		await page.ready;
		if (!page.guest) throw new BrowserError('browser_unavailable');
		this.viewportRelease ??= acquireDebugger(page.guest);
		await page.guest.debugger.sendCommand(
			size ? 'Emulation.setDeviceMetricsOverride' : 'Emulation.clearDeviceMetricsOverride',
			size ? { ...size, deviceScaleFactor: 1, mobile: false } : {},
		);
		this.store.setState({ viewport: size });
	}

	unmount(ownerDocument?: Document) {
		this.placeholder = undefined;
		this.retained?.unmount();
		if (ownerDocument && this.retained?.doc !== ownerDocument) {
			this.history = this.native?.history ?? this.history;
			this.viewportRelease?.();
			this.viewportRelease = undefined;
			this.native?.dispose();
			this.retained?.dispose();
			this.native = undefined;
			this.retained = undefined;
			this.store.setState({ viewport: undefined });
		}
	}
	private page() {
		if (this.disposed || !this.native || this.native.disposed) throw new BrowserError('browser_page_closed');
		return this.native;
	}
	async navigate(input: string) {
		const url = this.host.resolveInput(input);
		if (url === null) throw new BrowserError('browser_invalid_url');
		await this.page().navigate(url);
	}
	back() {
		return this.page().back();
	}
	forward() {
		return this.page().forward();
	}
	async reload(hard = false) {
		if (this.native?.disposed && this.placeholder) {
			this.store.setState({ error: null });
			this.mount(this.placeholder);
			return;
		}
		await this.page().reload(hard);
	}
	stop() {
		this.page().stop();
	}
	setZoom(level: number) {
		this.page().zoom(level);
	}
	find(query: string, options: { forward?: boolean; next?: boolean; matchCase?: boolean } = {}) {
		this.page().find(query, options.forward, options.next, options.matchCase);
	}
	stopFind() {
		this.page().find('');
	}
	focus() {
		this.native?.webview.focus();
	}
	openDevTools() {
		this.page().webview.openDevTools();
	}
	openExternal() {
		if (/^https?:/.test(this.url)) void this.page().api.shell.openExternal(this.url);
	}
	async setProfile(id: string) {
		this.host.requireProfile(id);
		if (id === this.profileId) return;
		this.history = undefined;
		this.viewportRelease?.();
		this.viewportRelease = undefined;
		this.store.setState({ viewport: undefined });
		this.native?.dispose();
		this.retained?.dispose();
		this.native = undefined;
		this.retained = undefined;
		this.store.setState({ profileId: id, error: null });
		if (this.placeholder) {
			this.mount(this.placeholder);
			await this.page().ready;
		}
	}
	async startGrab(_intent: 'copy' | 'annotate', selected: Parameters<BrowserPageHandle['startGrab']>[1]) {
		const page = this.page();
		await page.ready;
		await page.automation?.design(selected);
	}
	async stopGrab() {
		await this.native?.automation?.design();
	}
	captureScreenshot(full = false) {
		return this.page().screenshot(full);
	}
	downloadAction(id: string, action: 'cancel' | 'open' | 'show' | 'dismiss' | 'retry') {
		if (action === 'retry') {
			const row = this.native?.downloads.find((d) => d.id === id);
			if (row?.url) this.native?.guest?.downloadURL(row.url);
		} else this.page().downloadAction(id, action);
	}
	setShortcutHandler(handler: ((key: string) => void) | undefined) {
		this.shortcut = handler;
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.unmount();
		this.viewportRelease?.();
		this.viewportRelease = undefined;
		this.native?.dispose();
		this.retained?.dispose();
		this.shortcut = undefined;
	}
}
