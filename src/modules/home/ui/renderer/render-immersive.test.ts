import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import type { DashboardCard, DashboardData } from '../../core/board/types/index';
import { test } from 'vitest';
import { registerMessages, t } from '../../../../shared/i18n';
import { installDom, key } from '../../../../../test/dom';
import { messages } from '../../i18n';
import type { RenderCallbacks } from '../render-contract';
import { renderImmersiveBoard } from './render-immersive';

registerMessages(messages);
const { document, window } = installDom();
if (typeof CSS === 'undefined')
	(globalThis as { CSS: { escape(value: string): string } }).CSS = { escape: (value) => value };

const proto = window.HTMLElement.prototype as unknown as {
	createEl(
		this: HTMLElement,
		tag: string,
		options?: { cls?: string; text?: string; attr?: Record<string, string> },
	): HTMLElement;
	createDiv(this: HTMLElement, options?: { cls?: string; attr?: Record<string, string> }): HTMLElement;
	setPointerCapture(id: number): void;
};
proto.createEl = function (tag, options) {
	const el = this.ownerDocument.createElement(tag);
	if (options?.cls) el.className = options.cls;
	if (options?.text) el.textContent = options.text;
	if (options?.attr) for (const [name, value] of Object.entries(options.attr)) el.setAttribute(name, value);
	this.appendChild(el);
	return el;
};
proto.createDiv = function (options) {
	return this.createEl('div', options);
};
proto.setPointerCapture = () => {};
let focused: Element | null = null;
Object.defineProperty(document, 'activeElement', { configurable: true, get: () => focused });
(proto as unknown as { focus(this: HTMLElement): void }).focus = function () {
	focused = this;
};

const queued: FrameRequestCallback[] = [];
window.requestAnimationFrame = (callback: FrameRequestCallback) => {
	queued.push(callback);
	return queued.length;
};
window.cancelAnimationFrame = (id: number) => {
	queued[id - 1] = () => {};
};
const pump = () => {
	const batch = queued.splice(0, queued.length);
	for (const callback of batch) callback(0);
};

function pointer(target: Element, type: string, x: number, y: number) {
	const event = new window.Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, { clientX: x, clientY: y, button: 0, pointerId: 1 });
	target.dispatchEvent(event);
}

function board(): { root: HTMLElement; host: HTMLElement; moves: string[]; changes: string[] } {
	const moves: string[] = [];
	const changes: string[] = [];
	const host = document.createElement('div');
	host.className = 'dashboard-scroll-region';
	host.scrollTop = 0;
	Object.defineProperty(host, 'clientHeight', { configurable: true, get: () => 200 });
	Object.defineProperty(host, 'scrollHeight', { configurable: true, get: () => 800 });
	host.getBoundingClientRect = () => ({
		top: 0,
		left: 0,
		width: 288,
		height: 200,
		right: 288,
		bottom: 200,
		x: 0,
		y: 0,
		toJSON() {
			return {};
		},
	});
	const root = document.createElement('div');
	host.appendChild(root);
	document.body.appendChild(host);
	const card = {
		id: 'card-1',
		title: 'Note',
		type: 'text',
		column: 'Main',
		body: '',
		tasks: [],
		docs: [],
		url: '',
		wikiLink: '',
		progress: 0,
		streak: 0,
		dueDate: '',
		blockquote: '',
		color: '',
		coverImage: '',
		width: 0,
		size: 'medium',
		gridCols: 4,
		gridRows: 4,
		gridCol: 1,
		gridRow: 1,
	} as unknown as DashboardCard;
	const data = {
		banner: { images: [], quote: '', author: '' },
		quickActions: [],
		columns: [{ name: 'Main', color: '', cards: [card] }],
	} as unknown as DashboardData;
	const callbacks = {
		onCardGridMove: (id: string) => moves.push(id),
		onCardGridChange: (id: string) => changes.push(id),
	} as unknown as RenderCallbacks;
	renderImmersiveBoard(root, data, callbacks);
	return { root, host, moves, changes };
}

const place = (x: number, y: number, w = 4, h = 4) => t('renderer.tilePlace', { x, y, w, h });

test('keyboard move, resize, and cancel announce the tile and write only on drop', () => {
	const { root, moves, changes } = board();
	const grip = root.querySelector('.nand-immersive-grip') as HTMLElement;
	const live = root.querySelector('.nand-immersive-live') as HTMLElement;
	assert.equal(live.getAttribute('aria-live'), 'polite');
	let blurred = 0;
	grip.blur = () => {
		blurred += 1;
	};
	grip.focus();
	key(grip, 'Enter');
	assert.equal(live.textContent, place(1, 1));
	key(grip, 'ArrowRight');
	assert.equal(live.textContent, place(2, 1));
	assert.equal(blurred, 0);
	assert.equal(grip.isConnected, true);
	const grown = new window.Event('keydown', { bubbles: true, cancelable: true });
	Object.assign(grown, { key: 'ArrowRight', shiftKey: true });
	grip.dispatchEvent(grown);
	assert.equal(live.textContent, place(2, 1, 5, 4));
	key(grip, 'Escape');
	assert.equal(live.textContent, place(1, 1));
	assert.equal(document.activeElement, grip);
	assert.deepEqual(moves, []);
	assert.deepEqual(changes, []);
	key(grip, 'Enter');
	key(grip, 'ArrowDown');
	key(grip, 'Enter');
	assert.deepEqual(moves, ['card-1']);
	assert.equal(live.textContent, place(1, 2));
});

test('a pointer held on the edge keeps scrolling and the drop follows that scroll', () => {
	const { root, host, moves } = board();
	const grip = root.querySelector('.nand-immersive-grip') as HTMLElement;
	const live = root.querySelector('.nand-immersive-live') as HTMLElement;
	pointer(grip, 'pointerdown', 20, 180);
	pointer(grip, 'pointermove', 20, 180);
	assert.equal(host.scrollTop, 0);
	pump();
	assert.equal(host.scrollTop, 16);
	assert.equal(live.textContent, place(1, 2));
	const moving = host.scrollTop;
	pump();
	assert.ok(host.scrollTop > moving);
	pointer(grip, 'pointerup', 20, 180);
	const stopped = host.scrollTop;
	pump();
	assert.equal(host.scrollTop, stopped);
	assert.deepEqual(moves, ['card-1']);
});

function pair() {
	const moves: string[] = [];
	const changes: string[] = [];
	const host = document.createElement('div');
	host.className = 'dashboard-scroll-region';
	host.scrollTop = 0;
	Object.defineProperty(host, 'clientHeight', { configurable: true, get: () => 200 });
	Object.defineProperty(host, 'scrollHeight', { configurable: true, get: () => 800 });
	const root = document.createElement('div');
	Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => 960 });
	host.appendChild(root);
	document.body.appendChild(host);
	const make = (id: string, title: string, gridCol: number, gridRow: number, gridCols: number, gridRows: number) =>
		({
			id,
			title,
			type: 'text',
			column: 'Main',
			body: '',
			tasks: [],
			docs: [],
			url: '',
			wikiLink: '',
			progress: 0,
			streak: 0,
			dueDate: '',
			blockquote: '',
			color: '',
			coverImage: '',
			width: 0,
			size: 'medium',
			gridCols,
			gridRows,
			gridCol,
			gridRow,
		}) as unknown as DashboardCard;
	const data = {
		banner: { images: [], quote: '', author: '' },
		quickActions: [],
		columns: [{ name: 'Main', color: '', cards: [make('a', 'Wide', 1, 1, 6, 4), make('b', 'Slim', 7, 1, 3, 2)] }],
	} as unknown as DashboardData;
	renderImmersiveBoard(root, data, {
		onCardGridMove: (id: string) => moves.push(id),
		onCardGridChange: (id: string) => changes.push(id),
	} as unknown as RenderCallbacks);
	const box = (id: string) => root.querySelector(`[data-tile="${id}"]`) as HTMLElement;
	return { root, moves, changes, box };
}

test('pointer snap, swap, and resize paint the landing, and cancel or a title control writes nothing', () => {
	const snapped = pair();
	const wide = snapped.box('a');
	const grip = wide.querySelector('.nand-immersive-grip') as HTMLElement;
	pointer(grip, 'pointerdown', 10, 10);
	pointer(grip, 'pointermove', 14, 10);
	assert.equal(wide.style.gridColumn, '1 / span 6');
	pointer(grip, 'pointerup', 14, 10);
	assert.deepEqual(snapped.moves, []);
	assert.deepEqual(snapped.changes, []);

	const swapped = pair();
	const from = swapped.box('a');
	const handle = from.querySelector('.nand-immersive-grip') as HTMLElement;
	pointer(handle, 'pointerdown', 10, 10);
	pointer(handle, 'pointermove', 90, 10);
	assert.equal(from.style.gridColumn, '7 / span 6');
	assert.equal(swapped.box('b').style.gridColumn, '1 / span 3');
	pointer(handle, 'pointerup', 90, 10);
	assert.equal(from.style.gridColumn, '7 / span 6');
	assert.equal(swapped.box('b').style.gridColumn, '1 / span 3');
	assert.deepEqual(swapped.moves, ['a']);

	const resized = pair();
	const slim = resized.box('b');
	const corner = slim.querySelector('.nand-immersive-resize') as HTMLElement;
	pointer(corner, 'pointerdown', 0, 0);
	pointer(corner, 'pointermove', 20, 20);
	pointer(corner, 'pointerup', 20, 20);
	assert.equal(slim.style.gridColumn, '7 / span 4');
	assert.equal(slim.style.gridRow, '1 / span 3');
	assert.deepEqual(resized.changes, ['b']);
	assert.deepEqual(resized.moves, []);

	const cancelled = pair();
	const moving = cancelled.box('a').querySelector('.nand-immersive-grip') as HTMLElement;
	pointer(moving, 'pointerdown', 10, 10);
	pointer(moving, 'pointermove', 90, 10);
	pointer(moving, 'pointercancel', 90, 10);
	assert.equal(cancelled.box('a').style.gridColumn, '1 / span 6');
	assert.equal(cancelled.box('b').style.gridColumn, '7 / span 3');
	assert.deepEqual(cancelled.moves, []);
	assert.deepEqual(cancelled.changes, []);

	const guarded = pair();
	const title = guarded.box('a');
	const field = document.createElement('input');
	title.querySelector('.nand-immersive-grip')?.appendChild(field);
	pointer(field, 'pointerdown', 10, 10);
	pointer(field, 'pointermove', 90, 10);
	pointer(field, 'pointerup', 90, 10);
	assert.equal(title.style.gridColumn, '1 / span 6');
	assert.deepEqual(guarded.moves, []);

	const closed = pair();
	const leaving = closed.box('a').querySelector('.nand-immersive-grip') as HTMLElement;
	pointer(leaving, 'pointerdown', 10, 10);
	pointer(leaving, 'pointermove', 90, 10);
	closed.root.remove();
	pump();
	assert.deepEqual(closed.moves, []);
	assert.deepEqual(closed.changes, []);
});

test('reduced motion still moves a tile, and another window stays where it was', () => {
	const { window: popout } = parseHTML('<!doctype html><html><body></body></html>');
	const foreign = popout.HTMLElement.prototype as unknown as typeof proto;
	foreign.createEl = proto.createEl;
	foreign.createDiv = proto.createDiv;
	foreign.setPointerCapture = proto.setPointerCapture;
	const other = popout.document.createElement('div');
	Object.defineProperty(other, 'clientWidth', { configurable: true, get: () => 960 });
	popout.document.body.appendChild(other);
	const card = {
		id: 'pop',
		title: 'Pop',
		type: 'text',
		column: 'Main',
		body: '',
		tasks: [],
		docs: [],
		url: '',
		wikiLink: '',
		progress: 0,
		streak: 0,
		dueDate: '',
		blockquote: '',
		color: '',
		coverImage: '',
		width: 0,
		size: 'medium',
		gridCols: 4,
		gridRows: 4,
		gridCol: 1,
		gridRow: 1,
	} as unknown as DashboardCard;
	renderImmersiveBoard(
		other,
		{
			banner: { images: [], quote: '', author: '' },
			quickActions: [],
			columns: [{ name: 'Main', color: '', cards: [card] }],
		} as unknown as DashboardData,
		{} as RenderCallbacks,
	);
	const there = other.querySelector('[data-tile="pop"]') as HTMLElement;
	assert.equal(there.style.gridColumn, '1 / span 4');
	window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
	const { root, moves } = board();
	const grip = root.querySelector('.nand-immersive-grip') as HTMLElement;
	pointer(grip, 'pointerdown', 10, 10);
	pointer(grip, 'pointermove', 50, 10);
	pointer(grip, 'pointerup', 50, 10);
	assert.equal((root.querySelector('[data-tile="card-1"]') as HTMLElement).style.gridColumn, '3 / span 4');
	assert.deepEqual(moves, ['card-1']);
	assert.equal(there.style.gridColumn, '1 / span 4');
});
