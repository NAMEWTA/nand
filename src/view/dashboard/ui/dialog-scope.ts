import { Scope, type App } from 'obsidian';
const dialogs = new WeakMap<App, Set<() => void>>();
/** Native hotkey scopes keep a prompt's Escape from reaching a parent Modal. */
export function ownDialog(app: App | undefined, cancel: () => void): () => void {
	if (!app?.keymap) return () => {};
	let active = dialogs.get(app);
	if (!active) {
		active = new Set();
		dialogs.set(app, active);
	}
	active.add(cancel);
	const scope = new Scope(app.scope);
	scope.register([], 'Escape', () => {
		cancel();
		return false;
	});
	app.keymap.pushScope(scope);
	let released = false;
	return () => {
		if (released) return;
		released = true;
		app.keymap.popScope(scope);
		active.delete(cancel);
	};
}
export function closeDashboardDialogs(app: App): void {
	for (const cancel of [...(dialogs.get(app) ?? [])]) cancel();
	dialogs.delete(app);
}
