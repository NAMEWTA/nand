import { Scope, type App } from 'obsidian';

/** Host controls must run before Obsidian's document key handler, not in DOM bubbling. */
export function mountBrowserKeyScope(
	app: App,
	root: HTMLElement,
	parent: Scope,
	actions: { find(): void; address(): void; escape(): boolean; shortcut?(key: string): void },
): () => void {
	const doc = root.ownerDocument,
		win = doc.defaultView!;
	const scope = new Scope(parent);
	let pushed = false,
		disposed = false;
	const release = () => {
		if (pushed) app.keymap.popScope(scope);
		pushed = false;
	};
	const target = () => {
		if (
			disposed ||
			root.ownerDocument !== doc ||
			!root.isConnected ||
			!doc.hasFocus() ||
			root.closest('[hidden], [inert]') ||
			!root.getClientRects().length
		)
			return null;
		const node = doc.activeElement;
		return node && root.contains(node) && node.tagName !== 'WEBVIEW' ? node : null;
	};
	const sync = () => {
		if (!target()) release();
		else if (!pushed) {
			app.keymap.pushScope(scope);
			pushed = true;
		}
	};
	const consume = (event: KeyboardEvent) => {
		event.preventDefault();
		event.stopPropagation();
		return false;
	};
	for (const [key, action] of [
		['f', 'find'],
		['l', 'address'],
	] as const) {
		scope.register(['Mod'], key, (event) => {
			const node = target();
			if (
				event.isComposing ||
				event.altKey ||
				event.shiftKey ||
				(event.ctrlKey && event.metaKey) ||
				!node?.closest('.nand-browser-toolbar, .nand-browser-find')
			)
				return;
			actions[action]();
			return consume(event);
		});
	}
	// A named binding shadows the parent's Escape even when it returns undefined.
	// The wildcard can decline handling, preserving the modal's own dismissal binding.
	scope.register(null, null, (event) => {
		if (
			event.key === 'Escape' &&
			!event.isComposing &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey &&
			!event.shiftKey &&
			target() &&
			actions.escape()
		)
			return consume(event);
		return;
	});
	// Workspace scopes can sit above this scope after focus bubbles to Window.
	// Capture only browser actions; workspace shortcuts continue to its scope.
	const capture = (event: KeyboardEvent) => {
		if (!target() || event.isComposing || event.altKey || (event.ctrlKey && event.metaKey)) return;
		const key = event.key.toLowerCase(),
			mod = event.ctrlKey || event.metaKey;
		let handled = false;
		if (mod && !event.shiftKey && key === 'f') {
			actions.find();
			handled = true;
		} else if (mod && !event.shiftKey && key === 'l') {
			actions.address();
			handled = true;
		} else if (
			mod &&
			actions.shortcut &&
			(['r', '+', '=', '-', '0'].includes(key) || (key === 'c' && event.shiftKey))
		) {
			actions.shortcut((event.shiftKey && ['r', 'c'].includes(key) ? 'Shift+' : '') + key);
			handled = true;
		} else if (!mod && !event.shiftKey && event.key === 'Escape') handled = actions.escape();
		if (handled) {
			consume(event);
			event.stopImmediatePropagation();
		}
	};
	win.addEventListener('keydown', capture, true);
	// focusout can precede activeElement changing; the queued check also covers a removed control.
	const afterFocus = () => queueMicrotask(sync);
	doc.addEventListener('focusin', sync);
	doc.addEventListener('focusout', afterFocus);
	doc.addEventListener('visibilitychange', sync);
	win.addEventListener('focus', sync);
	win.addEventListener('blur', release);
	const observer = new win.ResizeObserver(sync);
	observer.observe(root);
	sync();
	return () => {
		disposed = true;
		win.removeEventListener('keydown', capture, true);
		release();
		observer.disconnect();
		doc.removeEventListener('focusin', sync);
		doc.removeEventListener('focusout', afterFocus);
		doc.removeEventListener('visibilitychange', sync);
		win.removeEventListener('focus', sync);
		win.removeEventListener('blur', release);
	};
}
