import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';
import { installDom, key } from '../../../../../test/dom';
import { registerMessages, t } from '../../../../shared/i18n';
import { messages } from '../../i18n';
import type { GridTile } from '../../core/board/immersive-grid';
import { attachGridController } from '../immersive/layout-controller';

registerMessages(messages);
const { document, window } = installDom();
const frames = new Map<number, FrameRequestCallback>();
let sequence = 0;
window.requestAnimationFrame = cb => { const id = ++sequence; frames.set(id, cb); return id; };
window.cancelAnimationFrame = id => { frames.delete(id); };
const pump = () => { const batch = [...frames.values()]; frames.clear(); for (const callback of batch) callback(0); };
const cleanup: Array<() => void> = [];
afterEach(() => { for (const dispose of cleanup.splice(0)) dispose(); frames.clear(); });
const proto = window.HTMLElement.prototype as unknown as { setPointerCapture(id: number): void; focus(): void };
proto.setPointerCapture = () => {};
proto.focus = () => {};
const pointer = (el: Element, type: string, x: number, y: number) => { const e = new window.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { clientX: x, clientY: y, button: 0, pointerId: 1 }); el.dispatchEvent(e); };

function board(fixed = true) {
	let width = 1200;
	let measure = () => {};
	let disconnected = false;
	(window as unknown as { ResizeObserver: unknown }).ResizeObserver = class { constructor(callback: () => void) { measure = callback; } observe() {} disconnect() { disconnected = true; } };
	const host = document.createElement('div'); host.className = 'dashboard-scroll-region'; document.body.appendChild(host);
	host.scrollTop = 0;
	Object.defineProperty(host, 'clientHeight', { get: () => 200 }); Object.defineProperty(host, 'scrollHeight', { get: () => 800 });
	host.getBoundingClientRect = () => ({ top: 0, height: 200 }) as DOMRect;
	host.innerHTML = '<p class="nand-immersive-projection"></p><div class="nand-immersive-grid"><div class="nand-immersive-live"></div><div class="nand-immersive-ghost" hidden></div></div>';
	const grid = host.querySelector<HTMLElement>('.nand-immersive-grid')!;
	Object.defineProperty(grid, 'clientWidth', { get: () => width });
	const tiles: GridTile[] = [{ id: 'a', x: 0, y: 0, w: 6, h: 20, cap: 20, fixed, explicit: true }, { id: 'b', x: 6, y: 0, w: 3, h: 20, cap: 20, fixed, explicit: true }];
	for (const tile of tiles) {
		const el = document.createElement('article'); el.dataset.tile = tile.id;
		el.innerHTML = '<div class="nand-immersive-toolbar"><button data-grid-action="move">Move</button><button data-grid-action="resize">Resize</button><button data-grid-action="fit">Fit</button></div><div class="nand-immersive-content"><input></div>';
		Object.defineProperty(el.querySelector('.nand-immersive-content'), 'scrollHeight', { get: () => 20 });
		Object.defineProperty(el.querySelector('.nand-immersive-toolbar'), 'offsetHeight', { get: () => 32 });
		grid.appendChild(el);
	}
	const saves: GridTile[][] = [];
	const dispose = attachGridController(grid, tiles, next => saves.push(next.map(tile => ({ ...tile }))));
	cleanup.push(() => { dispose(); host.remove(); });
	const box = (id = 'a') => grid.querySelector<HTMLElement>(`[data-tile="${id}"]`)!;
	const control = (action = 'move', id = 'a') => box(id).querySelector<HTMLElement>(`[data-grid-action="${action}"]`)!;
	return { host, grid, box, control, saves, dispose, disconnected: () => disconnected, resize: (next: number) => { width = next; measure(); pump(); } };
}

test('keyboard commit saves both swap participants once; Escape and embedded inputs do not write', () => {
	const b = board(); const grip = b.control();
	key(grip, 'Enter');
	for (let i = 0; i < 5; i++) key(grip, 'ArrowRight');
	assert.equal(b.saves.length, 0);
	key(grip, 'Escape'); assert.equal(b.box().style.gridColumn, '1 / span 6');
	key(b.box().querySelector('input')!, 'Enter'); key(b.box().querySelector('input')!, 'ArrowDown'); key(b.box().querySelector('input')!, 'Enter');
	assert.equal(b.saves.length, 0);
	pointer(grip, 'pointerdown', 10, 10); pointer(grip, 'pointermove', 615, 10); pump(); pointer(grip, 'pointerup', 615, 10);
	assert.equal(b.saves.length, 1); assert.deepEqual(b.saves[0]!.map(tile => [tile.id, tile.x]), [['a', 6], ['b', 0]]);
	assert.equal(b.grid.querySelector('.nand-immersive-live')!.textContent, t('renderer.tilePlace', { x: 7, y: 1, w: 6, h: 20 }));
});

test('5px pickup threshold, pointer cancellation, lost capture and disposal leave no write or frame', () => {
	const b = board(); const grip = b.control();
	pointer(grip, 'pointerdown', 10, 10); pointer(grip, 'pointerup', 14, 10); assert.equal(b.saves.length, 0);
	pointer(grip, 'pointerdown', 10, 10); pointer(grip, 'pointermove', 615, 10); pump(); pointer(grip, 'pointercancel', 615, 10);
	assert.equal(b.box().style.gridColumn, '1 / span 6'); assert.equal(b.saves.length, 0);
	pointer(grip, 'pointerdown', 10, 10); pointer(grip, 'pointermove', 615, 10); pump(); pointer(grip, 'lostpointercapture', 615, 10); assert.equal(b.saves.length, 0);
	pointer(grip, 'pointerdown', 10, 10); pointer(grip, 'pointermove', 20, 190); b.dispose(); pump();
	assert.equal(b.saves.length, 0); assert.equal(b.disconnected(), true); assert.equal(frames.size, 0);
});

test('edge scrolling repeats on the owner window and stops on drop', () => {
	const b = board(); const grip = b.control();
	pointer(grip, 'pointerdown', 10, 180); pointer(grip, 'pointermove', 10, 190); pump(); pump();
	assert.ok(b.host.scrollTop > 0); const position = b.host.scrollTop; pump(); assert.ok(b.host.scrollTop > position);
	pointer(grip, 'pointerup', 10, 190); const stopped = b.host.scrollTop; pump(); assert.equal(b.host.scrollTop, stopped); assert.equal(b.saves.length, 1);
});

test('fit and 6/3-column resize are read-only, cancel a pending gesture and retain canonical positions', () => {
	const b = board(false);
	assert.equal(b.box().style.gridRow, '1 / span 7'); assert.equal(b.saves.length, 0);
	key(b.control(), 'Enter'); key(b.control(), 'ArrowDown'); b.resize(750);
	assert.equal(b.grid.dataset.columns, '6'); assert.equal(b.saves.length, 0); assert.equal(b.control().hasAttribute('disabled'), true);
	b.resize(400); assert.equal(b.grid.dataset.columns, '3'); assert.match(b.box().style.gridColumn, /span 3/);
	b.resize(1200); assert.equal(b.box().style.gridColumn, '1 / span 6'); assert.equal(b.box('b').style.gridColumn, '7 / span 3'); assert.equal(b.saves.length, 0);
});

test('keyboard resize sets fixed height and combined move plus resize saves in one operation', () => {
	const b = board(); const grip = b.control();
	key(grip, 'Enter'); key(grip, 'ArrowDown');
	const e = new window.Event('keydown', { bubbles: true, cancelable: true }); Object.assign(e, { key: 'ArrowDown', shiftKey: true }); grip.dispatchEvent(e);
	key(grip, 'Enter'); assert.equal(b.saves.length, 1);
	assert.equal(b.saves[0]![0]!.y, 1); assert.equal(b.saves[0]![0]!.cap, 21); assert.equal(b.saves[0]![0]!.fixed, true);
});

test('scrollbar width changes during a move do not cancel the keyboard gesture', () => {
	const b = board(); const grip = b.control();
	key(grip, 'Enter'); key(grip, 'ArrowDown'); b.resize(1216);
	key(grip, 'ArrowDown'); key(grip, 'Enter');
	assert.equal(b.saves.length, 1);
	assert.equal(b.saves[0]![0]!.y, 2);
});
