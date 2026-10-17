// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { getAllTags, TFile, TFolder, type App, type Component, type TAbstractFile } from 'obsidian';
import { parentFolder, ROOT_FOLDER, type NoteEntry } from '../core/types';

const NOTE_EXTENSIONS = new Set(['md', 'canvas', 'base']);

export function isListed(ext: string, showAllFiles: boolean): boolean {
	return showAllFiles || NOTE_EXTENSIONS.has(ext.toLowerCase());
}

/** Tags of a note (frontmatter and inline) without '#', deduplicated. */
function tagsOf(app: App, file: TFile): string[] {
	if (file.extension !== 'md') return [];
	const cache = app.metadataCache.getFileCache(file);
	const raw = cache ? getAllTags(cache) : null;
	if (!raw?.length) return [];
	return [...new Set(raw.map((tag) => tag.replace(/^#/, '')).filter(Boolean))];
}

const MAX_VALUE_LENGTH = 200;

function textValues(value: unknown): string[] {
	if (typeof value === 'string') return value.trim() ? [value.trim().slice(0, MAX_VALUE_LENGTH)] : [];
	if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
	if (Array.isArray(value)) return value.flatMap((item) => (Array.isArray(item) ? [] : textValues(item)));
	return [];
}

/** What search and the property browser need from a note's metadata. */
export interface NoteMeta {
	aliases: readonly string[];
	props: Readonly<Record<string, readonly string[]>> | undefined;
	hasTask: boolean;
}

export function metaOf(app: App, file: TFile): NoteMeta {
	const cache = file.extension === 'md' ? app.metadataCache.getFileCache(file) : null;
	if (!cache) return { aliases: [], props: undefined, hasTask: false };
	const frontmatter = cache.frontmatter;
	let props: Record<string, readonly string[]> | undefined;
	if (frontmatter) {
		for (const [key, value] of Object.entries(frontmatter)) {
			if (key === 'position') continue;
			(props ??= {})[key] = textValues(value);
		}
	}
	const aliases = frontmatter ? [...textValues(frontmatter['aliases']), ...textValues(frontmatter['alias'])] : [];
	return { aliases, props, hasTask: cache.listItems?.some((item) => item.task === ' ') ?? false };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function sameMeta(entry: NoteEntry, meta: NoteMeta, tags: readonly string[]): boolean {
	if (!sameList(entry.tags, tags) || !sameList(entry.aliases ?? [], meta.aliases) || (entry.hasTask ?? false) !== meta.hasTask) return false;
	const a = entry.props;
	const b = meta.props;
	if (!a || !b) return !a && !b;
	const keys = Object.keys(a);
	return keys.length === Object.keys(b).length && keys.every((key) => b[key] !== undefined && sameList(a[key]!, b[key]));
}

/**
 * The navigator's view of the vault: one light entry per listed file plus the folder set, kept current
 * from vault and metadata events. Structure changes notify at once; modifications and tag updates are coalesced.
 */
export class VaultIndex {
	private readonly byPath = new Map<string, NoteEntry>();
	private readonly folderSet = new Set<string>([ROOT_FOLDER]);
	private readonly listeners = new Set<() => void>();
	private snapshot: NoteEntry[] | undefined;
	private folderSnapshot: string[] | undefined;
	private versionValue = 0;
	private timer: number | undefined;
	private tagTimer: number | undefined;
	private disposed = false;
	private showAll = false;

	private readonly win: Window;

	constructor(private readonly app: App) {
		this.win = app.workspace.containerEl.ownerDocument.defaultView ?? window;
	}

	get version(): number {
		return this.versionValue;
	}

	/** Build the index and follow the vault until `scope` unloads. */
	start(scope: Component, showAllFiles: boolean): void {
		this.showAll = showAllFiles;
		this.rebuild();
		const { vault, metadataCache } = this.app;
		scope.registerEvent(vault.on('create', (file) => this.add(file)));
		scope.registerEvent(vault.on('delete', (file) => this.drop(file)));
		scope.registerEvent(vault.on('rename', (file, oldPath) => this.move(file, oldPath)));
		scope.registerEvent(vault.on('modify', (file) => {
			if (!(file instanceof TFile)) return;
			const entry = this.byPath.get(file.path);
			if (!entry) return;
			this.byPath.set(file.path, { ...entry, mtime: file.stat.mtime, ctime: file.stat.ctime });
			this.touch(false);
		}));
		scope.registerEvent(metadataCache.on('changed', (file) => this.retag(file)));
		scope.registerEvent(metadataCache.on('resolved', () => this.retagAll()));
		scope.register(() => this.dispose());
	}

	notes(): readonly NoteEntry[] {
		return (this.snapshot ??= [...this.byPath.values()]);
	}
	folders(): readonly string[] {
		return (this.folderSnapshot ??= [...this.folderSet]);
	}
	get(path: string): NoteEntry | undefined {
		return this.byPath.get(path);
	}
	hasFolder(path: string): boolean {
		return this.folderSet.has(path);
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	setShowAllFiles(value: boolean): void {
		if (value === this.showAll) return;
		this.showAll = value;
		this.rebuild();
	}

	/** Rebuild from scratch (e.g. after the file-type filter changed). */
	rebuild(): void {
		this.byPath.clear();
		this.folderSet.clear();
		this.folderSet.add(ROOT_FOLDER);
		for (const file of this.app.vault.getAllLoadedFiles()) this.addQuiet(file);
		this.touch(true);
	}

	dispose(): void {
		this.disposed = true;
		if (this.timer !== undefined) this.win.clearTimeout(this.timer);
		if (this.tagTimer !== undefined) this.win.clearTimeout(this.tagTimer);
		this.timer = this.tagTimer = undefined;
		this.listeners.clear();
	}

	private entryFor(file: TFile): NoteEntry {
		const meta = metaOf(this.app, file);
		return {
			path: file.path,
			name: file.basename,
			ext: file.extension.toLowerCase(),
			folder: parentFolder(file.path),
			ctime: file.stat.ctime,
			mtime: file.stat.mtime,
			tags: tagsOf(this.app, file),
			aliases: meta.aliases,
			props: meta.props,
			hasTask: meta.hasTask,
		};
	}

	private addQuiet(file: TAbstractFile): void {
		if (file instanceof TFolder) {
			this.folderSet.add(file.isRoot() ? ROOT_FOLDER : file.path);
			return;
		}
		if (file instanceof TFile && isListed(file.extension, this.showAll)) this.byPath.set(file.path, this.entryFor(file));
	}

	private add(file: TAbstractFile): void {
		this.addQuiet(file);
		this.touch(true);
	}

	private drop(file: TAbstractFile): void {
		if (file instanceof TFolder) {
			const prefix = `${file.path}/`;
			for (const folder of [...this.folderSet]) if (folder === file.path || folder.startsWith(prefix)) this.folderSet.delete(folder);
			for (const path of [...this.byPath.keys()]) if (path.startsWith(prefix)) this.byPath.delete(path);
		} else this.byPath.delete(file.path);
		this.touch(true);
	}

	private move(file: TAbstractFile, oldPath: string): void {
		if (file instanceof TFolder) {
			const prefix = `${oldPath}/`;
			for (const folder of [...this.folderSet]) {
				if (folder === oldPath) {
					this.folderSet.delete(folder);
					this.folderSet.add(file.path);
				} else if (folder.startsWith(prefix)) {
					this.folderSet.delete(folder);
					this.folderSet.add(`${file.path}/${folder.slice(prefix.length)}`);
				}
			}
			// Children receive their own rename events; entries under the old prefix go with them.
			for (const path of [...this.byPath.keys()]) if (path.startsWith(prefix)) this.byPath.delete(path);
			this.app.vault.getAllLoadedFiles().forEach((child) => { if (child.path.startsWith(`${file.path}/`)) this.addQuiet(child); });
		} else {
			this.byPath.delete(oldPath);
			this.addQuiet(file);
		}
		this.touch(true);
	}

	private retag(file: TFile): void {
		const entry = this.byPath.get(file.path);
		if (!entry) return;
		const tags = tagsOf(this.app, file);
		const meta = metaOf(this.app, file);
		if (sameMeta(entry, meta, tags)) return;
		this.byPath.set(file.path, { ...entry, tags, aliases: meta.aliases, props: meta.props, hasTask: meta.hasTask, mtime: file.stat.mtime });
		this.touch(false);
	}

	private retagAll(): void {
		if (this.tagTimer !== undefined) return;
		this.tagTimer = this.win.setTimeout(() => {
			this.tagTimer = undefined;
			if (this.disposed) return;
			let changed = false;
			for (const [path, entry] of this.byPath) {
				const file = this.app.vault.getFileByPath(path);
				if (!file) continue;
				const tags = tagsOf(this.app, file);
				const meta = metaOf(this.app, file);
				if (!sameMeta(entry, meta, tags)) {
					this.byPath.set(path, { ...entry, tags, aliases: meta.aliases, props: meta.props, hasTask: meta.hasTask });
					changed = true;
				}
			}
			if (changed) this.touch(false);
		}, 250);
	}

	private touch(immediate: boolean): void {
		this.snapshot = undefined;
		this.folderSnapshot = undefined;
		if (this.disposed) return;
		if (immediate) {
			if (this.timer !== undefined) this.win.clearTimeout(this.timer);
			this.timer = undefined;
			this.emit();
			return;
		}
		if (this.timer !== undefined) return;
		this.timer = this.win.setTimeout(() => {
			this.timer = undefined;
			this.emit();
		}, 150);
	}

	private emit(): void {
		this.versionValue++;
		for (const listener of [...this.listeners]) listener();
	}
}
