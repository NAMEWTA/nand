import type { App } from 'obsidian';
import { join } from 'node:path';
import { privateVaultStorage, desktopVaultRoot } from '../../../../host/obsidian/storage/private-storage';
import { deviceId } from '../../../../host/obsidian/storage/device-id';
export async function browserTempPath(app: App): Promise<string> {
	const path = `.nand/browser/${deviceId(app)}/tmp`;
	await privateVaultStorage(app).mkdir(path);
	return join(desktopVaultRoot(app), path);
}
export async function chooseCookieFile(win: Window): Promise<string | undefined> {
	const remote = win.require('@electron/remote') as {
		dialog: { showOpenDialog(options: unknown): Promise<{ canceled: boolean; filePaths: string[] }> };
	};
	const result = await remote.dialog.showOpenDialog({
		properties: ['openFile'],
		filters: [{ name: 'Cookies', extensions: ['txt', 'json'] }],
	});
	return result.canceled ? undefined : result.filePaths[0];
}
