import { El } from './mini-dom';
/** Install a document for integration tests that combine native Obsidian helpers and Preact. */
export function installPreactMiniDom(): void {
	Object.defineProperty(El.prototype, 'draggable', {
		configurable: true,
		get() {
			return this.getAttribute('draggable') === 'true';
		},
		set(value: boolean) {
			this.setAttribute('draggable', String(value));
		},
	});
	for (const event of [
		'click',
		'dblclick',
		'input',
		'change',
		'keydown',
		'blur',
		'focus',
		'mousedown',
		'mouseup',
		'mousemove',
		'mouseover',
		'mouseenter',
		'mouseleave',
		'dragstart',
		'dragend',
		'dragover',
		'dragleave',
		'drop',
		'touchstart',
		'touchmove',
		'touchend',
		'touchcancel',
	])
		Object.defineProperty(El.prototype, 'on' + event, { value: null, configurable: true, writable: true });
	Object.assign(globalThis, {
		document: {
			defaultView: globalThis,
			querySelector: () => null,
			createElementNS: (_namespace: string, tag: string) => new El(tag),
			createElement: (tag: string) => new El(tag),
			createTextNode: (text: string) => {
				const node = new El('#text');
				node.textContent = text;
				return node;
			},
		},
	});
}
