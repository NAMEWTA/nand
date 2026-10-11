import { FileSystemAdapter, Notice, Platform, type App } from 'obsidian';
import { JsonStore } from '../../../shared/json-store';
import { contentPath, isContentPath } from '../../../shared/storage/content-paths';
import { validateNandPath } from '../../../shared/storage/nand-paths';
import { storageWriteQueue } from '../../../shared/storage/write-queue';
import { migrateContent, type ContentMigrationPort } from '../../../shared/storage/content-migration';
import { readMarkdownDocument, readYaml } from '../../../shared/storage/markdown-document';
import { privateVaultStorage } from './private-storage';
import { contentFiles, type ContentFiles } from './content-files';
import { copyContentExclusive } from './content-io';
import { t } from '../../../shared/i18n';

const OWNED_TYPES = new Set(['habit', 'habit-records', 'expense-settings', 'expense-records', 'pomodoro-settings', 'pomodoro-records', 'book', 'reading-records', 'automation', 'person', 'company', 'news', 'news-brief', 'news-edition', 'browser-task', 'browser-turn', 'browser-exchange', 'browser-prompt', 'browser-synthesis', 'browser-assistant', 'browser-workflow', 'browser-workflow-run', 'browser-user-adapter']);
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function migrationPort(app: App): { port: ContentMigrationPort; guard: (path: string) => Promise<void> } {
	const adapter = app.vault.adapter, privateStorage = privateVaultStorage(app), files = contentFiles(app);
	const guard = async (path: string) => {
		if (path.startsWith('.nand/')) validateNandPath(path); else contentPath(path);
		if (Platform.isDesktopApp && adapter instanceof FileSystemAdapter) await (await import('../../desktop/nand-paths')).absoluteVaultPath(adapter.getBasePath(), path);
	};
	const port: ContentMigrationPort = {
		exists: path => privateStorage.exists(path), read: path => privateStorage.read(path),
		write: (path, text) => privateStorage.write(path, text), mkdir: path => privateStorage.mkdir(path),
		readBinary: async path => { await guard(path); return adapter.readBinary(path); },
		copy: async (source, target) => { await guard(source); await guard(target); await copyContentExclusive(app, source, target); },
		move: async (source, target) => {
			await guard(source); await guard(target);
			if (source.endsWith('.md')) files.checkEditor(source, await adapter.read(source));
			if (await adapter.exists(target)) throw new Error(`nand-content.migration-target-exists: ${target}`);
			await adapter.rename(source, target);
		},
	};
	// Preserve the adapter queue identity through this migration-specific port.
	Object.defineProperty(port, Symbol.for('nand.storage.write-queue'), { value: storageWriteQueue(adapter) });
	return { port, guard };
}

interface Review { version: 1; paths: string[]; ordinary: string[] }
function reviewStore(app: App): JsonStore<Review> {
	return new JsonStore(privateVaultStorage(app), '.nand/migrations/content/review.json', (value): value is Review => {
		const row = object(value);
		return row.version === 1 && [row.paths, row.ordinary].every(items => Array.isArray(items) && items.every(item => typeof item === 'string' && !!item && !isContentPath(item)));
	});
}
const emptyReview = (): Review => ({ version: 1, paths: [], ordinary: [] });
export async function contentMigrationCandidates(app: App): Promise<string[]> { return (await reviewStore(app).load(emptyReview())).paths; }
export async function resolveContentCandidate(app: App, path: string, owned: boolean): Promise<void> {
	const store = reviewStore(app), base = await store.load(emptyReview());
	if (!base.paths.includes(path)) throw new Error('nand-content.review-changed');
	if (owned) await migrateContent(migrationPort(app).port, [path]);
	await store.commit({ base, value: { ...base, paths: base.paths.filter(item => item !== path), ordinary: owned ? base.ordinary : [...base.ordinary, path] } });
	await contentFiles(app).refresh();
}

/** Runs before settings normalization and before any module can write managed content. */
export async function prepareVaultContent(app: App): Promise<ContentFiles> {
	const adapter = app.vault.adapter, privateStorage = privateVaultStorage(app), files = contentFiles(app);
	const { port, guard } = migrationPort(app);
	const review = reviewStore(app); let unresolved: string[] = [];
	const discover = async (): Promise<string[]> => {
		const sources = new Set<string>();
		const base = await review.load(emptyReview());
		const settings = await new JsonStore<Record<string, unknown> | null>(privateStorage, '.nand/config/settings.json', (value): value is Record<string, unknown> | null => value === null || !!value && typeof value === 'object' && !Array.isArray(value)).load(null);
		const namespaces = object(settings?.namespaces), home = object(namespaces.home), browser = object(namespaces.browser);
		const workspaceFiles: unknown[] = Array.isArray(home.workspaceFiles) ? home.workspaceFiles : [];
		const boards = new Set([home.dashboardFile, ...workspaceFiles].filter((value): value is string => typeof value === 'string' && !!value.trim()).map(value => value.replace(/^\.nand\/content\//, '')).map(value => value.endsWith('.md') ? value : value + '.md'));
		const legacy = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.replace(/^\.nand\/content\//, '').replace(/^\/+|\/+$/g, '') : fallback;
		const archive = legacy(home.taskArchivePath, 'Archive/Done.md'), weread = legacy(home.wereadImportPath, 'Weread/Highlights');
		const discoverable = async (path: string) => !Platform.isDesktopApp || !(adapter instanceof FileSystemAdapter)
			|| (await import('../../desktop/nand-paths')).discoverableVaultEntry(adapter.getBasePath(), path);
		const all: string[] = [], recordFolders = new Set<string>();
		const scan = async (directory: string): Promise<void> => {
			if (directory && !await discoverable(directory)) return;
			const entries = await adapter.list(directory);
			for (const path of entries.files) if (!path.split('/').some(part => part.startsWith('.')) && await discoverable(path)) all.push(path);
			for (const folder of entries.folders) if (!folder.split('/').some(part => part.startsWith('.'))) await scan(folder);
		};
		await scan('');
		for (const path of all) {
			if (base.ordinary.includes(path)) continue;
			if (boards.has(path)) { sources.add(path); continue; }
			if (!path.endsWith('.md')) continue;
			const text = await adapter.read(path);
			// Unmarked notes, including earlier ordinary note creation, keep their native ownership.
			let properties: Record<string, unknown>;
			try { properties = object(readYaml(readMarkdownDocument(text).yaml).toJSON()); }
			catch { continue; } // Invalid/unmarked ordinary notes are not owned migration sources.
			if (path.startsWith(weread + '/') && properties.source === 'weread' && typeof properties.bookId === 'string'
				&& typeof properties.title === 'string' && typeof properties.highlightCount === 'number') { sources.add(path); continue; }
			if (OWNED_TYPES.has(String(properties['nand-type'])) && typeof properties['nand-id'] === 'string') {
				sources.add(path);
				if (['person', 'company'].includes(String(properties['nand-type'])) && path.endsWith('/基本信息.md')) recordFolders.add(path.slice(0, path.lastIndexOf('/')));
			} else if (path === 'dashboard.md' && properties.dashboard === true) sources.add(path);
		}
		for (const path of all) if (!base.ordinary.includes(path) && [...recordFolders].some(folder => path.startsWith(folder + '/'))) sources.add(path);
		for (const source of sources) await guard(source);
		const exportRoot = legacy(browser.workspaceFolder, 'NAND/AI Workspace') + '/Exports/';
		unresolved = all.filter(path => !sources.has(path) && !base.ordinary.includes(path) && (path === archive || path.startsWith('NAND Exports/') || path.startsWith(exportRoot)));
		if (JSON.stringify(base.paths) !== JSON.stringify(unresolved)) await review.commit({ base, value: { ...base, paths: unresolved } });
		return [...sources].filter(path => !isContentPath(path));
	};
	// Sync may deliver another old source during copying. Re-scan before enabling writers,
	// and discover again on every startup even when earlier batches completed.
	for (let attempt = 0; ; attempt++) {
		await migrateContent(port, await discover());
		if (!(await discover()).length) break;
		if (attempt >= 4) throw new Error('nand-content.migration-source-set-changing');
	}
	if (unresolved.length) new Notice(t('content.reviewNeeded', { count: unresolved.length }), 10000);
	await files.refresh();
	return files;
}
