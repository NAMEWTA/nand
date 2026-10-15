import { expect, it, vi } from 'vitest';
import type { Workspace } from 'obsidian';
import { observeNoteLinks } from './note-links';
it('routes enabled note links in existing and future windows and removes every listener', () => {
	const existing = document.implementation.createHTMLDocument(),
		later = document.implementation.createHTMLDocument();
	const handlers = new Map<string, (...args: unknown[]) => void>();
	const workspace = {
		containerEl: document.body,
		iterateAllLeaves: (fn: Function) => fn({ view: { containerEl: existing.body } }),
		on: (name: string, fn: (...args: unknown[]) => void) => {
			handlers.set(name, fn);
			return name;
		},
		offref: (name: string) => handlers.delete(name),
	} as unknown as Workspace;
	let enabled = false;
	const route = vi.fn(),
		off = observeNoteLinks(workspace, () => enabled, route);
	const click = (doc: Document) => {
		const wrap = doc.createElement('div');
		wrap.className = 'markdown-rendered';
		const a = doc.createElement('a');
		a.className = 'external-link';
		a.href = 'https://example.com';
		wrap.append(a);
		doc.body.append(wrap);
		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		a.dispatchEvent(event);
		wrap.remove();
		return event.defaultPrevented;
	};
	expect(click(document)).toBe(false);
	expect(click(existing)).toBe(false);
	enabled = true;
	expect(click(document)).toBe(true);
	expect(click(existing)).toBe(true);
	handlers.get('window-open')!({}, { document: later });
	expect(click(later)).toBe(true);
	expect(route).toHaveBeenCalledTimes(3);
	handlers.get('window-close')!({}, { document: later });
	expect(click(later)).toBe(false);
	off();
	expect(click(document)).toBe(false);
	expect(click(existing)).toBe(false);
	expect(handlers.size).toBe(0);
});
