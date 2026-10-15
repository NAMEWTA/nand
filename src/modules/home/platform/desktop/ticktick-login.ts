// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/ticktick-login-modal.ts
import { Platform, type App } from 'obsidian';
import { acquireVaultSession } from '../../../../host/desktop/browser-session';
import { desktopRemote } from '../../../../host/desktop/electron-main';
/** The login window and its local session belong to this vault and dialog. */
export async function loginTickTick(
	app: App,
	owner: Window,
	region: 'dida365' | 'ticktick',
	signal: AbortSignal,
): Promise<{ cookie: string; csrf: string }> {
	if (Platform.isMobile) throw Error('UNSUPPORTED');
	const origin = region === 'dida365' ? 'https://dida365.com' : 'https://ticktick.com';
	const lease = await acquireVaultSession(app, owner, { profile: `home-${region}`, signal });
	if (signal.aborted) {
		lease.dispose();
		throw Error('CANCELLED');
	}
	try {
		return await new Promise((resolve, reject) => {
			const api = desktopRemote(owner).require('electron') as {
				BrowserWindow: new (options: Record<string, unknown>) => {
					webContents: { id: number };
					on(event: string, handler: () => void): void;
					loadURL(url: string): Promise<void>;
					isDestroyed(): boolean;
					close(): void;
				};
			};
			const win = new api.BrowserWindow({
				width: 960,
				height: 720,
				webPreferences: {
					session: lease.session,
					nodeIntegration: false,
					contextIsolation: true,
					sandbox: true,
					webSecurity: true,
				},
			});
			lease.protect(win.webContents.id);
			let done = false,
				timer: number | undefined;
			const finish = (value?: { cookie: string; csrf: string }, error?: Error) => {
				if (done) return;
				done = true;
				owner.clearTimeout(timer);
				owner.clearTimeout(timeout);
				signal.removeEventListener('abort', abort);
				owner.removeEventListener('unload', abort);
				if (!win.isDestroyed()) win.close();
				if (value) resolve(value);
				else reject(error ?? Error('CANCELLED'));
			};
			const abort = () => finish();
			signal.addEventListener('abort', abort, { once: true });
			owner.addEventListener('unload', abort, { once: true });
			const timeout = owner.setTimeout(() => finish(undefined, Error('TIMEOUT')), 300000);
			win.on('closed', () => finish());
			const poll = async () => {
				if (done) return;
				try {
					const cookies = await lease.session.cookies.get({ url: origin });
					if (done) return;
					const cookie = cookies.find((c) => c.name === 't')?.value,
						csrf = cookies.find((c) => c.name === '_csrf_token')?.value;
					if (cookie && csrf) {
						await lease.session.cookies.flushStore();
						if (!done) finish({ cookie, csrf });
						return;
					}
				} catch {
					/* Authentication can still be completing. */
				}
				if (!done)
					timer = owner.setTimeout(() => {
						void poll();
					}, 1500);
			};
			void win
				.loadURL(`${origin}/signin`)
				.then(() => poll())
				.catch(() => finish(undefined, Error('LOAD_FAILED')));
		});
	} finally {
		lease.dispose();
	}
}
