import { Scope, type App, type Modal } from 'obsidian';
const dialogs = new WeakMap<App, Set<() => void>>();
const owners = new WeakMap<App, Map<unknown, Set<() => void>>>();
/** Native hotkey scopes keep a prompt's Escape from reaching a parent Modal. */
export function ownDialog(app: App | undefined, cancel: () => void, owner?: unknown, captureEscape = true): () => void {
	if (!app?.keymap) return () => {};
	let active = dialogs.get(app);
	if (!active) {
		active = new Set();
		dialogs.set(app, active);
	}
	active.add(cancel);
	if (owner !== undefined) {
		const map = owners.get(app) ?? new Map<unknown, Set<() => void>>();
		const set = map.get(owner) ?? new Set<() => void>();
		set.add(cancel); map.set(owner, set); owners.set(app, map);
	}
	const scope = captureEscape ? new Scope(app.scope) : undefined;
	scope?.register([], 'Escape', () => {
		cancel();
		return false;
	});
	if (scope) app.keymap.pushScope(scope);
	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (scope) app.keymap.popScope(scope);
		active.delete(cancel);
		const owned = owners.get(app)?.get(owner);
		owned?.delete(cancel);
		if (owned?.size === 0) owners.get(app)?.delete(owner);
	};
}
export function closeDashboardDialogs(app: App): void {
	for (const cancel of [...(dialogs.get(app) ?? [])]) cancel();
	dialogs.delete(app);
	owners.delete(app);
}

export function closeOwnedDashboardDialogs(app: App, owner: unknown): void {
	for (const cancel of [...(owners.get(app)?.get(owner) ?? [])]) cancel();
}

/** Element-owned widget editors also end when their cached board page is hidden. */
export function closeDashboardDialogsIn(app: App, root: HTMLElement): void {
	const ownerWindow = root.win as Window & { HTMLElement: typeof HTMLElement };
	for (const [owner, callbacks] of owners.get(app) ?? []) {
		if (owner instanceof ownerWindow.HTMLElement && root.contains(owner)) {
			for (const cancel of [...callbacks]) cancel();
		}
	}
}

/** Keep a native configuration form and its nested pickers inside its surface lifetime. */
export function openOwnedDashboardModal(app: App, modal: Modal, owner: unknown): void {
	const onClose = modal.onClose.bind(modal);
	let release = () => {};
	modal.onClose = () => { release(); onClose(); };
	modal.open();
	release = ownDialog(app, () => modal.close(), owner, false);
}
