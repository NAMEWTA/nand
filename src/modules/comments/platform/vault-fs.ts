import { normalizePath, type App } from 'obsidian';
import type { CommentFs } from '../core/store';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { ensureDirectory } from '../../../shared/storage/durable-state';

/** Vault-relative sidecar IO. Comments travel with the vault, not the plugin folder. */
export function vaultCommentFs(app: App): CommentFs {
	const adapter = privateVaultStorage(app);
	return {
		read: (path) => adapter.read(normalizePath(path)),
		write: async (path, data) => {
			const normalized = normalizePath(path);
			await ensureDirectory(adapter, normalized.split('/').slice(0, -1).join('/'));
			await adapter.write(normalized, data);
		},
		remove: async (path) => {
			const normalized = normalizePath(path);
			if (await adapter.exists(normalized)) await app.vault.adapter.remove(normalized);
		},
		exists: (path) => adapter.exists(normalizePath(path)),
	};
}
