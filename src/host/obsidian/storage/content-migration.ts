import { FileSystemAdapter, Platform, type App } from 'obsidian';
import { JsonStore } from '../../../shared/json-store';
import { contentPath, isContentPath } from '../../../shared/storage/content-paths';
import { validateNandPath } from '../../../shared/storage/nand-paths';
import { storageWriteQueue } from '../../../shared/storage/write-queue';
import { CONTENT_MIGRATION_FILE, migrateContent, type ContentMigrationPort } from '../../../shared/storage/content-migration';
import { readMarkdownDocument, readYaml } from '../../../shared/storage/markdown-document';
import { privateVaultStorage } from './private-storage';
import { contentFiles, type ContentFiles } from './content-files';

const OWNED_TYPES = new Set(['habit', 'habit-records', 'expense-settings', 'expense-records', 'pomodoro-settings', 'pomodoro-records', 'book', 'reading-records', 'automation', 'person', 'company', 'news', 'news-brief', 'news-edition', 'browser-task', 'browser-turn', 'browser-exchange', 'browser-prompt', 'browser-synthesis', 'browser-assistant', 'browser-workflow', 'browser-workflow-run', 'browser-user-adapter']);
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Runs before settings normalization and before any module can write managed content. */
export async function prepareVaultContent(app: App): Promise<ContentFiles> {
	const adapter = app.vault.adapter, privateStorage = privateVaultStorage(app), files = contentFiles(app);
	const guard = async (path: string) => {
		if (path.startsWith('.nand/')) validateNandPath(path); else contentPath(path);
		if (Platform.isDesktopApp && adapter instanceof FileSystemAdapter) await (await import('../../desktop/nand-paths')).absoluteVaultPath(adapter.getBasePath(), path);
	};
	const port: ContentMigrationPort = {
		exists: path => privateStorage.exists(path), read: path => privateStorage.read(path),
		write: (path, text) => privateStorage.write(path, text), mkdir: path => privateStorage.mkdir(path),
		readBinary: async path => { await guard(path); return adapter.readBinary(path); },
		copy: async (source, target) => { await guard(source); await guard(target); await adapter.copy(source, target); },
		move: async (source, target) => {
			await guard(source); await guard(target);
			if (source.endsWith('.md')) files.checkEditor(source, await adapter.read(source));
			if (await adapter.exists(target)) throw new Error(`nand-content.migration-target-exists: ${target}`);
			await adapter.rename(source, target);
		},
	};
	// Preserve the adapter queue identity through this migration-specific port.
	Object.defineProperty(port, Symbol.for('nand.storage.write-queue'), { value: storageWriteQueue(adapter) });
	const sources = new Set<string>();
	if (!await privateStorage.exists(CONTENT_MIGRATION_FILE) && !await privateStorage.exists(CONTENT_MIGRATION_FILE + '.backup')) {
		const settings = await new JsonStore<Record<string, unknown> | null>(privateStorage, '.nand/config/settings.json', (value): value is Record<string, unknown> | null => value === null || !!value && typeof value === 'object' && !Array.isArray(value)).load(null);
		const namespaces = object(settings?.namespaces), home = object(namespaces.home), browser = object(namespaces.browser);
		const workspaceFiles: unknown[] = Array.isArray(home.workspaceFiles) ? home.workspaceFiles : [];
		const boards = new Set([home.dashboardFile, ...workspaceFiles].filter((value): value is string => typeof value === 'string' && !!value.trim()).map(value => value.endsWith('.md') ? value : value + '.md'));
		const all: string[] = [], recordFolders = new Set<string>();
		const scan = async (directory: string): Promise<void> => {
			if (directory) await guard(directory);
			const entries = await adapter.list(directory);
			for (const path of entries.files) if (!path.split('/').some(part => part.startsWith('.'))) { await guard(path); all.push(path); }
			for (const folder of entries.folders) if (!folder.split('/').some(part => part.startsWith('.'))) await scan(folder);
		};
		await scan('');
		for (const path of all) {
			if (boards.has(path)) { sources.add(path); continue; }
			const exportRoot = typeof browser.workspaceFolder === 'string' ? browser.workspaceFolder : 'NAND/AI Workspace';
			if (path.startsWith('NAND Exports/') || path.startsWith(exportRoot + '/Exports/')) { sources.add(path); continue; }
			if (!path.endsWith('.md')) continue;
			const text = await adapter.read(path);
			// Unmarked notes, including earlier ordinary note creation, keep their native ownership.
			if (!/^\s*(?:["']?nand-type["']?\s*:|dashboard\s*:\s*true)/m.test(text)) continue;
			const properties = object(readYaml(readMarkdownDocument(text).yaml).toJSON());
			if (OWNED_TYPES.has(String(properties['nand-type'])) && typeof properties['nand-id'] === 'string') {
				sources.add(path);
				if (['person', 'company'].includes(String(properties['nand-type'])) && path.endsWith('/基本信息.md')) recordFolders.add(path.slice(0, path.lastIndexOf('/')));
			} else if (path === 'dashboard.md' && properties.dashboard === true) sources.add(path);
		}
		for (const path of all) if ([...recordFolders].some(folder => path.startsWith(folder + '/'))) sources.add(path);
	}
	await migrateContent(port, [...sources].filter(path => !isContentPath(path)));
	await files.refresh();
	return files;
}
