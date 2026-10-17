// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { useEffect, useRef, type RefObject } from 'react';
import { Scope } from 'obsidian';
import type { NavPane } from '../core/keymap';
import type { NavigatorEnv } from './env';

/** Run the keyboard action bound to `event` in `pane`; true when the key was handled. */
export function handlePaneKey(env: NavigatorEnv, pane: NavPane, event: KeyboardEvent, pageSize: number): boolean {
	if (event.isComposing) return false;
	const action = env.service.keymap().resolve(event, pane);
	if (!action) return false;
	env.service.perform(action, pane, pageSize);
	return true;
}

/**
 * Obsidian's own hotkeys (F2 renames the file, for one) run before page listeners. While a pane has
 * keyboard focus a scope on top of the app's gives the pane's keys priority; every other key still
 * reaches Obsidian's hotkeys. `onKey` returns true for keys it handled.
 */
export function usePaneKeyScope(env: NavigatorEnv, ref: RefObject<HTMLElement | null>, onKey: (event: KeyboardEvent) => boolean): void {
	const latest = useRef(onKey);
	latest.current = onKey;
	const { app } = env;
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const scope = new Scope(app.scope);
		scope.register(null, null, (event) => (event.target === element && latest.current(event) ? false : true));
		let pushed = false;
		const push = () => { if (!pushed) { app.keymap.pushScope(scope); pushed = true; } };
		const pop = () => { if (pushed) { app.keymap.popScope(scope); pushed = false; } };
		element.addEventListener('focus', push);
		element.addEventListener('blur', pop);
		if (element.ownerDocument.activeElement === element) push();
		return () => {
			element.removeEventListener('focus', push);
			element.removeEventListener('blur', pop);
			pop();
		};
	}, [app, ref]);
}

/**
 * Focus a pane that may have just become visible (single-pane mode slides it in and un-inerts it in the
 * same render): try now, and once more on the next frame of the element's own window.
 */
export function focusWhenVisible(element: HTMLElement | null): void {
	if (!element) return;
	element.focus();
	if (element.ownerDocument.activeElement === element) return;
	element.ownerDocument.defaultView?.requestAnimationFrame(() => element.focus());
}
