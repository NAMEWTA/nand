import assert from 'node:assert/strict';
import { test } from 'vitest';
import { resolveTheme, themeBodyState, themeSettings } from './settings';

test('follow system with defaults touches nothing', () => {
	const state = themeBodyState(resolveTheme(themeSettings.defaults()));
	assert.deepEqual(state, { classes: [], vars: {} });
});

test('presets bring their Markdown styles unless the user picks one', () => {
	const claude = themeBodyState(resolveTheme({ ...themeSettings.defaults(), preset: 'claude-code' }));
	assert.deepEqual(claude.classes, ['nand-theme--claude-code', 'nand-md-headings--accented', 'nand-md-emphasis--accent']);
	const plain = themeBodyState(resolveTheme({ ...themeSettings.defaults(), preset: 'eye-care', headings: 'plain', emphasis: 'highlight' }));
	assert.deepEqual(plain.classes, ['nand-theme--eye-care', 'nand-md-emphasis--highlight']);
});

test('accent and line-height overrides become variables; invalid values are dropped', () => {
	const settings = themeSettings.normalize({ preset: 'system', accentLight: '#AA3300', accentDark: 'red', lineHeight: 9 });
	assert.equal(settings.accentDark, '');
	assert.equal(settings.lineHeight, 2.2);
	const state = themeBodyState(resolveTheme(settings));
	assert.deepEqual(state.vars, { '--nand-user-accent-light': '#aa3300', '--nand-user-line-height': '2.2' });
	assert.ok(state.classes.includes('nand-theme-accent-light'));
});
