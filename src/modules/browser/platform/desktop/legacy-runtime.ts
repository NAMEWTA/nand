import type { App } from 'obsidian';
import path from 'node:path';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { vaultIdentity } from '../../../../host/obsidian/storage/device-id';
import { desktopVaultRoot } from '../../../../host/obsidian/storage/private-storage';
import { desktopRemote } from '../../../../host/desktop/electron-main';
import { retainLegacyDirectory } from '../../../../host/desktop/browser-session-migration';
import { privatePathHasSymlink } from '../../../../host/desktop/private-mode';

const migrating = new WeakMap<App, Promise<void>>();
async function endpointInactive(endpoint: string): Promise<boolean> {
	return new Promise(resolve => {
		const socket = createConnection(endpoint);
		const finish = (inactive: boolean) => { socket.destroy(); resolve(inactive); };
		socket.once('connect', () => finish(false));
		socket.once('error', (error: NodeJS.ErrnoException) => finish(error.code === 'ENOENT' || error.code === 'ECONNREFUSED'));
		socket.setTimeout(250, () => finish(false));
	});
}
/** Only this device's captured legacy vault ID owns the old bridge directory. */
export function migrateLegacyRuntime(app: App, win: Window): Promise<void> {
	const existing = migrating.get(app); if (existing) return existing;
	const operation = (async () => {
		const identity = vaultIdentity(app);
		if (!identity.legacyBrowserVaultId) return;
		const remote = desktopRemote(win);
		const source = path.join(remote.app.getPath('userData'), 'nand-browser', identity.legacyBrowserVaultId);
		if (await privatePathHasSymlink(source)) throw new Error('private-storage.symlink');
		let entries;
		try { entries = await readdir(source, { withFileTypes: true }); }
		catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
		for (const entry of entries ?? []) {
			if (!entry.isDirectory() || !/^[a-f\d-]{36}$/i.test(entry.name)) continue;
			const endpoint = process.platform === 'win32' ? `\\\\.\\pipe\\nand-browser-${entry.name}` : path.join(remote.app.getPath('temp'), `nand-browser-${entry.name}.sock`);
			if (!await endpointInactive(endpoint)) throw new Error('browser_session_restart');
			const ownerFile = path.join(source, entry.name, 'owner.json');
			try {
				if ((await lstat(ownerFile)).isSymbolicLink()) throw new Error('private-storage.symlink');
				const owner = JSON.parse(await readFile(ownerFile, 'utf8')) as { pid?: unknown };
				if (typeof owner.pid !== 'number' || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error('browser_session_restart');
				try { process.kill(owner.pid, 0); throw new Error('browser_session_restart'); }
				catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
			} catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
		}
		await retainLegacyDirectory(desktopVaultRoot(app), `.nand/browser/${identity.deviceId}/legacy-runtime`, source);
	})();
	migrating.set(app, operation); void operation.catch(() => { if (migrating.get(app) === operation) migrating.delete(app); });
	return operation;
}
