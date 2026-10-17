// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

export type NavPane = 'nav' | 'list';

/** Everything the keyboard can do inside the navigator. */
export const NAV_ACTIONS = [
	'moveUp',
	'moveDown',
	'pageUp',
	'pageDown',
	'home',
	'end',
	'rename',
	'delete',
	'open',
	'collapseOrParent',
	'expandOrFocusList',
	'focusList',
	'focusNav',
	'focusEditor',
	'selectAll',
	'extendUp',
	'extendDown',
	'rangeToStart',
	'rangeToEnd',
	'contextMenu',
] as const;
export type NavAction = (typeof NAV_ACTIONS)[number];

/** Panes in which each action is active. */
export const ACTION_PANES: Readonly<Record<NavAction, readonly NavPane[]>> = {
	moveUp: ['nav', 'list'],
	moveDown: ['nav', 'list'],
	pageUp: ['nav', 'list'],
	pageDown: ['nav', 'list'],
	home: ['nav', 'list'],
	end: ['nav', 'list'],
	rename: ['nav', 'list'],
	delete: ['nav', 'list'],
	open: ['nav', 'list'],
	collapseOrParent: ['nav'],
	expandOrFocusList: ['nav'],
	focusList: ['nav'],
	focusNav: ['list'],
	focusEditor: ['list'],
	selectAll: ['list'],
	extendUp: ['list'],
	extendDown: ['list'],
	rangeToStart: ['list'],
	rangeToEnd: ['list'],
	contextMenu: ['nav', 'list'],
};

/** Key strings: modifiers `Mod` (Cmd or Ctrl), `Ctrl`, `Alt`, `Shift` joined with `+`, then a `KeyboardEvent.key` value. */
export type KeymapOverrides = Readonly<Partial<Record<NavAction, readonly string[]>>>;

export function defaultKeymap(isMac: boolean): Record<NavAction, string[]> {
	return {
		moveUp: ['ArrowUp'],
		moveDown: ['ArrowDown'],
		pageUp: ['PageUp'],
		pageDown: ['PageDown'],
		home: ['Home'],
		end: ['End'],
		rename: isMac ? ['Enter'] : ['F2'],
		delete: ['Delete', 'Backspace'],
		open: isMac ? [] : ['Enter'],
		collapseOrParent: ['ArrowLeft'],
		expandOrFocusList: ['ArrowRight'],
		focusList: ['Tab'],
		focusNav: ['ArrowLeft', 'Shift+Tab'],
		focusEditor: ['ArrowRight', 'Tab'],
		selectAll: ['Mod+a'],
		extendUp: ['Shift+ArrowUp'],
		extendDown: ['Shift+ArrowDown'],
		rangeToStart: ['Shift+Home'],
		rangeToEnd: ['Shift+End'],
		contextMenu: ['ContextMenu', 'Shift+F10'],
	};
}

export interface KeyLike {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
}

interface Binding { key: string; mod: boolean; ctrl: boolean; alt: boolean; shift: boolean }

export function parseBinding(text: string): Binding | undefined {
	const parts = text.split('+').map((part) => part.trim()).filter(Boolean);
	// A literal plus key is written "Shift++"; split leaves a dangling empty part.
	if (text.endsWith('+') && parts.at(-1) !== '+') parts.push('+');
	const key = parts.pop();
	if (!key) return undefined;
	const binding: Binding = { key: key.length === 1 ? key.toLowerCase() : key, mod: false, ctrl: false, alt: false, shift: false };
	for (const part of parts) {
		const modifier = part.toLowerCase();
		if (modifier === 'mod') binding.mod = true;
		else if (modifier === 'ctrl') binding.ctrl = true;
		else if (modifier === 'alt') binding.alt = true;
		else if (modifier === 'shift') binding.shift = true;
		else return undefined;
	}
	return binding;
}

function matches(binding: Binding, event: KeyLike, isMac: boolean): boolean {
	const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
	if (key !== binding.key || event.altKey !== binding.alt || event.shiftKey !== binding.shift) return false;
	if (isMac) return event.metaKey === binding.mod && event.ctrlKey === binding.ctrl;
	return !event.metaKey && event.ctrlKey === (binding.mod || binding.ctrl);
}

export interface Keymap {
	/** The action a key press triggers in `pane`, or undefined. */
	resolve(event: KeyLike, pane: NavPane): NavAction | undefined;
}

/** A keymap from defaults plus per-action overrides; an override replaces that action's default keys. */
export function createKeymap(overrides: KeymapOverrides, isMac: boolean): Keymap {
	const defaults = defaultKeymap(isMac);
	const table: Array<{ action: NavAction; bindings: Binding[] }> = NAV_ACTIONS.map((action) => {
		const keys = overrides[action] ?? defaults[action];
		return { action, bindings: keys.flatMap((key) => parseBinding(key) ?? []) };
	});
	return {
		resolve(event, pane) {
			// More specific bindings (with modifiers) win over plain keys bound to another action.
			let best: { action: NavAction; weight: number } | undefined;
			for (const { action, bindings } of table) {
				if (!ACTION_PANES[action].includes(pane)) continue;
				for (const binding of bindings) {
					if (!matches(binding, event, isMac)) continue;
					const weight = Number(binding.mod) + Number(binding.ctrl) + Number(binding.alt) + Number(binding.shift);
					if (!best || weight > best.weight) best = { action, weight };
				}
			}
			return best?.action;
		},
	};
}

/** Normalize a user-typed list such as "j, Ctrl+n" into key strings; invalid entries are dropped. */
export function parseKeyList(text: string): string[] {
	return text.split(',').map((part) => part.trim()).filter((part) => part && parseBinding(part));
}
