import type { App } from 'obsidian';
import { ensureDirectory } from '../../../shared/storage/durable-state';
import { BrowserError } from '../core/model';
import { workspaceFolder } from '../core/workspace/location';

/** Always creates a new visible document; exports have no owned workspace metadata. */
export async function saveWorkspaceExport(app: App, root: string, text: string, extension: 'md' | 'maiw.jsonl', admit: () => void): Promise<string> {
	if (workspaceFolder(root) !== root || !['md', 'maiw.jsonl'].includes(extension)) throw new BrowserError('browser_workspace_folder');
	admit(); const folder = root + '/Exports';
	await ensureDirectory(app.vault.adapter, folder); admit();
	const path = folder + '/' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID() + '.' + extension;
	await app.vault.create(path, text); return path;
}
