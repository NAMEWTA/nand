import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PageHandle, type BrowserEngine } from '../../services/host';
import { newPageState } from '../../core/model';
import type { BrowserPage } from './page';
import type { GuestHistory, WebviewElement } from './electron-api';

// Keep PageHandle, BrowserPage, RetainedPage and automation lifetimes real. Only
// the Electron IPC boundary and Obsidian's DOM extensions are supplied here.
const boundary = vi.hoisted(() => ({
	guests: new Map<number, unknown>(),
	attached: new Map<HTMLElement, (id: number) => void>(),
}));
vi.mock('./electron-api', async (original) => ({
	...(await original<typeof import('./electron-api')>()),
	electronBrowserApi: () => ({ webContents: { fromId: (id: number) => boundary.guests.get(id) } }),
}));
vi.mock('./guest-policy', () => ({
	installGuestPolicy: () => ({ dispose: vi.fn(), setGrants: vi.fn() }),
}));
vi.mock('./history-guest', () => ({
	prepareHistoryGuest: (_win: Window, element: HTMLElement, attached: (id: number) => void) => {
		boundary.attached.set(element, attached);
		return () => boundary.attached.delete(element);
	},
}));

let nextId = 0;
class NativeFixture {
	readonly id = ++nextId;
	history: GuestHistory = { entries: [], index: -1 };
	rendererReady = false;
	zoom = 1;
	zoomFailure = false;
	restoreFailure = false;
	private completeRestore?: () => void;
	readonly session = new EventEmitter();
	readonly restore = vi.fn((history: GuestHistory) => {
		if (this.history.entries.length) throw Error('restore requires a never-loaded guest');
		if (this.restoreFailure) return Promise.reject(Error('fixture restore failure'));
		this.history = structuredClone(history);
		this.event('did-start-loading');
		return new Promise<void>((resolve) => {
			this.completeRestore = resolve;
		});
	});
	readonly setZoom = vi.fn((zoom: number) => {
		this.requireRenderer();
		if (this.zoomFailure) throw Error('fixture zoom initialization failure');
		this.zoom = zoom;
	});
	readonly guest = Object.assign(new EventEmitter(), {
		id: this.id,
		session: this.session,
		navigationHistory: {
			getAllEntries: () => structuredClone(this.history.entries),
			getActiveIndex: () => this.history.index,
			restore: this.restore,
		},
		getURL: () => this.history.entries[this.history.index]?.url ?? '',
		getTitle: () => this.history.entries[this.history.index]?.title ?? '',
		executeJavaScript: vi.fn(async () => undefined),
	});
	constructor(readonly element: WebviewElement) {
		boundary.guests.set(this.id, this.guest);
		Object.assign(element, {
			getWebContentsId: () => {
				this.requireRenderer();
				return this.id;
			},
			getURL: () => {
				this.requireRenderer();
				return this.guest.getURL();
			},
			getTitle: () => {
				this.requireRenderer();
				return this.guest.getTitle();
			},
			canGoBack: () => this.history.index > 0,
			canGoForward: () => this.history.index < this.history.entries.length - 1,
			setZoomFactor: this.setZoom,
			getZoomFactor: () => {
				this.requireRenderer();
				return this.zoom;
			},
			loadURL: async (url: string) => {
				this.requireRenderer();
				this.navigate(url);
			},
			goBack: () => {
				this.requireRenderer();
				this.history.index--;
				this.event('did-navigate');
				this.event('did-stop-loading');
			},
			stop: vi.fn(),
		});
	}
	private requireRenderer() {
		if (!this.rendererReady) throw Error('The WebView must emit dom-ready before this method can be called');
	}
	event(name: string) {
		this.element.dispatchEvent(new (this.element.win as Window & typeof globalThis).Event(name));
	}
	domReady() {
		if (!this.history.entries.length) this.history = { entries: [{ url: 'about:blank', title: '' }], index: 0 };
		this.rendererReady = true;
		this.event('dom-ready');
	}
	finishRestore() {
		this.event('did-navigate');
		this.domReady();
		this.event('did-stop-loading');
		this.completeRestore?.();
	}
	navigate(url: string, inPage = false, emitReady = true) {
		this.history.entries = this.history.entries.slice(0, this.history.index + 1);
		this.history.entries.push({ url, title: url === 'about:blank' ? '' : 'Fixture' });
		this.history.index++;
		// A full navigation commits before dom-ready. Recovery must not depend on
		// renderer methods being callable during either navigation event.
		this.rendererReady = inPage;
		this.event(inPage ? 'did-navigate-in-page' : 'did-navigate');
		if (emitReady) this.domReady();
		this.event('did-stop-loading');
	}
}
const fixtures = new Map<HTMLElement, NativeFixture>();
const handles: PageHandle[] = [];
const restoreDom: Array<() => void> = [];
let popup: HTMLIFrameElement;
const leases: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
function installDom(win: Window) {
	const realm = win as Window & typeof globalThis;
	for (const [name, descriptor] of Object.entries({
		win: {
			get(this: HTMLElement) {
				return this.ownerDocument.defaultView;
			},
		},
		createDiv: {
			value(this: HTMLElement, options?: { cls?: string }) {
				return this.createEl('div', options);
			},
		},
		createEl: {
			value(this: HTMLElement, tag: string, options?: { cls?: string }) {
				const element = this.ownerDocument.createElement(tag);
				if (options?.cls) element.className = options.cls;
				this.appendChild(element);
				if (tag === 'webview') fixtures.set(element, new NativeFixture(element as WebviewElement));
				return element;
			},
		},
	})) {
		const original = Object.getOwnPropertyDescriptor(realm.HTMLElement.prototype, name);
		Object.defineProperty(realm.HTMLElement.prototype, name, { configurable: true, ...descriptor });
		restoreDom.push(() => {
			if (original) Object.defineProperty(realm.HTMLElement.prototype, name, original);
			else Reflect.deleteProperty(realm.HTMLElement.prototype, name);
		});
	}
}
function placeholder(doc: Document) {
	const el = doc.body.createDiv();
	vi.spyOn(el, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
	return el;
}
function page() {
	const host = {
		window,
		preparePageSession: vi.fn(async () => {
			const lease = {
				bind: vi.fn(),
				protect: vi.fn(),
				onDownloadError: vi.fn(),
				dispose: vi.fn(),
				storagePath: '/fixture',
			};
			leases.push(lease);
			return lease;
		}),
		permissions: () => ({}),
		historyStore: { record: vi.fn() },
		resolveInput: (url: string) => url,
	} as unknown as BrowserEngine;
	const handle = new PageHandle(
		host,
		newPageState('page', { url: 'https://example.com/one', profileId: 'secondary', zoom: 1.25 }),
	);
	handles.push(handle);
	handle.mount(placeholder(document));
	return handle;
}
async function attached(page: BrowserPage) {
	await vi.waitFor(() => expect(page.webview.getAttribute('src')).toBe('about:blank'));
	const fixture = fixtures.get(page.webview)!;
	boundary.attached.get(page.webview)?.(fixture.id);
	return fixture;
}
async function ready(page: BrowserPage) {
	const fixture = await attached(page);
	if (fixture.restore.mock.calls.length) fixture.finishRestore();
	else fixture.domReady();
	await page.initialLoad;
	return fixture;
}
beforeEach(() => {
	installDom(window);
	popup = document.body.appendChild(document.createElement('iframe'));
	installDom(popup.contentWindow!);
});
afterEach(() => {
	for (const handle of handles.splice(0)) handle.dispose();
	for (const lease of leases.splice(0)) expect(lease.dispose).toHaveBeenCalledTimes(1);
	expect(boundary.attached.size).toBe(0);
	for (const fixture of fixtures.values()) expect(fixture.session.listenerCount('will-download')).toBe(0);
	fixtures.clear();
	boundary.guests.clear();
	popup.remove();
	document.body.replaceChildren();
	for (const restore of restoreDom.splice(0).reverse()) restore();
	vi.restoreAllMocks();
});

it('recovers the latest full and in-page navigation history after migration, crash and retry', async () => {
	const handle = page();
	const first = handle.native!;
	await ready(first);
	await handle.navigate('https://example.com/two');
	await handle.navigate('https://example.com/three');
	await handle.back();
	const beforeMove = structuredClone(first.history);
	handle.mount(placeholder(popup.contentDocument!));
	expect(first.disposed).toBe(true);
	const moved = handle.native!;
	const fixture = await attached(moved);
	let rendererReady = false;
	void moved.ready.then(
		() => {
			rendererReady = true;
		},
		() => undefined,
	);
	await Promise.resolve();
	expect(fixture.restore).toHaveBeenCalledWith(beforeMove);
	expect(fixture.setZoom).not.toHaveBeenCalled();
	expect(rendererReady).toBe(false);
	fixture.finishRestore();
	await moved.initialLoad;
	expect(fixture.zoom).toBe(1.25);
	fixture.navigate('https://example.com/after-return', false, false);
	await vi.waitFor(() => expect(moved.history?.entries.at(-1)?.url).toBe('https://example.com/after-return'));
	expect(fixture.rendererReady).toBe(false);
	fixture.domReady();
	fixture.navigate('https://example.com/after-return#section', true);
	await vi.waitFor(() => expect(moved.history?.entries.at(-1)?.url).toBe('https://example.com/after-return#section'));
	await handle.navigate('https://example.com/forward');
	await handle.back();
	await vi.waitFor(() => expect(moved.history).toEqual(fixture.history));
	const latest = structuredClone(moved.history);
	expect(latest).not.toEqual(beforeMove);
	fixture.event('render-process-gone');
	await vi.waitFor(() => expect(moved.disposed).toBe(true));
	expect(handle.store.getState().error).toBe('browser_guest_crashed');
	await handle.reload();
	const retried = handle.native!;
	expect(retried).not.toBe(moved);
	const recovered = await ready(retried);
	expect(recovered.history).toEqual(latest);
	expect(retried.history).toEqual(latest);
	expect(handle.url).toBe('https://example.com/after-return#section');
	expect(handle.store.getState()).toMatchObject({
		error: null,
		canGoBack: true,
		canGoForward: true,
		profileId: 'secondary',
		zoom: 1.25,
	});
	expect(recovered.zoom).toBe(1.25);
	expect(retried.webview.ownerDocument).toBe(popup.contentDocument);
});

it('disposes a renderer initialization failure so Retry creates a new usable page', async () => {
	const handle = page();
	const failed = handle.native!;
	const fixture = await attached(failed);
	fixture.zoomFailure = true;
	fixture.domReady();
	await expect(failed.ready).rejects.toThrow('fixture zoom initialization failure');
	await expect(failed.initialLoad).rejects.toThrow('fixture zoom initialization failure');
	expect(failed.disposed).toBe(true);
	expect(failed.webview.isConnected).toBe(false);
	expect(failed.guest).toBeUndefined();
	expect(leases[0]!.dispose).toHaveBeenCalledTimes(1);
	await handle.reload();
	expect(handle.native).not.toBe(failed);
	const recovered = await ready(handle.native!);
	expect(handle.url).toBe('https://example.com/one');
	expect(handle.store.getState().error).toBeNull();
	expect(recovered.zoom).toBe(1.25);
});

it('releases a failed main-process restore and retries its history in a fresh guest', async () => {
	const handle = page();
	await ready(handle.native!);
	await handle.navigate('https://example.com/latest');
	const latest = structuredClone(handle.native!.history);
	handle.mount(placeholder(popup.contentDocument!));
	const failed = handle.native!;
	fixtures.get(failed.webview)!.restoreFailure = true;
	await attached(failed);
	await expect(failed.ready).rejects.toThrow('fixture restore failure');
	await expect(failed.initialLoad).rejects.toThrow('fixture restore failure');
	expect(failed.disposed).toBe(true);
	expect(failed.webview.isConnected).toBe(false);
	await handle.reload();
	const recovered = await ready(handle.native!);
	expect(recovered.history).toEqual(latest);
	expect(handle.url).toBe('https://example.com/latest');
	expect(handle.store.getState().error).toBeNull();
});

it('creates guests with an opaque canvas so undeclared pages stay readable on dark hosts', async () => {
	const handle = page();
	const native = handle.native!;
	await ready(native);
	const preferences = native.webview.getAttribute('webpreferences')!.split(',');
	expect(preferences).toContain('transparent=false');
	expect(preferences).toContain('sandbox=true');
	expect(preferences).toContain('contextIsolation=true');
});
