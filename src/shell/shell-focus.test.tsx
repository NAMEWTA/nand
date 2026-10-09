import assert from 'node:assert/strict';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { test } from 'vitest';
import type { WorkbenchFeature } from '../app/contracts/workbench';
import { flush, installDom, key } from '../../test/dom';
import { Shell } from './Shell';
import type { WorkbenchState } from './navigation-state';

const { document, window } = installDom();
let focused: HTMLElement | null = null;
Object.defineProperty(document, 'activeElement', { configurable: true, get: () => focused });
(window.HTMLElement.prototype as unknown as { focus(this: HTMLElement): void }).focus = function () {
	focused = this;
};
let paneWidth = 1200;
window.HTMLElement.prototype.getBoundingClientRect = () =>
	({
		width: paneWidth,
		height: 800,
		top: 0,
		left: 0,
		right: paneWidth,
		bottom: 800,
		x: 0,
		y: 0,
		toJSON() {
			return {};
		},
	}) as DOMRect;

function ownerOf(reduce: boolean) {
	const timers: Array<() => void> = [];
	const owner = {
		matchMedia: () => ({ matches: reduce }),
		setTimeout: (fn: () => void) => {
			timers.push(fn);
			return timers.length;
		},
		ResizeObserver: class {
			constructor(private readonly cb: () => void) {}
			observe() {
				this.cb();
			}
			disconnect() {}
		},
	};
	return { timers, owner };
}

function mount(reduce: boolean, feature: WorkbenchFeature = 'dashboard') {
	const host = ownerOf(reduce);
	const state: WorkbenchState = {
		target: { feature },
		panelWidth: 260,
		panelOpen: false,
		focus: false,
		lastTargets: {},
	};
	const root = document.createElement('div');
	document.body.appendChild(root);
	const opened: boolean[] = [];
	render(
		h(Shell, {
			state,
			rail: [
				{ id: 'dashboard', label: 'Home', icon: 'home', slot: 'top' },
				{ id: 'contacts', label: 'Archives', icon: 'users', slot: 'top' },
			],
			title: 'Home',
			panelTitle: 'Home',
			panel: {
				searchable: true,
				sections: [{ id: 'main', items: [{ id: 'one', label: 'One', target: { feature } }] }],
			},
			statuses: [],
			busy: false,
			ownerWindow: host.owner as unknown as Window,
			phone: false,
			onRail: (): 'navigated' => 'navigated',
			onNavigate: () => {},
			onPanelOpen: (open) => opened.push(open),
			onPanelWidth: () => {},
			more: () => {},
			retry: () => {},
			report: () => {},
			contentRef: { current: null },
			panelCustomRef: { current: null },
		}),
		root,
	);
	return { root, opened, timers: host.timers };
}

test('overlay focus moves into the drawer and Escape restores it', async () => {
	paneWidth = 700;
	const { root } = mount(false);
	await flush();
	const toggle = root.querySelector('.nand-page-panel-toggle') as HTMLElement;
	toggle.focus();
	await act(() => {
		toggle.dispatchEvent(new window.Event('click', { bubbles: true }));
	});
	const overlay = root.querySelector('.nand-shell-overlay');
	assert.ok(overlay);
	assert.equal(overlay.contains(document.activeElement), true);
	await act(() => {
		key(root.querySelector('.nand-shell') as HTMLElement, 'Escape');
	});
	assert.equal(root.querySelector('.nand-shell-overlay'), null);
	assert.equal(document.activeElement, toggle);
	render(null, root);
});

test('reduced motion skips the panel transition and a second window keeps its own timer', async () => {
	paneWidth = 1200;
	const main = mount(false, 'dashboard');
	const popout = mount(true, 'contacts');
	await flush();
	const clickToggle = (root: HTMLElement) =>
		root.querySelector('.nand-page-panel-toggle')!.dispatchEvent(new window.Event('click', { bubbles: true }));
	clickToggle(main.root);
	clickToggle(popout.root);
	await flush();
	assert.equal(main.root.querySelector('.nand-shell')?.className.includes('is-opening'), true);
	assert.equal(main.timers.length, 1);
	assert.equal(main.opened.at(-1), true);
	assert.equal(popout.root.querySelector('.nand-shell')?.className.includes('is-opening'), false);
	assert.equal(popout.timers.length, 0);
	assert.equal(popout.opened.at(-1), true);
	render(null, main.root);
	assert.equal(popout.root.querySelector('.nand-shell')?.isConnected, true);
	assert.equal(popout.timers.length, 0);
	render(null, popout.root);
});
