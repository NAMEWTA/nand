import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'obsidian') return { shortCircuit: true, url: moduleUrl(`
			export class ItemView { constructor(leaf) { this.leaf = leaf; this.app = leaf.app; this.contentEl = leaf.el; this.containerEl = leaf.el; } register() {} registerEvent() {} }
			export class FileSystemAdapter {} export class Menu {} export class Notice {} export class TFile {} export class TFolder {} export class Modal {}`) };
		if (specifier === 'electron') return { shortCircuit: true, url: moduleUrl('export const shell = {}, webUtils = {};') };
		if (specifier === 'preact') return { shortCircuit: true, url: moduleUrl('export const h = () => null, render = () => {};') };
		if (specifier === './TerminalWorkbench' || specifier === './workbench') return { shortCircuit: true, url: moduleUrl('export const TerminalWorkbench = () => {}, confirmSessionClose = () => {}, HistoryPreview = () => {}, HistorySidebar = () => {}, NewConversationButton = () => {}, SessionSidebar = () => {}, TerminalHeader = () => {}, UsageFooter = () => {};') };
		return nextResolve(specifier, context);
	},
	load(url, context, nextLoad) {
		if (!url.endsWith('/terminal-view.ts')) return nextLoad(url, context);
		return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
			compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 },
		}).outputText };
	},
});
const { TerminalView } = await import('./terminal-view.ts');
const settled = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture() {
	let timerId = 0;
	const timers = new Map<number, () => void>(), cancelled: number[] = [], active: string[] = [];
	const win = {
		require: createRequire(import.meta.url),
		setTimeout(callback: () => void) { timers.set(++timerId, callback); return timerId; },
		clearTimeout(id: number) { cancelled.push(id); timers.delete(id); },
		cancelAnimationFrame() {},
	};
	globalThis.window = win as unknown as Window;
	const el = { win, empty() {}, createEl() {}, addClass() {}, onWindowMigrated: () => () => {}, doc: {}, ownerDocument: {}, style: { removeProperty() {} }, querySelector: () => null };
	const leaves: any[] = [];
	const events = new Map<string, Set<() => void>>();
	const app = { workspace: {
		getLeavesOfType: () => leaves, revealLeaf: async () => {},
		on(name: string, callback: () => void) { const listeners = events.get(name) ?? new Set(); listeners.add(callback); events.set(name, listeners); return { name, callback }; },
		offref(ref: { name: string; callback: () => void }) { events.get(ref.name)?.delete(ref.callback); },
	} };
	const leaf = { app, el, detach() {}, view: null as any };
	const host = { recordActiveSession: (id: string) => active.push(id), handleTerminalViewClosed() {}, getTerminalRenderer: async () => ({ id: 'chosen' }) };
	const view = new TerminalView(leaf as never, { subscribe: () => () => {} } as never, host as never) as any;
	leaf.view = view; leaves.push(leaf);
	view.drawWorkbench = () => {};
	view.ensureDropHint = () => {};
	view.hideDropHint = () => {};
	view.removeDropHandlers = () => {};
	view.bindOutputPause = () => {};
	view.terminalContainer = el;
	view.focusTerminal = () => {};
	return { view, win, timers, cancelled, active, leaf, leaves, host, events, emit(name: string) { for (const callback of events.get(name) ?? []) callback(); }, tick() { const queued = [...timers.values()]; timers.clear(); for (const timer of queued) timer(); } };
}

test('closing before renderer initialization rejects waiting callers immediately', async () => {
	const f = fixture();
	const waiting = f.view.waitForTerminalInstance().then(() => 'resolved', () => 'rejected');
	await f.view.onClose();
	await settled();
	assert.equal(await Promise.race([waiting, Promise.resolve('still waiting')]), 'rejected');
	assert.equal(f.timers.size, 0);
});

test('CSS changes update the current themed renderer and appearance, with one subscription after migration and none after close', async () => {
	const f = fixture();
	let themes = 0, appearances = 0;
	await f.view.onOpen();
	f.view.terminalInstance = { getOptions: () => ({ useObsidianTheme: true }), updateTheme: () => themes++, release() {} };
	f.view.updateAppearanceStyles = () => appearances++;
	f.emit('css-change');
	assert.deepEqual([themes, appearances], [1, 1]);
	f.view.bindPauseDocument = () => {};
	f.view.setupDropHandlers = () => () => {};
	f.view.attachTerminalToContainer = () => {};
	f.view.setupResizeObserver = () => {};
	f.view.handleHostWindowChanged();
	assert.equal(f.events.get('css-change')!.size, 1);
	f.emit('css-change');
	assert.equal(themes, 2);
	await f.view.onClose();
	assert.equal(f.events.get('css-change')!.size, 0);
	f.emit('css-change');
	assert.equal(themes, 2);
});

test('CSS changes preserve a renderer using custom colors', async () => {
	const f = fixture();
	let themes = 0;
	await f.view.onOpen();
	f.view.terminalInstance = { getOptions: () => ({ useObsidianTheme: false }), updateTheme: () => themes++, release() {} };
	f.view.updateAppearanceStyles = () => {};
	f.emit('css-change');
	assert.equal(themes, 0);
	await f.view.onClose();
});

test('an explicit session choice cancels the still-pending automatic initialization timer', async () => {
	const f = fixture();
	let initializeCalls = 0, resolveRenderer: (renderer: object) => void = () => {};
	f.view.initializeTerminal = async () => { initializeCalls++; };
	f.host.getTerminalRenderer = () => new Promise((resolve) => { resolveRenderer = resolve; });
	f.view.selectSession = () => {};
	await f.view.onOpen();
	const selection = f.view.selectPtySession({ id: 'chosen', isDisposed: false });
	f.tick();
	assert.equal(initializeCalls, 0);
	resolveRenderer({ id: 'chosen' });
	await selection;
});

test('selecting a session already open in another leaf updates recent-session order', () => {
	const f = fixture(), other = fixture(), renderer = { id: 'existing' };
	other.view.terminalInstance = renderer;
	f.leaves.push(other.leaf);
	f.view.selectSession(renderer);
	assert.deepEqual(f.active, ['existing']);
});

test('a renderer finishing after the view closes is never adopted', async () => {
	const f = fixture();
	let resolveRenderer: (renderer: object) => void = () => {}, selections = 0;
	f.host.getTerminalRenderer = () => new Promise((resolve) => { resolveRenderer = resolve; });
	f.view.selectSession = () => selections++;
	const waiting = f.view.waitForTerminalInstance().catch(() => 'closed');
	const selecting = f.view.selectPtySession({ id: 'chosen', isDisposed: false });
	await f.view.onClose();
	resolveRenderer({ id: 'chosen' });
	await selecting;
	assert.equal(await waiting, 'closed');
	assert.equal(selections, 0);
	assert.equal(f.timers.size, 0);
});

test('a failed explicit initial selection rejects initialization waiters', async () => {
	const f = fixture();
	f.host.getTerminalRenderer = async () => { throw new Error('renderer failed'); };
	const waiting = f.view.waitForTerminalInstance();
	await assert.rejects(f.view.selectPtySession({ id: 'chosen', isDisposed: false }), /renderer failed/);
	await assert.rejects(waiting, /renderer failed/);
	assert.equal(f.view.isInitializing(), false);
	assert.equal(f.timers.size, 0);
});

test('moving a pending initialization timer cancels it on its original window', async () => {
	const f = fixture();
	let scheduled = 0, initialized = 0;
	const newTimers = new Map<number, () => void>();
	f.view.initializeTerminal = async () => initialized++;
	f.view.bindPauseDocument = () => {};
	await f.view.onOpen();
	f.leaf.el.win = { ...f.win, setTimeout(callback: () => void) { newTimers.set(++scheduled, callback); return scheduled; } };
	f.view.handleHostWindowChanged();
	assert.equal(f.timers.size, 0);
	assert.equal(f.cancelled.length, 1);
	assert.equal(newTimers.size, 1);
	for (const timer of newTimers.values()) timer();
	assert.equal(initialized, 1);
});

test('the lazy controller placeholder cannot reopen a leaf closed while its service was loading', async () => {
	const f = fixture();
	const source = readFileSync(new URL('../../plugin/modules/terminal/controller.ts', import.meta.url), 'utf8');
	const ast = ts.createSourceFile('controller.ts', source, ts.ScriptTarget.Latest, true);
	const declaration = ast.statements.find((node) => ts.isClassDeclaration(node) && node.name?.text === 'TerminalViewPlaceholder');
	assert.ok(declaration);
	// Exercise the production class without importing the controller's unrelated native services.
	const compiled = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.None } }).outputText;
	const Placeholder = new Function('TerminalView', 'errorLog', 't', 'renderEmptyState', 'sharedT', compiled + '\nreturn TerminalViewPlaceholder;')(TerminalView, () => {}, () => '', () => {}, () => '');
	let resolveService: (service: object) => void = () => {};
	const plugin = { ...f.host, isActive: () => true, consumePendingRestoredTerminal: () => null, getTerminalService: () => new Promise((resolve) => { resolveService = resolve; }) };
	const view = new Placeholder(f.leaf, plugin);
	for (const method of ['drawWorkbench', 'ensureDropHint', 'hideDropHint', 'bindOutputPause']) view[method] = () => {};
	view.terminalContainer = f.leaf.el;
	view.removeDropHandlers = () => {};
	const opening = view.onOpen();
	await view.onClose();
	resolveService({ subscribe: () => () => {} });
	await opening;
	assert.equal(view.closed, true);
	assert.equal(f.timers.size, 0);
});
