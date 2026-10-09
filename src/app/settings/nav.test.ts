import assert from 'node:assert/strict';
import { test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { visibleProducts } from './nav.ts';
import { normalizeCommentsSettings } from '../../modules/comments/settings.ts';

const ALL_ON = {
	browser: true,
	automation: true,
	dashboard: true,
	editor: true,
	terminal: true,
	iconic: true,
	contacts: true,
	sync: true,
};
const ALL_OFF = { browser: false, automation: false, iconic: false, contacts: false, dashboard: false, editor: false, terminal: false, sync: false };

test('settings list home first, then every module that is on', () => {
	assert.deepEqual(visibleProducts(ALL_ON), ['home', 'dashboard', 'browser', 'editor', 'terminal', 'iconic', 'contacts', 'automation', 'sync']);
	assert.deepEqual(visibleProducts({ ...ALL_OFF, editor: true, terminal: true }), ['home', 'editor', 'terminal']);
	assert.deepEqual(visibleProducts({ ...ALL_OFF, dashboard: true, terminal: true }), ['home', 'dashboard', 'terminal']);
	assert.deepEqual(visibleProducts({ ...ALL_OFF, automation: true }), ['home', 'automation']);
	assert.deepEqual(visibleProducts(ALL_OFF), ['home']);
});

test('settings stylesheet does not keep a left-hand settings column', () => {
	const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');
	const block = css.slice(css.indexOf('.nand-settings {'), css.indexOf('.nand-settings {') + 180);
	assert.equal(block.includes('display: block'), true);
	assert.equal(block.includes('180px'), false);
	assert.equal(css.includes('nand-settings-split'), false);
	assert.equal(css.includes('dashboard-settings-sidenav'), false);
	const source = fs.readFileSync(path.join(process.cwd(), 'src/app/settings/settings-tab.ts'), 'utf8');
	assert.equal(source.includes('dashboard-settings-sidenav'), false);
	assert.equal(source.includes('nand-settings-split'), false);
});

test('archive folder setting reserves room for its description', () => {
	const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');
	const info = css.match(/\.setting-item\.nand-contacts-folder-setting > \.setting-item-info \{[^}]+\}/);
	const control = css.match(/\.setting-item\.nand-contacts-folder-setting > \.setting-item-control \{[^}]+\}/);
	assert.ok(info);
	assert.ok(control);
	assert.match(info[0], /flex:\s*1 1 0\s*;/);
	assert.match(info[0], /min-width:\s*min\(100%,\s*16rem\)/);
	assert.match(control[0], /min-width:\s*auto/);
	assert.match(control[0], /flex:\s*0 0 auto/);
	assert.match(css, /\.setting-item-info \{[^}]*min-width:\s*0/);
	const globalInfo = css.indexOf('.setting-item:not(.dashboard-settings-section) > .setting-item-info { flex: 1; }');
	assert.ok(globalInfo >= 0);
	assert.ok(css.indexOf('.setting-item.nand-contacts-folder-setting > .setting-item-info') > globalInfo);
});

test('stored editor placeholder selections return to comments while preserving preferences', () => {
	for (const activeDomain of ['comments', 'writing-stats', 'focus', 'unknown']) {
		assert.deepEqual(
			normalizeCommentsSettings({ activeDomain, sidebarWidth: 300, highlightEnabled: false, popoverEnabled: false }),
			{ sidebarWidth: 300, highlightEnabled: false, popoverEnabled: false },
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
