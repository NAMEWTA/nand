// Fixed time zone: the Iconic 1.1.10 oracle outcomes were recorded in UTC.
process.env.TZ = 'UTC';
import { createIconicDialogs } from '../../modules/icons/ui/dialog-factory';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { App, Component as ObsidianComponent, Plugin, Command } from 'obsidian';
import { TFile, Menu } from 'obsidian';
import { Component } from '../../../scripts/iconic-obsidian-stub';
import fixture from '../../../scripts/fixtures/iconic/upstream-1.1.10.json';
import RuleManager, { type RuleItem } from '../../modules/icons/platform/managers/rule-manager';
import MenuManager from '../../modules/icons/platform/managers/menu-manager';
import IconicController, { type IconicHost } from '../../modules/icons/platform/host/controller';
import { IconicStore } from '../../modules/icons/platform/persistence/store';
import { DEFAULT_ICONIC_SETTINGS } from '../../modules/icons/core/settings/model';
import { IconicSettingsSections } from '../../modules/icons/ui/settings/sections';
import { iconicTranslations as startupIconic } from '../../shared/i18n/iconic';
import { messages as iconsMessages } from './i18n';

/** Iconic strings live partly in startup (commands, settings headings) and partly in the module dictionary. */
const iconicOnly = (dictionary: Record<string, string>) => Object.fromEntries(Object.entries(dictionary).filter(([key]) => key.startsWith('iconic.')));
const iconicTranslations = {
	en: { ...startupIconic.en, ...iconicOnly(iconsMessages.en) } as Record<string, string>,
	zh: { ...startupIconic.zh, ...iconicOnly(iconsMessages.zh) } as Record<string, string>,
};
import { setLanguage } from '../../shared/i18n/index';
import type { FileItem } from '../../modules/icons/core/types';

Object.assign(String, { isString: (value: unknown) => typeof value === 'string' });
Object.assign(Number, { isNumber: (value: unknown) => typeof value === 'number' });
Object.assign(globalThis, { isBoolean: (value: unknown) => typeof value === 'boolean', window: globalThis });

function storage() {
	const files = new Map<string, string>();
	const mtimes = new Map<string, number>();
	const writes: string[] = [];
	const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
	const events = {
		on(name: string, fn: (...args: unknown[]) => void) {
			const set = handlers.get(name) ?? new Set();
			handlers.set(name, set);
			set.add(fn);
			return { off: () => set.delete(fn) };
		},
		emit(name: string, ...args: unknown[]) {
			for (const fn of handlers.get(name) ?? []) fn(...args);
		},
	};
	const win = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
	const doc = Object.assign(new EventTarget(), { defaultView: win, visibilityState: 'visible' });
	const adapter = {
		mkdir: async () => {},
		exists: async (p: string) => files.has(p),
		read: async (p: string) => {
			if (!files.has(p)) throw Error('ENOENT ' + p);
			return files.get(p)!;
		},
		write: async (p: string, text: string) => {
			writes.push(p);
			files.set(p, text);
			mtimes.set(p, Date.now());
			events.emit('raw', p);
		},
		stat: async (p: string) => (files.has(p) ? { mtime: mtimes.get(p) ?? 0 } : null),
		remove: async (p: string) => {
			files.delete(p);
			mtimes.delete(p);
		},
		copy: async (from: string, to: string) => {
			files.set(to, files.get(from)!);
			mtimes.set(to, Date.now());
		},
		rename: async (from: string, to: string) => {
			files.set(to, files.get(from)!);
			mtimes.set(to, mtimes.get(from)!);
			files.delete(from);
			mtimes.delete(from);
		},
	};
	const app = {
		vault: { configDir: '.custom', adapter, ...events },
		metadataCache: { ...events },
		workspace: { containerEl: { ownerDocument: doc }, ...events },
	} as unknown as App;
	return { app, files, mtimes, writes, events, handlers, store: new IconicStore(app, { id: 'nand' }) };
}
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test('defaults, all locale values, command ids and resource bytes match pinned upstream', () => {
	assert.deepEqual(DEFAULT_ICONIC_SETTINGS, fixture.defaults);
	const locales = structuredClone(fixture.locales);
	// Reviewed NAND copy changes. The upstream oracle remains immutable.
	locales.en['iconic.menu.changeIcon'] = 'Change icon…';
	locales.en['iconic.backups.backupNotice'] = 'NAND could not load icon settings.';
	for (const key of Object.keys(locales.zh) as Array<keyof typeof locales.zh>) locales.zh[key] = locales.zh[key].replaceAll('……', '…');
	locales.zh['iconic.backups.backupNotice'] = 'NAND 无法加载图标设置。';
	locales.zh['iconic.settings.minimalFolderIcons.name'] = '极简文件夹图标';
	locales.zh['iconic.commands.toggleQuickSwitcherIcons'] = '切换快速切换器图标';
	assert.deepEqual(iconicTranslations, locales);
	for (const [name, hash] of Object.entries(fixture.hashes)) {
		const text = readFileSync('src/modules/icons/core/res/' + name, 'utf8').replaceAll('\r\n', '\n');
		// The pinned upstream text is LF; checkout line endings may differ.
		for (const content of [text, text.replaceAll('\n', '\r\n')])
			assert.equal(createHash('sha256').update(content.replaceAll('\r\n', '\n')).digest('hex'), hash, name);
	}
	const ids: string[] = [];
	const f = storage();
	const lifetime = new Component();
	const host = {
		app: f.app,
		manifest: { id: 'nand', name: 'NAND' },
		commands: { add: (command: Command) => { ids.push(command.id); return command; } },
		editor: { addExtension: () => {}, addPostProcessor: () => {} },
		lifetime,
	} as unknown as IconicHost;
	const controller = new IconicController(host, createIconicDialogs);
	// Commands register when the controller loads, even if activation is deferred.
	const internals = controller as unknown as { activate: () => Promise<void> };
	internals.activate = async () => {};
	return controller.onload().then(async () => {
		assert.deepEqual(ids, fixture.commands.map((id) => id === 'toggle-minimal.folder-icons' ? 'toggle-minimal-folder-icons' : id));
	});
});

test('137 rule outcomes match the original 1.1.10 implementation', () => {
	const manager = Object.create(RuleManager.prototype) as RuleManager;
	const tfile = Object.assign(new TFile(), { path: fixture.file.id, stat: fixture.stat });
	Object.assign(manager, {
		plugin: {
			splitFilePath: IconicController.prototype.splitFilePath,
			app: {
				vault: { getAbstractFileByPath: () => tfile },
				metadataCache: { getFileCache: () => fixture.metadata },
			},
		},
	});
	for (const entry of fixture.cases) {
		const rule = {
			id: 'fixture',
			name: 'fixture',
			category: 'rule',
			iconDefault: 'lucide-file',
			icon: null,
			color: null,
			match: 'all',
			enabled: true,
			...entry,
		} as RuleItem;
		assert.equal(
			manager.judgeFile(fixture.file as FileItem, rule, new Date(fixture.now)),
			entry.expected,
			entry.label,
		);
	}
});

test('declarative settings expose folder icons in both languages and six sections', () => {
	const f = storage();
	const controller = new IconicController({ app: f.app, manifest: { id: 'nand' } } as unknown as IconicHost, createIconicDialogs);
	for (const language of ['en', 'zh'] as const) {
		setLanguage(language);
		const groups = new IconicSettingsSections(controller).getSettingDefinitions();
		assert.equal(groups.length, 6);
		assert.ok(
			groups.every((group) => group.items?.every((item) => 'render' in item && !('control' in item))),
			'every icon preference must use the domain store, never NAND settings binding',
		);
		const names = groups.flatMap((group) =>
			(group.items ?? []).map((item) => ('name' in item ? item.name : undefined)),
		);
		assert.ok(names.includes(iconicTranslations[language]['iconic.settings.showAllFolderIcons.name']));
		assert.equal(names.length, 24); // 22 preferences plus rulebook and usage checker.
	}
	setLanguage('zh');
});

test('saves coalesce for 300ms, isolate data.json and own their defaults', async () => {
	const f = storage();
	f.files.set('.custom/plugins/nand/data.json', '{"unrelated":true}');
	await f.store.load();
	f.store.settings.fileIcons['Z.md'] = { icon: 'lucide-star' };
	const promise = f.store.save();
	f.store.settings.fileIcons['A.md'] = { color: 'red' };
	assert.equal(f.store.save(), promise);
	assert.equal(f.writes.length, 0);
	await promise;
	assert.deepEqual(Object.keys(JSON.parse(f.files.get(f.store.path)!).fileIcons), ['A.md', 'Z.md']);
	assert.equal(f.files.get('.custom/plugins/nand/data.json'), '{"unrelated":true}');
	assert.deepEqual(f.writes.filter(path => path === f.store.path), [f.store.path]);
	assert.equal(f.files.get(f.store.path + '.backup1'), f.files.get(f.store.path));
	const second = storage();
	await second.store.load();
	assert.deepEqual(second.store.settings.fileIcons, {});
});

test('backup rotation, 0/2/9 limits, corrupt and missing primary recovery', async () => {
	for (const max of [0, 2, 9]) {
		const f = storage();
		f.files.set(f.store.path, JSON.stringify({ ...fixture.defaults, maxBackups: max }));
		await f.store.load();
		for (let index = 1; index <= 9; index++) {
			f.files.set(
				f.store.path + '.backup' + index,
				JSON.stringify({ ...fixture.defaults, maxBackups: max, maxSearchResults: index }),
			);
			f.mtimes.set(f.store.path + '.backup' + index, 1);
		}
		await f.store.saveBackup();
		assert.equal([...f.files.keys()].filter((key) => key.includes('.backup')).length, max);
		if (max > 0) {
			assert.equal(JSON.parse(f.files.get(f.store.path + '.backup1')!).maxBackups, max);
			assert.equal(JSON.parse(f.files.get(f.store.path + '.backup2')!).maxSearchResults, 1);
		}
	}
	for (const corrupt of [true, false]) {
		const f = storage();
		if (corrupt) f.files.set(f.store.path, '{broken');
		f.files.set(f.store.path + '.backup1', JSON.stringify({ ...fixture.defaults, maxSearchResults: 73 }));
		await f.store.load();
		assert.equal(f.store.settings.maxSearchResults, 73);
	}
});

test('raw file watcher reloads external edits, ignores own writes, cancels on disable', async () => {
	const f = storage();
	await f.store.load();
	const scope = new Component();
	let changes = 0;
	f.store.watch(scope as unknown as ObsidianComponent, () => changes++);
	await f.store.save();
	await wait(350);
	await f.store.flush();
	assert.equal(changes, 0);
	f.files.set(f.store.path, JSON.stringify({ ...fixture.defaults, maxSearchResults: 57 }));
	f.events.emit('raw', f.store.path);
	await wait(350);
	await f.store.flush();
	assert.equal(changes, 1);
	assert.equal(f.store.settings.maxSearchResults, 57);
	f.events.emit('raw', f.store.path);
	scope.unload();
	await wait(350);
	assert.equal(changes, 1);
	assert.ok([...f.handlers.values()].every((set) => set.size === 0));
});

test('menu patch restores after ten cycles and preserves later patches', () => {
	const original = Menu.prototype.showAtPosition;
	for (let i = 0; i < 10; i++) {
		const manager = new MenuManager();
		assert.notEqual(Menu.prototype.showAtPosition, original);
		manager.unload();
		assert.equal(Menu.prototype.showAtPosition, original);
	}
	const manager = new MenuManager();
	const later = function (this: Menu) {
		return this;
	};
	Menu.prototype.showAtPosition = later;
	manager.unload();
	assert.equal(Menu.prototype.showAtPosition, later);
	Menu.prototype.showAtPosition = original;
});

test('disable before layout-ready cancels startup; every restart is a new controller and releases its registrations', async () => {
	const f = storage();
	const callbacks: Array<() => void> = [];
	Object.assign(f.app.workspace, { onLayoutReady: (callback: () => void) => callbacks.push(callback) });
	const live = { commands: 0, extensions: 0, processors: 0 };
	let starts = 0;
	const create = () => {
		const lifetime = new Component();
		lifetime.load();
		const track = (key: keyof typeof live) => { live[key]++; lifetime.register(() => { live[key]--; }); };
		const host = {
			app: f.app,
			manifest: { id: 'nand', name: 'NAND' },
			commands: { add: (command: Command) => { track('commands'); return command; } },
			editor: { addExtension: () => track('extensions'), addPostProcessor: () => track('processors') },
			lifetime,
		} as unknown as IconicHost;
		const controller = new IconicController(host, createIconicDialogs);
		Object.assign(controller, { startManagers: () => { starts++; }, stopManagers: () => {}, refreshBody: () => {} });
		return { controller, lifetime };
	};
	// Turned off before the layout is ready: nothing starts.
	let run = create();
	await run.controller.onload();
	await run.controller.dispose();
	run.lifetime.unload();
	callbacks.splice(0).forEach((callback) => callback());
	assert.equal(starts, 0);
	assert.deepEqual(live, { commands: 0, extensions: 0, processors: 0 });
	for (let i = 0; i < 10; i++) {
		run = create();
		await run.controller.onload();
		assert.deepEqual(live, { commands: 14, extensions: 1, processors: 1 });
		callbacks.splice(0).forEach((callback) => callback());
		await run.controller.dispose();
		run.lifetime.unload();
		assert.deepEqual(live, { commands: 0, extensions: 0, processors: 0 });
	}
	assert.equal(starts, 10);
	assert.ok([...f.handlers.values()].every((set) => set.size === 0));
	run = create();
	const pending = run.controller.onload();
	const disposing = run.controller.dispose();
	await pending;
	await disposing;
	callbacks.splice(0).forEach((callback) => callback());
	assert.equal(starts, 10);
	assert.equal(run.controller.isActive(), false);
});
