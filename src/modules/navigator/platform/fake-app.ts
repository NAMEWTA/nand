// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
// An in-memory vault with just enough of Obsidian's API for the platform adapters' tests.
import { TFile, TFolder, type App } from 'obsidian';
import { plainEqual } from '../core/plain-yaml';
import { parseSimpleYaml } from './simple-yaml';

interface FakeFile extends TFile { path: string; name: string; basename: string; extension: string; parent: FakeFolder | null }
interface FakeFolder extends TFolder { path: string; name: string; children: Array<FakeFile | FakeFolder>; parent: FakeFolder | null; isRoot: () => boolean }

const split = (path: string) => { const slash = path.lastIndexOf('/'); return { folder: slash < 0 ? '' : path.slice(0, slash), name: path.slice(slash + 1) }; };

/** Parse and rewrite a simple frontmatter block. */
function editFrontmatter(text: string, edit: (fm: Record<string, unknown>) => void): string {
	const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
	const rest = match ? text.slice(match[0].length) : text;
	const fm = parseSimpleYaml(match ? match[1]! : '');
	const before = structuredClone(fm);
	edit(fm);
	if (plainEqual(fm, before)) return text;
	const out: string[] = [];
	for (const [key, value] of Object.entries(fm)) {
		if (Array.isArray(value)) out.push(...(value.length ? [`${key}:`, ...value.map((item) => `  - ${String(item)}`)] : [`${key}: []`]));
		else if (value === null) out.push(`${key}:`);
		else out.push(`${key}: ${JSON.stringify(value).replace(/^"|"$/g, "")}`);
	}
	return out.length ? `---\n${out.join('\n')}\n---\n${rest}` : rest;
}

export function createFakeApp(initial: Record<string, string> = {}) {
	const files = new Map<string, string>();
	const entries = new Map<string, FakeFile | FakeFolder>();
	const trashed: string[] = [];
	const cached = new Map<string, Record<string, unknown>>();
	/** Tag positions a test pins for a note, as a metadata cache that is (possibly) behind the file. */
	const pinnedTags = new Map<string, Array<{ tag: string; start: number; end: number }>>();
	const root = Object.assign(Object.create(TFolder.prototype) as FakeFolder, { path: '/', name: '', children: [], parent: null, isRoot: () => true });
	entries.set('/', root);
	entries.set('', root);

	function folderFor(path: string): FakeFolder {
		const existing = entries.get(path);
		if (existing) return existing as FakeFolder;
		const { folder, name } = split(path);
		const parent = folderFor(folder);
		const created = Object.assign(Object.create(TFolder.prototype) as FakeFolder, { path, name, children: [], parent, isRoot: () => false });
		parent.children.push(created);
		entries.set(path, created);
		return created;
	}
	function addFile(path: string, content: string): FakeFile {
		const { folder, name } = split(path);
		const dot = name.lastIndexOf('.');
		const parent = folderFor(folder);
		const file = Object.assign(Object.create(TFile.prototype) as FakeFile, { path, name, basename: dot < 0 ? name : name.slice(0, dot), extension: dot < 0 ? '' : name.slice(dot + 1), parent });
		parent.children.push(file);
		entries.set(path, file);
		files.set(path, content);
		return file;
	}
	for (const [path, content] of Object.entries(initial)) addFile(path, content);

	const processed = (file: TFile, change: (data: string) => string) => {
		const next = change(files.get(file.path) ?? '');
		files.set(file.path, next);
		return Promise.resolve(next);
	};
	const app = {
		vault: {
			getRoot: () => root,
			getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
			getFileByPath: (path: string) => { const found = entries.get(path); return found instanceof TFile ? found : null; },
			getFolderByPath: (path: string) => { const found = entries.get(path); return found instanceof TFolder ? found : null; },
			read: (file: TFile) => Promise.resolve(files.get(file.path) ?? ''),
			cachedRead: (file: TFile) => Promise.resolve(files.get(file.path) ?? ''),
			create: (path: string, content: string) => { if (entries.has(path)) return Promise.reject(new Error('File already exists.')); return Promise.resolve(addFile(path, content)); },
			createFolder: (path: string) => Promise.resolve(folderFor(path)),
			process: processed,
			modify: (file: TFile, content: string) => { files.set(file.path, content); return Promise.resolve(); },
		},
		fileManager: {
			processFrontMatter: async (file: TFile, edit: (fm: Record<string, unknown>) => void) => { await processed(file, (data) => editFrontmatter(data, edit)); },
			trashFile: (file: TFile) => {
				trashed.push(file.path);
				files.delete(file.path);
				entries.delete(file.path);
				const parent = (file as FakeFile).parent;
				if (parent) parent.children = parent.children.filter((child) => child !== file);
				return Promise.resolve();
			},
		},
		metadataCache: {
			getFileCache: (file: TFile) => {
				const content = files.get(file.path) ?? '';
				const front = /^---\n[\s\S]*?\n---\n?/.exec(content);
				const offset = front ? front[0].length : 0;
				const tags = (pinnedTags.get(file.path) ?? [...content.slice(offset).matchAll(/#[\w/-]*[A-Za-z_/-][\w/-]*/g)].filter((m) => !/[\w&/\\#-]/.test(m.index === 0 ? ' ' : content.slice(offset)[m.index - 1]!)).map((m) => ({ tag: m[0], start: offset + m.index, end: offset + m.index + m[0].length }))).map((t) => ({ tag: t.tag, position: { start: { offset: t.start }, end: { offset: t.end } } }));
				return { ...(cached.has(file.path) ? { frontmatter: cached.get(file.path) } : {}), tags };
			},
		},
		workspace: { getActiveFile: () => null },
	};
	return {
		app: app as unknown as App,
		files,
		trashed,
		add: addFile,
		read: (path: string) => files.get(path),
		has: (path: string) => files.has(path),
		/** Make the metadata cache report these frontmatter properties for a note. */
		setFrontmatter(path: string, frontmatter: Record<string, unknown>) {
			cached.set(path, frontmatter);
		},
		/** Pin the tag positions the metadata cache reports for a note (undefined: follow the file again). */
		setTags(path: string, tags: Array<{ tag: string; start: number; end: number }> | undefined) {
			if (tags) pinnedTags.set(path, tags); else pinnedTags.delete(path);
		},
	};
}
