// Adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), src/banner.ts
import type { App } from 'obsidian';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
export function resolveVaultImage(app: App, relativePath: string): string | null {
	if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
		return relativePath;
	}

	const file = contentFiles(app).resolveLink(relativePath);
	if (!file) return null;

	const adapter = app.vault.adapter;
	if (
		'getResourcePath' in adapter &&
		typeof (adapter as { getResourcePath: (path: string) => string }).getResourcePath === 'function'
	) {
		return (adapter as { getResourcePath: (path: string) => string }).getResourcePath(file.path);
	}

	const parts = relativePath.split('/');
	const encoded = parts.map((p) => encodeURIComponent(p)).join('/');
	return `app://local/${encoded}`;
}

