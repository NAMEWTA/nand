import { TFile, type App } from 'obsidian';

/** Emits real Vault-shaped events and serializes process(), including competing writers. */
export function memoryVault(initial: Record<string, string> = {}, win: unknown = {}) {
	const contents = new Map(Object.entries(initial)), files = new Map<string, TFile>();
	const listeners = new Map<string, Set<(...args: any[]) => void>>();
	const queues = new Map<string, Promise<unknown>>();
	let reads = 0, writes = 0;
	const file = (path: string) => { let f = files.get(path); if (!f) { f = Object.assign(new TFile(), { path, name: path.split('/').at(-1), extension: 'md' }); files.set(path, f); } return f; };
	for (const path of contents.keys()) file(path);
	const emit = (name: string, ...args: unknown[]) => { for (const listener of listeners.get(name) ?? []) listener(...args); };
	const adapter = {
		exists: async (path: string) => contents.has(path), read: async (path: string) => { reads++; if (!contents.has(path)) throw Error(`Missing ${path}`); return contents.get(path)!; },
		write: async (path: string, text: string) => { writes++; const exists = contents.has(path); contents.set(path, text); emit(exists ? 'modify' : 'create', file(path)); },
		mkdir: async () => {},
	};
	const app = { vault: {
		adapter, getMarkdownFiles: () => [...files.values()].filter(f => f.path.endsWith('.md')),
		getAbstractFileByPath: (path: string) => contents.has(path) ? file(path) : null,
		read: (f: TFile) => adapter.read(f.path), create: async (path: string, text: string) => { if (contents.has(path)) throw Error('Exists'); await adapter.write(path, text); return file(path); },
		process: (f: TFile, update: (text: string) => string) => { const operation = (queues.get(f.path) ?? Promise.resolve()).then(async () => { const result = update(await adapter.read(f.path)); await adapter.write(f.path, result); return result; }); queues.set(f.path, operation.catch(() => {})); return operation; },
		on: (name: string, callback: (...args: any[]) => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(callback); return { name, callback }; },
		offref: ({ name, callback }: { name: string; callback: (...args: any[]) => void }) => listeners.get(name)?.delete(callback),
	}, workspace: { getLeavesOfType: () => [], containerEl: { win } } } as unknown as App;
	return { app, contents, adapter, emit, file, get reads() { return reads; }, get writes() { return writes; } };
}
