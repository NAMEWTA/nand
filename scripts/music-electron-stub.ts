export let cookies: { name: string; value: string }[] = [];
export let flushes = 0;
export let windows: BrowserWindow[] = [];
export let failLoad = false;
export const localSession = Object.assign(new EventEmitter(), {
	storagePath: '',
	setCodeCachePath: (_path: string) => {},
	setPermissionRequestHandler: (_handler: unknown) => {},
	setPermissionCheckHandler: (_handler: unknown) => {},
	cookies: {
		get: async () => cookies,
		flushStore: async () => {
			flushes += 1;
		},
	},
	clearStorageData: async () => {
		cookies = [];
	},
});
export function setCookies(next: typeof cookies): void {
	cookies = [...next];
}
export function setFailLoad(next: boolean): void {
	failLoad = next;
}
export const session = { fromPath: (directory: string) => { localSession.storagePath = directory; return localSession; } };
const webContents = { fromId: (id: number) => windows.find(win => win.webContents.id === id)?.webContents, getAllWebContents: () => windows.filter(win => !win.closed).map(win => win.webContents) };
const vmContext = { process: { execPath: process.execPath, getBuiltinModule: () => ({ createRequire: () => (name: string) => name === 'electron' ? { session, webContents } : requireNative(name) }) }, URL };
export const app = { getPath: () => process.cwd() + '/scripts/tmp/music-unused-host' };
export function runtimeRequire(name: string): unknown {
	if (name === '@electron/remote') return { app, require: (module: string) => module === 'node:vm' ? { runInThisContext: (source: string) => runInNewContext(source, vmContext) } : requireNative(module) };
	return requireNative(name);
}
export class BrowserWindow {
	closed = false;
	onClosed = () => {};
	webContents = {
		id: windows.length + 1,
		isDestroyed: () => this.closed,
		session: localSession,
		setWindowOpenHandler: (_handler: unknown) => {},
		on: (_event: string, _handler: unknown) => {},
		removeListener: (_event: string, _handler: unknown) => {},
	};
	constructor(readonly options: Record<string, unknown>) {
		windows = [...windows, this];
	}
	async loadURL(_url: string): Promise<void> {
		if (failLoad) throw new Error('offline');
	}
	on(_event: string, listener: () => void): void {
		this.onClosed = listener;
	}
	isDestroyed(): boolean {
		return this.closed;
	}
	close(): void {
		this.closed = true;
		this.onClosed();
	}
}
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { EventEmitter } from 'node:events';
const requireNative = createRequire(process.cwd() + '/package.json');
