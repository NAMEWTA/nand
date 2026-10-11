import type { App } from 'obsidian';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { BrowserError } from '../core/model';
import { workspaceFolder } from '../core/workspace/location';

/** Exports are new files inside NAND content and never overwrite a previous export. */
export async function saveWorkspaceExport(app: App, root: string, text: string, extension: 'md' | 'maiw.jsonl', admit: () => void): Promise<string> {
	const normalized = workspaceFolder(root);
	if (!normalized || !['md', 'maiw.jsonl'].includes(extension)) throw new BrowserError('browser_workspace_folder');
	admit(); const folder = normalized + '/Exports';
	const path = folder + '/' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID() + '.' + extension;
	await contentFiles(app).create(path, text, admit); return path;
}
