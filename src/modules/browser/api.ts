import { serviceKey } from '../../app/contracts/module';
import type { BrowserPageState, BrowserOpenRequest, BrowserSettings } from './core/model';
import type { BrowserProfile, ProfilePage } from './core/profiles';

export type { BrowserOpenRequest, BrowserSettings };
export type { BrowserProfile, ProfilePage };

export interface BrowserProfiles {
	list(): BrowserProfile[];
	create(label: string): Promise<BrowserProfile>;
	rename(id: string, label: string): Promise<void>;
	/** Review these pages before deletion; a changed set requires a fresh confirmation. */
	affectedPages(id: string): ProfilePage[];
	remove(id: string, confirmedPageIds: readonly string[]): Promise<void>;
	subscribe(listener: () => void): () => void;
}

/** Open a web page in NAND's browser (service `browser.open`). */
export interface BrowserOpener {
	/** Resolves with the page id; rejects with a localized message when the page cannot open. */
	open(request: BrowserOpenRequest): Promise<string>;
	/** For commands and buttons: like `open`, but reports failures as a notice. */
	show(request: BrowserOpenRequest): Promise<void>;
}

export const BROWSER_OPEN = serviceKey<BrowserOpener>('browser', 'open');
export const BROWSER_PROFILES = serviceKey<BrowserProfiles>('browser', 'profiles');

export interface BrowserViewState extends BrowserPageState {
	downloads: import('./core/model').BrowserDownload[];
	find: { matches: number; activeMatchOrdinal: number };
	permissionDenied: string;
	annotations: Array<{ grab: import('./core/model').BrowserGrab; note: string }>;
	viewport?: { width: number; height: number };
}
export interface BrowserReadableStore<T> {
	getState(this: void): T;
	getInitialState(this: void): T;
	subscribe(this: void, listener: (state: T, previous: T) => void): () => void;
}
export interface BrowserPageHandle {
	readonly id: string;
	readonly url: string;
	readonly title: string;
	readonly profileId: string;
	readonly store: BrowserReadableStore<BrowserViewState>;
	mount(placeholder: HTMLElement): void;
	/** A new owner Document retires the old guest even while this tab is inactive. */
	unmount(ownerDocument?: Document): void;
	viewportWidth(): number;
	viewportBounds(): { left: number; top: number; width: number; height: number };
	setViewport(size?: { width: number; height: number }): Promise<void>;
	setAnnotations(items: BrowserViewState['annotations']): void;
	navigate(input: string): Promise<void>;
	back(): Promise<void>;
	forward(): Promise<void>;
	reload(hard?: boolean): Promise<void>;
	stop(): void;
	setZoom(level: number): void;
	find(query: string, options?: { forward?: boolean; next?: boolean; matchCase?: boolean }): void;
	stopFind(): void;
	focus(): void;
	openDevTools(): void;
	openExternal(): void;
	setProfile(profileId: string): Promise<void>;
	startGrab(intent: 'copy' | 'annotate', selected: (grab: import('./core/model').BrowserGrab) => void): Promise<void>;
	stopGrab(): Promise<void>;
	captureScreenshot(full?: boolean): Promise<string>;
	downloadAction(id: string, action: 'cancel' | 'open' | 'show' | 'dismiss' | 'retry'): void;
	setShortcutHandler(handler: ((key: string) => void) | undefined): void;
	dispose(): void;
}
export interface BrowserHost {
	createPage(init: { url?: string; profileId?: string; zoom?: number; restoreId?: string }): BrowserPageHandle;
	getPage(id: string): BrowserPageHandle | undefined;
	disposePage(id: string): void;
	resolveInput(input: string): string | null;
	renderChrome(page: BrowserPageHandle): Promise<unknown>;
	readonly profiles: BrowserReadableStore<{ profiles: BrowserProfile[]; defaultProfileId: string }>;
	createProfile(name: string): Promise<BrowserProfile>;
	renameProfile(id: string, name: string): Promise<void>;
	deleteProfile(id: string, confirmedPageIds: readonly string[]): Promise<void>;
	affectedPages(id: string): ProfilePage[];
	clearCookies(profileId: string, origin?: string): Promise<void>;
	cookieCount(profileId: string): Promise<number>;
	detectBrowsers(): Promise<import('./core/cookies').DetectedBrowser[]>;
	importCookiesFromBrowser(
		source: { family: string; profileDir?: string },
		target: string,
	): Promise<import('./core/cookies').CookieImportResult>;
	importCookiesFromFile(path: string, target: string): Promise<import('./core/cookies').CookieImportResult>;
	chooseCookieFile(): Promise<string | undefined>;
	routeLink(url: string, event: MouseEvent, source?: 'terminal' | 'note'): void;
}
export const BROWSER_HOST = serviceKey<BrowserHost>('browser', 'host');
