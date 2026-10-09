import { parseHTML } from 'linkedom';

/** Install a linkedom document as the global DOM for Preact component tests. */
export function installDom(): { document: Document; window: Window & typeof globalThis } {
	const { document, window } = parseHTML('<!doctype html><html><body></body></html>');
	Object.assign(globalThis, { document, window, activeDocument: document, activeWindow: window, Node: window.Node, HTMLElement: window.HTMLElement, Event: window.Event });
	return { document: document as unknown as Document, window: window as unknown as Window & typeof globalThis };
}

/** Let Preact flush effects and state updates. */
export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Dispatch a keydown (linkedom has no KeyboardEvent constructor, so `key` is attached to an Event). */
export function key(target: Element, name: string): void {
	const event = new (target.ownerDocument.defaultView as unknown as { Event: typeof Event }).Event('keydown', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'key', { value: name });
	target.dispatchEvent(event);
}
