import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Minimal Obsidian DOM extension used by the real Portal adapter in happy-dom.
Object.defineProperty(HTMLElement.prototype, 'createDiv', {
	configurable: true,
	value(this: HTMLElement, options?: { cls?: string }) {
		const el = this.ownerDocument.createElement('div');
		if (options?.cls) el.className = options.cls;
		this.appendChild(el);
		return el;
	},
});
afterEach(cleanup);
