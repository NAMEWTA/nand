import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

// Load the production renderer without Electron, while preserving its real methods.
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (specifier === 'electron') return { url: 'data:text/javascript,export const shell = {}', shortCircuit: true };
		return nextResolve(specifier, context);
	},
	load(url, context, nextLoad) {
		if (!url.endsWith('/terminal-instance.ts')) return nextLoad(url, context);
		return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
			compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 },
		}).outputText };
	},
});
const { TerminalInstance } = await import('./terminal-instance.ts');

function fixture(options: object = {}) {
	const outputs = new Set<(text: string) => void>(), events = new Set<(event: object) => void>();
	let snapshot = 'initial screen';
	const writes: string[] = [];
	const win = {
		requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
		setTimeout: () => 1, clearTimeout: () => {},
	};
	globalThis.window = win as unknown as Window;
	const element = { remove() { this.parentElement = null; }, parentElement: null };
	const container = { ownerDocument: { defaultView: win }, appendChild(el: typeof element) { el.parentElement = this; }, clientWidth: 800, clientHeight: 400 };
	const xterm = {
		element, cols: 80, rows: 24, options: {},
		buffer: { active: { type: 'normal', baseY: 0, viewportY: 0, cursorY: 0 } },
		parser: { registerCsiHandler: () => ({ dispose() {} }), registerOscHandler: () => ({ dispose() {} }) },
		write(text: string, done?: () => void) { writes.push(text); done?.(); },
		reset() {}, clear() {}, dispose() {}, open() {}, blur() {}, refresh() {},
		registerMarker: () => ({ isDisposed: true, line: -1, dispose() {} }),
		scrollToLine() {}, scrollToBottom() {}, onScroll: () => ({ dispose() {} }),
	};
	const session = {
		id: 'test', getOptions: () => options, onDispose: () => () => {},
		onOutput(listener: (text: string) => void) { listener(snapshot); outputs.add(listener); return () => outputs.delete(listener); },
		onShellEvent(listener: (event: object) => void) { events.add(listener); return () => events.delete(listener); },
		getNavigationMarkers: () => ({ prompts: [], commands: [] }),
	};
	const renderer = new TerminalInstance(session as never) as any;
	renderer.initXterm = async () => { renderer.xterm = xterm; renderer.fitAddon = { proposeDimensions: () => ({ cols: 80, rows: 24 }), fit() {} }; };
	renderer.setupXtermHandlers = () => {};
	renderer.setupDomEventHandlers = () => {};
	renderer.syncBackgroundLayerStyles = () => {};
	renderer.loadRenderer = async () => {};
	return {
		renderer, writes, outputs, container, xterm,
		emit(text: string) { for (const output of outputs) output(text); },
		setSnapshot(text: string) { snapshot = text; },
		event(event: object) { for (const listener of events) listener(event); },
	};
}

test('a renderer without a visible owner does not consume browser output', async () => {
	const f = fixture();
	await f.renderer.initialize();
	assert.equal(f.outputs.size, 0);
	assert.deepEqual(f.writes, []);
	f.renderer.destroy();
});

function themeDocument(background: string, foreground: string, dark: boolean) {
	const colors = { background, foreground };
	const doc = {
		body: { classList: { contains: (name: string) => name === 'theme-dark' && dark } },
		defaultView: {
			requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, setTimeout: () => 1, clearTimeout: () => {},
			getComputedStyle: () => ({ getPropertyValue: (name: string) => name === '--background-primary' ? colors.background : name === '--text-normal' ? colors.foreground : '' }),
		},
	};
	return { doc, colors };
}

test('following Obsidian theme reads the renderer owner document instead of another active window', async () => {
	const f = fixture({ useObsidianTheme: true });
	const main = themeDocument('#ffffff', '#333333', false), popout = themeDocument('#181818', '#dddddd', true);
	(globalThis as any).activeDocument = main.doc;
	await f.renderer.initialize();
	f.container.ownerDocument = popout.doc as any;
	f.renderer.attachToElement(f.container);
	assert.equal((f.xterm.options as any).theme.background, '#181818');
	assert.equal((f.xterm.options as any).theme.foreground, '#dddddd');
	f.renderer.destroy();
});

test('a released renderer reacquires the destination window theme without using its previous window colors', async () => {
	const f = fixture({ useObsidianTheme: true }), owner = {};
	const first = themeDocument('#ffffff', '#333333', false), destination = themeDocument('#121212', '#eeeeee', true);
	(globalThis as any).activeDocument = first.doc;
	await f.renderer.initialize();
	f.container.ownerDocument = first.doc as any;
	f.renderer.acquire(owner, f.container);
	assert.equal((f.xterm.options as any).theme.background, '#ffffff');
	f.renderer.release(owner);
	const moved = { ...f.container, ownerDocument: destination.doc };
	f.renderer.acquire(owner, moved);
	assert.equal((f.xterm.options as any).theme.background, '#121212');
	assert.equal((f.xterm.options as any).theme.foreground, '#eeeeee');
	f.renderer.destroy();
});

test('a hidden renderer refreshes current window colors when its visible owner returns', async () => {
	const f = fixture({ useObsidianTheme: true });
	const themed = themeDocument('#ffffff', '#333333', false);
	(globalThis as any).activeDocument = themed.doc;
	await f.renderer.initialize();
	f.container.ownerDocument = themed.doc as any;
	f.renderer.attachToElement(f.container);
	f.renderer.updateTheme();
	f.renderer.setOutputPaused(true);
	themed.colors.background = '#202020'; themed.colors.foreground = '#eeeeee';
	f.renderer.setOutputPaused(false);
	assert.equal((f.xterm.options as any).theme.background, '#202020');
	assert.equal((f.xterm.options as any).theme.foreground, '#eeeeee');
	f.renderer.destroy();
});

test('custom terminal colors stay unchanged across a host theme refresh', async () => {
	const f = fixture({ useObsidianTheme: false, backgroundColor: '#112233', foregroundColor: '#abcdef' });
	(globalThis as any).activeDocument = themeDocument('#ffffff', '#000000', false).doc;
	await f.renderer.initialize();
	f.renderer.attachToElement(f.container);
	f.renderer.updateTheme();
	assert.equal((f.xterm.options as any).theme.background, '#112233');
	assert.equal((f.xterm.options as any).theme.foreground, '#abcdef');
	f.renderer.destroy();
});

for (const chunks of [[2_100_000], [1_100_000, 1_100_000]]) {
	test(`hidden output restores the authoritative screen without an ANSI suffix (${chunks.join('+')})`, async () => {
		const f = fixture();
		await f.renderer.initialize();
		f.renderer.attachToElement(f.container);
		await new Promise((resolve) => setImmediate(resolve));
		f.renderer.setOutputPaused(true);
		f.writes.length = 0;
		for (const size of chunks) f.emit('\x1b[31m' + 'x'.repeat(size));
		f.setSnapshot('authoritative screen\x1b[0m');
		f.renderer.setOutputPaused(false);
		await new Promise((resolve) => setImmediate(resolve));
		assert.deepEqual(f.writes.map((text) => ({ length: text.length, prefix: text.slice(0, 32) })), [{ length: 24, prefix: 'authoritative screen\x1b[0m' }]);
		f.renderer.destroy();
	});
}

test('disposed prompt markers are not retained forever', async () => {
	const f = fixture();
	await f.renderer.initialize();
	f.renderer.attachToElement(f.container);
	await new Promise((resolve) => setImmediate(resolve));
	for (let i = 0; i < 1_100; i++) f.event({ type: 'prompt_start' });
	await new Promise((resolve) => setImmediate(resolve));
	assert.ok(f.renderer.promptMarkers.length <= 1_000);
	f.renderer.destroy();
});
