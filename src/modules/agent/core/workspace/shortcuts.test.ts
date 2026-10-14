import { expect, test } from 'vitest';
import { workspaceShortcut } from './shortcuts';
const key = { key: 't', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
test('workspace combinations pass through xterm and only match intentional modifiers', () => {
	expect(workspaceShortcut(key)).toBe('newTerminal');
	expect(workspaceShortcut({ ...key, shiftKey: true })).toBe('reopen');
	expect(workspaceShortcut({ ...key, ctrlKey: false, metaKey: true, key: 'w' })).toBe('close');
	expect(workspaceShortcut({ ...key, key: 'n', altKey: true })).toBe('newAgent');
	expect(workspaceShortcut({ ...key, key: 'n', shiftKey: true })).toBe('newMenu');
	expect(workspaceShortcut({ ...key, key: '\\', shiftKey: true })).toBe('splitDown');
	expect(workspaceShortcut({ ...key, isComposing: true })).toBeUndefined();
	expect(workspaceShortcut({ ...key, key: 'c' })).toBeUndefined();
});
