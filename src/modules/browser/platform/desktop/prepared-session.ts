import type { App, FileSystemAdapter } from 'obsidian';
import { dirname, join } from 'node:path';
import {
	acquireVaultSession,
	SESSION_RUNTIME_SOURCE,
	type VaultSessionLease,
} from '../../../../host/desktop/browser-session';
import { bundledMain, desktopRemote } from '../../../../host/desktop/electron-main';

type NativeLease = Pick<VaultSessionLease, 'session' | 'onDownloadError' | 'protect' | 'dispose'> & {
	bind(owner: number, token: string): { dispose(): void };
};
interface Runtime {
	acquire(vault: string, directory: string, downloads: string): NativeLease;
}
export interface PreparedBrowserSession {
	acquire(owner: Window): VaultSessionLease;
	dispose(): void;
}

/** Prepare/validate a profile once in the persistent renderer. Guests then acquire
 * independent native bindings; moving a view cannot queue behind filesystem work
 * whose initiating popout has disappeared. Native acquire rechecks owned paths. */
export async function prepareBrowserSession(
	app: App,
	broker: Window,
	profile: string,
	signal: AbortSignal,
): Promise<PreparedBrowserSession> {
	const prepared = await acquireVaultSession(app, broker, { profile, signal });
	try {
		const runtime = bundledMain<Runtime>(broker, SESSION_RUNTIME_SOURCE);
		const vault = (app.vault.adapter as FileSystemAdapter).getBasePath();
		const directory = prepared.storagePath,
			downloads = join(dirname(directory), 'downloads');
		const brokerId = desktopRemote(broker).getCurrentWebContents().id;
		let disposed = false;
		return {
			acquire(owner) {
				if (disposed || signal.aborted || owner.closed) throw new Error('browser_session_closed');
				const ownerId =
					owner === broker
						? brokerId
						: (owner as Window & { electronWindow: { webContents: { id: number } } }).electronWindow
								.webContents.id;
				const native = runtime.acquire(vault, directory, downloads);
				return {
					storagePath: directory,
					session: native.session,
					onDownloadError: (listener) => native.onDownloadError(listener),
					protect: (id) => native.protect(id),
					clearRecovery: () => prepared.clearRecovery(),
					bind(element) {
						const token = 'nand-vault-' + crypto.randomUUID();
						for (const id of new Set([ownerId, brokerId])) native.bind(id, token);
						element.setAttribute('partition', token);
					},
					dispose: () => native.dispose(),
				};
			},
			dispose() {
				if (disposed) return;
				disposed = true;
				prepared.dispose();
			},
		};
	} catch (error) {
		prepared.dispose();
		throw error;
	}
}
