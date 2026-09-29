import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

import { defaultPage, productOrder, sidePages, visibleProducts } from './nav.ts';

const ALL_ON = { automation: true, dashboard: true, editor: true, terminal: true, iconic: true, contacts: true };

test('home is the first primary settings product', () => {
	assert.equal(productOrder()[0], 'home');
	assert.deepEqual(productOrder(), [
		'home',
		'dashboard',
		'editor',
		'terminal',
		'iconic',
		'contacts',
		'automation',
		'sync',
	]);
});

test('top tabs keep home and sync and hide closed domains', () => {
	assert.deepEqual(visibleProducts(ALL_ON), [
		'home',
		'dashboard',
		'editor',
		'terminal',
		'iconic',
		'contacts',
		'automation',
		'sync',
	]);
	assert.deepEqual(
		visibleProducts({ automation: false, iconic: false, contacts: false, dashboard: false, editor: true, terminal: true }),
		['home', 'editor', 'terminal', 'automation', 'sync'],
	);
	assert.deepEqual(
		visibleProducts({ automation: false, iconic: false, contacts: false, dashboard: true, editor: false, terminal: true }),
		['home', 'dashboard', 'terminal', 'automation', 'sync'],
	);
	assert.deepEqual(
		visibleProducts({ automation: false, iconic: false, contacts: false, dashboard: true, editor: true, terminal: false }),
		['home', 'dashboard', 'editor', 'automation', 'sync'],
	);
	assert.deepEqual(
		visibleProducts({ automation: false, iconic: false, contacts: false, dashboard: false, editor: false, terminal: false }),
		['home', 'automation', 'sync'],
	);
	assert.equal(
		visibleProducts({ automation: false, iconic: false, contacts: false, dashboard: false, editor: true, terminal: false }).includes(
			'home',
		),
		true,
	);
	assert.equal(
		visibleProducts({ automation: false, iconic: false, contacts: false, dashboard: false, editor: true, terminal: false }).includes(
			'sync',
		),
		true,
	);
});

test('domain sections stay in their previous order for stacking on one tab', () => {
	assert.equal(sidePages('home').length, 0);
	assert.equal(sidePages('sync').length, 0);
	assert.deepEqual(sidePages('dashboard'), ['general', 'widgets', 'coffee']);
	assert.deepEqual(sidePages('editor'), ['comments', 'copy']);
	assert.deepEqual(sidePages('terminal'), [
		'shell',
		'instance',
		'workflows',
		'appearance',
		'behavior',
		'connection',
		'visibility',
		'agents',
	]);
	assert.equal(defaultPage('terminal'), 'shell');
	assert.equal(defaultPage('home'), 'home');
});

test('settings stylesheet does not keep a left-hand settings column', () => {
	const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');
	const block = css.slice(css.indexOf('.nand-settings {'), css.indexOf('.nand-settings {') + 180);
	assert.equal(block.includes('display: block'), true);
	assert.equal(block.includes('180px'), false);
	assert.equal(css.includes('nand-settings-split'), false);
	assert.equal(css.includes('dashboard-settings-sidenav'), false);
	const source = fs.readFileSync(path.join(process.cwd(), 'src/plugin/settings/settings-tab.ts'), 'utf8');
	assert.equal(source.includes('dashboard-settings-sidenav'), false);
	assert.equal(source.includes('nand-settings-split'), false);
});

test('archive folder setting reserves room for its description', () => {
	const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');
	const info = css.match(/\.setting-item\.nand-contacts-folder-setting > \.setting-item-info \{[^}]+\}/);
	const control = css.match(/\.setting-item\.nand-contacts-folder-setting > \.setting-item-control \{[^}]+\}/);
	assert.ok(info);
	assert.ok(control);
	assert.match(info[0], /min-width:\s*min\(100%,\s*16rem\)/);
	assert.match(control[0], /min-width:\s*auto/);
	assert.match(control[0], /flex:\s*0 0 auto/);
	assert.match(css, /\.setting-item-info \{[^}]*min-width:\s*0/);
	const globalInfo = css.indexOf('.setting-item:not(.dashboard-settings-section) > .setting-item-info { flex: 1; }');
	assert.ok(globalInfo >= 0);
	assert.ok(css.indexOf('.setting-item.nand-contacts-folder-setting > .setting-item-info') > globalInfo);
});

test('archives has independent navigation and respects its module gate', () => {
	assert.deepEqual(sidePages('contacts'), ['contacts-storage']);
	assert.equal(defaultPage('contacts'), 'contacts-storage');
	assert.equal(visibleProducts({ ...ALL_ON, contacts: false }).includes('contacts'), false);
	assert.equal(visibleProducts({ ...ALL_ON, dashboard: false }).includes('contacts'), true);
});
