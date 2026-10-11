import { Notice, Platform, requestUrl, type App } from 'obsidian';
import { t } from '../../../../shared/i18n';
import type { VaultSessionLease } from '../../../../host/desktop/browser-session';

declare const require: (id: string) => unknown;
const ORIGIN = 'https://music.163.com';
interface Cookie {
	name: string;
	value: string;
}
interface Session {
	cookies: { get(filter: { url: string }): Promise<Cookie[]>; flushStore(): Promise<void> };
	clearStorageData(): Promise<void>;
}
interface LoginWindow {
	webContents: {
		id: number;
		session: Session;
		setWindowOpenHandler(handler: () => { action: 'deny' }): void;
		on(event: 'will-navigate', handler: (event: { preventDefault(): void }, url: string) => void): void;
	};
	loadURL(url: string): Promise<unknown>;
	on(event: 'closed', handler: () => void): void;
	isDestroyed(): boolean;
	close(): void;
}
interface ElectronApi {
	BrowserWindow: new (options: Record<string, unknown>) => LoginWindow;
}
function electronApi(): ElectronApi {
	if (Platform.isMobile) throw new Error('UNSUPPORTED');
	try {
		const electron = require('electron') as Partial<ElectronApi> & { remote?: ElectronApi };
		const api =
			electron.BrowserWindow
				? (electron as ElectronApi)
				: (electron.remote ?? (require('@electron/remote') as ElectronApi));
		if (!api?.BrowserWindow) throw new Error('UNSUPPORTED');
		return api;
	} catch {
		throw new Error('UNSUPPORTED');
	}
}

/** Only the two music-site authentication cookies are sent to its API. */
export function musicCookieHeader(cookies: Cookie[]): string {
	return cookies
		.filter((c) => ['MUSIC_U', '__csrf'].includes(c.name) && /^[\x21-\x3A\x3C-\x7E]+$/.test(c.value))
		.map((c) => `${c.name}=${c.value}`)
		.join('; ');
}

/** Credentials stay in Electron's isolated local cookie store, never the settings file. */
export class NeteaseAccount {
	private session: Session | null = null;
	private lease?: VaultSessionLease;
	private pending?: Promise<Session>;
	private readonly abort = new AbortController();
	private cancelLogin: (() => void) | null = null;
	private disposed = false;
	loggedIn = false;
	error = '';
	constructor(private readonly app: App) {}

	private async getSession(interactive = false): Promise<Session> {
		if (this.disposed) throw new Error('browser_session_closed');
		if (this.session) return this.session;
		return this.pending ??= import('./session').then(({ homeSession }) => homeSession(this.app, this.app.workspace.containerEl.win, 'music', this.abort.signal, interactive)).then(lease => {
			this.lease = lease; this.session = lease.session; this.error = ''; return this.session;
		}).finally(() => { this.pending = undefined; });
	}

	async cookie(): Promise<string> {
		const cookies = await (await this.getSession()).cookies.get({ url: ORIGIN });
		const header = musicCookieHeader(cookies);
		this.loggedIn = /(?:^|; )MUSIC_U=/.test(header);
		return this.loggedIn ? header : '';
	}

	async restore(): Promise<void> {
		if (Platform.isMobile) return;
		try {
			await this.cookie();
		} catch (error) {
			this.loggedIn = false;
			this.error = error instanceof Error ? error.message : 'browser_session_unavailable';
			new Notice(t(`web.${this.error.startsWith('browser_session_') ? this.error : 'browser_session_unavailable'}`));
		}
	}

	async login(): Promise<void> {
		if (this.disposed || this.cancelLogin) return Promise.reject(new Error('BUSY'));
		const session = await this.getSession(true);
		if (this.disposed || this.cancelLogin) throw new Error('BUSY');
		return new Promise((resolve, reject) => {
			const api = electronApi();
			const win = new api.BrowserWindow({
				width: 1020,
				height: 760,
				title: 'NetEase Cloud Music',
				webPreferences: {
					session,
					nodeIntegration: false,
					contextIsolation: true,
					sandbox: true,
					webSecurity: true,
				},
			});
			this.session = win.webContents.session;
			this.lease!.protect(win.webContents.id);
			let done = false;
			let timer: number | undefined;
			const finish = (error?: Error): void => {
				if (done) return;
				done = true;
				window.clearTimeout(timer);
				window.clearTimeout(timeout);
				this.cancelLogin = null;
				if (!win.isDestroyed()) win.close();
				if (error) reject(error);
				else resolve();
			};
			const timeout = window.setTimeout(() => finish(new Error('TIMEOUT')), 5 * 60_000);
			this.cancelLogin = () => finish(new Error('CANCELLED'));
			win.on('closed', () => finish(new Error('CANCELLED')));
			win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
			win.webContents.on('will-navigate', (event, url) => {
				try {
					const parsed = new URL(url);
					if (parsed.protocol !== 'https:' || parsed.hostname !== 'music.163.com') event.preventDefault();
				} catch {
					event.preventDefault();
				}
			});
			const poll = async (): Promise<void> => {
				if (done) return;
				try {
					const cookie = await this.cookie();
					if (done) return;
					if (cookie) {
						const response = await requestUrl({
							url: `${ORIGIN}/api/nuser/account/get`,
							headers: { Cookie: cookie, Referer: ORIGIN },
							throw: false,
						});
						const body = response.json as { code?: number; profile?: { userId?: number } };
						if (done) return;
						if (body.code === 200 && typeof body.profile?.userId === 'number') {
							await (await this.getSession()).cookies.flushStore();
							if (!done) finish();
							return;
						}
					}
				} catch {
					/* Site may still be completing login; retry until timeout. */
				}
				if (!done)
					timer = window.setTimeout(() => {
						void poll();
					}, 1500);
			};
			void win
				.loadURL(ORIGIN)
				.then(() => poll())
				.catch(() => finish(new Error('LOAD_FAILED')));
		});
	}

	async logout(): Promise<void> {
		this.cancelLogin?.();
		this.loggedIn = false;
		const session = await this.getSession();
		await session.clearStorageData();
		await session.cookies.flushStore();
	}

	destroy(): void {
		this.disposed = true;
		this.cancelLogin?.();
		this.abort.abort(); this.lease?.dispose(); this.lease = undefined; this.session = null;
	}
}
