import { TFile, type App } from 'obsidian';

/** Emits real Vault-shaped events and serializes process(), including competing writers. */
export function memoryVault(initial: Record<string, string> = {}, win: unknown = {}) {
	const contents = new Map(Object.entries(initial)), files = new Map<string, TFile>();
	const directories = new Set<string>(['']);
	const stamps = new Map<string, number>();
	const visible = (path: string) => !path.split('/').some(part => part.startsWith('.'));
	const parents = (path: string) => { const parts = path.split('/'); for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/')); };
	const listeners = new Map<string, Set<(...args: any[]) => void>>();
	const queues = new Map<string, Promise<unknown>>();
	let reads = 0, writes = 0;
	const file = (path: string) => { let f = files.get(path); if (!f) { const name = path.split('/').at(-1)!; f = Object.assign(new TFile(), { path, name, basename: name.replace(/\.[^.]+$/, ''), extension: name.includes('.') ? name.split('.').at(-1) : '', stat: { ctime: 1, mtime: stamps.get(path) ?? 1, size: contents.get(path)?.length ?? 0 } }); files.set(path, f); } return f; };
	for (const path of contents.keys()) { parents(path); file(path); }
	const emit = (name: string, ...args: unknown[]) => { for (const listener of listeners.get(name) ?? []) listener(...args); };
	const adapter = {
		exists: async (path: string) => contents.has(path) || directories.has(path) || [...contents.keys()].some(key => key.startsWith(path + '/')), read: async (path: string) => { reads++; if (!contents.has(path)) throw Error(`Missing ${path}`); return contents.get(path)!; },
		write: async (path: string, text: string) => { writes++; const exists = contents.has(path); contents.set(path, text); parents(path); stamps.set(path, writes + 1); const f = file(path); f.stat = { ctime: 1, mtime: writes + 1, size: text.length }; if (visible(path)) emit(exists ? 'modify' : 'create', f); },
		mkdir: async (path: string) => { directories.add(path); parents(path); },
		stat: async (path: string) => contents.has(path) ? { type: 'file' as const, ctime: 1, mtime: stamps.get(path) ?? 1, size: contents.get(path)!.length } : directories.has(path) ? { type: 'folder' as const, ctime: 1, mtime: 1, size: 0 } : null,
		list: async (path: string) => { for (const file of contents.keys()) parents(file); const prefix = path ? path + '/' : ''; return { files: [...contents.keys()].filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')), folders: [...directories].filter(p => p !== path && p.startsWith(prefix) && !p.slice(prefix.length).includes('/')) }; },
		process: (path: string, update: (text: string) => string) => { const operation = (queues.get(path) ?? Promise.resolve()).then(async () => { const result = update(await adapter.read(path)); await adapter.write(path, result); return result; }); queues.set(path, operation.catch(() => {})); return operation; },
		readBinary: async (path: string) => new TextEncoder().encode(await adapter.read(path)).buffer,
		writeBinary: async (path: string, data: ArrayBuffer) => adapter.write(path, new TextDecoder().decode(data)),
		getResourcePath: (path: string) => 'app://vault/' + path,
		copy: async (source: string, target: string) => { if (contents.has(target)) throw new Error('Exists'); await adapter.write(target, await adapter.read(source)); },
		rename: async (source: string, target: string) => {
			if (contents.has(target) || directories.has(target)) throw new Error('Exists');
			if (directories.has(source)) {
				for (const path of [...directories]) if (path === source || path.startsWith(source + '/')) { directories.delete(path); directories.add(target + path.slice(source.length)); }
				for (const path of [...contents.keys()]) if (path.startsWith(source + '/')) { await adapter.write(target + path.slice(source.length), contents.get(path)!); contents.delete(path); }
			} else { await adapter.write(target, await adapter.read(source)); contents.delete(source); }
			if (visible(source)) emit('delete', file(source));
		},
	};
	const app = { vault: {
		adapter, getMarkdownFiles: () => [...files.values()].filter(f => contents.has(f.path) && visible(f.path) && f.path.endsWith('.md')),
		getAbstractFileByPath: (path: string) => visible(path) && contents.has(path) ? file(path) : null,
		getFileByPath: (path: string) => visible(path) && contents.has(path) ? file(path) : null,
		read: (f: TFile) => adapter.read(f.path), create: async (path: string, text: string) => { if (contents.has(path)) throw Error('Exists'); await adapter.write(path, text); return file(path); },
		process: (f: TFile, update: (text: string) => string) => { const operation = (queues.get(f.path) ?? Promise.resolve()).then(async () => { const result = update(await adapter.read(f.path)); await adapter.write(f.path, result); return result; }); queues.set(f.path, operation.catch(() => {})); return operation; },
		on: (name: string, callback: (...args: any[]) => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(callback); return { name, callback }; },
		offref: ({ name, callback }: { name: string; callback: (...args: any[]) => void }) => listeners.get(name)?.delete(callback),
	}, workspace: { getLeavesOfType: () => [], containerEl: { win } } } as unknown as App;
	return { app, contents, adapter, emit, file, get reads() { return reads; }, get writes() { return writes; } };
}
