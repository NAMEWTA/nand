import assert from 'node:assert/strict';
import { Scope, type App } from 'obsidian';
import { test } from 'vitest';
import { installDom } from '../../../../test/dom';
import { mountBrowserKeyScope } from './browser-key-scope';

test('browser key scope follows host focus, visibility and lifetime without owning guest or editor keys', async () => {
	const { document: doc, window: win } = installDom();
	const root = doc.createElement('div');
	root.innerHTML = '<div class="nand-browser-toolbar"><input></div><webview></webview>';
	doc.body.append(root);
	const input = root.querySelector('input')!;
	let active: Element | null = input, focused = true, resized = () => {};
	Object.defineProperty(root, 'win', { value: win });
	Object.defineProperty(root, 'getClientRects', { value: () => [1] });
	Object.defineProperty(doc, 'hasFocus', { value: () => focused });
	Object.defineProperty(doc, 'activeElement', { get: () => active, configurable: true });
	Object.defineProperty(win, 'ResizeObserver', { configurable: true, value: class {
		constructor(callback: () => void) { resized = callback; }
		observe() {}
		disconnect() { resized = () => {}; }
	} });
	const stack: Scope[] = [], parent = new Scope();
	const app = { keymap: {
		pushScope: (scope: Scope) => stack.push(scope),
		popScope: (scope: Scope) => { const index = stack.indexOf(scope); if (index >= 0) stack.splice(index, 1); },
	} } as unknown as App;
	let finds = 0, addresses = 0, escapeAvailable = true;
	const dispose = mountBrowserKeyScope(app, root, parent, {
		find: () => { finds++; }, address: () => { addresses++; }, escape: () => escapeAvailable,
	});
	assert.equal(stack.length, 1);
	const scope = stack[0] as unknown as { parent: Scope; handlers: { key: string | null; callback(event: KeyboardEvent): unknown }[] };
	assert.equal(scope.parent, parent);
	const invoke = (key: string, options: Partial<KeyboardEvent> = {}) => (scope.handlers.find(handler => handler.key === key) ?? scope.handlers.find(handler => handler.key === null))!.callback({
		key, preventDefault() {}, stopPropagation() {}, ...options,
	} as KeyboardEvent);
	assert.equal(invoke('f'), false);
	assert.equal(invoke('l'), false);
	invoke('f', { isComposing: true }); invoke('f', { shiftKey: true }); invoke('f', { altKey: true });
	invoke('f', { ctrlKey: true, metaKey: true });
	assert.deepEqual([finds, addresses], [1, 1]);
	assert.equal(invoke('Escape'), false);
	escapeAvailable = false;
	assert.equal(invoke('Escape'), undefined, 'unhandled Escape declines the wildcard and reaches the parent modal scope');
	active = root.querySelector('webview');
	doc.dispatchEvent(new win.Event('focusin'));
	assert.equal(stack.length, 0);
	invoke('f'); assert.equal(finds, 1);
	active = input; doc.dispatchEvent(new win.Event('focusin'));
	assert.equal(stack.length, 1);
	root.setAttribute('hidden', '');
	invoke('f'); assert.equal(finds, 1, 'hidden pane is rejected before observer delivery');
	resized(); assert.equal(stack.length, 0);
	root.removeAttribute('hidden'); resized(); assert.equal(stack.length, 1);
	focused = false; win.dispatchEvent(new win.Event('blur')); assert.equal(stack.length, 0);
	focused = true; win.dispatchEvent(new win.Event('focus')); assert.equal(stack.length, 1);
	active = doc.body; doc.dispatchEvent(new win.Event('focusin')); assert.equal(stack.length, 0);
	active = input; doc.dispatchEvent(new win.Event('focusin')); assert.equal(stack.length, 1);
	doc.dispatchEvent(new win.Event('focusout'));
	dispose(); await Promise.resolve(); assert.equal(stack.length, 0);
	doc.dispatchEvent(new win.Event('focusin')); assert.equal(stack.length, 0);
	root.remove();
});
