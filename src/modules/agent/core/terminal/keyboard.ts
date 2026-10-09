/**
 * Key encodings an application can opt into: the kitty keyboard protocol's "disambiguate" level and the
 * Windows win32-input-mode used by ConPTY. Pure functions over a plain key description, so they can be
 * tested without a DOM. Specifications: https://sw.kovidgoyal.net/kitty/keyboard-protocol/ and
 * https://github.com/microsoft/terminal/blob/main/doc/specs/%234999%20-%20Improved%20keyboard%20handling%20in%20Conpty.md
 */

export interface KeyDescription {
	type: 'keydown' | 'keyup';
	/** `KeyboardEvent.key` */
	key: string;
	/** `KeyboardEvent.code` */
	code: string;
	/** Windows virtual-key code; derived from `code` when omitted. */
	keyCode?: number;
	shift: boolean;
	alt: boolean;
	ctrl: boolean;
	meta: boolean;
	repeat?: boolean;
	capsLock?: boolean;
	location?: number;
}

/** Kitty progressive-enhancement flags, kept separately for the main and alternate screens. */
export class KittyFlags {
	private stacks: Record<'main' | 'alt', number[]> = { main: [], alt: [] };
	screen: 'main' | 'alt' = 'main';

	get current(): number {
		const stack = this.stacks[this.screen];
		return stack.length ? stack[stack.length - 1]! : 0;
	}
	/** `CSI > flags u` */
	push(flags: number): void {
		const stack = this.stacks[this.screen];
		stack.push(flags & 0x1f);
		if (stack.length > 32) stack.shift();
	}
	/** `CSI < count u` */
	pop(count = 1): void {
		const stack = this.stacks[this.screen];
		stack.splice(Math.max(0, stack.length - Math.max(1, count)));
	}
	/** `CSI = flags ; mode u` (1 replace, 2 add, 3 remove). */
	set(flags: number, mode = 1): void {
		const stack = this.stacks[this.screen];
		const value = mode === 2 ? this.current | flags : mode === 3 ? this.current & ~flags : flags;
		if (stack.length) stack[stack.length - 1] = value & 0x1f;
		else stack.push(value & 0x1f);
	}
	reset(): void {
		this.stacks = { main: [], alt: [] };
		this.screen = 'main';
	}
	/** Reply to `CSI ? u`. */
	report(): string {
		return `\x1b[?${this.current}u`;
	}
}

function kittyModifiers(key: KeyDescription): number {
	return 1 + (key.shift ? 1 : 0) + (key.alt ? 2 : 0) + (key.ctrl ? 4 : 0) + (key.meta ? 8 : 0);
}

const FUNCTIONAL: Record<string, number> = { Enter: 13, Tab: 9, Backspace: 127, Escape: 27 };

/**
 * Encode a key press under kitty "disambiguate escape codes" (flag 1). Returns undefined when the
 * key keeps its legacy encoding (plain text, unmodified Enter/Tab/Backspace, navigation keys).
 */
export function encodeKitty(key: KeyDescription, flags: number): string | undefined {
	if (!(flags & 1) || key.type !== 'keydown') return undefined;
	const modifiers = kittyModifiers(key);
	const functional = FUNCTIONAL[key.key];
	if (functional !== undefined) {
		if (key.key === 'Escape') return modifiers === 1 ? '\x1b[27u' : `\x1b[27;${modifiers}u`;
		return modifiers === 1 ? undefined : `\x1b[${functional};${modifiers}u`;
	}
	// Ctrl/Alt with a printable key would collide with control characters or ESC prefixes.
	if ((key.ctrl || key.alt) && key.key.length === 1) {
		const base = baseCharacter(key);
		if (base) return `\x1b[${base.codePointAt(0)};${modifiers}u`;
	}
	return undefined;
}

/** The unshifted character a physical key produces (kitty reports keys by their base layout). */
function baseCharacter(key: KeyDescription): string | undefined {
	if (/^Key[A-Z]$/.test(key.code)) return key.code.slice(3).toLowerCase();
	if (/^Digit[0-9]$/.test(key.code)) return key.code.slice(5);
	const punctuation: Record<string, string> = {
		Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
		Quote: "'", Backquote: '`', Comma: ',', Period: '.', Slash: '/', Space: ' ',
	};
	return punctuation[key.code] ?? (key.key.length === 1 ? key.key.toLowerCase() : undefined);
}

/**
 * PC set-1 scan codes, as `KeyboardEvent.code` names listed by code: position N (from 1) has scan code N;
 * `-` marks a code with no key here. Extended keys reuse keypad codes and set the enhanced-key flag.
 */
const SET1_BY_CODE =
	'Escape Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal Backspace Tab ' +
	'KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight Enter ControlLeft KeyA KeyS KeyD KeyF ' +
	'KeyG KeyH KeyJ KeyK KeyL Semicolon Quote Backquote ShiftLeft Backslash KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma ' +
	'Period Slash ShiftRight NumpadMultiply AltLeft Space CapsLock F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 NumLock ScrollLock ' +
	'Numpad7 Numpad8 Numpad9 NumpadSubtract Numpad4 Numpad5 Numpad6 NumpadAdd Numpad1 Numpad2 Numpad3 Numpad0 ' +
	'NumpadDecimal - - - F11 F12';
/** Extended keys and the base key whose scan code they share. */
const EXTENDED_AS = 'NumpadEnter=Enter ControlRight=ControlLeft NumpadDivide=Slash AltRight=AltLeft Home=Numpad7 ArrowUp=Numpad8 PageUp=Numpad9 ArrowLeft=Numpad4 ArrowRight=Numpad6 End=Numpad1 ArrowDown=Numpad2 PageDown=Numpad3 Insert=Numpad0 Delete=NumpadDecimal';
const SCAN_CODES: Record<string, number> = {};
SET1_BY_CODE.split(' ').forEach((name, index) => {
	if (name !== '-') SCAN_CODES[name] = index + 1;
});
const ENHANCED = new Set<string>();
for (const pair of EXTENDED_AS.split(' ')) {
	const [name = '', base = ''] = pair.split('=');
	SCAN_CODES[name] = SCAN_CODES[base] ?? 0;
	ENHANCED.add(name);
}
// The Windows logo and menu keys are extended keys with their own codes.
Object.assign(SCAN_CODES, { MetaLeft: 0x5b, MetaRight: 0x5c, ContextMenu: 0x5d });
for (const name of ['MetaLeft', 'MetaRight', 'ContextMenu']) ENHANCED.add(name);

const NAMED_VK: Record<string, number> = {
	Backspace: 8, Tab: 9, Enter: 13, NumpadEnter: 13, ShiftLeft: 16, ShiftRight: 16, ControlLeft: 17, ControlRight: 17,
	AltLeft: 18, AltRight: 18, Pause: 19, CapsLock: 20, Escape: 27, Space: 32, PageUp: 33, PageDown: 34, End: 35, Home: 36,
	ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Insert: 45, Delete: 46, MetaLeft: 91, MetaRight: 92,
	ContextMenu: 93, NumpadMultiply: 106, NumpadAdd: 107, NumpadSubtract: 109, NumpadDecimal: 110, NumpadDivide: 111,
	NumLock: 144, ScrollLock: 145, Semicolon: 186, Equal: 187, Comma: 188, Minus: 189, Period: 190, Slash: 191,
	Backquote: 192, BracketLeft: 219, Backslash: 220, BracketRight: 221, Quote: 222,
};

/** Windows virtual-key code for a `KeyboardEvent.code` (0 when unknown). */
export function virtualKey(code: string): number {
	if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
	if (/^Digit[0-9]$/.test(code)) return 48 + Number(code[5]);
	if (/^Numpad[0-9]$/.test(code)) return 96 + Number(code[6]);
	const fn = /^F([1-9]|1[0-9]|2[0-4])$/.exec(code);
	if (fn) return 111 + Number(fn[1]);
	return NAMED_VK[code] ?? 0;
}

// Control-key state bits (Windows KEY_EVENT_RECORD.dwControlKeyState).
const RIGHT_ALT = 0x1, LEFT_ALT = 0x2, RIGHT_CTRL = 0x4, LEFT_CTRL = 0x8, SHIFT = 0x10, CAPS = 0x80, ENHANCED_KEY = 0x100;

function unicodeOf(key: KeyDescription): number {
	if (key.key.length === 1) {
		const code = key.key.charCodeAt(0);
		// Ctrl+letter produces the matching control character, as on a Windows console.
		if (key.ctrl && !key.alt && /^[a-z]$/i.test(key.key)) return code & 0x1f;
		return code;
	}
	return ({ Enter: 13, Tab: 9, Backspace: 8, Escape: 27 } as Record<string, number>)[key.key] ?? 0;
}

/** `CSI Vk ; Sc ; Uc ; Kd ; Cs ; Rc _` for one key transition. */
export function encodeWin32(key: KeyDescription): string {
	const scan = SCAN_CODES[key.code] ?? 0;
	let state = 0;
	if (key.shift) state |= SHIFT;
	if (key.ctrl) state |= key.code === 'ControlRight' ? RIGHT_CTRL : LEFT_CTRL;
	if (key.alt) state |= key.code === 'AltRight' ? RIGHT_ALT : LEFT_ALT;
	if (key.capsLock) state |= CAPS;
	if (ENHANCED.has(key.code)) state |= ENHANCED_KEY;
	const down = key.type === 'keydown' ? 1 : 0;
	return `\x1b[${key.keyCode ?? virtualKey(key.code)};${scan};${unicodeOf(key)};${down};${state};1_`;
}

export interface KeyboardModes {
	kitty: number;
	win32: boolean;
}

/**
 * What to send for a key, or undefined to let the terminal's default encoder handle it. Input-method
 * composition is never intercepted.
 */
export function encodeKey(key: KeyDescription, modes: KeyboardModes, composing: boolean): string | undefined {
	if (composing || key.key === 'Process' || key.key === 'Dead' || key.key === 'Unidentified') return undefined;
	if (modes.win32) {
		// Modifier-only and printable keys are both reported; the console layer builds text from them.
		return encodeWin32(key);
	}
	const kitty = encodeKitty(key, modes.kitty);
	if (kitty !== undefined) return kitty;
	// Without either protocol, Shift+Enter is sent as ESC CR, which agent CLIs read as a newline.
	if (key.type === 'keydown' && key.key === 'Enter' && key.shift && !key.ctrl && !key.alt && !key.meta) return '\x1b\r';
	return undefined;
}
