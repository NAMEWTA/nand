import { Scope, type App } from 'obsidian';
import { workspaceShortcut, type WorkspaceCommand } from '../../core/workspace/shortcuts';

/** Obsidian handles keydown on the window before React/xterm: participate in its public scope stack. */
export function bindWorkspaceKeyboard(
	app: App,
	root: HTMLElement,
	command: (action: WorkspaceCommand) => void,
): () => void {
	const doc = root.ownerDocument,
		win = doc.defaultView;
	if (!win) return () => {};
	const scope = new Scope(app.scope);
	const owns = (target: EventTarget | null) =>
		target instanceof win.Node && root.contains(target) && !root.closest('[hidden], [inert]');
	scope.register(null, null, (event) => {
		if (event.view !== win || !owns(event.target) || !owns(doc.activeElement)) return;
		const action = workspaceShortcut(event);
		const terminal =
			event.target instanceof win.Element ? event.target.closest<HTMLElement>('[data-terminal-host]') : null;
		const find =
			!event.isComposing &&
			!event.altKey &&
			(event.ctrlKey || event.metaKey) &&
			event.key.toLowerCase() === 'f' &&
			terminal;
		if (!action && !find) return;
		event.preventDefault();
		event.stopPropagation();
		if (action) command(action);
		else terminal?.dispatchEvent(new win.Event('nand-terminal-find'));
		return false;
	});
	const release = () => app.keymap.popScope(scope);
	const focus = () => {
		release();
		// Reacquire after a modal or leaf activation: the host may have replaced its base scope.
		if (owns(doc.activeElement)) app.keymap.pushScope(scope);
	};
	const keyup = (event: KeyboardEvent) => {
		if (owns(event.target) && workspaceShortcut(event)) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	};
	win.addEventListener('focusin', focus);
	win.addEventListener('pointerdown', focus);
	win.addEventListener('focus', focus);
	win.addEventListener('blur', release);
	win.addEventListener('keyup', keyup, true);
	focus();
	return () => {
		release();
		win.removeEventListener('focusin', focus);
		win.removeEventListener('pointerdown', focus);
		win.removeEventListener('focus', focus);
		win.removeEventListener('blur', release);
		win.removeEventListener('keyup', keyup, true);
	};
}
