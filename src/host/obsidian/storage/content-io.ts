import { FileSystemAdapter, Platform, type App } from 'obsidian';
import { privateVaultStorage } from './private-storage';
import { ensureDirectory } from '../../../shared/storage/durable-state';

export async function contentDigest(app: App, path: string): Promise<string> {
	if (!await privateVaultStorage(app).exists(path)) throw new Error('nand-content.missing');
	return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await app.vault.adapter.readBinary(path)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function copyContentExclusive(app: App, source: string, target: string): Promise<void> {
	const adapter = app.vault.adapter;
	if (Platform.isDesktopApp && adapter instanceof FileSystemAdapter) {
		await (await import('../../desktop/content-io')).copyContentExclusive(adapter.getBasePath(), source, target);
	} else {
		// DataAdapter.copy's public contract rejects an existing destination.
		await adapter.copy(source, target);
	}
}

/** Stage before publishing so a concurrent target is retained, even for binary creates. */
export async function createContentExclusive(app: App, target: string, value: string | ArrayBuffer, admit: () => void = () => {}): Promise<void> {
	const storage = privateVaultStorage(app);
	const stage = `.nand/recovery/content-creates/${crypto.randomUUID()}`;
	await ensureDirectory(storage, stage.slice(0, stage.lastIndexOf('/')));
	await storage.write(stage, typeof value === 'string' ? value : '');
	if (typeof value !== 'string') await app.vault.adapter.writeBinary(stage, value);
	admit();
	await copyContentExclusive(app, stage, target);
	await app.vault.adapter.remove(stage);
}
