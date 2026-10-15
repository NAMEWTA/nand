import { expect, test, vi } from 'vitest';
import type { App, Scope } from 'obsidian';
import { bindWorkspaceKeyboard } from './keyboard-scope';
test('host scope handles workspace keys, reacquires after dialogs, releases on hide/dispose and preserves terminal keys', () => {
	const root = document.createElement('div'),
		input = root.appendChild(document.createElement('textarea')),
		outside = document.createElement('input');
	document.body.append(root, outside);
	const scopes: Scope[] = [],
		app = {
			keymap: {
				pushScope: (scope: Scope) => scopes.push(scope),
				popScope: (scope: Scope) => {
					const i = scopes.indexOf(scope);
					if (i >= 0) scopes.splice(i, 1);
				},
			},
		} as unknown as App;
	const command = vi.fn(),
		host = vi.fn(),
		dispose = bindWorkspaceKeyboard(app, root, command);
	const dispatch = (event: KeyboardEvent) => {
		const scope = scopes.at(-1) as unknown as
			{ handlers: { callback: (event: KeyboardEvent) => unknown }[] } | undefined;
		if (scope?.handlers[0]?.callback(event) === false) event.stopImmediatePropagation();
	};
	window.addEventListener('keydown', dispatch, true);
	document.addEventListener('keydown', host, true);
	const key = (target: HTMLElement, key: string) => {
		const event = new KeyboardEvent('keydown', {
			key,
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
			view: window,
		});
		target.dispatchEvent(event);
		return event;
	};
	input.focus();
	expect(key(input, 't').defaultPrevented).toBe(true);
	expect(host).not.toHaveBeenCalled();
	expect(command).toHaveBeenCalledWith('newTerminal');
	expect(key(input, 'c').defaultPrevented).toBe(false);
	expect(host).toHaveBeenCalledOnce();
	outside.focus();
	expect(key(outside, 'w').defaultPrevented).toBe(false);
	input.focus();
	root.hidden = true;
	expect(key(input, 'w').defaultPrevented).toBe(false);
	root.hidden = false;
	// Opening/closing an external dialog releases and then reacquires this workspace scope.
	outside.focus();
	input.focus();
	expect(key(input, 'w').defaultPrevented).toBe(true);
	expect(command).toHaveBeenCalledWith('close');
	dispose();
	expect(key(input, 'w').defaultPrevented).toBe(false);
	window.removeEventListener('keydown', dispatch, true);
	document.removeEventListener('keydown', host, true);
	root.remove();
	outside.remove();
});
