import assert from 'node:assert/strict';
import { test } from 'vitest';
import { encodeControl, encodeInput, FrameDecoder, FRAME_CONTROL, FRAME_INPUT, MAX_FRAME } from './frames';
import { encodeKey, encodeKitty, encodeWin32, KittyFlags, virtualKey, type KeyDescription } from './keyboard';
import { parseOsc133, parseOsc633, parseOsc7, PromptHistory } from './shell-marks';
import { droppedPaths, pasteSequence } from './paste';
import { findFileReferences } from './links';
import { EMPTY_TABS, activeTab, canSplit, openTab, removeSession, sessionsOf, split, tabOf } from './layout';

const ESC = '\x1b';

function key(over: Partial<KeyDescription>): KeyDescription {
	return { type: 'keydown', key: 'a', code: 'KeyA', keyCode: 65, shift: false, alt: false, ctrl: false, meta: false, ...over };
}

test('frames: documented bytes, arbitrary chunking, limits', () => {
	assert.deepEqual([...encodeControl({})], [0, 0, 0, 3, 1, 0x7b, 0x7d]);
	const bytes = new Uint8Array([...encodeControl({ type: 'hello' }), ...encodeInput(7, 'abc')]);
	const decoder = new FrameDecoder();
	const frames = [];
	for (let at = 0; at < bytes.length; at += 3) frames.push(...decoder.push(bytes.subarray(at, at + 3)));
	assert.equal(frames.length, 2);
	assert.deepEqual(frames[0], { kind: FRAME_CONTROL, message: { type: 'hello' } });
	const input = frames[1]!;
	assert.equal(input.kind, FRAME_INPUT);
	assert.ok(input.kind === FRAME_INPUT && input.session === 7 && new TextDecoder().decode(input.bytes) === 'abc');
	const huge = new Uint8Array(4);
	new DataView(huge.buffer).setUint32(0, MAX_FRAME + 1);
	assert.throws(() => new FrameDecoder().push(huge));
});

test('kitty: disambiguate encodes modified Enter/Tab and keeps plain keys', () => {
	assert.equal(encodeKitty(key({ key: 'Enter', code: 'Enter', keyCode: 13, shift: true }), 1), `${ESC}[13;2u`);
	assert.equal(encodeKitty(key({ key: 'Enter', code: 'Enter', keyCode: 13, ctrl: true }), 1), `${ESC}[13;5u`);
	assert.equal(encodeKitty(key({ key: 'Tab', code: 'Tab', keyCode: 9, shift: true }), 1), `${ESC}[9;2u`);
	assert.equal(encodeKitty(key({ key: 'Escape', code: 'Escape', keyCode: 27 }), 1), `${ESC}[27u`);
	assert.equal(encodeKitty(key({ key: 'a', ctrl: true }), 1), `${ESC}[97;5u`);
	assert.equal(encodeKitty(key({ key: 'Enter', code: 'Enter', keyCode: 13 }), 1), undefined);
	assert.equal(encodeKitty(key({ key: 'a' }), 1), undefined);
	assert.equal(encodeKitty(key({ key: 'Enter', code: 'Enter', keyCode: 13, shift: true }), 0), undefined);
});

test('kitty: flag stack per screen, push/pop/set/query', () => {
	const flags = new KittyFlags();
	flags.push(1);
	assert.equal(flags.report(), `${ESC}[?1u`);
	flags.push(3);
	flags.pop();
	assert.equal(flags.current, 1);
	flags.screen = 'alt';
	assert.equal(flags.current, 0);
	flags.set(5);
	flags.set(2, 2);
	assert.equal(flags.current, 7);
	flags.set(4, 3);
	assert.equal(flags.current, 3);
	flags.screen = 'main';
	assert.equal(flags.current, 1);
});

test('win32-input-mode: documented key down and up records', () => {
	assert.equal(encodeWin32({ ...key({}), keyCode: undefined }), `${ESC}[65;30;97;1;0;1_`, 'virtual key from the physical key');
	assert.equal(virtualKey('ArrowUp'), 38);
	assert.equal(virtualKey('F12'), 123);
	assert.equal(virtualKey('Numpad3'), 99);
	assert.equal(encodeWin32(key({})), `${ESC}[65;30;97;1;0;1_`);
	assert.equal(encodeWin32(key({ type: 'keyup' })), `${ESC}[65;30;97;0;0;1_`);
	assert.equal(encodeWin32(key({ key: 'Enter', code: 'Enter', keyCode: 13, shift: true })), `${ESC}[13;28;13;1;16;1_`);
	assert.equal(encodeWin32(key({ key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 })), `${ESC}[38;72;0;1;256;1_`);
	assert.equal(encodeWin32(key({ key: 'c', code: 'KeyC', keyCode: 67, ctrl: true })), `${ESC}[67;46;3;1;8;1_`);
});

test('encodeKey: protocol precedence, Shift+Enter fallback, composition untouched', () => {
	const shiftEnter = key({ key: 'Enter', code: 'Enter', keyCode: 13, shift: true });
	assert.equal(encodeKey(shiftEnter, { kitty: 0, win32: false }, false), `${ESC}\r`);
	assert.equal(encodeKey(shiftEnter, { kitty: 1, win32: false }, false), `${ESC}[13;2u`);
	assert.equal(encodeKey(shiftEnter, { kitty: 1, win32: true }, false), `${ESC}[13;28;13;1;16;1_`);
	assert.equal(encodeKey(shiftEnter, { kitty: 1, win32: true }, true), undefined);
	assert.equal(encodeKey(key({ key: 'Process' }), { kitty: 0, win32: true }, false), undefined);
	assert.equal(encodeKey(key({}), { kitty: 0, win32: false }, false), undefined);
});

test('shell integration marks and working directory', () => {
	assert.deepEqual(parseOsc133('D;1'), { kind: 'command-finished', exitCode: 1 });
	assert.deepEqual(parseOsc133('A'), { kind: 'prompt-start' });
	assert.deepEqual(parseOsc633('P;Cwd=/tmp/x'), { kind: 'cwd', cwd: '/tmp/x' });
	assert.deepEqual(parseOsc633('P;Cwd=C:\\x3a\\\\dir'), { kind: 'cwd', cwd: 'C::\\dir' });
	assert.deepEqual(parseOsc7('file://host/Users/a%20b/vault', 'darwin'), { kind: 'cwd', cwd: '/Users/a b/vault' });
	assert.deepEqual(parseOsc7('file:///C:/Users/me', 'win32'), { kind: 'cwd', cwd: 'C:\\Users\\me' });
	const history = new PromptHistory();
	history.prompt(3);
	history.finished(0);
	history.prompt(9);
	history.finished(2);
	history.prompt(15);
	assert.equal(history.previous(15), 9);
	assert.equal(history.next(3), 9);
	assert.equal(history.lastFailed(), 9);
	history.shift(5);
	assert.deepEqual(history.lines, [4, 10]);
});

test('paste: sanitized, newline as CR, bracketed on request; dropped paths quoted', () => {
	assert.equal(pasteSequence('a\x1b[31mb\r\n', true), `${ESC}[200~a[31mb\r${ESC}[201~`);
	assert.equal(pasteSequence('a\x1b[31mb\r\n', false), 'a[31mb\r');
	assert.equal(pasteSequence('x\u009by\tz', false), 'xy\tz');
	assert.equal(droppedPaths(['/a b/c.md', '/d.md'], 'linux'), '"/a b/c.md" /d.md');
	assert.equal(droppedPaths(['C:\\My Notes\\a.md'], 'win32'), '"C:\\My Notes\\a.md"');
});

test('file references with line and column; URLs and version numbers ignored', () => {
	assert.deepEqual(findFileReferences('src/a.ts:12:3 error'), [{ start: 0, end: 13, path: 'src/a.ts', line: 12, column: 3 }]);
	assert.deepEqual(findFileReferences('see /tmp/x/notes.md now').map((ref) => ref.path), ['/tmp/x/notes.md']);
	assert.deepEqual(findFileReferences('open https://example.com/a.html'), []);
	assert.deepEqual(findFileReferences('version 1.2.3 ready'), []);
	assert.deepEqual(findFileReferences('(./docs/readme.md:4)').map((ref) => [ref.path, ref.line]), [['./docs/readme.md', 4]]);
});

test('layout: tabs hold up to four panes; closing panes and tabs moves focus', () => {
	let state = openTab(EMPTY_TABS, 't1', 'a');
	state = split(state, 'a', 'row', 'b');
	state = split(state, 'b', 'column', 'c');
	state = split(state, 'a', 'column', 'd');
	assert.equal(canSplit(state, 'a'), false);
	assert.deepEqual(sessionsOf(activeTab(state)!.root).sort(), ['a', 'b', 'c', 'd']);
	assert.equal(split(state, 'a', 'row', 'e'), state);
	state = openTab(state, 't2', 'x');
	state = removeSession(state, 'x');
	assert.equal(state.active, 't1');
	state = removeSession(state, 'd');
	assert.equal(tabOf(state, 'a')!.focused, 'a');
	for (const session of ['a', 'b', 'c']) state = removeSession(state, session);
	assert.deepEqual(state, { tabs: [] });
});
