// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import '../../../../scripts/navigator-test-moment';
import { SettingsStore, type SettingsFile, type SettingsHandle } from '../../../shared/settings/store';
import { navigatorSchema, type NavigatorSettings } from '../settings';
import type { NoteEntry } from '../core/types';
import { createNavigatorService, type IndexPort, type OpsPort } from './navigator';

export function note(path: string, mtime = 1, tags: string[] = [], extra: Partial<NoteEntry> = {}): NoteEntry {
	const slash = path.lastIndexOf('/');
	return { path, name: path.slice(slash + 1).replace(/\.md$/, ''), ext: 'md', folder: slash < 0 ? '/' : path.slice(0, slash), ctime: mtime, mtime, tags, ...extra };
}

export class FakeVault implements IndexPort {
	version = 1;
	private listeners = new Set<() => void>();
	constructor(public files: NoteEntry[], public folderList: string[] = ['/']) {}
	notes() { return this.files; }
	folders() { return this.folderList; }
	get(path: string) { return this.files.find((entry) => entry.path === path); }
	subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
	change(files: NoteEntry[]) { this.files = files; this.version++; for (const listener of this.listeners) listener(); }
}

export function fakeOps(vault: FakeVault, overrides: Partial<OpsPort> = {}) {
	const calls: Array<[string, ...unknown[]]> = [];
	const ops: OpsPort = {
		open: (path, options) => { calls.push(['open', path, options]); return Promise.resolve(); },
		activePath: () => undefined,
		isFolder: (path) => vault.folderList.includes(path),
		createNote: (folder, tag) => { calls.push(['createNote', folder, tag]); const path = `${folder ?? ''}/Untitled.md`.replace(/^\//, ''); vault.change([...vault.files, note(path, 9)]); return Promise.resolve(path); },
		createFolder: (parent) => { calls.push(['createFolder', parent]); return Promise.resolve(`${parent}/New`); },
		rename: (path, name) => { calls.push(['rename', path, name]); if (name === 'taken') return Promise.reject(new Error('exists')); const next = path.replace(/[^/]*$/, `${name}.md`); vault.change(vault.files.map((entry) => (entry.path === path ? note(next, entry.mtime, [...entry.tags]) : entry))); return Promise.resolve(next); },
		duplicate: (path) => { calls.push(['duplicate', path]); return Promise.resolve(path); },
		move: (paths, folder) => {
			calls.push(['move', paths, folder]);
			const moved = new Map(paths.filter((path) => !path.includes('clash')).map((path): [string, string] => [path, `${folder}/${path.slice(path.lastIndexOf('/') + 1)}`]));
			vault.change(vault.files.map((entry) => (moved.has(entry.path) ? note(moved.get(entry.path)!, entry.mtime, [...entry.tags]) : entry)));
			return Promise.resolve({ moved, skipped: paths.filter((path) => path.includes('clash')) });
		},
		notifySkipped: (paths) => { calls.push(['skipped', paths]); },
		chooseFolder: () => Promise.resolve('Target'),
		ensureFolder: (path) => { calls.push(['ensureFolder', path]); if (!vault.folderList.includes(path)) vault.folderList = [...vault.folderList, path]; return Promise.resolve(); },
		askName: (_title, value) => { calls.push(['askName', value]); return Promise.resolve(value); },
		notify: (key, params) => { calls.push(['notify', key, params]); },
		confirmDelete: () => Promise.resolve(true),
		trash: (paths) => { calls.push(['trash', paths]); vault.change(vault.files.filter((entry) => !paths.includes(entry.path))); return Promise.resolve(); },
		addTag: (paths, tag) => { calls.push(['addTag', paths, tag]); return Promise.resolve(); },
		copyPath: (path) => { calls.push(['copyPath', path]); },
		report: (error) => { calls.push(['report', error]); },
		...overrides,
	};
	return { ops, calls };
}

export async function createTestService(vault: FakeVault, options: { isMac?: boolean; settings?: Partial<NavigatorSettings>; ops?: Partial<OpsPort>; now?: number; reuse?: SettingsHandle<NavigatorSettings>; timers?: boolean } = {}) {
	const files: Record<string, SettingsFile | null> = { vault: null, device: null };
	const store = new SettingsStore({
		load: (scope) => Promise.resolve(files[scope] ?? null),
		save: (scope, file) => { files[scope] = file; return Promise.resolve(file); },
	}, { timers: { set: (callback) => { queueMicrotask(callback); return 0; }, clear: () => undefined } });
	await store.load();
	const settings = options.reuse ?? store.bind('navigator', navigatorSchema);
	if (!options.reuse) await settings.update((draft) => Object.assign(draft, { openOnSelect: false, confirmDelete: false, ...options.settings }));
	const { ops, calls } = fakeOps(vault, options.ops);
	const timers = options.timers ? fakeTimers() : undefined;
	const service = createNavigatorService({ settings, timers: timers?.timers, index: vault, ops, isMac: options.isMac ?? false, labels: () => ({ folders: 'Folders', tags: 'Tags', untagged: 'Untagged', root: 'Vault', shortcuts: 'Shortcuts', recent: 'Recent', properties: 'Properties' }), now: () => options.now ?? new Date(2026, 9, 15, 12).getTime() });
	return { service, settings, calls, store, timers };
}

/** Timers that run only when a test advances them. */
export function fakeTimers() {
	const pending = new Map<number, () => void>();
	let id = 0;
	return {
		timers: { set: (callback: () => void) => { pending.set(++id, callback); return id; }, clear: (handle: unknown) => { pending.delete(handle as number); } },
		get pending() { return pending.size; },
		run() { for (const [key, callback] of [...pending]) { pending.delete(key); callback(); } },
	};
}
