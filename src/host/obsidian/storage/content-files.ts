import { MarkdownView, TFile, type App, type EventRef, type FileStats } from 'obsidian';
import { CONTENT_ROOT, contentPath, isContentPath } from '../../../shared/storage/content-paths';
import { validateNandPath } from '../../../shared/storage/nand-paths';
import { ensureDirectory } from '../../../shared/storage/durable-state';
import { storageWriteQueue } from '../../../shared/storage/write-queue';
import { privateVaultStorage } from './private-storage';
import { patchFrontmatter, readMarkdownDocument, readYaml } from '../../../shared/storage/markdown-document';
import { stringify } from 'yaml';
import { contentDigest, createContentExclusive } from './content-io';
import { ContentMoves, type LinkEdit } from './content-moves';
import { rewriteContentLinks } from './content-link-text';

/** A NAND index entry. It is never passed to Obsidian as a TFile. */
export interface ManagedFile {
	readonly kind: 'managed';
	path: string;
	name: string;
	basename: string;
	extension: string;
	stat: FileStats;
}
export type ContentFile = ManagedFile | TFile;
export function isManagedFile(file: ContentFile): file is ManagedFile { return 'kind' in file && file.kind === 'managed'; }
export interface ContentMetadata {
	frontmatter?: Record<string, unknown>; tags?: Array<{ tag: string }>; links?: Array<{ link: string }>;
	headings?: Array<{ heading: string; level: number }>;
	blocks?: Record<string, { position: { start: { line: number } } }>;
	listItems?: Array<{ task?: string }>;
}
export interface ContentChange { kind: 'create' | 'modify' | 'delete' | 'rename'; path: string; oldPath?: string }

const instances = new WeakMap<App, ContentFiles>();
export function contentFiles(app: App): ContentFiles {
	let files = instances.get(app);
	if (!files) { files = new ContentFiles(app); instances.set(app, files); }
	return files;
}

/** Owns hidden-file indexing and atomic writes; ordinary notes retain the native Vault contract. */
export class ContentFiles {
	private indexed = new Map<string, ManagedFile>();
	private directories = new Set<string>();
	private metadata = new Map<string, { stamp: string; value: ContentMetadata }>();
	private listeners = new Set<(event: ContentChange) => void>();
	private refs: EventRef[] = [];
	private drafts = new Map<symbol, { path: string; read: () => string }>();
	private opener?: (path: string, ownerWindow?: Window, fragment?: string) => Promise<void>;
	private queue;
	private moves: ContentMoves;
	constructor(private readonly app: App) { this.queue = storageWriteQueue(app.vault.adapter); this.moves = new ContentMoves(app); }
	bindOpen(open: (path: string, ownerWindow?: Window, fragment?: string) => Promise<void>): () => void { this.opener = open; return () => { this.opener = undefined; }; }
	async open(path: string, ownerWindow?: Window): Promise<void> {
		if (isContentPath(path) && this.directories.has(path)) {
			if (!this.opener) throw new Error('nand-content.not-ready');
			await this.opener(path, ownerWindow); return;
		}
		const target = this.resolveLink(path);
		if (!target) throw new Error(`Missing document: ${path}`);
		if (isContentPath(target.path)) { if (!this.opener) throw new Error('nand-content.not-ready'); await this.opener(target.path, ownerWindow, path.includes('#') ? path.slice(path.indexOf('#')) : undefined); }
		else if (target instanceof TFile) await this.app.workspace.openLinkText(target.path + (path.includes('#') ? path.slice(path.indexOf('#')) : ''), '', true);
	}
	resolveLink(raw: string, source = ''): ContentFile | null {
		// Callers opening an indexed path pass a literal filename, not a URL.
		if (!source) try { const exact = this.getFileByPath(raw); if (exact) return exact; } catch { /* Resolve link syntax below. */ }
		let link = raw.split('|')[0]!.split('#')[0]!;
		if (!link && raw.startsWith('#')) link = source;
		if (!link || /^[a-z][a-z\d+.-]*:|^[/\\]{2}|^\\/i.test(link)) return null;
		let decoded = link;
		try { decoded = decodeURIComponent(link); } catch { /* Literal percent signs are valid filenames. */ }
		for (const spelling of new Set([link, decoded])) {
			const candidates = [spelling.replace(/^\//, '')];
			if (source.includes('/') && !spelling.startsWith('/') && !isContentPath(spelling)) {
				const relative = source.slice(0, source.lastIndexOf('/') + 1) + spelling;
				candidates.unshift(...(isContentPath(source) ? [relative, relative.slice(CONTENT_ROOT.length + 1)] : [relative]));
			}
			for (const candidate of candidates) {
				const parts: string[] = [];
				for (const part of candidate.split('/')) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); }
				const path = parts.join('/');
				for (const value of [path, path + '.md']) {
					try {
						const direct = this.getFileByPath(value); if (direct) return direct;
						const managed = contentPath(value), managedFile = this.getFileByPath(managed);
						if (managedFile) return managedFile;
						const destination = this.moves.target(managed, target => this.indexed.has(target));
						if (destination) return this.indexed.get(destination)!;
					} catch { /* Ordinary names can be outside the managed portable namespace. */ }
				}
			}
		}
		const native = this.app.metadataCache?.getFirstLinkpathDest(link, source);
		if (native) return native;
		const matches = [...this.indexed.values()].filter(file => file.name === link || file.basename === link);
		return matches.length === 1 ? matches[0]! : null;
	}
	/** Portable polling observes external sync writes which Obsidian omits for hidden folders. */
	watch(ownerWindow: Window, report: (error: unknown) => void): () => void {
		let closed = false, failed = false, timer: number;
		const scan = async () => {
			try { await this.refresh(); failed = false; } catch (error) { if (!failed) report(error); failed = true; }
			if (!closed) timer = ownerWindow.setTimeout(() => { void scan(); }, 1500);
		};
		timer = ownerWindow.setTimeout(() => { void scan(); }, 1500);
		return () => { closed = true; ownerWindow.clearTimeout(timer); };
	}
	/** An editor registers its live text until it closes, including failed saves. */
	claimDraft(path: string, read: () => string): { owner: symbol; release: () => void } {
		const owner = Symbol(path); this.drafts.set(owner, { path, read });
		return { owner, release: () => { this.drafts.delete(owner); } };
	}
	private emit(event: ContentChange): void { for (const listener of this.listeners) listener(event); }
	subscribe(listener: (event: ContentChange) => void): () => void {
		if (!this.listeners.size) {
			const vault = this.app.vault;
			this.refs.push(vault.on('create', file => this.emit({ kind: 'create', path: file.path })));
			this.refs.push(vault.on('modify', file => this.emit({ kind: 'modify', path: file.path })));
			this.refs.push(vault.on('delete', file => this.emit({ kind: 'delete', path: file.path })));
			this.refs.push(vault.on('rename', (file, oldPath) => this.emit({ kind: 'rename', path: file.path, oldPath })));
		}
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); if (!this.listeners.size) for (const ref of this.refs.splice(0)) this.app.vault.offref(ref); };
	}
	async refresh(): Promise<void> {
		return this.queue.run('nand-content:mutation', () => this.scan());
	}
	private async scan(): Promise<void> {
			await this.moves.load();
			await this.moves.recover((path, text) => this.checkEditor(path, text));
			const adapter = this.app.vault.adapter, storage = privateVaultStorage(this.app);
			const next = new Map<string, ManagedFile>();
			const directories = new Set<string>();
			const visit = async (directory: string): Promise<void> => {
				validateNandPath(directory);
				if (!await storage.exists(directory)) return;
				directories.add(directory);
				const entries = await adapter.list(directory);
				for (const path of entries.files) {
					validateNandPath(path);
					if (!path.startsWith(directory + '/') || !isContentPath(path)) throw new Error('nand-content.invalid-index');
					await storage.exists(path);
					const stat = await adapter.stat(path);
					if (!stat) continue;
					if (stat.type !== 'file') throw new Error('nand-content.invalid-index');
					const name = path.split('/').at(-1)!;
					next.set(path, { kind: 'managed', path, name, basename: name.replace(/\.[^.]+$/, ''), extension: name.includes('.') ? name.split('.').at(-1)! : '', stat: { ctime: stat.ctime, mtime: stat.mtime, size: stat.size } });
				}
				for (const path of entries.folders) {
					if (!path.startsWith(directory + '/') || !isContentPath(path)) throw new Error('nand-content.invalid-index');
					await visit(path);
				}
			};
			await visit(CONTENT_ROOT);
			const previous = this.indexed;
			const changes: ContentChange[] = [];
			this.indexed = next;
			this.directories = directories;
			for (const file of next.values()) {
				const old = previous.get(file.path);
				if (!old) changes.push({ kind: 'create', path: file.path });
				else {
					if (old.stat.mtime !== file.stat.mtime || old.stat.size !== file.stat.size) changes.push({ kind: 'modify', path: file.path });
					Object.assign(old, file); next.set(file.path, old);
				}
			}
			for (const path of previous.keys()) if (!next.has(path)) changes.push({ kind: 'delete', path });
			for (const event of changes) this.emit(event);
	}
	getMarkdownFiles(): ContentFile[] { return [...this.app.vault.getMarkdownFiles(), ...[...this.indexed.values()].filter(file => file.extension === 'md')]; }
	getFiles(): ContentFile[] { return [...this.app.vault.getFiles(), ...this.indexed.values()]; }
	allManaged(): readonly ManagedFile[] { return [...this.indexed.values()]; }
	allDirectories(): readonly string[] { return [...this.directories]; }
	getMetadata(file: ContentFile): ContentMetadata | null {
		if (!isManagedFile(file)) return this.app.metadataCache.getFileCache(file);
		return this.metadata.get(file.path)?.value ?? null;
	}
	resolvedLinks(): Record<string, Record<string, number>> {
		const graph: Record<string, Record<string, number>> = {};
		for (const [source, targets] of Object.entries(this.app.metadataCache.resolvedLinks)) {
			const next = graph[source] = {} as Record<string, number>;
			for (const [path, count] of Object.entries(targets)) next[this.resolveLink(path, source)?.path ?? path] = count;
		}
		for (const file of this.indexed.values()) {
			const targets: Record<string, number> = {};
			for (const { link } of this.getMetadata(file)?.links ?? []) {
				const target = this.resolveLink(link, file.path);
				if (target) targets[target.path] = (targets[target.path] ?? 0) + 1;
			}
			graph[file.path] = targets;
		}
		return graph;
	}
	/** Only consumers needing properties pay for parsing; normal polling performs no body reads. */
	async prepareMetadata(): Promise<void> {
		await this.refresh();
		for (const file of this.indexed.values()) {
			if (file.extension !== 'md') continue;
			const stamp = `${file.stat.mtime}:${file.stat.size}`;
			if (this.metadata.get(file.path)?.stamp === stamp) continue;
			const raw = await this.read(file), value: ContentMetadata = {};
			let body = raw;
			try {
				const document = readMarkdownDocument(raw); body = document.body;
				value.frontmatter = (readYaml(document.yaml).toJSON() ?? {}) as Record<string, unknown>;
			} catch { /* Invalid properties stay unindexed; the document remains readable and editable. */ }
			value.tags = [...body.matchAll(/(?:^|\s)#([^\s#.,;!?()[\]{}]+)/g)].map(match => ({ tag: '#' + match[1]! }));
			value.links = [...body.matchAll(/\[\[([^\]]+)\]\]|\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match => ({ link: match[1] ?? match[2]! }));
			value.headings = []; value.blocks = {}; value.listItems = [];
			let fenced = false;
			for (const [line, text] of raw.split('\n').entries()) {
				if (/^\s*(`{3,}|~{3,})/.test(text)) { fenced = !fenced; continue; }
				if (fenced) continue;
				const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(text);
				if (heading) value.headings.push({ heading: heading[2]!, level: heading[1]!.length });
				const block = /\s\^([A-Za-z\d-]+)\s*$/.exec(text);
				if (block) value.blocks[block[1]!] = { position: { start: { line } } };
				const task = /^\s*[-*+]\s+\[(.)\]/.exec(text);
				if (task) value.listItems.push({ task: task[1] });
			}
			this.metadata.set(file.path, { stamp, value });
		}
		for (const path of this.metadata.keys()) if (!this.indexed.has(path)) this.metadata.delete(path);
	}
	async processFrontMatter(file: ContentFile, update: (properties: Record<string, unknown>) => void): Promise<void> {
		await this.process(file.path, raw => {
			if (raw === null) throw new Error('nand-content.missing');
			const document = readMarkdownDocument(raw), properties = (readYaml(document.yaml).toJSON() ?? {}) as Record<string, unknown>;
			update(properties);
			return patchFrontmatter(raw, raw, `---\n${stringify(properties)}---\n${document.body}`);
		});
	}
	async rename(file: ContentFile, path: string): Promise<void> {
		if (!isManagedFile(file)) { await this.app.fileManager.renameFile(file, path); return; }
		const target = contentPath(path);
		await this.queue.run('nand-content:mutation', async () => {
			await this.scan();
			const storage = privateVaultStorage(this.app), oldPath = file.path;
			if (!await storage.exists(oldPath)) throw new Error('nand-content.missing');
			if (await storage.exists(target)) throw new Error(`Exists: ${target}`);
			this.checkEditor(oldPath, await this.read(oldPath));
			await ensureDirectory(storage, target.slice(0, target.lastIndexOf('/')));
			const edits: LinkEdit[] = [];
			for (const document of this.getMarkdownFiles()) {
				const before = await this.read(document);
				const after = rewriteContentLinks(before, link => {
					if (!link || link.startsWith('#')) return undefined;
					const destination = this.resolveLink(link, document.path);
					if (!destination || destination.path !== oldPath && document.path !== oldPath) return undefined;
					const fragment = link.includes('#') ? link.slice(link.indexOf('#')) : '';
					return '/' + (destination.path === oldPath ? target : destination.path).split('/').map(part => encodeURIComponent(part)).join('/') + fragment;
				});
				if (before !== after) { this.checkEditor(document.path, before); edits.push({ path: document.path, before, after }); }
			}
			const sourceEdit = edits.find(edit => edit.path === oldPath);
			const digest = sourceEdit ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceEdit.after)))].map(byte => byte.toString(16).padStart(2, '0')).join('') : await contentDigest(this.app, oldPath);
			const retained = `.nand/recovery/renames/${crypto.randomUUID()}/${file.name}`;
			await ensureDirectory(storage, retained.slice(0, retained.lastIndexOf('/')));
			await this.moves.prepare(oldPath, target, edits, retained, digest);
			try {
				for (const edit of edits) await this.moves.apply(edit, true, (path, text) => this.checkEditor(path, text));
				for (const edit of edits) this.checkEditor(edit.path, edit.before);
				if (await contentDigest(this.app, oldPath) !== digest) throw new Error('nand-content.move-source-changed');
				await this.app.vault.adapter.rename(oldPath, retained);
				await this.moves.publish();
			} catch (error) { await this.moves.recover((path, text) => this.checkEditor(path, text)); throw error; }
			// Announce the pair before the next scan can appear as an unrelated deletion.
			this.indexed.delete(oldPath);
			file.path = target;
			this.indexed.set(target, file);
			await this.moves.finish();
			await this.scan();
			this.emit({ kind: 'rename', path: target, oldPath });
		});
	}
	async trash(file: ContentFile): Promise<void> {
		if (!isManagedFile(file)) { await this.app.fileManager.trashFile(file); return; }
		await this.queue.run('nand-content:mutation', async () => {
			const storage = privateVaultStorage(this.app);
			this.checkEditor(file.path, await this.read(file));
			const target = `.nand/recovery/trash/${crypto.randomUUID()}/${file.name}`;
			await ensureDirectory(storage, target.slice(0, target.lastIndexOf('/')));
			if (await storage.exists(target)) throw new Error('nand-content.trash-exists');
			await this.app.vault.adapter.rename(file.path, target);
			await this.scan();
		});
	}
	getAbstractFileByPath(path: string): ContentFile | { path: string } | null {
		if (isContentPath(path)) return this.getFileByPath(path) ?? (this.directories.has(path) ? { path } : null);
		return this.app.vault.getAbstractFileByPath(path);
	}
	listFolder(path: string): Array<{ path: string; folder: boolean; size: number; modified: number }> {
		if (!this.directories.has(path)) throw new Error('nand-content.missing');
		return [...[...this.directories].filter(value => value.startsWith(path + '/')).map(value => ({ path: value, folder: true, size: 0, modified: 0 })),
			...[...this.indexed.values()].filter(file => file.path.startsWith(path + '/')).map(file => ({ path: file.path, folder: false, size: file.stat.size, modified: file.stat.mtime }))];
	}
	async mkdir(path: string): Promise<void> {
		await this.queue.run('nand-content:mutation', async () => { await ensureDirectory(privateVaultStorage(this.app), contentPath(path)); await this.scan(); });
	}
	async createFolder(path: string): Promise<void> {
		const target = contentPath(path);
		await this.queue.run('nand-content:mutation', async () => {
			const storage = privateVaultStorage(this.app);
			if (await storage.exists(target)) throw new Error(`Exists: ${target}`);
			await ensureDirectory(storage, target.slice(0, target.lastIndexOf('/')));
			await this.app.vault.adapter.mkdir(target);
			await this.scan();
		});
	}
	async createBinary(path: string, data: ArrayBuffer): Promise<ManagedFile> {
		const target = contentPath(path);
		await this.queue.run('nand-content:mutation', async () => {
			await this.moves.load(); await this.moves.recover((path, text) => this.checkEditor(path, text));
			const storage = privateVaultStorage(this.app);
			if (await storage.exists(target)) throw new Error(`Exists: ${target}`);
			await ensureDirectory(storage, target.slice(0, target.lastIndexOf('/')));
			await this.moves.created(target);
			await createContentExclusive(this.app, target, data);
			await this.scan();
		});
		return this.indexed.get(target)!;
	}
	async checkFolderEditors(path: string): Promise<void> {
		for (const draft of this.drafts.values()) if (draft.path.startsWith(path + '/')) this.checkEditor(draft.path, await this.read(draft.path));
	}
	/** A directory rename retains every byte inside the vault, including unknown attachments. */
	async trashFolder(path: string): Promise<void> {
		await this.queue.run('nand-content:mutation', async () => {
			if (!isContentPath(path) || path === CONTENT_ROOT) throw new Error('nand-content.invalid-path');
			await this.scan();
			if (!this.directories.has(path)) throw new Error('nand-content.missing');
			await this.checkFolderEditors(path);
			const target = `.nand/recovery/trash/${crypto.randomUUID()}/${path.slice(CONTENT_ROOT.length + 1)}`;
			const storage = privateVaultStorage(this.app);
			await ensureDirectory(storage, target.slice(0, target.lastIndexOf('/')));
			if (await storage.exists(target)) throw new Error('nand-content.trash-exists');
			await this.app.vault.adapter.rename(validateNandPath(path), validateNandPath(target));
			await this.scan();
		});
	}
	async resourceUrl(path: string): Promise<string> {
		if (!isContentPath(path)) {
			const native = this.app.vault.getFileByPath(path);
			if (!native) throw new Error('nand-content.missing');
			return this.app.vault.getResourcePath(native);
		}
		if (!await privateVaultStorage(this.app).exists(validateNandPath(path))) throw new Error('nand-content.missing');
		return this.app.vault.adapter.getResourcePath(path);
	}
	async create(path: string, text: string, admit: () => void = () => {}): Promise<ManagedFile> {
		const target = contentPath(path);
		await this.queue.run('nand-content:mutation', async () => {
			admit();
			await this.moves.load(); await this.moves.recover((path, text) => this.checkEditor(path, text));
			const storage = privateVaultStorage(this.app);
			if (await storage.exists(target)) throw new Error(`Exists: ${target}`);
			await ensureDirectory(storage, target.slice(0, target.lastIndexOf('/')));
			await this.moves.created(target);
			await createContentExclusive(this.app, target, text, admit);
			await this.scan();
		});
		return this.indexed.get(target)!;
	}
	getFileByPath(path: string): ContentFile | null {
		if (isContentPath(path)) return this.indexed.get(validateNandPath(path)) ?? null;
		return this.app.vault.getFileByPath(path);
	}
	async read(file: ContentFile | string): Promise<string> {
		const path = typeof file === 'string' ? file : file.path;
		if (isContentPath(path)) return privateVaultStorage(this.app).read(validateNandPath(path));
		const native = this.app.vault.getFileByPath(path);
		if (!native) throw new Error(`Missing document: ${path}`);
		return this.app.vault.read(native);
	}
	checkEditor(path: string, disk: string, owner?: symbol): void {
		for (const [token, draft] of this.drafts) if (token !== owner && draft.path === path && draft.read() !== disk) throw new Error(`Unsaved editor: ${path}`);
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path && leaf.view.editor.getValue() !== disk) throw new Error(`Unsaved editor: ${path}`);
		}
	}
	async process(path: string, update: (text: string | null) => string, owner?: symbol): Promise<string> {
		return this.queue.run(isContentPath(path) ? 'nand-content:mutation' : 'nand-content:write:' + path, async () => {
			const storage = privateVaultStorage(this.app), adapter = this.app.vault.adapter;
			const apply = (current: string) => { this.checkEditor(path, current, owner); return update(current); };
			let result: string;
			if (isContentPath(path)) {
				validateNandPath(path);
				await this.moves.load(); await this.moves.recover((path, text) => this.checkEditor(path, text));
				if (await storage.exists(path)) result = await adapter.process(path, apply);
				else { result = update(null); await ensureDirectory(storage, path.slice(0, path.lastIndexOf('/'))); await this.moves.created(path); await createContentExclusive(this.app, path, result); }
				await this.scan();
			} else {
				const file = this.app.vault.getFileByPath(path);
				if (file) result = await this.app.vault.process(file, apply);
				else {
					if (this.app.vault.getAbstractFileByPath(path)) throw new Error(`Not a document: ${path}`);
					result = update(null); await ensureDirectory(adapter, path.split('/').slice(0, -1).join('/')); await this.app.vault.create(path, result);
				}
			}
			return result;
		});
	}
}
