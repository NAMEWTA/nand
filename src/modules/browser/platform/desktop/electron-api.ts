import { BrowserError } from '../../core/model';
export type NativeListener = (...args: unknown[]) => void;
export interface NativeEvents {
	on(name: string, listener: NativeListener): void;
	removeListener(name: string, listener: NativeListener): void;
}
export interface NativeImage {
	toDataURL(): string;
	toPNG(): Uint8Array;
}
export interface GuestDebugger extends NativeEvents {
	attach(version: string): void;
	detach(): void;
	isAttached(): boolean;
	sendCommand(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<unknown>;
}
export interface GuestContents extends NativeEvents {
	id: number;
	debugger: GuestDebugger;
	session: GuestSession;
	isDestroyed(): boolean;
	getURL(): string;
	getTitle(): string;
	close(): void;
	setWindowOpenHandler(
		handler: (details: { url: string; frameName: string; disposition: string; features: string }) => {
			action: 'deny' | 'allow';
			overrideBrowserWindowOptions?: Record<string, unknown>;
		},
	): void;
	executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
	capturePage(rect?: { x: number; y: number; width: number; height: number }): Promise<NativeImage>;
}
export interface GuestSession extends NativeEvents {
	clearStorageData(): Promise<void>;
	clearCache(): Promise<void>;
	setPermissionRequestHandler(
		handler: (_guest: unknown, _permission: string, callback: (allowed: boolean) => void) => void,
	): void;
}
export interface DownloadItem extends NativeEvents {
	getFilename(): string;
	getReceivedBytes(): number;
	getTotalBytes(): number;
	getSavePath(): string;
	cancel(): void;
	isDestroyed?: () => boolean;
}
export interface GuestWindow extends NativeEvents {
	close(): void;
	isDestroyed(): boolean;
	webContents: GuestContents;
}
export interface WebviewElement extends HTMLElement {
	getWebContentsId(): number;
	getURL(): string;
	getTitle(): string;
	loadURL(url: string): Promise<void>;
	reload(): void;
	reloadIgnoringCache(): void;
	stop(): void;
	canGoBack(): boolean;
	canGoForward(): boolean;
	goBack(): void;
	goForward(): void;
	setZoomFactor(value: number): void;
	getZoomFactor(): number;
	findInPage(text: string, options?: Record<string, unknown>): number;
	stopFindInPage(action: string): void;
	openDevTools(): void;
}
export interface ElectronBrowserApi {
	require?: (name: string) => unknown;
	webContents: { fromId(id: number): GuestContents | undefined };
	session: { fromPartition(partition: string): GuestSession };
	app: { getPath(name: string): string };
	shell: {
		openExternal(url: string): Promise<void>;
		openPath(path: string): Promise<string>;
		showItemInFolder(path: string): void;
	};
	clipboard: { writeText(text: string): void; writeImage(image: NativeImage): void };
	nativeImage: { createFromDataURL(data: string): NativeImage };
}
export function electronBrowserApi(win: Window): ElectronBrowserApi {
	try {
		const runtimeRequire = win.require;
		const electron = runtimeRequire('electron') as Partial<ElectronBrowserApi> & { remote?: ElectronBrowserApi };
		const api = electron.webContents
			? (electron as ElectronBrowserApi)
			: (electron.remote ?? (runtimeRequire('@electron/remote') as ElectronBrowserApi));
		if (!api.webContents?.fromId || !api.session?.fromPartition) throw new Error();
		return api;
	} catch {
		throw new BrowserError('browser_unavailable');
	}
}
export function listenNative(target: NativeEvents, name: string, listener: NativeListener): () => void {
	target.on(name, listener);
	return () => {
		try {
			target.removeListener(name, listener);
		} catch {
			/* Guest already destroyed. */
		}
	};
}
