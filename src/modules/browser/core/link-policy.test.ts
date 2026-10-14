import { describe, it, expect } from 'vitest';
import { terminalWebLinkAction } from './link-policy';
const settings = { linkTarget: 'nand' as const, reverseLinkModifier: true, terminalLinkMenu: true };
const plain = { ctrlKey: false, metaKey: false, shiftKey: false };
describe('web link routing', () => {
	it('shows actions for plain terminal clicks but routes note links directly', () => {
		expect(terminalWebLinkAction(settings, plain)).toBe('menu');
		expect(terminalWebLinkAction(settings, plain, 'note')).toBe('nand');
	});
	it('uses Ctrl or Cmd and inverts only with Shift when enabled', () => {
		for (const key of ['ctrlKey', 'metaKey']) {
			expect(terminalWebLinkAction(settings, { ...plain, [key]: true })).toBe('nand');
			expect(terminalWebLinkAction(settings, { ...plain, [key]: true, shiftKey: true })).toBe('system');
			expect(
				terminalWebLinkAction({ ...settings, linkTarget: 'system' }, { ...plain, [key]: true, shiftKey: true }),
			).toBe('nand');
			expect(
				terminalWebLinkAction(
					{ ...settings, reverseLinkModifier: false },
					{ ...plain, [key]: true, shiftKey: true },
				),
			).toBe('nand');
		}
	});
	it('can disable the terminal action menu', () =>
		expect(terminalWebLinkAction({ ...settings, terminalLinkMenu: false, linkTarget: 'system' }, plain)).toBe(
			'system',
		));
});
