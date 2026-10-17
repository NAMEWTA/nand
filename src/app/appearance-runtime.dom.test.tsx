import { expect, test } from 'vitest';
import type { Plugin } from 'obsidian';
import { AppearanceRuntime } from './appearance-runtime';
import { FONT_ATTRIBUTE, PALETTE_ATTRIBUTE, type NandAppearance } from '../ui/appearance';

type Handler = (win: { doc: Document }) => void;

function fixture(initial: NandAppearance, leafDocuments: Document[] = []) {
	let value = initial;
	const listeners = new Set<() => void>();
	const events = new Map<string, Handler[]>();
	const cleanups: Array<() => void> = [];
	const plugin = {
		app: { workspace: {
			on: (name: string, handler: Handler) => { events.set(name, [...(events.get(name) ?? []), handler]); return { name }; },
			iterateAllLeaves: (visit: (leaf: { view: { containerEl: { ownerDocument: Document } } }) => void) => { for (const doc of leafDocuments) visit({ view: { containerEl: { ownerDocument: doc } } }); },
		} },
		registerEvent: () => undefined,
		register: (cleanup: () => void) => { cleanups.push(cleanup); },
	} as unknown as Plugin;
	const handle = {
		get: () => value,
		subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
	};
	return {
		plugin, handle, events, cleanups,
		set(next: NandAppearance) { value = next; for (const listener of [...listeners]) listener(); },
	};
}
const attributes = (doc: Document) => [doc.body.getAttribute(PALETTE_ATTRIBUTE), doc.body.getAttribute(FONT_ATTRIBUTE)];

test('palette and font reach the main window, popouts and later changes, and unload removes them', () => {
	const f = fixture({ palette: 'orca', font: 'geist' });
	const popout = document.implementation.createHTMLDocument('popout');
	new AppearanceRuntime(f.handle).attach(f.plugin);
	expect(attributes(document)).toEqual(['orca', 'geist']);

	f.events.get('window-open')?.[0]?.({ doc: popout });
	expect(attributes(popout)).toEqual(['orca', 'geist']);

	f.set({ palette: 'host', font: 'host' });
	expect(attributes(document)).toEqual(['host', 'host']);
	expect(attributes(popout)).toEqual(['host', 'host']);

	f.events.get('window-close')?.[0]?.({ doc: popout });
	f.set({ palette: 'orca', font: 'geist' });
	expect(attributes(popout)).toEqual(['host', 'host']);

	f.events.get('window-open')?.[0]?.({ doc: popout });
	for (const cleanup of f.cleanups) cleanup();
	expect(attributes(document)).toEqual([null, null]);
	expect(attributes(popout)).toEqual([null, null]);
});

test('a popout window that already exists when the plugin starts gets the attributes and later updates', () => {
	const popout = document.implementation.createHTMLDocument('existing popout');
	const f = fixture({ palette: 'orca', font: 'host' }, [document, popout]);
	new AppearanceRuntime(f.handle).attach(f.plugin);
	expect(attributes(popout)).toEqual(['orca', 'host']);
	f.set({ palette: 'host', font: 'geist' });
	expect(attributes(popout)).toEqual(['host', 'geist']);
	for (const cleanup of f.cleanups) cleanup();
	expect(attributes(popout)).toEqual([null, null]);
	expect(attributes(document)).toEqual([null, null]);
});
