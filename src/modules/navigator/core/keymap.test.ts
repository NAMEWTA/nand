// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { createKeymap, parseBinding, parseKeyList, type KeyLike } from './keymap';

const key = (name: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key: name, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

test('arrow keys map per pane', () => {
	const map = createKeymap({}, false);
	expect(map.resolve(key('ArrowLeft'), 'nav')).toBe('collapseOrParent');
	expect(map.resolve(key('ArrowLeft'), 'list')).toBe('focusNav');
	expect(map.resolve(key('ArrowRight'), 'nav')).toBe('expandOrFocusList');
	expect(map.resolve(key('ArrowRight'), 'list')).toBe('focusEditor');
	expect(map.resolve(key('Tab'), 'nav')).toBe('focusList');
	expect(map.resolve(key('Tab', { shiftKey: true }), 'list')).toBe('focusNav');
	expect(map.resolve(key('Tab'), 'list')).toBe('focusEditor');
	expect(map.resolve(key('ArrowDown'), 'list')).toBe('moveDown');
	expect(map.resolve(key('ArrowDown', { shiftKey: true }), 'list')).toBe('extendDown');
	expect(map.resolve(key('ArrowDown', { shiftKey: true }), 'nav')).toBeUndefined();
	expect(map.resolve(key('Home', { shiftKey: true }), 'list')).toBe('rangeToStart');
	expect(map.resolve(key('Delete'), 'list')).toBe('delete');
	expect(map.resolve(key('Backspace'), 'nav')).toBe('delete');
});

test('rename is F2 on Windows/Linux and Enter on macOS; Enter opens elsewhere', () => {
	expect(createKeymap({}, false).resolve(key('F2'), 'list')).toBe('rename');
	expect(createKeymap({}, false).resolve(key('Enter'), 'list')).toBe('open');
	expect(createKeymap({}, true).resolve(key('Enter'), 'list')).toBe('rename');
});

test('Mod is Ctrl on Windows/Linux and Cmd on macOS', () => {
	expect(createKeymap({}, false).resolve(key('a', { ctrlKey: true }), 'list')).toBe('selectAll');
	expect(createKeymap({}, false).resolve(key('A', { ctrlKey: true }), 'list')).toBe('selectAll');
	expect(createKeymap({}, false).resolve(key('a', { metaKey: true }), 'list')).toBeUndefined();
	expect(createKeymap({}, true).resolve(key('a', { metaKey: true }), 'list')).toBe('selectAll');
	expect(createKeymap({}, true).resolve(key('a', { ctrlKey: true }), 'list')).toBeUndefined();
	expect(createKeymap({}, false).resolve(key('a'), 'list')).toBeUndefined();
});

test('overrides replace the default keys of an action and allow vim-style keys', () => {
	const map = createKeymap({ moveDown: ['j', 'ArrowDown'], moveUp: ['k'] }, false);
	expect(map.resolve(key('j'), 'list')).toBe('moveDown');
	expect(map.resolve(key('ArrowUp'), 'list')).toBeUndefined();
	expect(map.resolve(key('k'), 'nav')).toBe('moveUp');
});

test('parsing', () => {
	expect(parseBinding('Mod+Shift+ArrowUp')).toEqual({ key: 'ArrowUp', mod: true, ctrl: false, alt: false, shift: true });
	expect(parseBinding('Hyper+x')).toBeUndefined();
	expect(parseBinding('Shift++')).toMatchObject({ key: '+', shift: true });
	expect(parseKeyList('j, Ctrl+n, bogus+x,')).toEqual(['j', 'Ctrl+n']);
});
