import assert from 'node:assert/strict';
import { test } from 'vitest';

import { visibleProducts } from './nav.ts';
import { DEFAULT_COMMENTS_SETTINGS, normalizeCommentsSettings } from '../../modules/comments/settings.ts';

const ALL_ON = {
	browser: true,
	automation: true,
	dashboard: true,
	editor: true,
	navigator: true,
	terminal: true,
	iconic: true,
	contacts: true,
	sync: true,
};
const ALL_OFF = { browser: false, automation: false, iconic: false, contacts: false, dashboard: false, editor: false, navigator: false, terminal: false, sync: false };

test('settings list home first, then every module that is on', () => {
	assert.deepEqual(visibleProducts(ALL_ON), ['home', 'dashboard', 'browser', 'editor', 'navigator', 'terminal', 'iconic', 'contacts', 'automation', 'sync']);
	assert.deepEqual(visibleProducts({ ...ALL_OFF, editor: true, terminal: true }), ['home', 'editor', 'terminal']);
	assert.deepEqual(visibleProducts({ ...ALL_OFF, dashboard: true, terminal: true }), ['home', 'dashboard', 'terminal']);
	assert.deepEqual(visibleProducts({ ...ALL_OFF, automation: true }), ['home', 'automation']);
	assert.deepEqual(visibleProducts(ALL_OFF), ['home']);
});

test('stored editor placeholder selections return to comments while preserving preferences', () => {
	for (const activeDomain of ['comments', 'writing-stats', 'focus', 'unknown']) {
		assert.deepEqual(
			normalizeCommentsSettings({ activeDomain, sidebarWidth: 300, highlightEnabled: false, popoverEnabled: false }),
			{ ...DEFAULT_COMMENTS_SETTINGS, sidebarWidth: 300, highlightEnabled: false, popoverEnabled: false },
		);
	}
});

test('archives respects its module gate', () => {
	assert.equal(visibleProducts({ ...ALL_ON, contacts: false }).includes('contacts'), false);
	assert.equal(visibleProducts({ ...ALL_ON, dashboard: false }).includes('contacts'), true);
});


test('browser settings remain available with dashboard and terminal disabled', () => {
	assert.deepEqual(visibleProducts({ ...ALL_OFF, browser: true }), ['home', 'browser']);
});
