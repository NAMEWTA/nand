import { FileSystemAdapter, Platform, type App } from 'obsidian';
import type { TextStorage } from '../../../shared/storage/ports';
import { privateStorageIfDesktop } from '../../private-storage';

/** Keep Node code out of mobile and virtual vaults. */
export function privateVaultStorage(app: App): TextStorage {
	const adapter = app.vault.adapter;
	if (!Platform.isDesktopApp || Platform.isWin || !(adapter instanceof FileSystemAdapter)) return adapter;
	return privateStorageIfDesktop(adapter, adapter.getBasePath());
}
