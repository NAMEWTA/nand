import { FileSystemAdapter, Platform, type App } from 'obsidian';
import type { TextStorage } from '../../../shared/storage/ports';
import { privateStorageIfDesktop } from '../../private-storage';

export function desktopVaultRoot(app: App): string {
	if (!(app.vault.adapter instanceof FileSystemAdapter)) throw new Error('browser_session_unavailable');
	return app.vault.adapter.getBasePath();
}

/** Keep Node code out of mobile and virtual vaults. */
export function privateVaultStorage(app: App): TextStorage {
	const adapter = app.vault.adapter;
	if (!Platform.isDesktopApp || !(adapter instanceof FileSystemAdapter)) return adapter;
	return privateStorageIfDesktop(adapter, adapter.getBasePath());
}
